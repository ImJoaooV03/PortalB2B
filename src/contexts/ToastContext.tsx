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
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((message: string, type: ToastType, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, description, type, visible: true }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const toast = {
    success: (message: string, description?: string) => addToast(message, 'success', description),
    error: (message: string, description?: string) => addToast(message, 'error', description),
    info: (message: string, description?: string) => addToast(message, 'info', description),
    cart: (productName: string) => addToast('Adicionado', 'cart', `${productName}`),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-4 p-4 min-w-[300px] max-w-[400px] transition-all duration-300 transform border-2 border-black shadow-sharp bg-white",
              t.visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
              t.type === 'error' && "border-black bg-white" // Keep consistent base
            )}
          >
            <div className={cn(
              "p-2 shrink-0 mt-0.5 border border-black",
              t.type === 'success' && "bg-black text-white",
              t.type === 'error' && "bg-white text-black",
              t.type === 'info' && "bg-white text-black",
              t.type === 'cart' && "bg-black text-white"
            )}>
              {t.type === 'success' && <CheckCircle2 size={20} />}
              {t.type === 'error' && <AlertCircle size={20} />}
              {t.type === 'info' && <Info size={20} />}
              {t.type === 'cart' && <ShoppingBag size={20} />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black uppercase text-black">
                {t.message}
              </h4>
              {t.description && (
                <p className="text-sm text-black mt-1 font-medium">
                  {t.description}
                </p>
              )}
            </div>

            <button 
              onClick={() => removeToast(t.id)}
              className="text-black hover:bg-black hover:text-white p-1 transition-colors -mr-1 -mt-1 border border-transparent hover:border-black"
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
