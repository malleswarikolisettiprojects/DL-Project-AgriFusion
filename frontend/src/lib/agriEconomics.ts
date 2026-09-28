/**
 * AgriFusion Agricultural Economics Engine
 * Grounded in CACP (Commission for Agricultural Costs and Prices)
 * and State Agricultural University (ANGRAU / PJTSAU) Cost of Cultivation (C2) benchmarks.
 */

export interface CostBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  description: string;
}

export interface FarmEconomicsResult {
  crop: string;
  areaHa: number;
  areaAcres: number;
  costPerHa: number;
  costPerAcre: number;
  totalCost: number;
  costBreakdown: CostBreakdownItem[];
  expectedYieldTotalQuintals: number;
  yieldPerAcreQuintals: number;
  expectedPricePerQuintal: number;
  grossRevenue: number;
  netProfit: number;
  netProfitPerAcre: number;
  benefitCostRatio: number;
  profitMarginPercent: number;
  isProfitable: boolean;
  mspBenchmark: number;
}

interface CropBenchmark {
  baseCostPerHa: number; // Cost of cultivation per hectare in INR
  baseYieldQuintalsPerHa: number; // Normal harvest yield per hectare
  typicalPricePerQuintal: number; // Mandi modal rate
  msp: number; // Government Minimum Support Price
  breakdownWeights: {
    seeds: number;
    fertilizers: number;
    cropProtection: number;
    irrigationEnergy: number;
    machinery: number;
    labor: number;
    miscInsurance: number;
  };
}

