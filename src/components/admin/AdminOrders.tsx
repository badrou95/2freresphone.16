import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  Kanban,
  List,
  Printer,
  Receipt,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { printDeliverySlip, printPurchaseReceipt } from '../../lib/printer';
import {
  formatDzd,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  OrderStatus,
  toCsv,
} from '../../shared/domain';
import { StoreSettings } from '../../types';

interface AdminOrdersProps {
  orders: any[];
  carriers: any[];
  storeSettings?: Partial<StoreSettings>;
  onRefresh: () => void;
}

export function AdminOrders({ orders, carriers, storeSettings = {}, onRefresh }: AdminOrdersProps) {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal edit fields
  const [editStatus, setEditStatus] = useState<OrderStatus>('nouvelle');
  const [editCarrierId, setEditCarrierId] = useState<string>('');
  const [editTracking, setEditTracking] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatusNote, setEditStatusNote] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (q) {
        const hay = `${o.reference} ${o.firstName} ${o.lastName} ${o.phone} ${o.wilayaName} ${o.commune}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openOrderModal = (o: any) => {
    setSelectedOrder(o);
    setEditStatus(o.status);
    setEditCarrierId(o.carrierId ? String(o.carrierId) : '');
    setEditTracking(o.trackingNumber || '');
    setEditNotes(o.adminNotes || '');
    setEditStatusNote('');
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setActionError(null);
    try {
      await adminFetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editStatus,
          carrierId: editCarrierId ? Number(editCarrierId) : null,
          trackingNumber: editTracking,
          adminNotes: editNotes,
          note: editStatusNote || undefined,
        }),
      });
      setSelectedOrder(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors de la mise à jour de la commande.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (orderId: number, status: OrderStatus) => {
    try {
      await adminFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onRefresh();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteOrder = async (order: any) => {
    if (confirmDeleteId !== order.id) {
      setConfirmDeleteId(order.id);
      return;
    }
    setDeletingId(order.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await adminFetch<{
        deleted: boolean;
        reference: string;
        stockWasDeducted: boolean;
        restoredUnits: number;
      }>(`/api/admin/orders/${order.id}`, {
        method: 'DELETE',
      });
      setConfirmDeleteId(null);
      if (selectedOrder?.id === order.id) setSelectedOrder(null);
      setActionSuccess(
        res.restoredUnits > 0
          ? `Commande ${res.reference} supprimée — ${res.restoredUnits} article(s) remis automatiquement en stock.`
          : `Commande ${res.reference} supprimée avec succès.`,
      );
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors de la suppression de la commande.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    const csv = toCsv(
      ['Référence', 'Date', 'Client', 'Téléphone', 'Wilaya', 'Commune', 'Livraison', 'Statut', 'Total DZD'],
      filtered.map((o) => [
        o.reference,
        new Date(o.createdAt).toLocaleString('fr-FR'),
        `${o.firstName} ${o.lastName}`,
        o.phone,
        o.wilayaName,
        o.commune,
        o.deliveryType,
        ORDER_STATUS_LABELS[o.status as OrderStatus] || o.status,
        o.totalDzd,
      ]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2freres-commandes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {actionError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-semibold underline">
            Fermer
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {actionSuccess}
          </span>
          <button type="button" onClick={() => setActionSuccess(null)} className="font-semibold underline">
            Fermer
          </button>
        </div>
      )}
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Référence, client, téléphone, wilaya..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrer par statut"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
          >
            <option value="">Tous les statuts ({orders.length})</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({orders.filter((o) => o.status === s.value).length})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tableau</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">Référence</th>
                  <th className="py-3 px-4 font-semibold">Client &amp; Fiabilité</th>
                  <th className="py-3 px-4 font-semibold">Destination</th>
                  <th className="py-3 px-4 font-semibold">Statut</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                      Aucune commande trouvée.
                    </td>
                  </tr>
                ) : (
                  paginated.map((o) => {
                    const rel = o.phoneReliability;
                    const risky = rel && rel.returned > 0;
                    return (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-slate-900">{o.reference}</span>
                          <span className="block text-[11px] text-slate-400 tabular-nums">
                            {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">
                            {o.firstName} {o.lastName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                            <span>{o.phone}</span>
                            {risky && (
                              <span className="inline-flex items-center gap-1 text-red-600 font-sans font-medium">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                {rel.returned} retour(s)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <span className="font-medium text-slate-900">{o.wilayaName}</span> · {o.commune}
                          <span className="block text-slate-400">
                            {o.deliveryType === 'stop_desk'
                              ? 'STOP DESK'
                              : o.deliveryType === 'digital'
                              ? 'Numérique'
                              : 'À domicile'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            aria-label={`Changer statut de ${o.reference}`}
                            value={o.status}
                            onChange={(e) => handleQuickStatus(o.id, e.target.value as OrderStatus)}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatDzd(o.totalDzd)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => printDeliverySlip(o, storeSettings)}
                              title="Imprimer le bon de livraison"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => printPurchaseReceipt(o, storeSettings)}
                              title="Imprimer le bon d’achat / reçu"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openOrderModal(o)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Détails</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === o.id}
                              onClick={() => handleDeleteOrder(o)}
                              title="Supprimer la commande (retour auto en stock)"
                              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-semibold ${
                                confirmDeleteId === o.id
                                  ? 'bg-red-600 text-white border-red-600'
                                  : 'border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50'
                              }`}
                            >
                              {confirmDeleteId === o.id ? (
                                <span>{deletingId === o.id ? '...' : 'Confirmer ?'}</span>
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="tabular-nums">
                Page {page} / {totalPages} ({filtered.length} commandes)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Kanban View inspired by Mystoq */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ORDER_STATUSES.map((col) => {
            const colOrders = filtered.filter((o) => o.status === col.value);
            return (
              <div key={col.value} className="bg-slate-100/80 border border-slate-200 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-800">{col.label}</span>
                  <span className="text-xs font-mono text-slate-500 tabular-nums">{colOrders.length}</span>
                </div>
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto">
                  {colOrders.map((o) => (
                    <div
                      key={o.id}
                      onClick={() => openOrderModal(o)}
                      className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-blue-400 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900">{o.reference}</span>
                        <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                          {formatDzd(o.totalDzd)}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-800">
                        {o.firstName} {o.lastName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {o.wilayaName} · {o.phone}
                      </p>
                    </div>
                  ))}
                  {colOrders.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">Aucune</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">
                  Commande {selectedOrder.reference}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedOrder.firstName} {selectedOrder.lastName} · {selectedOrder.phone} · {selectedOrder.wilayaName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div>
                  <p className="text-slate-500">Adresse complète</p>
                  <p className="font-medium text-slate-900 mt-0.5">
                    {selectedOrder.address}, {selectedOrder.commune}, {selectedOrder.wilayaName}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Historique téléphone client</p>
                  <p className="font-medium text-slate-900 mt-0.5 tabular-nums">
                    {selectedOrder.phoneReliability?.total || 1} cmd ·{' '}
                    <span className="text-emerald-700">{selectedOrder.phoneReliability?.delivered || 0} livrée(s)</span> ·{' '}
                    <span className="text-red-600">{selectedOrder.phoneReliability?.returned || 0} retour(s)</span>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Articles</h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {selectedOrder.items?.map((item: any) => (
                    <div key={item.id} className="px-4 py-2.5 flex justify-between text-sm">
                      <span>
                        {item.productName} <span className="text-slate-400">×{item.quantity}</span>
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatDzd(item.lineTotalDzd)}
                      </span>
                    </div>
                  ))}
                  <div className="px-4 py-2.5 flex justify-between text-xs text-slate-600 bg-slate-50">
                    <span>Livraison ({selectedOrder.deliveryType})</span>
                    <span className="font-mono tabular-nums">{formatDzd(selectedOrder.shippingFeeDzd)}</span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between text-sm font-bold text-slate-900 bg-slate-50">
                    <span>Total à payer</span>
                    <span className="font-mono tabular-nums">{formatDzd(selectedOrder.totalDzd)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Statut</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transporteur</label>
                  <select
                    value={editCarrierId}
                    onChange={(e) => setEditCarrierId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Non assigné</option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Numéro de suivi (Tracking)</label>
                  <input
                    value={editTracking}
                    onChange={(e) => setEditTracking(e.target.value)}
                    placeholder="Ex. YAL-982341"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Note d’historique (optionnel)</label>
                  <input
                    value={editStatusNote}
                    onChange={(e) => setEditStatusNote(e.target.value)}
                    placeholder="Ex. Confirmée par appel téléphonique"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes internes admin</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              {/* Print & Delete Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printDeliverySlip(selectedOrder, storeSettings)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Bon de livraison</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printPurchaseReceipt(selectedOrder, storeSettings)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Bon d’achat</span>
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === selectedOrder.id}
                    onClick={() => handleDeleteOrder(selectedOrder)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold ${
                      confirmDeleteId === selectedOrder.id
                        ? 'bg-red-600 text-white border-red-600'
                        : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {confirmDeleteId === selectedOrder.id
                        ? deletingId === selectedOrder.id
                          ? 'Suppression...'
                          : 'Confirmer suppression (retour stock)'
                        : 'Supprimer'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteId(null);
                      setSelectedOrder(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveOrder}
                    className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
