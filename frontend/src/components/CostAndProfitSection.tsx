import React, { useState } from 'react';
import {
  Coins,
  TrendingUp,
  DollarSign,
  PieChart,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { calculateFarmEconomics, FarmEconomicsResult } from '../lib/agriEconomics';

export interface CostAndProfitProps {
  crop: string;
  areaHa: number;
  expectedYieldTotalQuintals?: number;
  pricePerQuintal?: number;
  title?: string;
  subtitle?: string;
}

export function CostAndProfitSection({
  crop,
  areaHa,
  expectedYieldTotalQuintals,
  pricePerQuintal,
  title = 'Farm Financial Projection: Estimated Costs & Net Profit',
  subtitle,
}: CostAndProfitProps) {
  const [showItemized, setShowItemized] = useState(false);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [customYield, setCustomYield] = useState<number | null>(null);

  const activePrice = customPrice !== null ? customPrice : pricePerQuintal;
  const activeYield = customYield !== null ? customYield : expectedYieldTotalQuintals;

  const econ: FarmEconomicsResult = calculateFarmEconomics({
    crop,
    areaHa,
    expectedYieldTotalQuintals: activeYield,
    pricePerQuintal: activePrice,
  });

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-b from-white to-emerald-50/30 border border-emerald-200/90 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">{title}</h3>
              <p className="text-xs text-stone-500">
                {subtitle ||
                  `Grounded in CACP Cost of Cultivation (C2) benchmarks for ${crop} across ${econ.areaAcres} Acres (${econ.areaHa} Ha).`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            BCR: {econ.benefitCostRatio}:1
          </span>
          <span className="text-[11px] text-stone-500">
            MSP: ₹{econ.mspBenchmark.toLocaleString()}/Q
          </span>
        </div>
      </div>

      {/* 3 Core Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Estimated Total Cost */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500">Total Cultivation Cost</span>
            <span className="text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
              Cost C2
            </span>
          </div>
          <div className="text-2xl font-extrabold text-stone-900">
            ₹{econ.totalCost.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-500 flex items-center justify-between">
            <span>₹{econ.costPerAcre.toLocaleString()} / Acre</span>
            <span>₹{econ.costPerHa.toLocaleString()} / Ha</span>
          </div>
        </div>

        {/* Projected Gross Revenue */}
        <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Projected Gross Revenue</span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
              {econ.expectedYieldTotalQuintals} Q Total
            </span>
          </div>
          <div className="text-2xl font-extrabold text-stone-900">
            ₹{econ.grossRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-stone-600 flex items-center justify-between">
            <span>@ ₹{econ.expectedPricePerQuintal.toLocaleString()} / Quintal</span>
            <span>~{econ.yieldPerAcreQuintals} Q / Acre</span>
          </div>
        </div>

        {/* Estimated Net Profit */}
        <div
          className={`p-4 rounded-2xl border shadow-2xs space-y-1 ${
            econ.isProfitable
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-rose-50/70 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold ${
                econ.isProfitable ? 'text-emerald-900' : 'text-rose-900'
              }`}
            >
              Estimated Net Farm Profit
            </span>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                econ.isProfitable
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-rose-200 text-rose-900'
              }`}
            >
              {econ.profitMarginPercent}% Margin
            </span>
          </div>
          <div
            className={`text-2xl font-extrabold ${
              econ.isProfitable ? 'text-emerald-950' : 'text-rose-950'
            }`}
          >
            ₹{econ.netProfit.toLocaleString()}
          </div>
          <div
            className={`text-[11px] font-medium flex items-center justify-between ${
              econ.isProfitable ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            <span>₹{econ.netProfitPerAcre.toLocaleString()} / Acre return</span>
            <span>Net of all inputs & labor</span>
          </div>
        </div>
      </div>

      {/* Itemized Cost Breakdown (Accordion / Expandable) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowItemized(!showItemized)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-xs font-bold text-stone-800 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#14532D]" />
            <span>
              {showItemized
                ? 'Hide Itemized Production Cost Breakdown'
                : 'View Itemized Production Cost Breakdown (Seeds, Fertilizer, Labor, Irrigation)'}
            </span>
          </span>
          {showItemized ? (
            <ChevronUp className="w-4 h-4 text-stone-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-stone-600" />
          )}
        </button>

        {showItemized && (
          <div className="mt-3 p-4 rounded-2xl bg-white border border-stone-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-100">
              <span className="font-semibold text-stone-700">Cost Head / Farm Input</span>
              <span className="font-semibold text-stone-700">Estimated Expense ({econ.areaAcres} Acres)</span>
            </div>

            <div className="space-y-2.5">
              {econ.costBreakdown.map((item, idx) => (
                <div key={idx} className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-stone-900">{item.category}</span>
                      <span className="text-[11px] text-stone-500 ml-2">({item.percentage}%)</span>
                    </div>
                    <span className="font-extrabold text-stone-800">
                      ₹{item.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#14532D] h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, item.percentage * 3)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 leading-tight">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-stone-900">
              <span>Total Estimated Input & Operational Expenditure</span>
              <span className="text-sm text-[#14532D]">₹{econ.totalCost.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Educational Explanation: Understanding Profit vs. Deficit */}
      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 text-xs space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-amber-900">
          <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Why might the Cost & Profit Estimator show profit while Forecasts show loss?</span>
        </div>
        <p className="text-stone-700 leading-relaxed">
          The <strong>Cost & Profit Estimator</strong> calculates returns based on normal, benchmark harvest yields ({econ.yieldPerAcreQuintals} Q/Acre) under favorable conditions. In contrast, <strong>Yield & Market Forecasts</strong> reflect specific environmental stress or lower mandi prices. When predicted production or price drops below the break-even threshold needed to cover operational costs (C2), the forecast will alert you to a potential loss so you can plan interventions (like crop insurance or staggered selling).
        </p>
      </div>

      {/* Advisory Note */}
      <div className="flex items-start gap-2 text-[11px] text-stone-500 bg-white/70 p-2.5 rounded-xl border border-stone-200">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <p>
          Calculations reflect standardized CACP Cost of Cultivation (Comprehensive Scheme C2) data adjusted for current market inputs. Actual farm profitability depends on micro-irrigation efficiency, weather during maturity, and mandi grading.
        </p>
      </div>
    </div>
  );
}
