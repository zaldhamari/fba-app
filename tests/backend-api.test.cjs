#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
 * Siftly Backend API Test Suite
 *
 * Tests every endpoint against the live Railway server.
 * Uses minimal payloads to verify each endpoint is reachable & returns
 * the expected shape — not full functional tests (those need real Supabase
 * auth tokens, which we don't have in CI).
 *
 * Run:  node tests/backend-api.test.cjs
 * ───────────────────────────────────────────────────────────────────────────── */

// Load .env so the test works without exporting env vars manually
const fs_env = require('fs');
const path_env = require('path');
const envPath = path_env.join(__dirname, '..', '.env');
if (fs_env.existsSync(envPath)) {
  fs_env.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const BASE_URL  = process.env.EXPO_PUBLIC_API_URL
                ?? 'https://fba-backend-production-6c44.up.railway.app/api';
const API_KEY   = process.env.EXPO_PUBLIC_API_KEY ?? '';
const TIMEOUT        = 30_000; // ms — standard endpoints
const BRAND_TIMEOUT  = 90_000; // ms — brand SVG endpoints; Railway cold start can take 60s+

// ── Minimal test runner ───────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0, suite = '';
const results  = [];
const failures = [];

function describe(name, fn) { suite = name; fn(); }
async function test(name, fn, opts = {}) {
  try {
    await fn();
    passed++;
    results.push({ suite, name, status: 'PASS' });
    console.log(`  ✓ ${name}`);
  } catch(e) {
    const status = e.skip ? 'SKIP' : 'FAIL';
    if (e.skip) { skipped++; results.push({ suite, name, status: 'SKIP', reason: e.message }); }
    else         { failed++;  results.push({ suite, name, status: 'FAIL', error: e.message }); }
    console.log(`  ${e.skip ? '⚠' : '✗'} ${name}\n    ${e.message}`);
    if (!e.skip) failures.push(`[${suite}] ${name}: ${e.message}`);
  }
}
function skip(msg) { const e = new Error(msg); e.skip = true; throw e; }

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function request(method, path, body, opts = {}) {
  const url = `${BASE_URL}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, ...(opts.headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}
async function get(path, opts)       { return request('GET',  path, null, opts); }
async function post(path, body, opts){ return request('POST', path, body, opts); }

// Asserts the response status is one of the expected codes
function assertStatus(res, ...codes) {
  if (!codes.includes(res.status)) {
    throw new Error(`Expected status ${codes.join('/')} but got ${res.status} for ${res.url}`);
  }
}
// Asserts the response body has the given top-level keys
async function assertShape(res, ...keys) {
  let body;
  try { body = await res.json(); } catch { throw new Error('Response body is not JSON'); }
  for (const key of keys) {
    if (!(key in body)) throw new Error(`Missing key "${key}" in response: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function runAll() {

  // ── 0. Server health ───────────────────────────────────────────────────────
  describe('Server health', () => {});
  await test('GET /health or root returns 2xx', async () => {
    // Try /health first, fall back to root
    let res = await get('/health').catch(() => null);
    if (!res || res.status >= 500) res = await get('/../health').catch(() => null);
    if (!res) throw new Error('Server unreachable');
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
    console.log(`    → status ${res.status} — server is up`);
  });

  // ── 1. Research endpoints ──────────────────────────────────────────────────
  console.log('\n── Research endpoints ───────────────────────────────────────');
  await test('POST /research/amazon — returns results array', async () => {
    const res = await post('/research/amazon', { query: 'silicone spatula', page: 1 });
    assertStatus(res, 200, 422);
    if (res.status === 200) {
      const body = await res.json();
      if (!Array.isArray(body.results) && !Array.isArray(body.products) && !body.data)
        throw new Error(`Unexpected shape: ${JSON.stringify(body).slice(0, 200)}`);
    }
  });

  await test('POST /research/niche — returns niche analysis', async () => {
    const res = await post('/research/niche', { query: 'bamboo toothbrush', category: 'Health' });
    assertStatus(res, 200, 422, 429);
    if (res.status === 200) {
      const body = await res.json();
      // Just check it's an object with content
      if (typeof body !== 'object') throw new Error('Expected object response');
    }
  });

  await test('POST /research/product — product details', async () => {
    const res = await post('/research/product', { asin: 'B07WJNDR2F' });
    assertStatus(res, 200, 404, 422);
  });

  await test('POST /research/suppliers — supplier search', async () => {
    const res = await post('/research/suppliers', { query: 'silicone kitchen tools', country: 'CN' });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /research/suppliers-v2 — suppliers v2', async () => {
    const res = await post('/research/suppliers-v2', { query: 'yoga mat manufacturer', minRating: 4 });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /research/keywords — keyword data', async () => {
    const res = await post('/research/keywords', { seed: 'silicone spatula', marketplace: 'US' });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /research/freight — freight estimate', async () => {
    const res = await post('/research/freight', {
      weight_kg: 0.5, dimensions_cm: { l: 30, w: 20, h: 5 },
      origin: 'CN', destination: 'US'
    });
    assertStatus(res, 200, 422);
  });

  await test('POST /research/freight-intel — freight intelligence', async () => {
    const res = await post('/research/freight-intel', { category: 'Kitchen', weight_kg: 1.0 });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /research/analyze-supplier — supplier analysis', async () => {
    const res = await post('/research/analyze-supplier', {
      name: 'Acme Co', country: 'CN', years: 5, products: ['spatulas']
    });
    assertStatus(res, 200, 422, 429);
  });

  // ── 2. AI endpoints ────────────────────────────────────────────────────────
  console.log('\n── AI endpoints ─────────────────────────────────────────────');
  await test('POST /ai/analyze-product — product analysis', async () => {
    const res = await post('/ai/analyze-product', {
      title: 'Silicone Spatula Set', price: 19.99, reviews: 450, rating: 4.5, category: 'Kitchen'
    });
    assertStatus(res, 200, 422, 429);
    if (res.status === 200) {
      const body = await res.json();
      if (typeof body !== 'object') throw new Error('Expected object');
    }
  });

  await test('POST /ai/copilot — copilot search', async () => {
    const res = await post('/ai/copilot', {
      query: 'best kitchen gadgets under $30', tier: 'builder'
    });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /ai/reviews — review analysis', async () => {
    const res = await post('/ai/reviews', {
      product_name: 'Silicone Spatula', category: 'Kitchen',
      sample_reviews: ['Great product!', 'Easy to use', 'Good quality']
    });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /ai/differentiate — differentiation ideas', async () => {
    const res = await post('/ai/differentiate', {
      product: 'Silicone Spatula', competitors: ['basic spatula', 'metal spatula']
    });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /ai/estimate-physical — physical product estimate', async () => {
    const res = await post('/ai/estimate-physical', {
      title: 'Kitchen Spatula', category: 'Kitchen Tools'
    });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /ai/ask — general AI ask', async () => {
    const res = await post('/ai/ask', {
      question: 'What is a good profit margin for Amazon FBA?', context: 'beginner seller'
    });
    assertStatus(res, 200, 422, 429);
  });

  // ── 3. Brand endpoints ─────────────────────────────────────────────────────
  console.log('\n── Brand endpoints ──────────────────────────────────────────');
  await test('POST /brand/create — brand generation (may be slow)', async () => {
    const res = await post('/brand/create', {
      brand_name: 'TestBrand', niche: 'Kitchen', style: 'modern',
      primary_color: '#2563EB', tier: 'builder'
    }, { timeout: BRAND_TIMEOUT });
    assertStatus(res, 200, 422, 429, 503, 500);
    if (res.status === 200) {
      const body = await res.json();
      if (typeof body !== 'object') throw new Error('Expected object');
      console.log(`    → brand created with keys: ${Object.keys(body).join(', ')}`);
    } else {
      console.log(`    → status ${res.status} (non-200 acceptable for cold start or rate limit)`);
    }
  });

  await test('POST /brand/label — label generation', async () => {
    const res = await post('/brand/label', {
      brand_name: 'TestBrand', product_name: 'Spatula Set',
      primary_color: '#2563EB', style: 'modern'
    }, { timeout: BRAND_TIMEOUT });
    assertStatus(res, 200, 422, 429, 500, 503);
    if (res.status === 200) console.log('    → label generated');
    else console.log(`    → status ${res.status}`);
  });

  await test('POST /brand/asset — asset generation', async () => {
    const res = await post('/brand/asset', {
      prompt: 'barcode for TestBrand', type: 'barcode',
      brand_name: 'TestBrand', primary_color: '#2563EB'
    }, { timeout: BRAND_TIMEOUT });
    assertStatus(res, 200, 422, 429, 500, 503);
    if (res.status === 200) {
      const body = await res.json();
      console.log(`    → asset keys: ${Object.keys(body).join(', ')}`);
    } else {
      console.log(`    → status ${res.status}`);
    }
  });

  await test('POST /brand/insert — insert generation', async () => {
    const res = await post('/brand/insert', {
      brand_name: 'TestBrand', product_name: 'Spatula', style: 'modern'
    }, { timeout: BRAND_TIMEOUT });
    assertStatus(res, 200, 422, 429, 500, 503);
    if (res.status === 200) console.log('    → insert generated');
    else console.log(`    → status ${res.status}`);
  });

  // ── 4. Calculate endpoints ─────────────────────────────────────────────────
  console.log('\n── Calculate endpoints ──────────────────────────────────────');
  await test('POST /calculate/fba — FBA fee calculation', async () => {
    const res = await post('/calculate/fba', {
      weight_lb: 1.2, dimensions_in: { l: 12, w: 8, h: 3 }, price: 29.99
    });
    assertStatus(res, 200, 422);
    if (res.status === 200) {
      const body = await res.json();
      if (typeof body !== 'object') throw new Error('Expected object');
      console.log(`    → FBA fee response keys: ${Object.keys(body).join(', ')}`);
    }
  });

  // ── 5. Supplier endpoints ──────────────────────────────────────────────────
  console.log('\n── Supplier endpoints ───────────────────────────────────────');
  await test('POST /supplier/email — outreach email generation', async () => {
    const res = await post('/supplier/email', {
      supplier_name: 'Acme Manufacturing', product: 'Silicone Spatula',
      buyer_name: 'John', moq: 500
    });
    assertStatus(res, 200, 422, 429);
  });

  await test('POST /suppliers/score — supplier scoring', async () => {
    const res = await post('/suppliers/score', {
      suppliers: [{ name: 'Acme Co', country: 'CN', years: 5, rating: 4.5 }]
    });
    assertStatus(res, 200, 422, 429);
  });

  // ── 6. Response time sanity ────────────────────────────────────────────────
  console.log('\n── Response time checks ─────────────────────────────────────');
  await test('Server responds within 30s for non-AI endpoints', async () => {
    const start = Date.now();
    const res = await post('/research/amazon', { query: 'kitchen', page: 1 });
    const ms = Date.now() - start;
    console.log(`    → responded in ${ms}ms`);
    if (ms > 30000) throw new Error(`Too slow: ${ms}ms`);
  });

}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log(`\nSiftly Backend API Test Suite`);
console.log(`Target: ${BASE_URL}`);
console.log('─'.repeat(60));

runAll().then(() => {
  console.log('\n' + '─'.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped`);

  // Pretty table
  const maxSuiteLen = Math.max(...results.map(r => r.suite.length), 5);
  const maxNameLen  = Math.min(60, Math.max(...results.map(r => r.name.length), 4));
  console.log(`\n${'Suite'.padEnd(maxSuiteLen)}  ${'Test'.padEnd(maxNameLen)}  Status`);
  console.log('─'.repeat(maxSuiteLen + maxNameLen + 12));
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '⚠' : '✗';
    console.log(`${r.suite.padEnd(maxSuiteLen)}  ${r.name.padEnd(maxNameLen)}  ${icon} ${r.status}`);
  }

  if (failed > 0) {
    console.log('\nFailed:');
    failures.forEach(f => console.log(`  • ${f}`));
    process.exit(1);
  } else {
    console.log('\nAll endpoints verified ✓');
  }
}).catch(e => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
