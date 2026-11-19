import React, { useMemo, useState } from 'react';
import {
  Barcode,
  CheckCircle2,
  FileText,
  Printer,
  Receipt,
  Save,
  Search,
  Tag,
} from 'lucide-react';
import {
  DeliverySlipFormat,
  generateCode128Svg,
  LABEL_DIMENSIONS_MM,
  loadPrinterConfig,
  PrinterConfig,
  PrinterConnectionType,
  printDeliverySlip,
  printPrinterTestPage,
  printProductThermalLabels,
  printPurchaseReceipt,
  ReceiptFormat,
  savePrinterConfig,
  ThermalLabelSize,
} from '../../lib/printer';
import { formatDzd } from '../../shared/domain';
import { StoreSettings } from '../../types';

interface AdminPrinterProps {
  settings: Partial<StoreSettings>;
  products: any[];
  orders: any[];
}

export function AdminPrinter({ settings, products, orders }: AdminPrinterProps) {
  const [config, setConfig] = useState<PrinterConfig>(() => loadPrinterConfig());
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Batch thermal label queue
  const [productSearch, setProductSearch] = useState('');
  const [selectedCopies, setSelectedCopies] = useState<Record<number, number>>({});

  // Quick order document printer
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0] ? String(orders[0].id) : '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = savePrinterConfig(config);
    setConfig(updated);
    setSavedMsg('Configuration de l’imprimante enregistrée sur cet appareil.');
    window.setTimeout(() => setSavedMsg(null), 4000);
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products
      .filter((p) => {
        if (!q) return true;
        return `${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [products, productSearch]);

  const totalSelectedLabels = useMemo(() => {
    return Object.values(selectedCopies).reduce((sum, n) => sum + (Number(n) > 0 ? Number(n) : 0), 0);
  }, [selectedCopies]);

  const handleBatchPrintLabels = () => {
    const job = products
      .filter((p) => (selectedCopies[p.id] || 0) > 0)
      .map((p) => ({
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || p.sku,
        priceDzd: p.priceDzd,
        copies: selectedCopies[p.id],
      }));
    if (job.length === 0) return;
    savePrinterConfig(config);
    printProductThermalLabels(job, settings, config);
  };

  const previewBarcodeSvg = useMemo(() => generateCode128Svg('2FP-ACC-001', 28), []);
  const selectedOrder = orders.find((o) => String(o.id) === selectedOrderId) || orders[0] || null;

  return (
    <div className="space-y-6">
      {savedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Printer Configuration Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-700" />
                <span>Configuration de votre imprimante</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Compatible imprimantes thermiques USB/Bluetooth (Xprinter, Rongta, Epson, Zebra) et imprimantes A4/Wi-Fi.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom / Modèle d’imprimante
              </label>
              <input
                value={config.printerName}
                onChange={(e) => setConfig({ ...config, printerName: e.target.value })}
                placeholder="Ex. Xprinter XP-365B / Epson TM-T20"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mode de connexion
              </label>
              <select
                value={config.connectionType}
                onChange={(e) =>
                  setConfig({ ...config, connectionType: e.target.value as PrinterConnectionType })
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="system_usb">USB / Imprimante système (Windows / Mac / Android)</option>
                <option value="bluetooth">Bluetooth thermique (Mobile / Tablette)</option>
                <option value="network_wifi">Réseau / Wi-Fi / LAN</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Format Bon de livraison
              </label>
              <select
                value={config.deliverySlipFormat}
                onChange={(e) =>
                  setConfig({ ...config, deliverySlipFormat: e.target.value as DeliverySlipFormat })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="a4">A4 complet</option>
                <option value="a5">A5 demi-page</option>
                <option value="thermal_80mm">Thermique 80 mm</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Format Bon d’achat / Reçu
              </label>
              <select
                value={config.receiptFormat}
                onChange={(e) =>
                  setConfig({ ...config, receiptFormat: e.target.value as ReceiptFormat })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="thermal_80mm">Ticket thermique 80 mm</option>
                <option value="thermal_58mm">Ticket thermique 58 mm</option>
                <option value="a4">Facturette A4</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Format Étiquette thermique
              </label>
              <select
                value={config.labelSize}
                onChange={(e) =>
                  setConfig({ ...config, labelSize: e.target.value as ThermalLabelSize })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
              >
                {(Object.keys(LABEL_DIMENSIONS_MM) as ThermalLabelSize[]).map((sizeKey) => (
                  <option key={sizeKey} value={sizeKey}>
                    {LABEL_DIMENSIONS_MM[sizeKey].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showLogo}
                onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })}
              />
              <span>Afficher le logo sur les bons</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showBarcode}
                onChange={(e) => setConfig({ ...config, showBarcode: e.target.checked })}
              />
              <span>Imprimer code-barres Code128</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showPriceOnLabel}
                onChange={(e) => setConfig({ ...config, showPriceOnLabel: e.target.checked })}
              />
              <span>Afficher le prix (DZD) sur l’étiquette</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showStoreNameOnLabel}
                onChange={(e) => setConfig({ ...config, showStoreNameOnLabel: e.target.checked })}
              />
              <span>Afficher « {settings.storeName || '2Frères Phone'} » sur l’étiquette</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message pied de page (Bons de livraison &amp; Bons d’achat)
            </label>
            <input
              value={config.footerNote}
              onChange={(e) => setConfig({ ...config, footerNote: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer l’imprimante</span>
            </button>
            <button
              type="button"
              onClick={() => {
                savePrinterConfig(config);
                printPrinterTestPage(settings, config, 'label');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Test étiquette</span>
            </button>
            <button
              type="button"
              onClick={() => {
                savePrinterConfig(config);
                printPrinterTestPage(settings, config, 'receipt');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Test ticket / reçu</span>
            </button>
          </div>
        </form>

        {/* Live Thermal Label Preview + Quick Order Print */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h4 className="font-display font-semibold text-sm text-slate-900 flex items-center gap-2">
              <Barcode className="w-4 h-4 text-blue-700" />
              <span>Aperçu étiquette thermique ({LABEL_DIMENSIONS_MM[config.labelSize].width} × {LABEL_DIMENSIONS_MM[config.labelSize].height} mm)</span>
            </h4>
            <div className="bg-slate-100 rounded-xl p-5 flex justify-center">
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg px-4 py-3 w-64 text-center shadow-sm space-y-1">
                {config.showStoreNameOnLabel && (
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-900">
                    {settings.storeName || '2Frères Phone'}
                  </p>
                )}
                <p className="text-xs font-bold text-slate-900 truncate">
                  Chargeur Rapide USB-C 65W GaN
                </p>
                {config.showBarcode && (
                  <div
                    className="w-48 mx-auto pt-1"
                    dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                  />
                )}
                <p className="text-[10px] font-mono font-bold text-slate-700">2FP-ACC-001</p>
                {config.showPriceOnLabel && (
                  <p className="text-base font-mono font-black text-slate-900">4 500 DZD</p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Astuce : lors de la fenêtre d’impression de votre PC ou téléphone, sélectionnez votre imprimante thermique (ex. Xprinter / Bluetooth) et laissez les marges sur « Aucune ».
            </p>
          </div>

          {/* Quick Order Document Printer */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h4 className="font-display font-semibold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-700" />
              <span>Impression rapide d’une commande</span>
            </h4>
            {orders.length === 0 ? (
              <p className="text-xs text-slate-500">Aucune commande disponible pour le moment.</p>
            ) : (
              <>
                <select
                  value={selectedOrder ? String(selectedOrder.id) : ''}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                >
                  {orders.slice(0, 50).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.reference} — {o.firstName} {o.lastName} ({formatDzd(o.totalDzd)})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!selectedOrder}
                    onClick={() => selectedOrder && printDeliverySlip(selectedOrder, settings, config)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Bon de livraison</span>
                  </button>
                  <button
                    type="button"
                    disabled={!selectedOrder}
                    onClick={() => selectedOrder && printPurchaseReceipt(selectedOrder, settings, config)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Bon d’achat</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Batch Thermal Label Printing Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-700" />
              <span>Impression d’étiquettes thermiques en lot (Produits &amp; Stock)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Choisissez le nombre d’étiquettes à imprimer pour chaque article (avec code-barres scannable et prix DZD).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Rechercher un produit, SKU..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-56"
              />
            </div>
            <button
              type="button"
              disabled={totalSelectedLabels === 0}
              onClick={handleBatchPrintLabels}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer ({totalSelectedLabels} étiquette{totalSelectedLabels > 1 ? 's' : ''})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-2.5 px-4">Article</th>
                <th className="py-2.5 px-4">SKU / Code-barres</th>
                <th className="py-2.5 px-4 text-right">Prix vente</th>
                <th className="py-2.5 px-4 text-right">Stock</th>
                <th className="py-2.5 px-4 text-right">Nb étiquettes</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const qty = selectedCopies[p.id] || 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500">
                      {p.barcode || p.sku}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatDzd(p.priceDzd)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {p.stockQuantity}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={qty}
                        onChange={(e) =>
                          setSelectedCopies((prev) => ({
                            ...prev,
                            [p.id]: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                          }))
                        }
                        aria-label={`Nombre d'étiquettes pour ${p.name}`}
                        className="w-16 px-2 py-1 text-right font-mono text-xs rounded border border-slate-300"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          printProductThermalLabels(
                            [
                              {
                                name: p.name,
                                sku: p.sku,
                                barcode: p.barcode || p.sku,
                                priceDzd: p.priceDzd,
                                copies: Math.max(1, qty || 1),
                              },
                            ],
                            settings,
                            config,
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Imprimer</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
