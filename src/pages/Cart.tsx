import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, ShoppingBag, Loader2, AlertTriangle, CreditCard, Info } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import Button from '../components/ui/Button';

interface TableInfo {
  min_order: number;
  payment_terms: string | null;
  notes: string | null;
}

export default function Cart() {
  const { items, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [tableInfo, setTableInfo] = useState<TableInfo>({ min_order: 0, payment_terms: null, notes: null });

  useEffect(() => {
    if (profile?.client_id) fetchTableInfo(profile.client_id);
  }, [profile]);

  async function fetchTableInfo(clientId: string) {
    const { data } = await supabase
      .from('price_tables')
      .select('min_order, payment_terms, notes')
      .eq('client_id', clientId)
      .eq('active', true)
      .single();
      
    if (data) setTableInfo(data);
  }

  const handleSubmitOrder = async () => {
    if (!profile?.client_id) return;
    setSubmitting(true);
    try {
      const { data: order, error: orderError } = await supabase.from('orders').insert([{ client_id: profile.client_id, status: 'enviado', total_amount: total }]).select().single();
      if (orderError) throw orderError;
      const orderItems = items.map(item => ({ order_id: order.id, product_id: item.productId, quantity: item.quantity, unit_price: item.price, subtotal: item.price * item.quantity }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
      clearCart();
      navigate('/orders');
    } catch (error) {
      alert('Erro ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-white border-2 border-black p-6 mb-4">
          <ShoppingBag className="text-black" size={48} />
        </div>
        <h2 className="text-xl font-black text-black mb-2 uppercase">Seu carrinho está vazio</h2>
        <Button onClick={() => navigate('/catalog')} className="mt-4">IR PARA O CATÁLOGO</Button>
      </div>
    );
  }

  const isMinOrderMet = total >= tableInfo.min_order;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-black text-black uppercase">Revisar Pedido</h1>

      <div className="bg-white border-2 border-black shadow-sharp">
        <div className="divide-y-2 divide-black">
          {items.map((item) => (
            <div key={item.productId} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="h-16 w-16 bg-white border border-black flex-shrink-0 overflow-hidden p-1">
                {item.productImage && (
                  <img src={item.productImage} alt={item.productName} className="h-full w-full object-contain grayscale" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-black uppercase">{item.productName}</h3>
                <p className="text-sm text-gray-600 font-mono">{item.productSku}</p>
                <p className="text-sm text-black font-bold sm:hidden mt-1">{formatCurrency(item.price)}</p>
              </div>

              <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-bold text-black">{formatCurrency(item.price)}</p>
                  <p className="text-xs text-gray-500 uppercase">UNID.</p>
                </div>

                <div className="flex items-center border border-black">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="px-3 py-1 hover:bg-black hover:text-white text-black border-r border-black font-bold">-</button>
                  <input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 0)} className="w-16 text-center py-1 outline-none text-sm font-bold bg-white text-black" min={item.minQuantity} />
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="px-3 py-1 hover:bg-black hover:text-white text-black border-l border-black font-bold">+</button>
                </div>

                <div className="text-right min-w-[80px]">
                  <p className="font-black text-black">{formatCurrency(item.price * item.quantity)}</p>
                </div>

                <button onClick={() => removeFromCart(item.productId)} className="text-gray-400 hover:text-black transition-colors">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-gray-50 p-6 border-t-2 border-black">
          <div className="flex flex-col gap-4">
            {/* Table Rules Info */}
            {(tableInfo.payment_terms || tableInfo.notes) && (
              <div className="mb-4 p-4 border border-black bg-white space-y-2">
                <h4 className="text-xs font-black text-black uppercase tracking-widest border-b border-black pb-1 mb-2">Condições Comerciais</h4>
                {tableInfo.payment_terms && (
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard size={16} />
                    <span className="font-bold uppercase">Pagamento:</span>
                    <span className="uppercase">{tableInfo.payment_terms}</span>
                  </div>
                )}
                {tableInfo.notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <span className="font-bold uppercase">Obs:</span>
                    <span className="uppercase">{tableInfo.notes}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center text-black font-medium uppercase">
              <span>Subtotal ({items.length} itens)</span>
              <span>{formatCurrency(total)}</span>
            </div>
            
            {tableInfo.min_order > 0 && (
              <div className={cn(
                "flex justify-between items-center text-sm px-3 py-2 border font-bold uppercase",
                isMinOrderMet ? "bg-black text-white border-black" : "bg-white text-black border-black border-dashed"
              )}>
                <span className="flex items-center gap-2">
                  {isMinOrderMet ? null : <AlertTriangle size={16} />}
                  PEDIDO MÍNIMO: {formatCurrency(tableInfo.min_order)}
                </span>
                <span>{isMinOrderMet ? 'ATINGIDO' : `FALTAM ${formatCurrency(tableInfo.min_order - total)}`}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-xl font-black text-black pt-4 border-t-2 border-black uppercase">
              <span>Total do Pedido</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmitOrder}
              disabled={submitting || !isMinOrderMet}
              className="bg-black hover:bg-white text-white hover:text-black border-2 border-black px-8 py-3 font-bold flex items-center gap-2 transition-all shadow-sharp hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
            >
              {submitting ? <><Loader2 className="animate-spin" size={20} /> ENVIANDO...</> : <>CONFIRMAR PEDIDO <ArrowRight size={20} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
