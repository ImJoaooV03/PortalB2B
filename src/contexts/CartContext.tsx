import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../lib/types';

export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  productImage: string | null;
  price: number;
  quantity: number;
  minQuantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, price: number, minQuantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('b2b_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to parse cart from localStorage:', error);
      // If parsing fails, clear the corrupted data
      localStorage.removeItem('b2b_cart');
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('b2b_cart', JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [items]);

  const addToCart = (product: Product, price: number, minQuantity: number) => {
    setItems(current => {
      const existing = current.find(item => item.productId === product.id);
      if (existing) {
        return current.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productImage: product.image,
        price,
        quantity: minQuantity, // Start with min quantity
        minQuantity
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setItems(current => current.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems(current => 
      current.map(item => 
        item.productId === productId 
          ? { ...item, quantity: Math.max(item.minQuantity, quantity) } // Enforce min quantity
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