export const CROP_ECONOMIC_BENCHMARKS: Record<string, CropBenchmark> = {
  Rice: {
    baseCostPerHa: 58000,
    baseYieldQuintalsPerHa: 45,
    typicalPricePerQuintal: 2450,
    msp: 2320,
    breakdownWeights: {
      seeds: 0.08,
      fertilizers: 0.22,
      cropProtection: 0.12,
      irrigationEnergy: 0.14,
      machinery: 0.18,
      labor: 0.22,
      miscInsurance: 0.04,
    },
  },
  Cotton: {
    baseCostPerHa: 68000,
    baseYieldQuintalsPerHa: 22,
    typicalPricePerQuintal: 7250,
    msp: 7121,
    breakdownWeights: {
      seeds: 0.12,
      fertilizers: 0.20,
      cropProtection: 0.20,
      irrigationEnergy: 0.10,
      machinery: 0.14,
      labor: 0.20,
      miscInsurance: 0.04,
    },
  },
  Maize: {
    baseCostPerHa: 46000,
    baseYieldQuintalsPerHa: 55,
    typicalPricePerQuintal: 2180,
    msp: 2090,
    breakdownWeights: {
      seeds: 0.12,
      fertilizers: 0.26,
      cropProtection: 0.10,
      irrigationEnergy: 0.12,
      machinery: 0.18,
      labor: 0.18,
      miscInsurance: 0.04,
    },
  },
  Chilli: {
    baseCostPerHa: 145000,
    baseYieldQuintalsPerHa: 34,
    typicalPricePerQuintal: 17200,
    msp: 16500,
    breakdownWeights: {
      seeds: 0.10,
      fertilizers: 0.22,
      cropProtection: 0.24,
      irrigationEnergy: 0.12,
      machinery: 0.10,
      labor: 0.18,
      miscInsurance: 0.04,
    },
  },
  Groundnut: {
    baseCostPerHa: 50000,
    baseYieldQuintalsPerHa: 21,
    typicalPricePerQuintal: 6600,
    msp: 6377,
    breakdownWeights: {
      seeds: 0.22,
      fertilizers: 0.18,
      cropProtection: 0.12,
      irrigationEnergy: 0.10,
      machinery: 0.16,
      labor: 0.18,
      miscInsurance: 0.04,
    },
  },
  Sugarcane: {
    baseCostPerHa: 98000,
    baseYieldQuintalsPerHa: 850,
    typicalPricePerQuintal: 345,
    msp: 340,
    breakdownWeights: {
      seeds: 0.16,
      fertilizers: 0.24,
      cropProtection: 0.08,
      irrigationEnergy: 0.18,
      machinery: 0.16,
      labor: 0.14,
      miscInsurance: 0.04,
    },
  },
  'Red Gram (Tur)': {
    baseCostPerHa: 38000,
    baseYieldQuintalsPerHa: 14,
    typicalPricePerQuintal: 7650,
    msp: 7550,
    breakdownWeights: {
      seeds: 0.10,
      fertilizers: 0.18,
      cropProtection: 0.18,
      irrigationEnergy: 0.08,
      machinery: 0.20,
      labor: 0.22,
      miscInsurance: 0.04,
    },
  },
  'Bengal Gram (Chickpea)': {
    baseCostPerHa: 35000,
    baseYieldQuintalsPerHa: 15,
    typicalPricePerQuintal: 5550,
    msp: 5440,
    breakdownWeights: {
      seeds: 0.14,
      fertilizers: 0.18,
      cropProtection: 0.16,
      irrigationEnergy: 0.08,
      machinery: 0.20,
      labor: 0.20,
      miscInsurance: 0.04,
    },
  },
  Soybean: {
    baseCostPerHa: 36000,
    baseYieldQuintalsPerHa: 22,
    typicalPricePerQuintal: 4950,
    msp: 4892,
    breakdownWeights: {
      seeds: 0.16,
      fertilizers: 0.20,
      cropProtection: 0.14,
      irrigationEnergy: 0.08,
      machinery: 0.20,
      labor: 0.18,
      miscInsurance: 0.04,
    },
  },
  Turmeric: {
    baseCostPerHa: 135000,
    baseYieldQuintalsPerHa: 52,
    typicalPricePerQuintal: 11500,
    msp: 11200,
    breakdownWeights: {
      seeds: 0.24,
      fertilizers: 0.20,
      cropProtection: 0.12,
      irrigationEnergy: 0.12,
      machinery: 0.14,
      labor: 0.14,
      miscInsurance: 0.04,
    },
  },
  Tomato: {
    baseCostPerHa: 88000,
    baseYieldQuintalsPerHa: 280,
    typicalPricePerQuintal: 1850,
    msp: 1800,
    breakdownWeights: {
      seeds: 0.12,
      fertilizers: 0.24,
      cropProtection: 0.22,
      irrigationEnergy: 0.14,
      machinery: 0.10,
      labor: 0.14,
      miscInsurance: 0.04,
    },
  },
  Tobacco: {
    baseCostPerHa: 82000,
    baseYieldQuintalsPerHa: 24,
    typicalPricePerQuintal: 12800,
    msp: 12500,
    breakdownWeights: {
      seeds: 0.08,
      fertilizers: 0.22,
      cropProtection: 0.20,
      irrigationEnergy: 0.12,
      machinery: 0.16,
      labor: 0.18,
      miscInsurance: 0.04,
    },
  },
  'Black Gram Dal(Urd Dal)': {
    baseCostPerHa: 36000,
    baseYieldQuintalsPerHa: 13,
    typicalPricePerQuintal: 7500,
    msp: 7400,
    breakdownWeights: {
      seeds: 0.12,
      fertilizers: 0.18,
      cropProtection: 0.16,
      irrigationEnergy: 0.08,
      machinery: 0.20,
      labor: 0.22,
      miscInsurance: 0.04,
    },
  },
  Mango: {
    baseCostPerHa: 95000,
    baseYieldQuintalsPerHa: 110,
    typicalPricePerQuintal: 4200,
    msp: 3800,
    breakdownWeights: {
      seeds: 0.10,
      fertilizers: 0.22,
      cropProtection: 0.20,
      irrigationEnergy: 0.14,
      machinery: 0.12,
      labor: 0.18,
      miscInsurance: 0.04,
    },
  },
  Papaya: {
    baseCostPerHa: 120000,
    baseYieldQuintalsPerHa: 650,
    typicalPricePerQuintal: 1400,
    msp: 1200,
    breakdownWeights: {
      seeds: 0.12,
      fertilizers: 0.25,
      cropProtection: 0.18,
      irrigationEnergy: 0.15,
      machinery: 0.10,
      labor: 0.16,
      miscInsurance: 0.04,
    },
  },
  Banana: {
    baseCostPerHa: 165000,
    baseYieldQuintalsPerHa: 750,
    typicalPricePerQuintal: 1600,
    msp: 1400,
    breakdownWeights: {
      seeds: 0.15,
      fertilizers: 0.28,
      cropProtection: 0.14,
      irrigationEnergy: 0.15,
      machinery: 0.10,
      labor: 0.14,
      miscInsurance: 0.04,
    },
  },
};

const DEFAULT_BENCHMARK: CropBenchmark = {
  baseCostPerHa: 48000,
  baseYieldQuintalsPerHa: 30,
  typicalPricePerQuintal: 3500,
  msp: 3200,
  breakdownWeights: {
    seeds: 0.12,
    fertilizers: 0.22,
    cropProtection: 0.16,
    irrigationEnergy: 0.12,
    machinery: 0.18,
    labor: 0.16,
    miscInsurance: 0.04,
  },
};

