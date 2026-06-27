/**
 * FBA Decision Report — Full HTML Report Generator
 *
 * Pulls every piece of pipeline data and renders a beautiful, self-contained
 * HTML file the user can share, open in a browser, and print to PDF.
 *
 * Covers: Market Research · Product Analysis · Competitor Intelligence ·
 *         Full Financial Model · Supplier Profile · Sales Projections ·
 *         Brand Identity · Launch Readiness Score · Risk Assessment ·
 *         90-Day Action Plan
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type {
  PipelineNiche,
  PipelineProduct,
  PipelineSupplier,
  PipelineCostModel,
  PipelineBrandData,
  PipelineReconInsights,
} from '../context/PipelineContext';

import {
  estimateMonthlySales,
  estimatePPCPressure,
  estimateStartupCapital,
  roughMarginPct,
} from '../lib/financialEngine';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ReportInput {
  niche:    PipelineNiche    | null;
  product:  PipelineProduct  | null;
  supplier: PipelineSupplier | null;
  cost:     PipelineCostModel | null;
  brand:    PipelineBrandData | null;
  recon:    PipelineReconInsights | null;
  verdict:  'LAUNCH' | 'TEST SMALL' | 'HOLD' | 'AVOID';
  score:    number;
  strengths: string[];
  risks:     string[];
  actions:   string[];
  improvements: string[];
  factors:   { label: string; pts: number; max: number; note?: string }[];
  stages:    { niche: boolean; product: boolean; supplier: boolean; cost: boolean; brand: boolean; recon: boolean };
}

/** Generate the HTML report, write it to the Expo cache dir, and share it. */
export async function generateAndShareReport(input: ReportInput): Promise<void> {
  const html  = buildReportHTML(input);
  const fname = `fba-decision-report-${Date.now()}.html`;
  const uri   = (FileSystem.cacheDirectory ?? '') + fname;

  await FileSystem.writeAsStringAsync(uri, html, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(uri, {
    mimeType:    'text/html',
    dialogTitle: 'FBA Decision Report',
    UTI:         'public.html',
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUSD(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return '$' + fmt(n, decimals);
}
function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—';
  return fmt(n, decimals) + '%';
}
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function badge(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;background:${bg};color:${color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:0.5px">${esc(text)}</span>`;
}
function chip(text: string): string {
  return `<span style="display:inline-block;background:#f0f4ff;color:#4A6FA5;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;margin:2px">${esc(text)}</span>`;
}
function bullet(items: string[], color = '#4A6FA5'): string {
  if (!items || items.length === 0) return '<p style="color:#94a3b8;font-size:13px">No data</p>';
  return items.map(i =>
    `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:7px">
      <span style="color:${color};font-size:14px;margin-top:1px;flex-shrink:0">✦</span>
      <span style="font-size:13px;color:#1e293b;line-height:1.55">${esc(i)}</span>
    </div>`
  ).join('');
}
function row(label: string, value: string, highlight = false): string {
  return `<tr style="border-bottom:1px solid #e2e8f0;${highlight ? 'background:#f8faff' : ''}">
    <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#64748b;white-space:nowrap">${esc(label)}</td>
    <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#1e293b;text-align:right">${value}</td>
  </tr>`;
}
function sectionHeader(icon: string, title: string, subtitle = ''): string {
  return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    <div style="width:40px;height:40px;border-radius:12px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${icon}</div>
    <div>
      <div style="font-size:10px;font-weight:800;color:#3b82f6;letter-spacing:2px;text-transform:uppercase">${subtitle || 'ANALYSIS'}</div>
      <div style="font-size:18px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">${esc(title)}</div>
    </div>
  </div>`;
}
function card(content: string, accent = false): string {
  const border = accent ? '#3b82f6' : '#e2e8f0';
  const shadow = accent ? '0 4px 24px rgba(59,130,246,0.10)' : '0 2px 8px rgba(0,0,0,0.04)';
  return `<div style="background:#fff;border-radius:16px;border:1.5px solid ${border};box-shadow:${shadow};padding:24px;margin-bottom:20px">${content}</div>`;
}
function progressBar(pct: number, color: string, height = 6): string {
  const clamped = Math.min(100, Math.max(0, pct));
  return `<div style="background:#f1f5f9;border-radius:${height}px;height:${height}px;overflow:hidden">
    <div style="width:${clamped}%;height:${height}px;background:${color};border-radius:${height}px;transition:width 0.3s"></div>
  </div>`;
}

// ─── Verdict config ───────────────────────────────────────────────────────────

function verdictCfg(v: ReportInput['verdict']): { color: string; bg: string; icon: string; tagline: string } {
  switch (v) {
    case 'LAUNCH':     return { color: '#059669', bg: '#ecfdf5', icon: '🚀', tagline: 'Strong fundamentals — proceed with confidence' };
    case 'TEST SMALL': return { color: '#d97706', bg: '#fffbeb', icon: '🧪', tagline: 'Viable but validate one factor before full commit' };
    case 'HOLD':       return { color: '#6366f1', bg: '#eef2ff', icon: '⏸', tagline: 'Information gaps — gather more data before deciding' };
    case 'AVOID':      return { color: '#dc2626', bg: '#fef2f2', icon: '⛔', tagline: 'Dealbreaker risk present — pivot or reconsider' };
  }
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildCover(input: ReportInput): string {
  const vc     = verdictCfg(input.verdict);
  const prod   = input.product;
  const date   = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const name   = prod?.title || input.brand?.productTitle || input.niche?.keyword || 'FBA Product';

  return `
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);border-radius:20px;padding:40px;color:#fff;margin-bottom:20px;position:relative;overflow:hidden">
    <div style="position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(59,130,246,0.15)"></div>
    <div style="position:absolute;bottom:-40px;left:-40px;width:140px;height:140px;border-radius:50%;background:rgba(99,102,241,0.12)"></div>
    <div style="position:relative">
      <div style="font-size:10px;font-weight:800;color:#93c5fd;letter-spacing:3px;margin-bottom:8px">FBA DECISION REPORT</div>
      <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.8px;line-height:1.2;margin-bottom:6px">${esc(name)}</div>
      ${input.brand?.brandName ? `<div style="font-size:14px;color:#94a3b8;margin-bottom:20px">by ${esc(input.brand.brandName)}${input.brand.tagline ? ` · "${esc(input.brand.tagline)}"` : ''}</div>` : '<div style="margin-bottom:20px"></div>'}
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="background:${vc.bg};border:2px solid ${vc.color}40;border-radius:14px;padding:12px 20px;display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">${vc.icon}</span>
          <div>
            <div style="font-size:11px;font-weight:800;color:${vc.color};letter-spacing:1px">VERDICT</div>
            <div style="font-size:20px;font-weight:900;color:${vc.color}">${esc(input.verdict)}</div>
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.08);border-radius:14px;padding:12px 20px;text-align:center">
          <div style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:1px">READINESS SCORE</div>
          <div style="font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px">${fmt(input.score)}<span style="font-size:18px">/100</span></div>
        </div>
        ${input.niche ? `<div style="background:rgba(255,255,255,0.08);border-radius:14px;padding:12px 20px">
          <div style="font-size:11px;font-weight:800;color:#94a3b8;letter-spacing:1px">NICHE</div>
          <div style="font-size:15px;font-weight:800;color:#fff">${esc(input.niche.keyword)}</div>
          <div style="font-size:11px;color:#64748b">${esc(input.niche.marketplace)} · ${esc(input.niche.verdictLabel)}</div>
        </div>` : ''}
      </div>
      <div style="margin-top:16px;font-size:13px;color:#94a3b8;font-style:italic">${esc(vc.tagline)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:20px">
        ${Object.entries(input.stages).map(([k, v]) =>
          `<div style="background:${v ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)'};border:1px solid ${v ? '#10b981' : 'rgba(255,255,255,0.12)'};border-radius:20px;padding:4px 12px;font-size:10px;font-weight:700;color:${v ? '#6ee7b7' : '#64748b'}">${v ? '✓' : '○'} ${k.toUpperCase()}</div>`
        ).join('')}
      </div>
      <div style="margin-top:16px;font-size:11px;color:#475569">Generated ${date}</div>
    </div>
  </div>`;
}

function buildExecutiveSummary(input: ReportInput): string {
  const vc   = verdictCfg(input.verdict);
  const prod = input.product;
  const cost = input.cost;
  const margin = cost?.marginPct ?? (prod?.price && input.supplier?.unitCost ? roughMarginPct(prod.price, input.supplier.unitCost) : null);
  const roi    = cost?.roiPct ?? null;
  const topStrengths = input.strengths.slice(0, 3);
  const topRisks     = input.risks.slice(0, 3);

  return card(`
    ${sectionHeader('⚡', 'Executive Summary', 'OVERVIEW')}
    <div style="background:${vc.bg};border:1.5px solid ${vc.color}33;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="font-size:13px;color:${vc.color};font-weight:700;line-height:1.55">${vc.icon} ${esc(vc.tagline)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      ${[
        { label: 'Selling Price', val: fmtUSD(prod?.price) },
        { label: 'Net Margin', val: fmtPct(margin), hl: margin != null && margin >= 30 },
        { label: 'ROI', val: fmtPct(roi), hl: roi != null && roi >= 50 },
        { label: 'Unit Cost', val: fmtUSD(input.supplier?.unitCost) },
        { label: 'Total Investment', val: fmtUSD(cost?.totalInvestment) },
        { label: 'Readiness', val: fmt(input.score) + '/100' },
      ].map(({ label, val, hl }) =>
        `<div style="background:${(hl ?? false) ? '#ecfdf5' : '#f8faff'};border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.5px;text-transform:uppercase">${esc(label)}</div>
          <div style="font-size:18px;font-weight:900;color:${(hl ?? false) ? '#059669' : '#0f172a'};margin-top:4px">${val}</div>
        </div>`
      ).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:10px;font-weight:800;color:#059669;letter-spacing:2px;margin-bottom:8px">STRENGTHS</div>
        ${bullet(topStrengths, '#059669')}
      </div>
      <div>
        <div style="font-size:10px;font-weight:800;color:#dc2626;letter-spacing:2px;margin-bottom:8px">RISKS</div>
        ${bullet(topRisks, '#dc2626')}
      </div>
    </div>
  `, true);
}

function buildProductAnalysis(input: ReportInput): string {
  const prod = input.product;
  if (!prod) return '';
  const comp      = prod.competition ?? 'Unknown';
  const compColor = comp === 'Low' ? '#059669' : comp === 'High' ? '#dc2626' : '#d97706';
  const ppc       = prod.ppcPressure ?? '—';
  const ppcColor  = ppc === 'Low' ? '#059669' : ppc === 'High' ? '#dc2626' : '#d97706';
  const salesEst  = prod.reviews && prod.price
    ? estimateMonthlySales(prod.reviews, comp as any, prod.price) : null;
  const revLow  = prod.revenueEstLow  ?? salesEst?.revenueEstLow;
  const revHigh = prod.revenueEstHigh ?? salesEst?.revenueEstHigh;

  return card(`
    ${sectionHeader('📦', 'Product Analysis', 'PRODUCT')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      ${row('Product Title', esc(prod.title), true)}
      ${prod.asin ? row('ASIN', esc(prod.asin)) : ''}
      ${row('Selling Price', fmtUSD(prod.price), true)}
      ${row('Customer Rating', prod.rating != null ? `${prod.rating.toFixed(1)} ★` : '—')}
      ${row('Review Count', prod.reviews ? fmt(prod.reviews) + ' reviews' : '—', true)}
      ${row('Competition Level', `<span style="color:${compColor};font-weight:800">${esc(comp)}</span>`)}
      ${row('PPC Pressure', `<span style="color:${ppcColor};font-weight:800">${esc(ppc)}</span>`, true)}
      ${revLow || revHigh ? row('Est. Monthly Revenue', `${fmtUSD(revLow)} – ${fmtUSD(revHigh)}`) : ''}
      ${salesEst ? row('Est. Monthly Sales', salesEst.monthlyLabel ?? '—', true) : ''}
      ${salesEst ? row('Est. Daily Sales', salesEst.dailyLabel ?? '—') : ''}
      ${prod.url ? row('Amazon Link', `<a href="${esc(prod.url)}" style="color:#3b82f6;font-size:11px">↗ View on Amazon</a>`, true) : ''}
    </table>
    ${prod.salesConfidence ? `<div style="margin-top:8px;font-size:11px;color:#94a3b8;font-style:italic">Sales estimates use a review-velocity model (${esc(prod.salesConfidence)} confidence). Not live BSR data.</div>` : ''}
  `);
}

function buildMarketIntelligence(input: ReportInput): string {
  const niche = input.niche;
  if (!niche) return '';
  const scoreColor = niche.score >= 4 ? '#059669' : niche.score >= 2 ? '#d97706' : '#dc2626';
  return card(`
    ${sectionHeader('🔍', 'Market Intelligence', 'NICHE')}
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      ${row('Keyword', esc(niche.keyword), true)}
      ${row('Marketplace', esc(niche.marketplace))}
      ${row('Niche Verdict', esc(niche.verdictLabel), true)}
      ${row('Opportunity Score', `<span style="color:${scoreColor};font-weight:900">${niche.score}/5</span>`)}
    </table>
  `);
}

function buildCompetitorIntelligence(input: ReportInput): string {
  const recon = input.recon;
  if (!recon) return '';
  const sections: { title: string; icon: string; items: string[]; color: string }[] = [];
  if (recon.complaints?.length)            sections.push({ title: 'Customer Complaints',      icon: '⚠', items: recon.complaints,            color: '#dc2626' });
  if (recon.opportunities?.length)         sections.push({ title: 'Market Opportunities',     icon: '✦', items: recon.opportunities,          color: '#059669' });
  if (recon.improvementSpecs?.length)      sections.push({ title: 'Product Improvement Specs',icon: '⬡', items: recon.improvementSpecs,       color: '#3b82f6' });
  if (recon.differentiationAngles?.length) sections.push({ title: 'Differentiation Angles',   icon: '◎', items: recon.differentiationAngles!, color: '#6366f1' });
  if (recon.bundleIdeas?.length)           sections.push({ title: 'Bundle Ideas',              icon: '🎁', items: recon.bundleIdeas!,          color: '#d97706' });
  if (recon.positioningAngles?.length)     sections.push({ title: 'Positioning Angles',        icon: '≋', items: recon.positioningAngles,     color: '#0891b2' });
  if (recon.qualityRisks?.length)          sections.push({ title: 'Quality Risks',             icon: '🔴', items: recon.qualityRisks,          color: '#dc2626' });
  if (sections.length === 0) return '';

  return card(`
    ${sectionHeader('🕵️', 'Competitor Intelligence', 'RECON')}
    ${recon.listingAngle ? `<div style="background:#f8faff;border-radius:10px;padding:14px;margin-bottom:16px;border-left:3px solid #3b82f6">
      <div style="font-size:10px;font-weight:800;color:#3b82f6;letter-spacing:1px;margin-bottom:4px">LISTING ANGLE</div>
      <div style="font-size:13px;color:#1e293b;font-weight:600">"${esc(recon.listingAngle)}"</div>
    </div>` : ''}
    ${recon.pricePositioning ? `<div style="background:#fff7ed;border-radius:10px;padding:14px;margin-bottom:16px;border-left:3px solid #d97706">
      <div style="font-size:10px;font-weight:800;color:#d97706;letter-spacing:1px;margin-bottom:4px">PRICE POSITIONING</div>
      <div style="font-size:13px;color:#1e293b;font-weight:600">"${esc(recon.pricePositioning)}"</div>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${sections.map(s => `
        <div>
          <div style="font-size:10px;font-weight:800;color:${s.color};letter-spacing:1.5px;margin-bottom:8px">${s.icon} ${esc(s.title).toUpperCase()}</div>
          ${bullet(s.items, s.color)}
        </div>
      `).join('')}
    </div>
  `);
}

function buildFinancialModel(input: ReportInput): string {
  const cost = input.cost;
  const prod = input.product;
  const sup  = input.supplier;
  if (!cost && !prod && !sup) return '';
  const marginColor = (m: number | null) => m == null ? '#64748b' : m >= 30 ? '#059669' : m >= 20 ? '#d97706' : '#dc2626';
  const roiColor    = (r: number | null) => r == null ? '#64748b' : r >= 80 ? '#059669' : r >= 40 ? '#d97706' : '#dc2626';
  const mc = cost?.marginPct ?? null;
  const rc = cost?.roiPct ?? null;
  const breakEven = cost && cost.netProfit > 0 && cost.totalInvestment
    ? Math.ceil(cost.totalInvestment / cost.netProfit) : null;
  const startup = prod?.price && sup?.unitCost
    ? estimateStartupCapital(sup.unitCost, sup.moq ?? 100, prod.price) : null;

  return card(`
    ${sectionHeader('💰', 'Financial Model', 'UNIT ECONOMICS')}
    <div style="overflow:auto;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8faff">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:800;color:#64748b;letter-spacing:1px">COST ITEM</th>
            <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:800;color:#64748b;letter-spacing:1px">PER UNIT</th>
          </tr>
        </thead>
        <tbody>
          ${row('Unit Cost (COGS)', fmtUSD(cost?.unitCost ?? sup?.unitCost, 2))}
          ${row('Freight & Duties', fmtUSD(cost?.freight, 2), true)}
          ${cost?.packaging ? row('Packaging', fmtUSD(cost.packaging, 2)) : ''}
          ${row('FBA Fulfillment Fee', fmtUSD(cost?.fbaFee, 2), true)}
          ${row('Amazon Referral Fee (15%)', fmtUSD(cost?.referralFee, 2))}
          ${cost?.duties ? row('Customs / Duties', fmtUSD(cost.duties, 2), true) : ''}
          <tr style="background:#f0f9ff;border-top:2px solid #3b82f6">
            <td style="padding:12px 14px;font-size:13px;font-weight:800;color:#0f172a">Total Cost per Unit</td>
            <td style="padding:12px 14px;font-size:14px;font-weight:900;color:#dc2626;text-align:right">${fmtUSD(cost?.totalCost, 2)}</td>
          </tr>
          <tr style="background:#f0fdf4">
            <td style="padding:12px 14px;font-size:13px;font-weight:800;color:#0f172a">Selling Price</td>
            <td style="padding:12px 14px;font-size:14px;font-weight:900;color:#0f172a;text-align:right">${fmtUSD(cost?.sellingPrice ?? prod?.price, 2)}</td>
          </tr>
          <tr style="background:#ecfdf5;border-top:2px solid #059669">
            <td style="padding:14px 14px;font-size:14px;font-weight:900;color:#0f172a">Net Profit per Unit</td>
            <td style="padding:14px 14px;font-size:18px;font-weight:900;color:${marginColor(mc)};text-align:right">${fmtUSD(cost?.netProfit, 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${[
        { label: 'Net Margin',       val: fmtPct(mc),                  color: marginColor(mc) },
        { label: 'ROI',              val: fmtPct(rc),                  color: roiColor(rc) },
        { label: 'Units Ordered',    val: fmt(cost?.unitsOrdered),     color: '#0f172a' },
        { label: 'Break-even Units', val: breakEven ? fmt(breakEven) + ' units' : '—', color: '#0f172a' },
      ].map(m =>
        `<div style="background:#f8faff;border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.5px">${esc(m.label)}</div>
          <div style="font-size:17px;font-weight:900;color:${m.color};margin-top:4px">${m.val}</div>
        </div>`
      ).join('')}
    </div>
    <div style="background:#f8faff;border-radius:12px;padding:16px">
      <div style="font-size:10px;font-weight:800;color:#3b82f6;letter-spacing:2px;margin-bottom:12px">INVESTMENT SUMMARY</div>
      <table style="width:100%;border-collapse:collapse">
        ${row('Total Stock Investment', fmtUSD(cost?.totalInvestment))}
        ${startup ? row('Est. Startup Capital (all-in)', fmtUSD(startup.total), true) : ''}
        ${startup ? row('  — PPC Launch Budget', fmtUSD(startup.ppc)) : ''}
        ${startup ? row('  — Photography & Assets', fmtUSD(startup.photography), true) : ''}
        ${startup ? row('  — Misc / Contingency', fmtUSD(startup.misc)) : ''}
      </table>
    </div>
  `);
}

function buildSupplierProfile(input: ReportInput): string {
  const sup = input.supplier;
  if (!sup) return '';
  const gradeColor: Record<string, string> = { A: '#059669', B: '#3b82f6', C: '#d97706', D: '#dc2626' };
  const gColor = gradeColor[sup.grade ?? ''] ?? '#64748b';

  return card(`
    ${sectionHeader('🏭', 'Supplier Profile', 'SOURCING')}
    <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:16px">
      <div style="background:#eff6ff;border-radius:14px;padding:16px;min-width:120px;text-align:center">
        <div style="font-size:36px">${sup.country ?? '🏭'}</div>
        ${sup.grade ? `<div style="font-size:24px;font-weight:900;color:${gColor};margin-top:4px">${esc(sup.grade)}</div>` : ''}
        ${sup.score ? `<div style="font-size:11px;color:#64748b">Score ${sup.score.toFixed(1)}/10</div>` : ''}
      </div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:900;color:#0f172a;margin-bottom:4px">${esc(sup.name)}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:12px">${esc(sup.platform)}</div>
        ${sup.recommendation ? `<div style="display:inline-block;background:#eff6ff;color:#3b82f6;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:800">⭐ ${esc(sup.recommendation)}</div>` : ''}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      ${row('Unit Cost', fmtUSD(sup.unitCost, 2), true)}
      ${row('Minimum Order Quantity', fmt(sup.moq) + ' units')}
      ${row('Total Order Cost', fmtUSD(sup.unitCost * (sup.moq ?? 1), 0), true)}
      ${sup.leadTimeDays ? row('Lead Time', sup.leadTimeDays + ' days') : ''}
      ${sup.shippingType ? row('Shipping Method', sup.shippingType.toUpperCase(), true) : ''}
      ${sup.estimatedLandedCost ? row('Est. Landed Cost/Unit', fmtUSD(sup.estimatedLandedCost, 2)) : ''}
      ${sup.estimatedROIPct ? row('Est. ROI at This Supplier', fmtPct(sup.estimatedROIPct, 1), true) : ''}
      ${sup.url ? row('Supplier Link', `<a href="${esc(sup.url)}" style="color:#3b82f6;font-size:11px">↗ View Supplier</a>`) : ''}
    </table>
    ${sup.notes ? `<div style="margin-top:14px;background:#fff7ed;border-radius:10px;padding:12px;font-size:12px;color:#92400e"><strong>Notes:</strong> ${esc(sup.notes)}</div>` : ''}
  `);
}

function buildBrandIdentity(input: ReportInput): string {
  const brand = input.brand;
  if (!brand) return '';
  return card(`
    ${sectionHeader('✦', 'Brand Identity', 'BRAND')}
    <div style="background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:14px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:#0f172a;letter-spacing:-1px">${esc(brand.brandName)}</div>
      ${brand.tagline ? `<div style="font-size:14px;color:#64748b;font-style:italic;margin-top:4px">"${esc(brand.tagline)}"</div>` : ''}
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${brand.personality  ? chip(brand.personality)  : ''}
        ${brand.style        ? chip(brand.style)        : ''}
        ${brand.colorPalette ? chip(brand.colorPalette) : ''}
        ${brand.fontStyle    ? chip(brand.fontStyle)    : ''}
      </div>
    </div>
    ${brand.listingTitle ? `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:800;color:#3b82f6;letter-spacing:2px;margin-bottom:6px">LISTING TITLE</div>
      <div style="background:#f8faff;border-radius:10px;padding:12px;font-size:13px;font-weight:600;color:#0f172a;line-height:1.5">${esc(brand.listingTitle)}</div>
    </div>` : ''}
    ${brand.listingBullets?.length ? `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:800;color:#3b82f6;letter-spacing:2px;margin-bottom:8px">LISTING BULLETS</div>
      ${brand.listingBullets.map((b, i) =>
        `<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f1f5f9">
          <div style="width:20px;height:20px;border-radius:50%;background:#eff6ff;color:#3b82f6;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
          <div style="font-size:12px;color:#1e293b;line-height:1.55">${esc(b)}</div>
        </div>`
      ).join('')}
    </div>` : ''}
    ${brand.backendKeywords?.length ? `
    <div>
      <div style="font-size:10px;font-weight:800;color:#3b82f6;letter-spacing:2px;margin-bottom:8px">BACKEND KEYWORDS</div>
      <div style="background:#f8faff;border-radius:10px;padding:12px;font-size:12px;color:#475569;line-height:1.6">${esc(brand.backendKeywords.join(' · '))}</div>
    </div>` : ''}
  `);
}

function buildReadinessScore(input: ReportInput): string {
  const barColor = (pts: number, max: number) => {
    const pct = max > 0 ? pts / max : 0;
    if (pct >= 0.8) return '#059669';
    if (pct >= 0.5) return '#d97706';
    return '#dc2626';
  };
  return card(`
    ${sectionHeader('◎', 'Launch Readiness Score', 'SCORING')}
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:64px;font-weight:900;color:#0f172a;letter-spacing:-3px;line-height:1">${fmt(input.score)}</div>
      <div style="font-size:13px;color:#64748b;margin-top:4px">out of 100 points</div>
      <div style="width:240px;margin:12px auto 0">${progressBar(input.score, input.score >= 80 ? '#059669' : input.score >= 60 ? '#d97706' : '#dc2626', 10)}</div>
      <div style="margin-top:8px">${badge(input.verdict, verdictCfg(input.verdict).color, verdictCfg(input.verdict).bg)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${input.factors.map(f => {
        const pct = f.max > 0 ? (f.pts / f.max) * 100 : 0;
        const col = barColor(f.pts, f.max);
        return `<div style="background:#f8faff;border-radius:10px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-size:11px;font-weight:700;color:#1e293b">${esc(f.label)}</div>
            <div style="font-size:11px;font-weight:900;color:${col}">${f.pts}/${f.max}</div>
          </div>
          ${progressBar(pct, col)}
          ${f.note ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px">${esc(f.note)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `);
}

function buildRiskAndActions(input: ReportInput): string {
  if (!input.risks.length && !input.actions.length && !input.improvements.length) return '';
  return card(`
    ${sectionHeader('⚠', 'Risk Assessment & Action Plan', 'NEXT STEPS')}
    ${input.risks.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:800;color:#dc2626;letter-spacing:2px;margin-bottom:10px">⚠ KEY RISKS</div>
      ${input.risks.map(r =>
        `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:#fff1f2;border-radius:8px;margin-bottom:6px">
          <span style="color:#dc2626;font-size:14px;flex-shrink:0">⚠</span>
          <span style="font-size:12px;color:#1e293b;line-height:1.5">${esc(r)}</span>
        </div>`
      ).join('')}
    </div>` : ''}
    ${input.actions.length ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:800;color:#3b82f6;letter-spacing:2px;margin-bottom:10px">→ IMMEDIATE ACTIONS</div>
      ${input.actions.map((a, i) =>
        `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:#f8faff;border-radius:8px;margin-bottom:6px">
          <div style="width:22px;height:22px;border-radius:50%;background:#eff6ff;color:#3b82f6;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
          <span style="font-size:12px;color:#1e293b;line-height:1.5">${esc(a)}</span>
        </div>`
      ).join('')}
    </div>` : ''}
    ${input.improvements.length ? `
    <div>
      <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:2px;margin-bottom:10px">✦ WHAT WOULD IMPROVE THIS SCORE</div>
      ${bullet(input.improvements, '#6366f1')}
    </div>` : ''}
  `);
}

function buildActionPlan(): string {
  const phases = [
    { icon: '◎', title: 'Discover', time: '30 min', color: '#3b82f6',  desc: 'Validate demand · confirm margin · check competition' },
    { icon: '✦', title: 'Brand',    time: '45 min', color: '#6366f1',  desc: 'Create brand identity · register Seller Central · get barcode' },
    { icon: '≋', title: 'Keywords', time: '30 min', color: '#0891b2',  desc: 'Find top 10 keywords · build backend list · validate intent' },
    { icon: '⬡', title: 'Source',   time: '45 min', color: '#059669',  desc: 'Approve sample · negotiate terms · place order' },
    { icon: '≡', title: 'Listing',  time: '45 min', color: '#d97706',  desc: 'Create ASIN · write title & bullets · upload 7+ images' },
    { icon: '📦', title: 'Inbound', time: '30 min', color: '#64748b',  desc: 'Create shipment plan · label units · ship to FBA' },
    { icon: '🚀', title: 'Launch',  time: '30 min', color: '#dc2626',  desc: 'Set price · launch PPC · request reviews · monitor daily' },
  ];
  return card(`
    ${sectionHeader('🚀', '90-Day Action Plan', 'CHECKLIST')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${phases.map((p, i) =>
        `<div style="display:flex;gap:12px;align-items:flex-start;background:#f8faff;border-radius:12px;padding:14px;border-left:3px solid ${p.color}">
          <div style="width:32px;height:32px;border-radius:10px;background:${p.color}18;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${p.icon}</div>
          <div>
            <div style="font-size:10px;font-weight:800;color:${p.color};letter-spacing:1px">PHASE 0${i + 1} · ${esc(p.time)}</div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;margin:2px 0">${esc(p.title)}</div>
            <div style="font-size:11px;color:#64748b;line-height:1.45">${esc(p.desc)}</div>
          </div>
        </div>`
      ).join('')}
    </div>
  `);
}

function buildFooter(): string {
  return `
  <div style="text-align:center;padding:24px;color:#94a3b8;font-size:11px;line-height:1.7;border-top:1px solid #e2e8f0;margin-top:8px">
    <div style="font-weight:800;color:#64748b;margin-bottom:4px">FBA Decision Report — Generated by Siftly</div>
    <div>All financial estimates are directional models based on review-velocity data and supplied cost inputs.</div>
    <div>They are not guarantees of performance. Always validate with live Amazon data before committing capital.</div>
    <div style="margin-top:8px;color:#cbd5e1">siftly.app · ${new Date().getFullYear()}</div>
  </div>`;
}

// ─── Master HTML builder ──────────────────────────────────────────────────────

function buildReportHTML(input: ReportInput): string {
  const prod = input.product;
  const name = prod?.title || input.brand?.productTitle || input.niche?.keyword || 'FBA Report';

  const sections = [
    buildCover(input),
    buildExecutiveSummary(input),
    buildMarketIntelligence(input),
    buildProductAnalysis(input),
    buildCompetitorIntelligence(input),
    buildFinancialModel(input),
    buildSupplierProfile(input),
    buildBrandIdentity(input),
    buildReadinessScore(input),
    buildRiskAndActions(input),
    buildActionPlan(),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FBA Decision Report — ${esc(name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      line-height: 1.5;
    }
    .page {
      max-width: 820px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
    table { border-collapse: collapse; }
    a { text-decoration: none; }
    @media print {
      body { background: #fff; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${sections}
    ${buildFooter()}
  </div>
</body>
</html>`;
}
