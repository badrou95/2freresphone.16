import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Package, Search, ShieldCheck, Truck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { formatDzd, ORDER_STATUS_LABELS, OrderStatus } from '../../shared/domain';

interface OrderTrackingViewProps {
  initialReference?: string;
}

export function OrderTrackingView({ initialReference = '' }: OrderTrackingViewProps) {
  const [reference, setReference] = useState(initialReference);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const performLookup = async (refToFind: string, phoneVal: string) => {
    if (!refToFind.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ reference: refToFind.trim().toUpperCase() });
      if (phoneVal.trim()) qs.set('phone', phoneVal.trim());
      const data = await apiFetch<any>(`/api/orders/track?${qs.toString()}`);
      setResult(data);
    } catch (err: any) {
      setResult(null);
      setError(err.message || 'Commande introuvable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialReference) {
      setReference(initialReference);
      performLookup(initialReference, '');
    }
  }, [initialReference]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(reference, phone);
  };

  const progressSteps: OrderStatus[] = ['nouvelle', 'confirmee', 'en_preparation', 'expediee', 'livree'];
  const currentStepIdx = result ? progressSteps.indexOf(result.order.status) : -1;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight">
          Suivi de commande
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Saisissez votre référence de commande (ex. <span className="font-mono">2FP-2026-000101</span>) pour consulter son statut en temps réel.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-12 gap-3"
      >
        <div className="sm:col-span-5">
          <label htmlFor="track-ref" className="block text-xs font-semibold text-slate-700 mb-1">
            Référence de commande *
          </label>
          <input
            id="track-ref"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="2FP-2026-000101"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="track-phone" className="block text-xs font-semibold text-slate-700 mb-1">
            Téléphone (optionnel)
          </label>
          <input
            id="track-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ex. 0550 12 34 56"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div className="sm:col-span-3 flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Recherche...' : 'Suivre'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Référence</p>
              <p className="font-mono font-bold text-xl text-slate-900">{result.order.reference}</p>
              <p className="text-xs text-slate-500 mt-1">
                Passée le {new Date(result.order.createdAt).toLocaleString('fr-FR')} · {result.order.wilayaName} ({result.order.commune})
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Statut actuel</p>
              <p className="font-display font-bold text-base text-blue-700">
                {ORDER_STATUS_LABELS[result.order.status as OrderStatus] || result.order.status}
              </p>
              {result.order.trackingNumber && (
                <p className="text-xs font-mono text-slate-600 mt-1">
                  Tracking : {result.order.trackingNumber}
                </p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {!['annulee', 'retournee'].includes(result.order.status) && (
            <div className="grid grid-cols-5 gap-2">
              {progressSteps.map((st, idx) => {
                const done = currentStepIdx >= idx || (result.order.status === 'a_confirmer' && idx === 0);
                return (
                  <div key={st} className="space-y-1.5">
                    <div
                      className={`h-1.5 rounded-full ${done ? 'bg-blue-700' : 'bg-slate-200'}`}
                    />
                    <p className={`text-[11px] font-medium ${done ? 'text-slate-900' : 'text-slate-400'}`}>
                      {ORDER_STATUS_LABELS[st]}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-500" />
              <span>Articles commandés</span>
            </h2>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg px-4">
              {result.items.map((item: any) => (
                <div key={item.id} className="py-2.5 flex justify-between text-sm">
                  <span className="text-slate-700">
                    {item.productName} <span className="text-slate-400">×{item.quantity}</span>
                  </span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatDzd(item.lineTotalDzd)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-sm pt-2">
              <span className="text-slate-500">
                Livraison ·{' '}
                {result.order.deliveryType === 'stop_desk'
                  ? 'STOP DESK'
                  : result.order.deliveryType === 'digital'
                  ? 'Numérique'
                  : 'À domicile'}
                {result.order.carrierName ? ` — ${result.order.carrierName}` : ''}
              </span>
              <span className="font-mono tabular-nums">{formatDzd(result.order.shippingFeeDzd)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-1">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatDzd(result.order.totalDzd)}</span>
            </div>
          </div>

          {/* Digital delivery status */}
          {result.digitalDeliveries && result.digitalDeliveries.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Traitement des produits numériques</span>
              </h3>
              {result.digitalDeliveries.map((d: any, idx: number) => (
                <div key={idx} className="text-xs text-slate-700 space-y-1">
                  <p className="font-medium">
                    {d.productName} —{' '}
                    <span className="text-blue-700">
                      {d.deliveryStatus === 'delivered'
                        ? 'Livré et validé'
                        : d.deliveryStatus === 'payment_verified'
                        ? 'Paiement validé, activation en cours'
                        : 'En attente de validation paiement'}
                    </span>
                  </p>
                  {d.activationInstructions ? (
                    <p className="p-2.5 bg-white border border-slate-200 rounded text-slate-800 whitespace-pre-line">
                      {d.activationInstructions}
                    </p>
                  ) : (
                    <p className="text-slate-500">
                      Les consignes d’activation sont visibles après livraison et vérification de votre numéro de téléphone ci-dessus.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Historique des étapes</span>
            </h3>
            <div className="space-y-2">
              {result.history.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">
                      {ORDER_STATUS_LABELS[h.toStatus as OrderStatus] || h.toStatus}
                      {h.note ? ` — ${h.note}` : ''}
                    </p>
                    <p className="text-slate-400 tabular-nums">
                      {new Date(h.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
