import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatDzd } from '../../shared/domain';
import { ProductImage } from '../ProductImage';

interface CartDrawerProps {
  onCheckout: () => void;
}

export function CartDrawer({ onCheckout }: CartDrawerProps) {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, subtotalDzd, totalItems } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Panier d'achat">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-slate-900" />
            <h2 className="font-display font-semibold text-base text-slate-900">
              Votre panier ({totalItems})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Fermer le panier"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-slate-100">
          {items.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-[1.5]" />
              <p className="text-sm font-medium text-slate-900">Votre panier est vide</p>
              <p className="text-sm text-slate-500 mt-1">
                Ajoutez des accessoires, jeux ou abonnements pour commander sans créer de compte.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="py-4 flex gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                  <ProductImage src={item.image} alt={item.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 line-clamp-2">{item.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.productType === 'digital' ? 'Produit numérique' : 'Livraison physique'}
                  </p>
                  <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums mt-1">
                    {formatDzd(item.priceDzd * item.quantity)}
                  </p>
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="inline-flex items-center border border-slate-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        aria-label={`Diminuer quantité de ${item.name}`}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-xs font-mono font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        aria-label={`Augmenter quantité de ${item.name}`}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      aria-label={`Retirer ${item.name}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Sous-total articles</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatDzd(subtotalDzd)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Frais de livraison calculés automatiquement selon votre wilaya à l’étape suivante.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCheckout();
              }}
              className="w-full py-3 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
            >
              Passer la commande
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
