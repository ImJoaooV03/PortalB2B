import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, ShoppingBag, Loader2, AlertTriangle } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export default function Cart() {
  const { items, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [minOrder, setMinOrder] = useState(0);

  useEffect(() => {
    if (profile?.client_id) {
      fetchMinOrder(profile.client_id);
    }
  }, [profile]);

  async function fetchMinOrder(clientId: string) {
    const { data } = await supabase
      .from('price_tables')
      .select('min_order')
      .eq('client_id', clientId)
      .eq('active', true)
      .single();
    
    if (data) setMinOrder(data.min_order);
  }

  const handleSubmitOrder = async () => {
    if (!profile?.client_id) return;
    
    setSubmitting(true);
    try {
      // 1. Create Order Header
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          client_id: profile.client_id,
          status: 'enviado', // Direct to sent status as per requirements
          total_amount: total
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Create Order Items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Success
      clearCart();
      navigate('/orders');
      
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-gray-100 p-6 rounded-full mb-4">
          <ShoppingBag className="text-gray-400" size={48} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Seu carrinho está vazio</h2>
        <p className="text-gray-500 mb-6">Adicione produtos do catálogo para criar um pedido.</p>
        <button 
          onClick={() => navigate('/catalog')}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Ir para o Catálogo
        </button>
      </div>
    );
  }

  const isMinOrderMet = total >= minOrder;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Revisar Pedido</h1>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.productId} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-16 w-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border">
                {item.productImage && (
                  <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">{item.productName}</h3>
                <p className="text-sm text-gray-500 font-mono">{item.productSku}</p>
                <p className="text-sm text-indigo-600 font-medium sm:hidden mt-1">
                  {formatCurrency(item.price)}
                </p>
              </div>

              <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(item.price)}</p>
                  <p className="text-xs text-gray-500">unid.</p>
                </div>

                <div className="flex items-center border rounded-lg">
                  <button 
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="px-3 py-1 hover:bg-gray-50 text-gray-600 border-r"
                  >
                    -
                  </button>
                  <input 
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 0)}
                    className="w-16 text-center py-1 outline-none text-sm"
                    min={item.minQuantity}
                  />
                  <button 
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="px-3 py-1 hover:bg-gray-50 text-gray-600 border-l"
                  >
                    +
                  </button>
                </div>

                <div className="text-right min-w-[80px]">
                  <p className="font-bold text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
                </div>

                <button 
                  onClick={() => removeFromCart(item.productId)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-gray-50 p-6 border-t">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center text-gray-600">
              <span>Subtotal ({items.length} itens)</span>
              <span>{formatCurrency(total)}</span>
            </div>
            
            {minOrder > 0 && (
              <div className={cn(
                "flex justify-between items-center text-sm px-3 py-2 rounded-lg",
                isMinOrderMet ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
              )}>
                <span className="flex items-center gap-2">
                  {isMinOrderMet ? null : <AlertTriangle size={16} />}
                  Pedido Mínimo: {formatCurrency(minOrder)}
                </span>
                <span>{isMinOrderMet ? 'Atingido' : `Faltam ${formatCurrency(minOrder - total)}`}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xl font-bold text-gray-900 pt-4 border-t">
              <span>Total do Pedido</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmitOrder}
              disabled={submitting || !isMinOrderMet}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Enviando...
                </>
              ) : (
                <>
                  Confirmar Pedido
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
