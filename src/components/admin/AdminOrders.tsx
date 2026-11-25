import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Eye,
  Kanban,
  List,
  MessageCircle,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  PhoneOff,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { printDeliverySlip, printPurchaseReceipt } from '../../lib/printer';
import {
  CALL_STATUSES,
  CallStatus,
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

type CarrierExportFormat = 'standard' | 'yalidine' | 'zrexpress' | 'maystro' | 'ecotrack';
type OrdersSubTab = 'all' | 'call_center' | 'abandoned' | 'cod_reconcile';

function formatAlgPhoneForWa(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('213')) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `213${digits.slice(1)}`;
  return `213${digits}`;
}

export function AdminOrders({ orders, carriers, storeSettings = {}, onRefresh }: AdminOrdersProps) {
  const [subTab, setSubTab] = useState<OrdersSubTab>('all');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [callFilter, setCallFilter] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<CarrierExportFormat>('yalidine');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal edit fields
  const [editStatus, setEditStatus] = useState<OrderStatus>('nouvelle');
  const [editCallStatus, setEditCallStatus] = useState<CallStatus>('non_appele');
  const [editCallNotes, setEditCallNotes] = useState('');
  const [editCarrierId, setEditCarrierId] = useState<string>('');
  const [editTracking, setEditTracking] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatusNote, setEditStatusNote] = useState('');

  // Abandoned Orders State
  const [abandonedOrders, setAbandonedOrders] = useState<any[]>([]);
  const [loadingAbandoned, setLoadingAbandoned] = useState(false);
  const [convertingAbandonedId, setConvertingAbandonedId] = useState<number | null>(null);

  // COD Reconciliation State
  const [selectedReconcileIds, setSelectedReconcileIds] = useState<number[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileFilter, setReconcileFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  const fetchAbandonedOrders = async () => {
    setLoadingAbandoned(true);
    try {
      const res = await adminFetch<{ abandonedOrders: any[] }>('/api/admin/abandoned-orders');
      setAbandonedOrders(res.abandonedOrders || []);
    } catch {
      // ignore
    } finally {
      setLoadingAbandoned(false);
    }
  };

  useEffect(() => {
    fetchAbandonedOrders();
  }, []);

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

  const callCenterOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const cs = o.callStatus || 'non_appele';
      if (callFilter && cs !== callFilter) return false;
      if (!callFilter && !['nouvelle', 'confirmee', 'annulee'].includes(o.status)) return false;
      if (q) {
        const hay = `${o.reference} ${o.firstName} ${o.lastName} ${o.phone} ${o.wilayaName} ${o.commune}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, callFilter]);

  const reconcileOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!['livree', 'expediee', 'retournee'].includes(o.status)) return false;
      if (reconcileFilter === 'unpaid' && (o.paymentStatus === 'paid' || o.status !== 'livree')) return false;
      if (reconcileFilter === 'paid' && o.paymentStatus !== 'paid') return false;
      return true;
    });
  }, [orders, reconcileFilter]);

  const codKpis = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'livree');
    const paidByCarrier = delivered.filter((o) => o.paymentStatus === 'paid');
    const unpaidByCarrier = delivered.filter((o) => o.paymentStatus !== 'paid');
    const inTransit = orders.filter((o) => o.status === 'expediee');
    const returned = orders.filter((o) => o.status === 'retournee');

    return {
      paidCount: paidByCarrier.length,
      paidAmountDzd: paidByCarrier.reduce((s, o) => s + (Number(o.totalDzd) || 0), 0),
      unpaidCount: unpaidByCarrier.length,
      unpaidAmountDzd: unpaidByCarrier.reduce((s, o) => s + (Number(o.totalDzd) || 0), 0),
      inTransitCount: inTransit.length,
      inTransitAmountDzd: inTransit.reduce((s, o) => s + (Number(o.totalDzd) || 0), 0),
      returnedCount: returned.length,
      returnedAmountDzd: returned.reduce((s, o) => s + (Number(o.totalDzd) || 0), 0),
    };
  }, [orders]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openOrderModal = (o: any) => {
    setSelectedOrder(o);
    setEditStatus(o.status);
    setEditCallStatus((o.callStatus as CallStatus) || 'non_appele');
    setEditCallNotes(o.callNotes || '');
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
          callStatus: editCallStatus,
          callNotes: editCallNotes,
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

  const handleQuickCallStatus = async (order: any, callStatus: CallStatus) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const nextAttempts =
        callStatus !== 'non_appele' ? (Number(order.callAttempts) || 0) + 1 : Number(order.callAttempts) || 0;
      await adminFetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          callStatus,
          callAttempts: nextAttempts,
        }),
      });
      const label = CALL_STATUSES.find((c) => c.value === callStatus)?.label || callStatus;
      setActionSuccess(`Commande ${order.reference} : ${label} (Tentative #${nextAttempts}).`);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de la mise à jour du statut d'appel.");
    }
  };

  const handleBlockPhone = async (order: any) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await adminFetch('/api/admin/customers/block-phone', {
        method: 'POST',
        body: JSON.stringify({
          phone: order.phone,
          firstName: order.firstName,
          lastName: order.lastName,
          wilayaCode: order.wilayaCode,
          reason: `Bloqué depuis la commande ${order.reference}`,
        }),
      });
      await adminFetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          callStatus: 'faux_numero',
          status: 'annulee',
        }),
      });
      setActionSuccess(
        `Numéro ${order.phone} placé sur Liste Noire Anti-Fraude et commande ${order.reference} annulée.`,
      );
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Impossible de bloquer ce numéro.');
    }
  };

  const handleConvertAbandoned = async (ab: any) => {
    setConvertingAbandonedId(ab.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await adminFetch<{ order: any }>(`/api/admin/abandoned-orders/${ab.id}/convert`, {
        method: 'POST',
      });
      setActionSuccess(
        `Panier abandonné de ${ab.firstName || ab.phone} converti en commande COD confirmée (${res.order?.reference}) !`,
      );
      await fetchAbandonedOrders();
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Impossible de convertir cette commande abandonnée.');
    } finally {
      setConvertingAbandonedId(null);
    }
  };

  const handleDeleteAbandoned = async (id: number) => {
    try {
      await adminFetch(`/api/admin/abandoned-orders/${id}`, { method: 'DELETE' });
      await fetchAbandonedOrders();
    } catch {
      // ignore
    }
  };

  const handleBatchReconcileCod = async (ids: number[], paymentStatus: 'paid' | 'unpaid') => {
    if (ids.length === 0) return;
    setReconciling(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await adminFetch<{ updatedCount: number }>('/api/admin/orders/reconcile-cod', {
        method: 'POST',
        body: JSON.stringify({ orderIds: ids, paymentStatus }),
      });
      setSelectedReconcileIds([]);
      setActionSuccess(
        paymentStatus === 'paid'
          ? `${res.updatedCount} colis pointé(s) comme Encaissé & Versé par le transporteur.`
          : `${res.updatedCount} colis remis en attente de versement transporteur.`,
      );
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Erreur lors du pointage COD transporteur.');
    } finally {
      setReconciling(false);
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
    const dateStamp = new Date().toISOString().slice(0, 10);
    let csv = '';
    const filename = `2freres-commandes-${exportFormat}-${dateStamp}.csv`;

    const buildProductsSummary = (o: any) =>
      (o.items || []).map((i: any) => `${i.productName} x${i.quantity}`).join(' + ') || 'Commande 2Frères Phone';

    if (exportFormat === 'yalidine') {
      csv = toCsv(
        [
          'Nom',
          'Prénom',
          'Téléphone',
          'Wilaya',
          'Commune',
          'Adresse',
          'Stop Desk (Oui/Non)',
          'Produit',
          'Montant COD (DZD)',
          'Référence Interne',
          'Échange (Oui/Non)',
        ],
        filtered.map((o) => [
          o.lastName || o.firstName,
          o.firstName,
          o.phone,
          `${String(o.wilayaCode || '').padStart(2, '0')} - ${o.wilayaName}`,
          o.commune,
          o.address,
          o.deliveryType === 'stop_desk' ? 'Oui' : 'Non',
          buildProductsSummary(o),
          o.totalDzd,
          o.reference,
          'Non',
        ]),
      );
    } else if (exportFormat === 'zrexpress') {
      csv = toCsv(
        [
          'Client',
          'Tel1',
          'Tel2',
          'Wilaya',
          'Commune',
          'Adresse',
          'Type Livraison',
          'Contenu Colis',
          'Total COD DZD',
          'Ref Boutique',
        ],
        filtered.map((o) => [
          `${o.firstName} ${o.lastName}`.trim(),
          o.phone,
          '',
          o.wilayaName,
          o.commune,
          o.address,
          o.deliveryType === 'stop_desk' ? 'STOP DESK' : 'DOMICILE',
          buildProductsSummary(o),
          o.totalDzd,
          o.reference,
        ]),
      );
    } else if (exportFormat === 'maystro') {
      csv = toCsv(
        [
          'external_id',
          'customer_name',
          'customer_phone',
          'wilaya_code',
          'wilaya_name',
          'commune_name',
          'delivery_address',
          'is_stop_desk',
          'products_description',
          'cod_amount_dzd',
        ],
        filtered.map((o) => [
          o.reference,
          `${o.firstName} ${o.lastName}`.trim(),
          o.phone,
          o.wilayaCode,
          o.wilayaName,
          o.commune,
          o.address,
          o.deliveryType === 'stop_desk' ? '1' : '0',
          buildProductsSummary(o),
          o.totalDzd,
        ]),
      );
    } else if (exportFormat === 'ecotrack') {
      csv = toCsv(
        [
          'reference',
          'nom_client',
          'telephone',
          'code_wilaya',
          'commune',
          'adresse',
          'stop_desk',
          'designation',
          'montant_da',
        ],
        filtered.map((o) => [
          o.reference,
          `${o.firstName} ${o.lastName}`.trim(),
          o.phone,
          o.wilayaCode,
          o.commune,
          o.address,
          o.deliveryType === 'stop_desk' ? 'OUI' : 'NON',
          buildProductsSummary(o),
          o.totalDzd,
        ]),
      );
    } else {
      csv = toCsv(
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
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setActionSuccess(
      `Export CSV (${exportFormat.toUpperCase()}) généré avec succès pour ${filtered.length} commande(s).`,
    );
  };

  const pendingCallsCount = orders.filter(
    (o) => o.status === 'nouvelle' && (!o.callStatus || o.callStatus === 'non_appele' || o.callStatus.startsWith('tentative')),
  ).length;
  const activeAbandonedCount = abandonedOrders.filter((a) => a.status === 'abandoned').length;

  return (
    <div className="space-y-5">
      {/* Sub-Navigation Tabs for 2FP COD Operations */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('all')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <List className="w-3.5 h-3.5" />
          <span>Toutes les Commandes ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('call_center')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'call_center'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Centre d’Appel &amp; Confirmation</span>
          {pendingCallsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono text-[10px] font-bold">
              {pendingCallsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('abandoned');
            fetchAbandonedOrders();
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'abandoned'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Commandes Abandonnées (2FP AbandonGuard)</span>
          {activeAbandonedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white font-mono text-[10px] font-bold">
              {activeAbandonedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('cod_reconcile')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
            subTab === 'cod_reconcile'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Réconciliation COD Transporteurs</span>
          {codKpis.unpaidCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
              {codKpis.unpaidCount} à pointer
            </span>
          )}
        </button>
      </div>

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

      {/* TAB 2: 2FP CALL CENTER & CONFIRMATION */}
      {subTab === 'call_center' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                2FP CallCenter · Confirmation Téléphonique Anti-Retour
              </span>
              <h3 className="font-display font-bold text-base text-slate-900">
                File d’appels de confirmation COD (58 Wilayas)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Téléphone, client, réf..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300"
                />
              </div>
              <select
                value={callFilter}
                onChange={(e) => setCallFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value="">Tous les appels à traiter</option>
                {CALL_STATUSES.map((cs) => (
                  <option key={cs.value} value={cs.value}>
                    {cs.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {callCenterOrders.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                Aucune commande dans la file d’appel pour ce filtre.
              </div>
            ) : (
              callCenterOrders.slice(0, 30).map((o) => {
                const cs = (o.callStatus as CallStatus) || 'non_appele';
                const csLabel = CALL_STATUSES.find((c) => c.value === cs)?.label || 'Non appelé';
                const attempts = Number(o.callAttempts) || 0;
                const rel = o.phoneReliability;
                const risky = rel && rel.returned > 0;

                return (
                  <div
                    key={o.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {o.reference}
                        </span>
                        <span className="font-bold text-sm text-slate-900">
                          {o.firstName} {o.lastName}
                        </span>
                        <a
                          href={`tel:${o.phone}`}
                          className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md hover:bg-blue-100"
                        >
                          {o.phone}
                        </a>
                        <span className="text-xs text-slate-600 font-medium">
                          {o.wilayaName} · {o.commune} (
                          {o.deliveryType === 'stop_desk' ? 'STOP DESK' : 'Domicile'})
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-700">
                          {formatDzd(o.totalDzd)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>
                          Articles :{' '}
                          <strong className="text-slate-800">
                            {(o.items || []).map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}
                          </strong>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          <Clock className="w-3 h-3" />
                          {csLabel} ({attempts} appel{attempts > 1 ? 's' : ''})
                        </span>
                        {risky && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Client à risque ({rel.returned} retour(s) précédent(s))
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleQuickCallStatus(o, 'confirme_tel')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmé</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCallStatus(o, 'appel_1_sans_reponse')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold"
                      >
                        <PhoneMissed className="w-3.5 h-3.5" />
                        <span>Appel 1 (Pas de rép.)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCallStatus(o, 'appel_2_eteint')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold"
                      >
                        <PhoneOff className="w-3.5 h-3.5" />
                        <span>Appel 2 (Éteint)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickCallStatus(o, 'appel_3_reporte')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold"
                      >
                        <PhoneForwarded className="w-3.5 h-3.5" />
                        <span>Reporté</span>
                      </button>
                      <a
                        href={`https://wa.me/${formatAlgPhoneForWa(o.phone)}?text=${encodeURIComponent(
                          `Bonjour ${o.firstName}, nous avons essayé de vous joindre pour confirmer votre commande ${o.reference} (${formatDzd(
                            o.totalDzd,
                          )}) chez ${storeSettings.storeName || '2Frères Phone'}. Répondez OUI pour expédier votre colis vers ${o.wilayaName}.`,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleBlockPhone(o)}
                        title="Faux numéro / Liste noire anti-spam"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Bloquer N°</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: 2FP ABANDONGUARD — COMMANDES ABANDONNÉES EN TEMPS RÉEL */}
      {subTab === 'abandoned' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                2FP AbandonGuard · Capture Automatique en Temps Réel
              </span>
              <h3 className="font-display font-bold text-base text-slate-900">
                Paniers &amp; Formulaires COD Abandonnés ({abandonedOrders.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dès qu’un visiteur saisit son numéro 05/06/07 sur une fiche produit ou landing page sans valider, il apparaît ici pour relance WhatsApp ou conversion en 1 clic.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAbandonedOrders}
              disabled={loadingAbandoned}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAbandoned ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Date capture</th>
                    <th className="py-3 px-4 font-semibold">Prospect &amp; Téléphone</th>
                    <th className="py-3 px-4 font-semibold">Wilaya &amp; Commune</th>
                    <th className="py-3 px-4 font-semibold">Produit souhaité</th>
                    <th className="py-3 px-4 font-semibold text-right">Montant COD</th>
                    <th className="py-3 px-4 font-semibold">Statut</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions 1-Clic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {abandonedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        Aucune commande abandonnée capturée pour le moment.
                      </td>
                    </tr>
                  ) : (
                    abandonedOrders.map((ab) => (
                      <tr key={ab.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                          {new Date(ab.updatedAt || ab.createdAt).toLocaleString('fr-FR')}
                          <span className="block text-[10px] uppercase font-semibold text-slate-400">
                            Source : {ab.source}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            {ab.firstName || 'Client'} {ab.lastName || ''}
                          </p>
                          <a
                            href={`tel:${ab.phone}`}
                            className="font-mono text-xs font-bold text-blue-700 hover:underline"
                          >
                            {ab.phone}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">
                          <span className="font-semibold">{ab.wilayaName}</span>
                          {ab.commune ? ` · ${ab.commune}` : ''}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="font-semibold text-slate-900">{ab.productName}</span>
                          <span className="text-slate-500"> ×{ab.quantity || 1}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatDzd(ab.totalDzd || 0)}
                        </td>
                        <td className="py-3 px-4">
                          {ab.status === 'recovered' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              Récupérée
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                              À relancer
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={`https://wa.me/${formatAlgPhoneForWa(ab.phone)}?text=${encodeURIComponent(
                                `Bonjour ${ab.firstName || ''}, vous avez commencé une commande pour « ${ab.productName} » sur ${
                                  storeSettings.storeName || '2Frères Phone'
                                } (Livraison vers ${ab.wilayaName} avec paiement à la livraison). Souhaitez-vous que nous validions votre colis ?`,
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Relancer WhatsApp</span>
                            </a>
                            {ab.status !== 'recovered' && (
                              <button
                                type="button"
                                disabled={convertingAbandonedId === ab.id}
                                onClick={() => handleConvertAbandoned(ab)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  {convertingAbandonedId === ab.id
                                    ? 'Conversion...'
                                    : 'Convertir en Commande'}
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAbandoned(ab.id)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50"
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
        </div>
      )}

      {/* TAB 4: 2FP CODRECONCILE — RÉCONCILIATION DES PAIEMENTS TRANSPORTEURS COD */}
      {subTab === 'cod_reconcile' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-800">
                Encaissé &amp; Versé par Transporteur
              </p>
              <p className="font-mono font-bold text-xl text-emerald-700 mt-1 tabular-nums">
                {formatDzd(codKpis.paidAmountDzd)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {codKpis.paidCount} colis livré(s) et réglé(s)
              </p>
            </div>

            <div className="bg-white border border-amber-300 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800">
                Livré · En attente de versement transporteur
              </p>
              <p className="font-mono font-bold text-xl text-amber-700 mt-1 tabular-nums">
                {formatDzd(codKpis.unpaidAmountDzd)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {codKpis.unpaidCount} colis livré(s) non encore versé(s)
              </p>
            </div>

            <div className="bg-white border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-800">En cours de livraison (Expédiées)</p>
              <p className="font-mono font-bold text-xl text-blue-700 mt-1 tabular-nums">
                {formatDzd(codKpis.inTransitAmountDzd)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {codKpis.inTransitCount} colis chez le transporteur
              </p>
            </div>

            <div className="bg-white border border-red-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-700">Colis Retournés (Non encaissés)</p>
              <p className="font-mono font-bold text-xl text-red-600 mt-1 tabular-nums">
                {formatDzd(codKpis.returnedAmountDzd)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {codKpis.returnedCount} retour(s) enregistré(s)
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setReconcileFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  reconcileFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Tous les colis expédiés/livrés
              </button>
              <button
                type="button"
                onClick={() => setReconcileFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  reconcileFilter === 'unpaid'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-900'
                }`}
              >
                Livrés à pointer ({codKpis.unpaidCount})
              </button>
              <button
                type="button"
                onClick={() => setReconcileFilter('paid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  reconcileFilter === 'paid'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 text-emerald-900'
                }`}
              >
                Déjà versés ({codKpis.paidCount})
              </button>
            </div>

            {selectedReconcileIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reconciling}
                  onClick={() => handleBatchReconcileCod(selectedReconcileIds, 'paid')}
                  className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                >
                  Pointer {selectedReconcileIds.length} colis comme Versé(s)
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4">
                      <input
                        type="checkbox"
                        aria-label="Tout sélectionner"
                        checked={
                          reconcileOrders.length > 0 &&
                          selectedReconcileIds.length === reconcileOrders.length
                        }
                        onChange={(e) =>
                          setSelectedReconcileIds(
                            e.target.checked ? reconcileOrders.map((o) => o.id) : [],
                          )
                        }
                      />
                    </th>
                    <th className="py-3 px-4 font-semibold">Référence &amp; Suivi</th>
                    <th className="py-3 px-4 font-semibold">Client &amp; Wilaya</th>
                    <th className="py-3 px-4 font-semibold">Statut Livraison</th>
                    <th className="py-3 px-4 font-semibold">Versement Transporteur</th>
                    <th className="py-3 px-4 font-semibold text-right">Montant COD</th>
                    <th className="py-3 px-4 font-semibold text-right">Pointage 1-Clic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconcileOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        Aucun colis à afficher pour ce filtre de réconciliation.
                      </td>
                    </tr>
                  ) : (
                    reconcileOrders.map((o) => {
                      const isPaid = o.paymentStatus === 'paid';
                      return (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedReconcileIds.includes(o.id)}
                              onChange={(e) =>
                                setSelectedReconcileIds((prev) =>
                                  e.target.checked
                                    ? [...prev, o.id]
                                    : prev.filter((id) => id !== o.id),
                                )
                              }
                            />
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {o.reference}
                            </span>
                            {o.trackingNumber && (
                              <span className="block font-mono text-[11px] text-blue-700">
                                {o.trackingNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <p className="font-semibold text-slate-900">
                              {o.firstName} {o.lastName}
                            </p>
                            <p className="text-slate-500">
                              {o.wilayaName} · {o.phone}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold">
                            {ORDER_STATUS_LABELS[o.status as OrderStatus] || o.status}
                          </td>
                          <td className="py-3 px-4">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Versé &amp; Encaissé
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
                                En attente transporteur
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatDzd(o.totalDzd)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isPaid ? (
                              <button
                                type="button"
                                disabled={reconciling}
                                onClick={() => handleBatchReconcileCod([o.id], 'unpaid')}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                              >
                                Remettre en attente
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={reconciling}
                                onClick={() => handleBatchReconcileCod([o.id], 'paid')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                              >
                                Pointer comme Versé
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: ALL ORDERS (TABLE & KANBAN) */}
      {subTab === 'all' && (
        <>
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

            <div className="flex flex-wrap items-center gap-2">
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

              <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
                <span className="pl-2.5 pr-1 text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  Format :
                </span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as CarrierExportFormat)}
                  aria-label="Format d'export transporteur Algérie"
                  className="px-2 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none border-r border-slate-200"
                >
                  <option value="yalidine">Yalidine Express (DZ)</option>
                  <option value="zrexpress">ZR Express (DZ)</option>
                  <option value="maystro">Maystro Delivery (DZ)</option>
                  <option value="ecotrack">Ecotrack / Noest / Guepex</option>
                  <option value="standard">CSV Standard</option>
                </select>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exporter Colis</span>
                </button>
              </div>
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
                      <th className="py-3 px-4 font-semibold">Statut &amp; Appel</th>
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
                        const callLabel =
                          CALL_STATUSES.find((c) => c.value === o.callStatus)?.label || 'Non appelé';
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
                            <td className="py-3 px-4 space-y-1">
                              <select
                                aria-label={`Changer statut de ${o.reference}`}
                                value={o.status}
                                onChange={(e) => handleQuickStatus(o.id, e.target.value as OrderStatus)}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white block"
                              >
                                {ORDER_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                              <span className="inline-block text-[11px] text-slate-500">
                                {callLabel}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {formatDzd(o.totalDzd)}
                              {o.paymentStatus === 'paid' && (
                                <span className="block text-[10px] font-sans font-bold text-emerald-700">
                                  Encaissé
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <a
                                  href={`https://wa.me/${formatAlgPhoneForWa(o.phone)}?text=${encodeURIComponent(
                                    `Bonjour ${o.firstName} ${o.lastName}, c'est la boutique ${
                                      storeSettings.storeName || '2Frères Phone'
                                    } ! Nous vous contactons pour confirmer votre commande ${o.reference} (${formatDzd(
                                      o.totalDzd,
                                    )}) vers ${o.wilayaName} (${o.commune}). Confirmez-vous l'expédition ?`,
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Confirmer la commande via WhatsApp (Call-Center Anti-Retour)"
                                  className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
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
            /* 2FP StockFlow Kanban View */
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
        </>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Statut commande</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Statut Centre d’Appel</label>
                  <select
                    value={editCallStatus}
                    onChange={(e) => setEditCallStatus(e.target.value as CallStatus)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    {CALL_STATUSES.map((cs) => (
                      <option key={cs.value} value={cs.value}>
                        {cs.label}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Numéro de suivi (Tracking)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const selectedCarrier = carriers.find((c) => String(c.id) === String(editCarrierId));
                        const prefix = selectedCarrier?.code
                          ? selectedCarrier.code.slice(0, 3).toUpperCase()
                          : 'YAL';
                        const wilayaPad = String(selectedOrder.wilayaCode || 16).padStart(2, '0');
                        const rand = Math.floor(100000 + Math.random() * 900000);
                        setEditTracking(`${prefix}-DZ${wilayaPad}-${rand}`);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Générer bordereau auto</span>
                    </button>
                  </div>
                  <input
                    value={editTracking}
                    onChange={(e) => setEditTracking(e.target.value)}
                    placeholder="Ex. YAL-DZ16-982341"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Note Centre d’Appel</label>
                  <input
                    value={editCallNotes}
                    onChange={(e) => setEditCallNotes(e.target.value)}
                    placeholder="Ex. Rappeler après 17h"
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