export function calculateFarmEconomics(params: {
  crop: string;
  areaHa: number;
  expectedYieldTotalQuintals?: number;
  pricePerQuintal?: number;
}): FarmEconomicsResult {
  const areaHa = Math.max(0.1, Number(params.areaHa) || 2);
  const areaAcres = areaHa * 2.47105;

  const benchmark =
    CROP_ECONOMIC_BENCHMARKS[params.crop] ||
    Object.entries(CROP_ECONOMIC_BENCHMARKS).find(([k]) =>
      params.crop.toLowerCase().includes(k.toLowerCase())
    )?.[1] ||
    DEFAULT_BENCHMARK;

  const costPerHa = benchmark.baseCostPerHa;
  const costPerAcre = Math.round(costPerHa / 2.47105);
  const totalCost = Math.round(costPerHa * areaHa);

  // Determine Yield
  const defaultTotalYield = Math.round(benchmark.baseYieldQuintalsPerHa * areaHa);
  const expectedYieldTotalQuintals =
    params.expectedYieldTotalQuintals && params.expectedYieldTotalQuintals > 0
      ? Number(params.expectedYieldTotalQuintals)
      : defaultTotalYield;

  const yieldPerAcreQuintals = Number((expectedYieldTotalQuintals / areaAcres).toFixed(1));

  // Determine Price
  const expectedPricePerQuintal =
    params.pricePerQuintal && params.pricePerQuintal > 0
      ? Number(params.pricePerQuintal)
      : benchmark.typicalPricePerQuintal;

  // Gross Revenue & Net Profit
  const grossRevenue = Math.round(expectedYieldTotalQuintals * expectedPricePerQuintal);
  const netProfit = grossRevenue - totalCost;
  const netProfitPerAcre = Math.round(netProfit / areaAcres);

  const benefitCostRatio = totalCost > 0 ? Number((grossRevenue / totalCost).toFixed(2)) : 1.0;
  const profitMarginPercent =
    grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0;

  // Itemized Cost Breakdown
  const w = benchmark.breakdownWeights;
  const costBreakdown: CostBreakdownItem[] = [
    {
      category: 'Certified Seeds & Nursery',
      amount: Math.round(totalCost * w.seeds),
      percentage: Math.round(w.seeds * 100),
      description: 'High-germination certified seed varieties & seed treatment bio-agents.',
    },
    {
      category: 'Fertilizers & Nutrients',
      amount: Math.round(totalCost * w.fertilizers),
      percentage: Math.round(w.fertilizers * 100),
      description: 'Basal and top dressing (Urea, DAP, MOP, Zinc Sulfate, and FYM compost).',
    },
    {
      category: 'Plant Protection (Pest/Disease)',
      amount: Math.round(totalCost * w.cropProtection),
      percentage: Math.round(w.cropProtection * 100),
      description: 'CIB&RC approved bio-pesticides, neem oil formulations, and targeted sprays.',
    },
    {
      category: 'Irrigation & Pumping Power',
      amount: Math.round(totalCost * w.irrigationEnergy),
      percentage: Math.round(w.irrigationEnergy * 100),
      description: 'Electricity, borewell servicing, diesel generator runs, and drip upkeep.',
    },
    {
      category: 'Tractor & Machinery Rental',
      amount: Math.round(totalCost * w.machinery),
      percentage: Math.round(w.machinery * 100),
      description: 'Primary tillage, rotavator, bunding, seed-drill, and mechanical harvest.',
    },
    {
      category: 'Farm Labor & Field Operations',
      amount: Math.round(totalCost * w.labor),
      percentage: Math.round(w.labor * 100),
      description: 'Manual transplanting, intercultural weeding, de-trashing, and harvest bagging.',
    },
    {
      category: 'Crop Insurance (PMFBY) & Misc',
      amount: Math.round(totalCost * w.miscInsurance),
      percentage: Math.round(w.miscInsurance * 100),
      description: 'PMFBY seasonal premium share (1.5-2%) and incidental transport.',
    },
  ];

  return {
    crop: params.crop,
    areaHa,
    areaAcres: Number(areaAcres.toFixed(1)),
    costPerHa,
    costPerAcre,
    totalCost,
    costBreakdown,
    expectedYieldTotalQuintals,
    yieldPerAcreQuintals,
    expectedPricePerQuintal,
    grossRevenue,
    netProfit,
    netProfitPerAcre,
    benefitCostRatio,
    profitMarginPercent,
    isProfitable: netProfit >= 0,
    mspBenchmark: benchmark.msp,
  };
}
