import React, { useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Download,
  Lock,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { loadPrinterConfig, printPurchaseReceipt } from '../../lib/printer';
import { formatDzd, toCsv } from '../../shared/domain';
import { StarRating } from '../StarRating';

// ---------------------------------------------------------------------------
// 3. SALES LEDGER
// ---------------------------------------------------------------------------
export function AdminSales({
  sales,
  orders = [],
  storeSettings,
}: {
  sales: any[];
  orders?: any[];
  storeSettings?: any;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      `${s.orderReference} ${s.customerName} ${s.wilayaName}`.toLowerCase().includes(q),
    );
  }, [sales, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, s) => {
        acc.collected += Number(s.totalCollectedDzd || 0);
        acc.items += Number(s.itemsRevenueDzd || 0);
        acc.shipping += Number(s.shippingFeeDzd || 0);
        acc.margin += Number(s.estimatedMarginDzd || 0);
        return acc;
      },
      { collected: 0, items: 0, shipping: 0, margin: 0 },
    );
  }, [filtered]);

  const handleExport = () => {
    const csv = toCsv(
      ['Référence', 'Date', 'Client', 'Wilaya', 'Articles DZD', 'Remise DZD', 'Livraison DZD', 'Encaissé DZD', 'Marge estimée DZD'],
      filtered.map((s) => [
        s.orderReference,
        new Date(s.recordedAt).toLocaleDateString('fr-FR'),
        s.customerName,
        s.wilayaName,
        s.itemsRevenueDzd,
        s.discountDzd,
        s.shippingFeeDzd,
        s.totalCollectedDzd,
        s.estimatedMarginDzd,
      ]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2freres-ventes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Total encaissé (Livrées)</p>
          <p className="mt-1 font-mono font-bold text-xl text-slate-900 tabular-nums">
            {formatDzd(totals.collected)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Chiffre articles</p>
          <p className="mt-1 font-mono font-bold text-xl text-slate-900 tabular-nums">
            {formatDzd(totals.items)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Frais de livraison facturés</p>
          <p className="mt-1 font-mono font-bold text-xl text-slate-900 tabular-nums">
            {formatDzd(totals.shipping)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Marge brute estimée</p>
          <p className="mt-1 font-mono font-bold text-xl text-emerald-700 tabular-nums">
            {formatDzd(totals.margin)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Référence, client, wilaya..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exporter CSV</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Référence</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Client</th>
                <th className="py-3 px-4 font-semibold">Wilaya</th>
                <th className="py-3 px-4 font-semibold text-right">Encaissé</th>
                <th className="py-3 px-4 font-semibold text-right">Marge estimée</th>
                <th className="py-3 px-4 font-semibold text-right">Reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                    Aucune vente enregistrée. Une vente est automatiquement comptabilisée lorsqu’une commande passe au statut « Livrée ».
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                      {s.orderReference}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                      {new Date(s.recordedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{s.customerName}</td>
                    <td className="py-3 px-4 text-slate-600">{s.wilayaName}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {formatDzd(s.totalCollectedDzd)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                      {formatDzd(s.estimatedMarginDzd)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          const matchedOrder = orders.find(
                            (o) => o.id === s.orderId || o.reference === s.orderReference,
                          );
                          const printable = matchedOrder || {
                            reference: s.orderReference,
                            createdAt: s.recordedAt,
                            customerName: s.customerName,
                            customerPhone: '',
                            wilayaName: s.wilayaName,
                            commune: '',
                            address: '',
                            deliveryType: 'domicile',
                            paymentMethod: 'cod',
                            subtotalDzd: s.itemsRevenueDzd,
                            discountDzd: s.discountDzd,
                            shippingFeeDzd: s.shippingFeeDzd,
                            totalDzd: s.totalCollectedDzd,
                            items: [
                              {
                                productName: `Vente ${s.orderReference}`,
                                quantity: 1,
                                unitPriceDzd: s.itemsRevenueDzd,
                                lineTotalDzd: s.itemsRevenueDzd,
                              },
                            ],
                          };
                          printPurchaseReceipt(
                            printable,
                            storeSettings || {},
                            loadPrinterConfig(),
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                        title="Imprimer le bon d’achat / reçu"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Bon d’achat</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. CUSTOMERS MANAGEMENT
// ---------------------------------------------------------------------------
export function AdminCustomers({
  customers,
  onRefresh,
}: {
  customers: any[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.phone} ${c.wilayaName} ${c.commune}`
        .toLowerCase()
        .includes(q),
    );
  }, [customers, search]);

  const toggleBlock = async (c: any) => {
    setBusyId(c.id);
    setError(null);
    try {
      await adminFetch(`/api/admin/customers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isBlocked: !c.isBlocked }),
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    const csv = toCsv(
      ['Nom', 'Prénom', 'Téléphone', 'Wilaya', 'Commune', 'Commandes', 'Livrées', 'Retours', 'Total DZD', 'Statut'],
      filtered.map((c) => [
        c.lastName,
        c.firstName,
        c.phone,
        c.wilayaName,
        c.commune,
        c.ordersCount,
        c.deliveredCount,
        c.returnedCount,
        c.totalSpentDzd,
        c.isBlocked ? 'Bloqué' : 'Actif',
      ]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2freres-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, téléphone, wilaya..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
        >
          <Download className="w-3.5 h-3.5" />
          <span>CSV</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Client</th>
                <th className="py-3 px-4 font-semibold">Localisation</th>
                <th className="py-3 px-4 font-semibold text-right">Cmd / Livrées / Retours</th>
                <th className="py-3 px-4 font-semibold text-right">Total dépensé</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                    Aucun client enregistré pour l’instant.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="text-xs font-mono text-slate-500">{c.phone}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{c.wilayaName}</span> · {c.commune}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      <span>{c.ordersCount}</span> ·{' '}
                      <span className="text-emerald-700 font-semibold">{c.deliveredCount}</span> ·{' '}
                      <span className={c.returnedCount > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>
                        {c.returnedCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {formatDzd(c.totalSpentDzd)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={busyId === c.id}
                        onClick={() => toggleBlock(c)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                          c.isBlocked
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>{c.isBlocked ? 'Débloquer' : 'Bloquer'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. CUSTOMER REVIEWS MODERATION
// ---------------------------------------------------------------------------
export function AdminReviews({
  reviews,
  onRefresh,
}: {
  reviews: any[];
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? reviews : reviews.filter((r) => r.status === filter)),
    [reviews, filter],
  );

  const moderate = async (id: number, status: 'approved' | 'rejected', includeReply = false) => {
    setBusyId(id);
    setError(null);
    try {
      await adminFetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(includeReply ? { adminReply: replyDrafts[id] ?? '' } : {}),
        }),
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const removeReview = async (id: number) => {
    setBusyId(id);
    try {
      await adminFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: `Tous (${reviews.length})` },
            { id: 'pending', label: `En attente (${reviews.filter((r) => r.status === 'pending').length})` },
            { id: 'approved', label: `Approuvés (${reviews.filter((r) => r.status === 'approved').length})` },
            { id: 'rejected', label: `Rejetés (${reviews.filter((r) => r.status === 'rejected').length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              filter === tab.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Aucun avis dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <StarRating rating={r.rating} size="sm" />
                    <span className="font-semibold text-sm text-slate-900">{r.customerName}</span>
                    {r.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Achat vérifié ({r.orderReference})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Produit : <span className="font-medium text-slate-800">{r.productName}</span> ·{' '}
                    {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>

                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded ${
                    r.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700'
                      : r.status === 'rejected'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {r.status === 'approved' ? 'Approuvé' : r.status === 'rejected' ? 'Rejeté' : 'En attente'}
                </span>
              </div>

              {r.title && <p className="font-semibold text-sm text-slate-900">{r.title}</p>}
              <p className="text-sm text-slate-700">{r.comment}</p>

              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
                <input
                  value={replyDrafts[r.id] ?? r.adminReply ?? ''}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Réponse officielle 2Frères Phone (optionnel)..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => moderate(r.id, 'approved', true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approuver</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => moderate(r.id, 'rejected', true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Rejeter</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => removeReview(r.id)}
                    aria-label="Supprimer avis"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 10. RETURNS (RMA)
// ---------------------------------------------------------------------------
export function AdminReturns({
  returnsList,
  onRefresh,
}: {
  returnsList: any[];
  onRefresh: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (id: number, payload: Record<string, unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await adminFetch(`/api/admin/returns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Commande</th>
                <th className="py-3 px-4 font-semibold">Client &amp; Wilaya</th>
                <th className="py-3 px-4 font-semibold">Motif</th>
                <th className="py-3 px-4 font-semibold">État colis</th>
                <th className="py-3 px-4 font-semibold">Statut</th>
                <th className="py-3 px-4 font-semibold text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-slate-500">
                    Aucun retour enregistré. Lorsqu’une commande est passée au statut « Retournée », un dossier RMA apparaît ici automatiquement.
                  </td>
                </tr>
              ) : (
                returnsList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                      {r.orderReference}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-medium text-slate-900">{r.customerName}</p>
                      <p className="text-slate-500">
                        {r.phone} · {r.wilayaName}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{r.reason}</td>
                    <td className="py-3 px-4">
                      <select
                        value={r.condition}
                        disabled={busyId === r.id}
                        onChange={(e) => handleUpdate(r.id, { condition: e.target.value })}
                        className="text-xs px-2 py-1 rounded border border-slate-300 bg-white"
                      >
                        <option value="intact">Intact / Revendable</option>
                        <option value="ouvert">Emballage ouvert</option>
                        <option value="endommage">Endommagé</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">{r.status}</td>
                    <td className="py-3 px-4 text-right">
                      {r.restocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Réintégré
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => handleUpdate(r.id, { restockNow: true })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Réintégrer au stock</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 11. PROMOTIONS
// ---------------------------------------------------------------------------
export function AdminPromotions({
  promotions,
  onRefresh,
}: {
  promotions: any[];
  onRefresh: () => void;
}) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed_dzd'>('percent');
  const [discountValue, setDiscountValue] = useState(10);
  const [minOrderDzd, setMinOrderDzd] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await adminFetch('/api/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          description,
          discountType,
          discountValue,
          minOrderDzd,
        }),
      });
      setCode('');
      setDescription('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: any) => {
    await adminFetch(`/api/admin/promotions/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    onRefresh();
  };

  const deletePromo = async (id: number) => {
    await adminFetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <form
        onSubmit={handleCreate}
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-700" />
          <h3 className="font-display font-semibold text-base text-slate-900">Créer un code promo</h3>
        </div>
        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
        )}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Code *</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex. RAMADAN10"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono uppercase"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex. -10% sur tout le panier"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="percent">Pourcentage (%)</option>
              <option value="fixed_dzd">Montant fixe (DZD)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Valeur</label>
            <input
              type="number"
              min={1}
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Commande minimum (DZD)</label>
          <input
            type="number"
            min={0}
            value={minOrderDzd}
            onChange={(e) => setMinOrderDzd(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? 'Création...' : 'Ajouter la promotion'}</span>
        </button>
      </form>

      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className="py-3 px-4 font-semibold">Code</th>
              <th className="py-3 px-4 font-semibold">Remise</th>
              <th className="py-3 px-4 font-semibold">Min.</th>
              <th className="py-3 px-4 font-semibold">Utilisations</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promotions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                  Aucun code promo configuré.
                </td>
              </tr>
            ) : (
              promotions.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-900">{p.code}</span>
                    {p.description && <span className="block text-xs text-slate-500">{p.description}</span>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-700 tabular-nums">
                    {p.discountType === 'percent' ? `-${p.discountValue}%` : `-${formatDzd(p.discountValue)}`}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                    {p.minOrderDzd > 0 ? formatDzd(p.minOrderDzd) : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                    {p.usesCount}
                    {p.maxUses ? ` / ${p.maxUses}` : ''}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(p)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold ${
                          p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.isActive ? 'Actif' : 'Inactif'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePromo(p.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label={`Supprimer ${p.code}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 12. DIGITAL PRODUCTS & PROTECTED FULFILLMENT
// ---------------------------------------------------------------------------
export function AdminDigitalDeliveries({
  deliveries,
  onRefresh,
}: {
  deliveries: any[];
  onRefresh: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, { instructions: string; privateNote: string }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getDraft = (d: any) =>
    drafts[d.id] || {
      instructions: d.activationInstructions || '',
      privateNote: d.privateFulfillmentNote || '',
    };

  const saveDelivery = async (d: any, nextStatus: 'pending' | 'processing' | 'delivered' | 'cancelled') => {
    setBusyId(d.id);
    setError(null);
    const cur = getDraft(d);
    try {
      await adminFetch(`/api/admin/digital-deliveries/${d.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          deliveryStatus: nextStatus,
          activationInstructions: cur.instructions,
          privateFulfillmentNote: cur.privateNote,
        }),
      });
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 text-white rounded-xl p-4 flex items-start gap-3">
        <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <p className="font-semibold text-sm">Protection stricte des comptes et abonnements numériques</p>
          <p className="text-slate-300 mt-1">
            Les identifiants et notes internes ne sont jamais exposés publiquement. Les instructions d’activation ne deviennent visibles sur la page de suivi qu’après validation manuelle du paiement et vérification du numéro de téléphone client.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {deliveries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Aucune commande de produit numérique (Netflix, Snapchat+, Xbox, PlayStation, Cartes cadeaux) en attente.
        </div>
      ) : (
        <div className="space-y-4">
          {deliveries.map((d) => {
            const cur = getDraft(d);
            return (
              <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display font-semibold text-base text-slate-900">{d.productName}</p>
                    <p className="text-xs text-slate-500">
                      Commande <span className="font-mono font-semibold text-slate-800">{d.orderReference}</span> ·{' '}
                      {d.customerName} (<span className="font-mono">{d.customerPhone}</span>)
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded ${
                      d.deliveryStatus === 'delivered'
                        ? 'bg-emerald-50 text-emerald-700'
                        : d.deliveryStatus === 'cancelled'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {d.deliveryStatus === 'delivered'
                      ? 'Activée / Livrée'
                      : d.deliveryStatus === 'processing'
                      ? 'En cours'
                      : d.deliveryStatus === 'cancelled'
                      ? 'Annulée'
                      : 'En attente de validation paiement'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Instructions d’activation (visibles client après livraison + vérif téléphone)
                    </label>
                    <textarea
                      rows={3}
                      value={cur.instructions}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [d.id]: { ...cur, instructions: e.target.value },
                        }))
                      }
                      placeholder="Ex. Contactez notre WhatsApp officiel avec votre référence pour recevoir votre accès sécurisé."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Note privée admin (strictement confidentielle, jamais exposée)
                    </label>
                    <textarea
                      rows={3}
                      value={cur.privateNote}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [d.id]: { ...cur, privateNote: e.target.value },
                        }))
                      }
                      placeholder="Ex. Paiement BaridiMob vérifié, code envoyé par WhatsApp le..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-slate-50"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => saveDelivery(d, 'processing')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700"
                  >
                    Enregistrer (En cours)
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => saveDelivery(d, 'delivered')}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Valider paiement &amp; Marquer livrée</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
