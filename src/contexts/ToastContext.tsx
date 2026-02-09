import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info, ShoppingBag } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'cart';

interface Toast {
  id: string;
  message: string;
  description?: string;
  type: ToastType;
  visible: boolean;
}

interface ToastContextType {
  toast: {
    success: (message: string, description?: string) => void;
    error: (message: string, description?: string) => void;
    info: (message: string, description?: string) => void;
    cart: (productName: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    
    // Remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((message: string, type: ToastType, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, description, type, visible: true }]);

    // Auto remove
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const toast = {
    success: (message: string, description?: string) => addToast(message, 'success', description),
    error: (message: string, description?: string) => addToast(message, 'error', description),
    info: (message: string, description?: string) => addToast(message, 'info', description),
    cart: (productName: string) => addToast('Adicionado ao pedido', 'cart', `${productName} foi incluído no carrinho.`),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-4 p-4 rounded-xl shadow-2xl border min-w-[340px] max-w-[400px] transition-all duration-300 transform",
              t.visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
              "bg-white border-gray-100" // Base style matching the clean card aesthetic
            )}
          >
            {/* Icon Container */}
            <div className={cn(
              "p-2 rounded-lg shrink-0 mt-0.5",
              t.type === 'success' && "bg-green-50 text-green-600",
              t.type === 'error' && "bg-red-50 text-red-600",
              t.type === 'info' && "bg-blue-50 text-blue-600",
              t.type === 'cart' && "bg-gray-900 text-white" // Matching the "Add" button style
            )}>
              {t.type === 'success' && <CheckCircle2 size={20} />}
              {t.type === 'error' && <AlertCircle size={20} />}
              {t.type === 'info' && <Info size={20} />}
              {t.type === 'cart' && <ShoppingBag size={20} />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className={cn(
                "text-sm font-bold",
                t.type === 'error' ? "text-red-900" : "text-gray-900"
              )}>
                {t.message}
              </h4>
              {t.description && (
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  {t.description}
                </p>
              )}
            </div>

            {/* Close Button */}
            <button 
              onClick={() => removeToast(t.id)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1 rounded-md transition-colors -mr-1 -mt-1"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
