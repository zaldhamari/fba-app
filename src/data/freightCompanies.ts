import type { ShipMode } from '../utils/shippingCalcs';

export interface FreightCompany {
  id:             string;
  name:           string;
  specialization: string;
  methods:        ShipMode[];
  rateMult:       number;   // multiplier on base rate (lower = cheaper)
  transitMult:    number;   // multiplier on base transit days (lower = faster)
  scoreBase:      number;   // service quality score 1.0–5.0
  website:        string;   // official website URL
  quoteEmail?:    string;   // direct quote email if available; omit → fall back to website
  badge?:         string;
  recommended?:   boolean;
}

export const FREIGHT_COMPANIES: FreightCompany[] = [
  {
    id:             'flexport',
    name:           'Flexport',
    specialization: 'Full-service digital freight forwarder',
    methods:        ['sea', 'air', 'express'],
    rateMult:       1.08,
    transitMult:    1.00,
    scoreBase:      4.7,
    website:        'https://www.flexport.com',
    badge:          'Most Reliable',
    recommended:    true,
  },
  {
    id:             'freightos',
    name:           'Freightos',
    specialization: 'Online rate marketplace — compare live quotes',
    methods:        ['sea', 'air', 'express'],
    rateMult:       0.95,
    transitMult:    1.02,
    scoreBase:      4.2,
    website:        'https://www.freightos.com',
    badge:          'Best Value',
  },
  {
    id:             'sinotrans',
    name:           'Sinotrans',
    specialization: 'Chinese national carrier — strong for sea FCL/LCL',
    methods:        ['sea', 'air'],
    rateMult:       0.88,
    transitMult:    1.05,
    scoreBase:      3.8,
    website:        'https://www.sinotrans.com',
    badge:          'Lowest Cost',
  },
  {
    id:             'expeditors',
    name:           'Expeditors',
    specialization: 'US-headquartered global forwarder — strong China network',
    methods:        ['sea', 'air', 'express'],
    rateMult:       1.05,
    transitMult:    0.97,
    scoreBase:      4.6,
    website:        'https://www.expeditors.com',
  },
  {
    id:             'dhl_global',
    name:           'DHL Global Forwarding',
    specialization: 'Express & air leader — fastest door-to-door',
    methods:        ['air', 'express'],
    rateMult:       1.15,
    transitMult:    0.85,
    scoreBase:      4.8,
    website:        'https://www.dhl.com/global-en/home/our-divisions/freight.html',
    badge:          'Fastest',
  },
  {
    id:             'kn',
    name:           'Kuehne+Nagel',
    specialization: 'Premium full-service — high-value or complex cargo',
    methods:        ['sea', 'air', 'express'],
    rateMult:       1.12,
    transitMult:    0.95,
    scoreBase:      4.9,
    website:        'https://www.kuehne-nagel.com',
  },
  {
    id:             'dsv',
    name:           'DSV',
    specialization: 'Danish global forwarder — major China–US & China–EU lanes',
    methods:        ['sea', 'air', 'express'],
    rateMult:       1.06,
    transitMult:    0.96,
    scoreBase:      4.4,
    website:        'https://www.dsv.com',
  },
  {
    id:             'sgl',
    name:           'Scan Global Logistics',
    specialization: 'FBA-focused forwarder — Amazon prep experience',
    methods:        ['sea', 'air', 'express'],
    rateMult:       1.02,
    transitMult:    1.00,
    scoreBase:      4.5,
    website:        'https://scangloballogistics.com',
    recommended:    true,
  },
];
