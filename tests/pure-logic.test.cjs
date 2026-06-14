/* ─────────────────────────────────────────────────────────────────────────────
 * Siftly pure-logic test suite
 *
 * Runs the LIVE money-path logic (financial engine, sales estimates, supplier
 * labels, smart search, sourcing) against real inputs and asserts behavior.
 * No React / native deps required.
 *
 * Run:  npm test
 *
 * Implementation note: these modules are TypeScript. Rather than depend on the
 * full Jest + ts-jest toolchain, we transpile the handful of pure modules with
 * the TypeScript compiler that's already a devDependency, then require the
 * emitted CommonJS. Fast (~1s), zero extra install. Hook/component tests can be
 * added later with jest-expo.
 *
 * (The feasibility/risk/launch engines were removed in the 2026-06 dead-code
 * cleanup — see DEAD_CODE_REMOVED.md — so their tests are gone too.)
 * ───────────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'siftly-test-'));

const MODULES = [
  'theme/ds.ts',
  'data/sourcingPlatforms.ts',
  'lib/financialConstants.ts',
  'lib/financialEngine.ts',
  'lib/smartSearch.ts',
  'lib/sourcingStrategy.ts',
];

for (const rel of MODULES) {
  const code = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const out = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
    fileName: rel,
  }).outputText;
  const dest = path.join(OUT, 'src', rel.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
}
const L = (m) => require(path.join(OUT, 'src', 'lib', m + '.js'));
const fe = L('financialEngine');
const ss = L('smartSearch');
const so = L('sourcingStrategy');

// ── tiny test framework ───────────────────────────────────────────────────────
let pass = 0, fail = 0; const failures = []; let suite = '';
function describe(name, fn) { suite = name; fn(); }
function test(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; failures.push(`${suite} › ${name}: ${e.message}`); }
}
function expect(a) {
  return {
    toBe: (e) => { if (a !== e) throw new Error(`expected ${JSON.stringify(a)} to be ${JSON.stringify(e)}`); },
    toEqual: (e) => { if (JSON.stringify(a) !== JSON.stringify(e)) throw new Error(`expected ${JSON.stringify(a)} to equal ${JSON.stringify(e)}`); },
    toBeCloseTo: (e, eps = 0.5) => { if (Math.abs(a - e) > eps) throw new Error(`expected ${a} ≈ ${e}`); },
    toBe_true: () => { if (a !== true) throw new Error(`expected true, got ${JSON.stringify(a)}`); },
    toBeGreaterThan: (e) => { if (!(a > e)) throw new Error(`expected ${a} > ${e}`); },
    toBeOneOf: (arr) => { if (!arr.includes(a)) throw new Error(`expected ${JSON.stringify(a)} to be one of ${JSON.stringify(arr)}`); },
  };
}

// ── financialEngine — rough estimates ─────────────────────────────────────────
describe('financialEngine — rough estimates', () => {
  test('roughMarginPct matches formula', () => expect(fe.roughMarginPct(30, 8)).toBeCloseTo(((30 * 0.7 - 8) / 30) * 100));
  test('roughMarginPct guards sellingPrice<=0', () => expect(fe.roughMarginPct(0, 8)).toBe(0));
  test('roughROIPct matches formula', () => expect(fe.roughROIPct(30, 8)).toBeCloseTo(((30 * 0.7 - 8) / 8) * 100));
  test('roughROIPct guards unitCost<=0', () => expect(fe.roughROIPct(30, 0)).toBe(0));
  test('roughLandedCost applies freight multiplier', () => expect(fe.roughLandedCost(10)).toBeCloseTo(13.5));
});

describe('financialEngine — confirmed calcs', () => {
  test('confirmedLandedCost adds freight', () => expect(fe.confirmedLandedCost(8, 2)).toBe(10));
  test('netProfitPerUnit ($30, uc8, fr2) = 11', () => expect(fe.netProfitPerUnit(30, 8, 2)).toBeCloseTo(11));
  test('confirmedMarginPct', () => expect(fe.confirmedMarginPct(30, 8, 2)).toBeCloseTo((11 / 30) * 100));
  test('confirmedROIPct', () => expect(fe.confirmedROIPct(30, 8, 2)).toBeCloseTo(110));
  test('confirmedMarginPct guards sp<=0', () => expect(fe.confirmedMarginPct(0, 8, 2)).toBe(0));
  test('buildCostModel netProfit + totalInvestment', () => {
    const cm = fe.buildCostModel(30, 8, 2, 100, 1);
    expect(cm.netProfit).toBeCloseTo(11);
    expect(cm.totalInvestment).toBe(1100);
  });
  test('buildCostModel.marginPct is a PERCENTAGE (regression guard for the 0.55 bug)', () => {
    // The decision hooks classify risk with thresholds of 55/35 — confirm the
    // value they read is on the 0–100 scale, not 0–1.
    const cm = fe.buildCostModel(30, 8, 2, 100, 1);
    expect(cm.marginPct > 1).toBe(true); // ~36.7, not ~0.37
  });
});

describe('financialEngine — validation & staleness', () => {
  test('valid inputs pass', () => expect(fe.validateFinancialInputs(20, 5, 1, 100).valid).toBe(true));
  test('negative price fails', () => expect(fe.validateFinancialInputs(-1, 5, 1).valid).toBe(false));
  test('zero cost fails', () => expect(fe.validateFinancialInputs(20, 0, 1).valid).toBe(false));
  test('negative freight fails', () => expect(fe.validateFinancialInputs(20, 5, -1).valid).toBe(false));
  test('NaN price fails', () => expect(fe.validateFinancialInputs(NaN, 5, 1).valid).toBe(false));
  test('zero MOQ fails', () => expect(fe.validateFinancialInputs(20, 5, 1, 0).valid).toBe(false));
  test('isDataStale: undefined → false', () => expect(fe.isDataStale(undefined)).toBe(false));
  test('isDataStale: 20d old → true', () => expect(fe.isDataStale(new Date(Date.now() - 20 * 864e5).toISOString(), 14)).toBe(true));
  test('isDataStale: fresh → false', () => expect(fe.isDataStale(new Date().toISOString(), 14)).toBe(false));
});

describe('financialEngine — sales & fees', () => {
  test('monthlySalesEst rounds revenue/price', () => expect(fe.monthlySalesEst(3000, 30)).toBe(100));
  test('monthlySalesEst null guards', () => { expect(fe.monthlySalesEst(null, 30)).toBe(null); expect(fe.monthlySalesEst(3000, 0)).toBe(null); });
  test('estimateMonthlySales: low<=mid<=high, daily>=1', () => {
    const e = fe.estimateMonthlySales(120, 'Low', 25);
    expect(e.low <= e.mid && e.mid <= e.high).toBe(true);
    expect(e.dailyLow >= 1 && e.dailyHigh >= 1).toBe(true);
  });
  test('estimateMonthlySales: confidence Medium at 120 reviews', () => expect(fe.estimateMonthlySales(120, 'Low', 25).confidence).toBe('Medium'));
  test('estimateMonthlySales: confidence Low at 10 reviews', () => expect(fe.estimateMonthlySales(10, 'High', 70).confidence).toBe('Low'));
  test('estimatePPCPressure: high by reviews', () => expect(fe.estimatePPCPressure(600, 'Low')).toBe('High'));
  test('estimatePPCPressure: high by competition', () => expect(fe.estimatePPCPressure(10, 'High')).toBe('High'));
  test('estimatePPCPressure: medium / low', () => { expect(fe.estimatePPCPressure(200, 'Low')).toBe('Medium'); expect(fe.estimatePPCPressure(10, 'Low')).toBe('Low'); });
  test('estimateFBAFee tiers', () => { expect(fe.estimateFBAFee(10)).toBe(3.5); expect(fe.estimateFBAFee(30)).toBe(5.5); expect(fe.estimateFBAFee(100)).toBe(10); });
});

describe('financialEngine — canonical FBA fulfillment fee', () => {
  test('weight tiers (kg→lb schedule)', () => {
    expect(fe.fbaFulfillmentFee(0.2)).toBe(3.22);   // ~0.44 lb
    expect(fe.fbaFulfillmentFee(0.4)).toBe(4.18);   // ~0.88 lb
    expect(fe.fbaFulfillmentFee(0.8)).toBe(5.09);   // ~1.76 lb
    expect(fe.fbaFulfillmentFee(5)).toBeGreaterThan(6); // heavy → above base tier
  });
  test('negative weight is clamped to lightest tier', () => expect(fe.fbaFulfillmentFee(-1)).toBe(3.22));
  test('cost model: weight-based fee differs from 15% proxy for a heavy item', () => {
    const proxy  = fe.buildCostModel(30, 8, 2, 100, 0);        // no weight → 15% of $30 = $4.50
    const weighed = fe.buildCostModel(30, 8, 2, 100, 0, 4);    // 4kg ≈ 8.8 lb → weight fee
    expect(proxy.fbaFee).toBeCloseTo(4.5);
    expect(weighed.fbaFee !== proxy.fbaFee).toBe(true);
  });
  test('cost model without weight preserves prior behavior (15% proxy)', () =>
    expect(fe.buildCostModel(30, 8, 2, 100, 0).fbaFee).toBeCloseTo(30 * 0.15));
});

describe('financialEngine — startup capital', () => {
  test('breaks down inventory + freight', () => {
    const sc = fe.estimateStartupCapital(8, 500, 2, 30);
    expect(sc.inventoryCost).toBe(4000);
    expect(sc.freightCost).toBe(1000);
    expect(sc.total).toBeGreaterThan(sc.inventoryCost + sc.freightCost);
  });
  test('invalid inputs → zero total + note', () => {
    const sc = fe.estimateStartupCapital(0, 500, 2, 30);
    expect(sc.total).toBe(0);
    expect(!!sc.note).toBe(true);
  });
});

describe('financialEngine — assignSupplierLabels (regression: M1 fix)', () => {
  const sup = [
    { unitCost: 5, moq: 1000, leadTimeDays: 40 },
    { unitCost: 9, moq: 300, leadTimeDays: 20 },
    { unitCost: 7, moq: 500, leadTimeDays: 60 },
  ];
  test('returns one label per supplier', () => expect(fe.assignSupplierLabels(sup, 30).length).toBe(3));
  test('empty input → []', () => expect(fe.assignSupplierLabels([], 30)).toEqual([]));
  test('cheapest supplier is Best Margin', () => expect(fe.assignSupplierLabels(sup, 30)[0]).toBe('Best Margin'));
  test('Budget Friendly is reachable (not dead code)', () => {
    let sawBudget = false;
    for (let i = 0; i < 200 && !sawBudget; i++) {
      const arr = Array.from({ length: 3 + (i % 2) }, () => ({
        unitCost: 1 + Math.random() * 20, moq: 100 + ((Math.random() * 900) | 0), leadTimeDays: 10 + ((Math.random() * 60) | 0),
      }));
      if (fe.assignSupplierLabels(arr, 30 + Math.random() * 20).includes('Budget Friendly')) sawBudget = true;
    }
    expect(sawBudget).toBe(true);
  });
});

// ── smartSearch ───────────────────────────────────────────────────────────────
describe('smartSearch', () => {
  test('expandProductKeywords returns a non-empty array', () => {
    const kw = ss.expandProductKeywords('garlic press');
    expect(Array.isArray(kw)).toBe(true);
    expect(kw.length).toBeGreaterThan(0);
  });
  test('deduplicateProducts removes duplicate ASIN', () => {
    const r = ss.deduplicateProducts([
      { asin: 'B000000001', title: 'Garlic Press Stainless' },
      { asin: 'B000000001', title: 'Garlic Press Stainless' },
      { asin: 'B000000002', title: 'Lemon Squeezer' },
    ]);
    expect(r.results.length).toBe(2);
    expect(r.removed).toBe(1);
  });
});

// ── sourcingStrategy (smoke) ──────────────────────────────────────────────────
describe('sourcingStrategy (smoke)', () => {
  test('computeFreightSensitivity runs', () => {
    if (typeof so.computeFreightSensitivity === 'function') {
      const r = so.computeFreightSensitivity(30, 8, 2);
      expect(r !== undefined && r !== null).toBe(true);
    }
  });
});

// ── report ────────────────────────────────────────────────────────────────────
console.log(`\n  Pure-logic suite: ${pass} passed, ${fail} failed (${pass + fail} total)\n`);
if (failures.length) { console.log('  Failures:'); failures.forEach(f => console.log('   ✗ ' + f)); console.log(); }
try { fs.rmSync(OUT, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
