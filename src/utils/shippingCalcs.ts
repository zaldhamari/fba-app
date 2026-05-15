// ─── Types ───────────────────────────────────────────────────────────────────

export type ShipOrigin = 'CN' | 'VN' | 'IN' | 'TR';
export type ShipMarket = 'US' | 'UK' | 'DE' | 'CA';
export type Incoterms = 'FOB' | 'EXW' | 'DDP';
export type ShipMode = 'sea' | 'air' | 'express';

export interface ShippingInputs {
  units: number;
  unitWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  cartonUnits: number;
  cartonWeightKg: number;
  cartonLengthCm: number;
  cartonWidthCm: number;
  cartonHeightCm: number;
  productCostUsd: number;
  sellingPriceUsd: number;
  marketplace: ShipMarket;
  origin: ShipOrigin;
  incoterms: Incoterms;
  dutyPct: number;
  tariffPct: number;
}

export interface ShipModeResult {
  mode: ShipMode;
  label: string;
  icon: string;
  transitDays: string;
  totalShippingUsd: number;
  shippingPerUnit: number;
  landedCostPerUnit: number;
  profitPerUnit: number;
  marginPct: number;
  cbm?: number;
  chargeableKg?: number;
  dutyPerUnit: number;
  tariffPerUnit: number;
  fbaFeePerUnit: number;
}

export interface ShippingResult {
  cartons: number;
  cbm: number;
  totalWeightKg: number;
  modes: ShipModeResult[];
  recommendation: string;
}

// ─── Rate tables ─────────────────────────────────────────────────────────────

const rk = (o: ShipOrigin, m: ShipMarket) => `${o}-${m}`;

const SEA_PER_CBM: Record<string, number> = {
  [rk('CN','US')]: 150, [rk('CN','UK')]: 130, [rk('CN','DE')]: 120, [rk('CN','CA')]: 155,
  [rk('VN','US')]: 155, [rk('VN','UK')]: 135, [rk('VN','DE')]: 125, [rk('VN','CA')]: 160,
  [rk('IN','US')]: 140, [rk('IN','UK')]: 95,  [rk('IN','DE')]: 85,  [rk('IN','CA')]: 145,
  [rk('TR','US')]: 160, [rk('TR','UK')]: 75,  [rk('TR','DE')]: 65,  [rk('TR','CA')]: 165,
};

const SEA_FIXED: Record<string, number> = {
  [rk('CN','US')]: 620, [rk('CN','UK')]: 520, [rk('CN','DE')]: 500, [rk('CN','CA')]: 640,
  [rk('VN','US')]: 650, [rk('VN','UK')]: 540, [rk('VN','DE')]: 520, [rk('VN','CA')]: 670,
  [rk('IN','US')]: 580, [rk('IN','UK')]: 400, [rk('IN','DE')]: 380, [rk('IN','CA')]: 600,
  [rk('TR','US')]: 680, [rk('TR','UK')]: 300, [rk('TR','DE')]: 280, [rk('TR','CA')]: 700,
};

const AIR_PER_KG: Record<string, number> = {
  [rk('CN','US')]: 6.0, [rk('CN','UK')]: 5.2, [rk('CN','DE')]: 5.0, [rk('CN','CA')]: 6.2,
  [rk('VN','US')]: 6.2, [rk('VN','UK')]: 5.4, [rk('VN','DE')]: 5.2, [rk('VN','CA')]: 6.4,
  [rk('IN','US')]: 5.5, [rk('IN','UK')]: 4.5, [rk('IN','DE')]: 4.2, [rk('IN','CA')]: 5.7,
  [rk('TR','US')]: 6.5, [rk('TR','UK')]: 3.8, [rk('TR','DE')]: 3.5, [rk('TR','CA')]: 6.7,
};

const EXPRESS_PER_KG: Record<string, number> = {
  [rk('CN','US')]: 10.5, [rk('CN','UK')]: 9.0, [rk('CN','DE')]: 8.8, [rk('CN','CA')]: 11.0,
  [rk('VN','US')]: 10.8, [rk('VN','UK')]: 9.2, [rk('VN','DE')]: 9.0, [rk('VN','CA')]: 11.2,
  [rk('IN','US')]: 9.5,  [rk('IN','UK')]: 7.5, [rk('IN','DE')]: 7.2, [rk('IN','CA')]: 9.8,
  [rk('TR','US')]: 11.0, [rk('TR','UK')]: 6.5, [rk('TR','DE')]: 6.2, [rk('TR','CA')]: 11.2,
};

