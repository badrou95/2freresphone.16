import React, { useMemo } from 'react';
import { AlertCircle, ArrowRight, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  calculateFinancialSummary,
  formatDzd,
  StockFinancialItem,
} from '../../shared/domain';

interface FinancialMarginWidgetProps {
  items: StockFinancialItem[];
  title?: string;
  subtitle?: string;
  hasUnsavedDrafts?: boolean;
  onGoToStock?: () => void;
}

const COLORS = {
  green: '#16a34a', // Marge bénéficiaire (Vert)
  red: '#dc2626',   // Coût d'achat total (Rouge)
  blue: '#2563eb',  // Valeur totale prix de vente (Bleu)
};

export function FinancialMarginWidget({
  items,
  title = 'Synthèse financière & Marge bénéficiaire',
  subtitle = 'Calculée en direct à partir des prix d’achat, prix de vente et quantités en stock',
  hasUnsavedDrafts = false,
  onGoToStock,
}: FinancialMarginWidgetProps) {
  const summary = useMemo(() => calculateFinancialSummary(items), [items]);

  const chartData = useMemo(() => {
    const raw = [
      {
        key: 'sale',
        name: 'Valeur de vente totale',
        value: summary.totalSaleValueDzd,
        color: COLORS.blue,
        desc: 'Chiffre d’affaires potentiel du stock',
      },
      {
        key: 'cost',
        name: 'Coût d’achat total',
        value: summary.totalCostValueDzd,
        color: COLORS.red,
        desc: 'Investissement total aux prix d’achat',
      },
      {
        key: 'margin',
        name: summary.totalGrossMarginDzd >= 0 ? 'Marge bénéficiaire totale' : 'Déficit sur stock',
        value: Math.abs(summary.totalGrossMarginDzd),
        color: COLORS.green,
        desc: 'Bénéfice brut estimé (Vente − Achat)',
      },
    ];
    const hasValues = raw.some((s) => s.value > 0);
    return hasValues ? raw.filter((s) => s.value > 0) : [];
  }, [summary]);

  const totalSliceSum = useMemo(
    () => chartData.reduce((acc, s) => acc + s.value, 0),
    [chartData],
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-800 shrink-0">
            <PieChartIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-base text-slate-900">{title}</h3>
              {hasUnsavedDrafts && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Aperçu en direct
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {onGoToStock && (
          <button
            type="button"
            onClick={onGoToStock}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shrink-0"
          >
            <span>Ajuster prix &amp; stocks</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Donut Circular Chart (Vert / Rouge / Bleu) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          {chartData.length > 0 ? (
            <div className="relative w-full max-w-[260px] h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={96}
                    paddingAngle={3}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const num = Number(value) || 0;
                      const share =
                        totalSliceSum > 0 ? ` (${Math.round((num / totalSliceSum) * 100)}%)` : '';
                      return [`${formatDzd(num)}${share}`, String(name)];
                    }}
                    contentStyle={{
                      borderRadius: '0.75rem',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center KPI Overlay */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Marge totale
                </span>
                <span
                  className={`font-mono font-bold text-sm sm:text-base tabular-nums leading-tight mt-0.5 ${
                    summary.totalGrossMarginDzd >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {summary.totalGrossMarginDzd >= 0 ? '+' : ''}
                  {formatDzd(summary.totalGrossMarginDzd)}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 mt-0.5 tabular-nums">
                  {summary.marginRatePercent}% de marge
                </span>
              </div>
            </div>
          ) : (
            <div className="h-[200px] w-full flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center">
              <PieChartIcon className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs font-medium text-slate-600">
                Saisissez vos quantités, prix d’achat et prix de vente pour afficher le graphique financier.
              </p>
            </div>
          )}

          {/* Color Legend Strip */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
              <span>Marge (Vert)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
              <span>Prix d’achat (Rouge)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span>Prix de vente (Bleu)</span>
            </span>
          </div>
        </div>

        {/* Detailed Financial Cards */}
        <div className="lg:col-span-7 space-y-3">
          {/* Green: Marge bénéficiaire totale */}
          <div className="p-3.5 rounded-xl border border-green-200 bg-green-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-3 h-10 rounded-full bg-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-green-950">Marge bénéficiaire totale</p>
                <p className="text-[11px] text-green-800">
                  Taux de marge : <strong className="font-mono">{summary.marginRatePercent}%</strong>
                  {summary.totalCostValueDzd > 0 && (
                    <>
                      {' '}· Rentabilité (ROI) : <strong className="font-mono">+{summary.roiPercent}%</strong>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`font-mono font-bold text-base sm:text-lg tabular-nums ${
                  summary.totalGrossMarginDzd >= 0 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {summary.totalGrossMarginDzd >= 0 ? '+' : ''}
                {formatDzd(summary.totalGrossMarginDzd)}
              </p>
            </div>
          </div>

          {/* Blue: Valeur de vente totale */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-3 h-10 rounded-full bg-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-blue-950">Valeur totale aux prix de vente</p>
                <p className="text-[11px] text-blue-800">
                  {summary.valuedProductsCount} article(s) en stock ·{' '}
                  <span className="font-mono font-semibold">{summary.totalUnits}</span> unité(s)
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-bold text-base sm:text-lg text-blue-700 tabular-nums">
                {formatDzd(summary.totalSaleValueDzd)}
              </p>
            </div>
          </div>

          {/* Red: Coût d'achat total / Prix de revient du stock réel */}
          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-3 h-10 rounded-full bg-red-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-red-950">
                  Valeur du stock réel au prix d’achat (Prix de revient)
                </p>
                <p className="text-[11px] text-red-800">
                  Capital immobilisé dans votre stock réel (Quantité × Prix d’achat unitaire)
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-bold text-base sm:text-lg text-red-600 tabular-nums">
                {formatDzd(summary.totalCostValueDzd)}
              </p>
            </div>
          </div>

          {/* Diagnostic hint if purchase prices are missing or below cost */}
          {(summary.productsMissingCostCount > 0 || summary.lossProductsCount > 0) && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600">
              {summary.productsMissingCostCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    <strong>{summary.productsMissingCostCount}</strong> article(s) en stock sans prix d’achat renseigné (0 DZD)
                  </span>
                </span>
              )}
              {summary.lossProductsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-red-800 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                  <TrendingUp className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>
                    <strong>{summary.lossProductsCount}</strong> article(s) vendu(s) sous le prix d’achat
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
