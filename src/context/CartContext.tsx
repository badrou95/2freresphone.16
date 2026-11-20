import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, StoreProduct } from '../types';

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addItem: (product: StoreProduct, quantity?: number, selectedColor?: string) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotalDzd: number;
  hasPhysical: boolean;
  hasDigital: boolean;
}

const STORAGE_KEY = '2fp_cart_v1';
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const addItem = (product: StoreProduct, quantity = 1, selectedColor?: string) => {
    const chosenColor = selectedColor || product.colors?.[0]?.name || undefined;
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      const maxStock = product.productType === 'digital' ? 99 : Math.max(1, product.stockQuantity);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? {
                ...i,
                quantity: Math.min(maxStock, i.quantity + quantity),
                maxStock,
                selectedColor: chosenColor || i.selectedColor,
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          priceDzd: product.priceDzd,
          productType: product.productType,
          image: product.primaryImage || product.images?.[0]?.url || null,
          quantity: Math.min(maxStock, quantity),
          maxStock,
          selectedColor: chosenColor,
        },
      ];
    });
    setIsOpen(true);
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.min(i.maxStock, quantity) } : i,
      ),
    );
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotalDzd = items.reduce((acc, i) => acc + i.priceDzd * i.quantity, 0);
  const hasPhysical = items.some((i) => i.productType === 'physical');
  const hasDigital = items.some((i) => i.productType === 'digital');

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        setIsOpen,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        totalItems,
        subtotalDzd,
        hasPhysical,
        hasDigital,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