const TRANSIT: Record<ShipMode, Record<string, string>> = {
  sea: {
    [rk('CN','US')]: '25–35', [rk('CN','UK')]: '25–30', [rk('CN','DE')]: '25–30', [rk('CN','CA')]: '28–38',
    [rk('VN','US')]: '22–30', [rk('VN','UK')]: '22–28', [rk('VN','DE')]: '22–28', [rk('VN','CA')]: '25–35',
    [rk('IN','US')]: '20–28', [rk('IN','UK')]: '18–24', [rk('IN','DE')]: '18–24', [rk('IN','CA')]: '22–30',
    [rk('TR','US')]: '20–28', [rk('TR','UK')]: '12–18', [rk('TR','DE')]: '10–16', [rk('TR','CA')]: '22–30',
  },
  air: {
    [rk('CN','US')]: '5–8', [rk('CN','UK')]: '5–7', [rk('CN','DE')]: '5–7', [rk('CN','CA')]: '5–8',
    [rk('VN','US')]: '5–8', [rk('VN','UK')]: '5–7', [rk('VN','DE')]: '5–7', [rk('VN','CA')]: '5–8',
    [rk('IN','US')]: '4–7', [rk('IN','UK')]: '3–5', [rk('IN','DE')]: '3–5', [rk('IN','CA')]: '4–7',
    [rk('TR','US')]: '5–8', [rk('TR','UK')]: '2–4', [rk('TR','DE')]: '2–3', [rk('TR','CA')]: '5–8',
  },
  express: {
    [rk('CN','US')]: '2–4', [rk('CN','UK')]: '2–4', [rk('CN','DE')]: '2–4', [rk('CN','CA')]: '2–4',
    [rk('VN','US')]: '2–4', [rk('VN','UK')]: '2–4', [rk('VN','DE')]: '2–4', [rk('VN','CA')]: '2–4',
    [rk('IN','US')]: '2–3', [rk('IN','UK')]: '1–3', [rk('IN','DE')]: '1–3', [rk('IN','CA')]: '2–3',
    [rk('TR','US')]: '2–4', [rk('TR','UK')]: '1–2', [rk('TR','DE')]: '1–2', [rk('TR','CA')]: '2–4',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function estimateFbaFee(unitWeightKg: number, sellingPrice: number): number {
  const lb = unitWeightKg * 2.205;
  let fulfillment: number;
  if (lb <= 0.5)       fulfillment = 3.22;
  else if (lb <= 1)    fulfillment = 4.18;
  else if (lb <= 2)    fulfillment = 5.09;
  else if (lb <= 3)    fulfillment = 6.00;
  else                 fulfillment = 6.00 + (lb - 3) * 0.50;
  return fulfillment + sellingPrice * 0.15;
}

function calcMode(mode: ShipMode, inputs: ShippingInputs): ShipModeResult {
  const route = rk(inputs.origin, inputs.marketplace);
  const cartons = Math.ceil(inputs.units / Math.max(inputs.cartonUnits, 1));

  const cartonCbm = (inputs.cartonLengthCm * inputs.cartonWidthCm * inputs.cartonHeightCm) / 1_000_000;
  const totalCbm = cartonCbm * cartons;
  const totalActualKg = inputs.cartonWeightKg * cartons;

  let shippingUsd: number;
  let chargeableKg: number | undefined;

  if (mode === 'sea') {
    const rate = SEA_PER_CBM[route] ?? 150;
    const fixed = SEA_FIXED[route] ?? 620;
    shippingUsd = Math.max(rate * totalCbm + fixed, 500);
  } else if (mode === 'air') {
    // IATA volumetric: CBM × 166.67 kg
    const volKg = totalCbm * 166.67;
    chargeableKg = Math.max(totalActualKg, volKg);
    const rate = AIR_PER_KG[route] ?? 6;
    shippingUsd = Math.max(chargeableKg * rate, 150);
  } else {
    // Express (DHL): L×W×H cm³/5000 per carton
    const volPerCarton = (inputs.cartonLengthCm * inputs.cartonWidthCm * inputs.cartonHeightCm) / 5000;
    chargeableKg = Math.max(totalActualKg, volPerCarton * cartons);
    const rate = EXPRESS_PER_KG[route] ?? 10.5;
    shippingUsd = Math.max(chargeableKg * rate, 80);
  }

  // Incoterms surcharge
  if (inputs.incoterms === 'EXW') shippingUsd += 300;
  if (inputs.incoterms === 'DDP') shippingUsd *= 1.12;

  const productCostTotal = inputs.productCostUsd * inputs.units;
  const dutyTotal   = productCostTotal * (inputs.dutyPct   / 100);
  const tariffTotal = productCostTotal * (inputs.tariffPct / 100);

  const shippingPerUnit  = shippingUsd     / inputs.units;
  const dutyPerUnit      = dutyTotal       / inputs.units;
  const tariffPerUnit    = tariffTotal     / inputs.units;
  const landedCostPerUnit = inputs.productCostUsd + shippingPerUnit + dutyPerUnit + tariffPerUnit;

  const fbaFeePerUnit = estimateFbaFee(inputs.unitWeightKg, inputs.sellingPriceUsd);
  const profitPerUnit = inputs.sellingPriceUsd - fbaFeePerUnit - landedCostPerUnit;
  const marginPct     = inputs.sellingPriceUsd > 0 ? (profitPerUnit / inputs.sellingPriceUsd) * 100 : 0;

  const transit = (TRANSIT[mode][route] ?? (mode === 'sea' ? '25–35' : mode === 'air' ? '5–8' : '2–4')) + ' days';

  return {
    mode,
    label:        mode === 'sea' ? 'Sea Freight' : mode === 'air' ? 'Air Freight' : 'Express',
    icon:         mode === 'sea' ? '⛵' : mode === 'air' ? '✈' : '📦',
    transitDays:  transit,
    totalShippingUsd: shippingUsd,
    shippingPerUnit,
    landedCostPerUnit,
    profitPerUnit,
    marginPct,
    cbm:           mode === 'sea' ? totalCbm : undefined,
    chargeableKg,
    dutyPerUnit,
    tariffPerUnit,
    fbaFeePerUnit,
  };
}

function buildRecommendation(modes: ShipModeResult[], inputs: ShippingInputs): string {
  const sea = modes.find(m => m.mode === 'sea')!;
  const air = modes.find(m => m.mode === 'air')!;
  const exp = modes.find(m => m.mode === 'express')!;

  const seaSavingsVsAir = air.profitPerUnit - sea.profitPerUnit;

  if (inputs.units >= 500 && sea.marginPct >= 15) {
    return `Sea freight is the clear winner for ${inputs.units} units — saves $${Math.abs(seaSavingsVsAir).toFixed(2)}/unit vs air and preserves the strongest margin. Reserve air or express for urgent restocks under 100 units.`;
  }
  if (inputs.units < 100) {
    return `For smaller orders under 100 units, sea freight's fixed costs eat into margins. Express or air gives faster cash flow and simpler logistics — consider sea only once you're ordering 300+ units.`;
  }
  if (sea.marginPct < 10) {
    return `Margins are tight across all methods. Focus on reducing COGS below $${(inputs.productCostUsd * 0.85).toFixed(2)}/unit, or raise your selling price before committing to a large order.`;
  }
  if (air.profitPerUnit > sea.profitPerUnit) {
    return `Given your cargo dimensions, volumetric weight makes air competitive with sea. Compare total cash tied up — air's faster cycle time (${air.transitDays} vs ${sea.transitDays}) can offset the higher per-unit cost.`;
  }
  return `Sea freight offers the lowest landed cost at scale. Use the ${exp.transitDays} express option for initial sample runs or urgent replenishments.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function calculateShipping(inputs: ShippingInputs): ShippingResult {
  const cartons = Math.ceil(inputs.units / Math.max(inputs.cartonUnits, 1));
  const cbm = (inputs.cartonLengthCm * inputs.cartonWidthCm * inputs.cartonHeightCm) / 1_000_000 * cartons;
  const totalWeightKg = inputs.cartonWeightKg * cartons;

  const modes = (['sea', 'air', 'express'] as ShipMode[]).map(m => calcMode(m, inputs));

  return {
    cartons,
    cbm,
    totalWeightKg,
    modes,
    recommendation: buildRecommendation(modes, inputs),
  };
}

export function buildQuoteEmail(inputs: ShippingInputs, result: ShippingResult): string {
  const cartons = result.cartons;
  const cbm = result.cbm.toFixed(2);
  const originLabels: Record<ShipOrigin, string> = { CN: 'China', VN: 'Vietnam', IN: 'India', TR: 'Turkey' };
  const destLabels: Record<ShipMarket, string> = { US: 'USA', UK: 'United Kingdom', DE: 'Europe (EU)', CA: 'Canada' };

  return `Subject: Freight Quote Request — ${originLabels[inputs.origin]} to ${destLabels[inputs.marketplace]}

Dear Freight Team,

I am seeking competitive quotes for the following shipment. Please provide your best rates for sea, air, and express options.

SHIPMENT DETAILS
────────────────
Origin:       ${originLabels[inputs.origin]}
Destination:  ${destLabels[inputs.marketplace]}
Incoterms:    ${inputs.incoterms}

CARGO
─────
Total Units:  ${inputs.units.toLocaleString()}
Cartons:      ${cartons}
Total CBM:    ${cbm} m³
Total Weight: ${result.totalWeightKg.toFixed(1)} kg
Carton Dims:  ${inputs.cartonLengthCm} × ${inputs.cartonWidthCm} × ${inputs.cartonHeightCm} cm
Carton Weight:${inputs.cartonWeightKg} kg

REQUIREMENTS
────────────
• Rates for FCL (full container) and LCL (shared container) sea freight
• Air freight rates (IATA chargeable weight)
• DHL/FedEx express rates
• Transit time estimates for each
• Any applicable surcharges (fuel, port, handling)

Please confirm if you can also handle customs clearance and last-mile delivery.

Best regards,
[Your Name]
[Company]
[Phone / Email]`;
}
