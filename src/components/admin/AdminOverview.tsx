import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Camera,
  CheckCircle2,
  Database,
  Package,
  ShoppingCart,
  Star,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDzd, ORDER_STATUS_LABELS, OrderStatus } from '../../shared/domain';
import { FinancialMarginWidget } from './FinancialMarginWidget';

interface AdminOverviewProps {
  data: any;
  products?: any[];
  onNavigateTab: (tab: string, extra?: any) => void;
}

export function AdminOverview({ data, products = [], onNavigateTab }: AdminOverviewProps) {
  if (!data) return null;
  const { kpis, chartSeries, topWilayas, activeLowStockAlerts, recentOrders } = data;

  return (
    <div className="space-y-6">
      {/* Prominent .MDF + .IDF Stock & Compta Integration Card */}
      <div className="bg-white border-2 border-blue-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-xl bg-blue-700 text-white shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-bold uppercase tracking-wider mb-1">
              Sauvegarde .MDF + .IDF · Stock &amp; Comptabilité
            </span>
            <h2 className="font-display font-bold text-sm sm:text-base text-slate-900">
              Intégrez vos fichiers .MDF et .IDF pour générer votre Stock et toute votre Compta
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Chargez vos deux fichiers de sauvegarde (Point 1 : <strong>.mdf</strong> et Point 2 : <strong>.idf</strong>) pour enregistrer automatiquement tous vos produits, prix d’achat/vente et votre bilan comptable.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('mdf_import')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Importer mes fichiers .MDF + .IDF</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('stock', { subTab: 'compta' })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Voir ma Comptabilité &amp; Bilan</span>
          </button>
        </div>
      </div>
      {/* Prominent Low Stock Alert Banner */}
      {activeLowStockAlerts && activeLowStockAlerts.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display font-bold text-sm text-red-900">
                Alerte stock faible : {activeLowStockAlerts.length} produit
                {activeLowStockAlerts.length > 1 ? 's' : ''} sous le seuil configuré
              </h2>
              <p className="text-xs text-red-800 mt-1">
                {activeLowStockAlerts
                  .slice(0, 3)
                  .map((a: any) => `${a.productName} (${a.currentStock}/${a.thresholdUsed})`)
                  .join(' · ')}
                {activeLowStockAlerts.length > 3 ? ` · +${activeLowStockAlerts.length - 3} autre(s)` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('stock', { subTab: 'alerts' })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
          >
            <span>Gérer les alertes stock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Action Strip for Photos / Reviews / Digital */}
      {(kpis.productsWithoutPhotos > 0 || kpis.pendingReviewsCount > 0 || kpis.pendingDigitalCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {kpis.productsWithoutPhotos > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('products', { onlyMissingPhotos: true })}
              className="bg-white border border-slate-200 hover:border-blue-400 rounded-xl p-4 text-left flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-blue-700 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Catalogue à illustrer</p>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">
                    {kpis.productsWithoutPhotos} article(s) sans photo
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {kpis.pendingReviewsCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('reviews')}
              className="bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-4 text-left flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Modération avis</p>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">
                    {kpis.pendingReviewsCount} avis en attente
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {kpis.pendingDigitalCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('digital')}
              className="bg-white border border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-left flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Produits numériques</p>
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">
                    {kpis.pendingDigitalCount} activation(s) à traiter
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Ventes encaissées (Livrées)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono font-bold text-2xl text-slate-900 tabular-nums">
            {formatDzd(kpis.deliveredRevenueDzd)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Marge estimée : {formatDzd(kpis.estimatedMarginDzd)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Commandes totales</span>
            <ShoppingCart className="w-4 h-4 text-blue-700" />
          </div>
          <p className="mt-2 font-mono font-bold text-2xl text-slate-900 tabular-nums">
            {kpis.totalOrders}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {kpis.newOrders} nouvelle(s) / à confirmer · En cours : {formatDzd(kpis.pendingPipelineDzd)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Taux confirmation / livraison</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="mt-2 font-mono font-bold text-2xl text-slate-900 tabular-nums">
            {kpis.confirmationRate}% / {kpis.deliveryRate}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Taux de retour : {kpis.returnRate}%
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Catalogue &amp; Valeur stock</span>
            <Package className="w-4 h-4 text-slate-700" />
          </div>
          <p className="mt-2 font-mono font-bold text-2xl text-slate-900 tabular-nums">
            {formatDzd(kpis.stockValuationDzd)}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {kpis.totalProducts} produits · {kpis.totalCustomers} clients
          </p>
        </div>
      </div>

      {/* Financial Margin Summary Donut Chart (Vert / Rouge / Bleu) */}
      <FinancialMarginWidget
        items={products}
        onGoToStock={() => onNavigateTab('stock', { subTab: 'levels' })}
      />

      {/* Charts + Top Wilayas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-base text-slate-900">
                Activité des 14 derniers jours
              </h3>
              <p className="text-xs text-slate-500">
                Données réelles issues de la base PostgreSQL (ventes encaissées DZD)
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value: any, name: any) =>
                    name === 'ventesDzd' ? [formatDzd(Number(value)), 'Ventes encaissées'] : [value, 'Commandes']
                  }
                />
                <Bar dataKey="ventesDzd" fill="#1d4ed8" radius={[4, 4, 0, 0]} name="ventesDzd" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <h3 className="font-display font-semibold text-base text-slate-900">Top Wilayas</h3>
          <p className="text-xs text-slate-500 mb-4">Répartition des commandes par wilaya</p>
          {topWilayas && topWilayas.length > 0 ? (
            <div className="space-y-3 flex-1">
              {topWilayas.map((w: any) => (
                <div key={w.wilaya} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{w.wilaya}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {w.count} cmd
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 my-auto text-center py-8">
              Les statistiques par wilaya apparaîtront dès les premières commandes.
            </p>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-display font-semibold text-base text-slate-900">
            Dernières commandes reçues
          </h3>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Voir toutes les commandes
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Référence</th>
                <th className="py-2.5 px-4 font-semibold">Client</th>
                <th className="py-2.5 px-4 font-semibold">Wilaya</th>
                <th className="py-2.5 px-4 font-semibold">Statut</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders && recentOrders.length > 0 ? (
                recentOrders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">
                      {o.reference}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {o.firstName} {o.lastName}
                      <span className="block text-xs font-mono text-slate-400">{o.phone}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{o.wilayaName}</td>
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-700">
                      {ORDER_STATUS_LABELS[o.status as OrderStatus] || o.status}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {formatDzd(o.totalDzd)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                    Aucune commande enregistrée pour l’instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
