import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PriceTable, PriceTableItem, Product } from '../lib/types';
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Edit2, Tag, Info, Calculator, ArrowRight, CalendarClock, Clock, AlertTriangle, CheckCircle2, CreditCard, StickyNote } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { cn, formatCurrency, formatDateTime, formatForInput } from '../lib/utils';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';

export default function PriceTableEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [table, setTable] = useState<PriceTable | null>(null);
  const [items, setItems] = useState<PriceTableItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Calculator State
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('0');

  const itemForm = useForm<Partial<PriceTableItem>>();
  const settingsForm = useForm<Partial<PriceTable>>();

  // Watch product selection to display base price
  const selectedProductId = itemForm.watch('product_id');
  const selectedProduct = products.find(p => p.id === selectedProductId);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  // Update calculated price when discount changes or product changes
  useEffect(() => {
    if (selectedProduct) {
      const { finalPrice } = calculatePricing(selectedProduct.base_price);
      itemForm.setValue('value', parseFloat(finalPrice.toFixed(2)));
    }
  }, [selectedProductId, discountType, discountValue]);

  async function fetchData() {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('price_tables')
        .select('*, clients(nome_fantasia)')
        .eq('id', id)
        .single();
      
      if (tableError) throw tableError;
      setTable(tableData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('price_table_items')
        .select('*, products(*)')
        .eq('price_table_id', id);
        
      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active');
      
      setProducts(productsData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Erro ao carregar dados da tabela.');
      navigate('/price-tables');
    } finally {
      setLoading(false);
    }
  }

  const toggleActive = async () => {
    if (!table) return;
    try {
      const newStatus = !table.active;
      
      // If activating, deactivate others first
      if (newStatus === true) {
        await supabase
          .from('price_tables')
          .update({ active: false })
          .eq('client_id', table.client_id)
          .neq('id', table.id);
      }

      const { error } = await supabase
        .from('price_tables')
        .update({ active: newStatus })
        .eq('id', table.id);

      if (error) throw error;
      setTable({ ...table, active: newStatus });
    } catch (error: any) {
      alert('Erro ao atualizar status.');
    }
  };

  const onSettingsSubmit = async (data: Partial<PriceTable>) => {
    if (!table) return;
    try {
      if (data.valid_from && data.valid_until && new Date(data.valid_from) > new Date(data.valid_until)) {
        alert('A data de fim deve ser posterior à data de início.');
        return;
      }

      // Convert local input time to UTC ISO string for DB
      const validFromUTC = data.valid_from ? new Date(data.valid_from).toISOString() : null;
      const validUntilUTC = data.valid_until ? new Date(data.valid_until).toISOString() : null;

      const payload = {
        name: data.name,
        min_order: data.min_order,
        payment_terms: data.payment_terms,
        notes: data.notes,
        valid_from: validFromUTC,
        valid_until: validUntilUTC
      };

      const { error } = await supabase
        .from('price_tables')
        .update(payload)
        .eq('id', table.id);

      if (error) throw error;
      setTable({ ...table, ...payload } as PriceTable);
      closeSettingsModal();
    } catch (error) {
      alert('Erro ao atualizar configurações.');
    }
  };

  const onItemSubmit = async (data: Partial<PriceTableItem>) => {
    if (!id) return;
    try {
      const payload = { ...data, price_table_id: id, price_type: 'fixo' };
      const { error } = await supabase.from('price_table_items').insert([payload]);
      if (error) throw error;
      await fetchData();
      closeItemModal();
    } catch (error) {
      alert('Erro ao salvar item.');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Remover este produto da tabela?')) return;
    try {
      const { error } = await supabase.from('price_table_items').delete().eq('id', itemId);
      if (error) throw error;
      setItems(items.filter(i => i.id !== itemId));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const openItemModal = () => {
    itemForm.reset({ min_quantity: 1 });
    setDiscountValue('0');
    setDiscountType('percentage');
    setIsItemModalOpen(true);
  };
  const closeItemModal = () => {
    setIsItemModalOpen(false);
    itemForm.reset();
  };
  const openSettingsModal = () => {
    if (table) {
      settingsForm.reset({ 
        name: table.name, 
        min_order: table.min_order,
        payment_terms: table.payment_terms,
        notes: table.notes,
        // Convert UTC DB time to Local Input Format
        valid_from: formatForInput(table.valid_from || ''),
        valid_until: formatForInput(table.valid_until || '')
      });
      setIsSettingsModalOpen(true);
    }
  };
  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
    settingsForm.reset();
  };

  const availableProducts = products.filter(p => !items.some(i => i.product_id === p.id));

  // Calculation Logic
  const calculatePricing = (basePrice: number) => {
    const discount = parseFloat(discountValue) || 0;
    
    let finalPrice = basePrice;
    let discountAmount = 0;
    let discountPercent = 0;

    if (discountType === 'percentage') {
      discountAmount = basePrice * (discount / 100);
      discountPercent = discount;
      finalPrice = basePrice - discountAmount;
    } else {
      discountAmount = discount;
      discountPercent = basePrice > 0 ? (discount / basePrice) * 100 : 0;
      finalPrice = basePrice - discount;
    }

    return {
      finalPrice: Math.max(0, finalPrice),
      discountAmount,
      discountPercent
    };
  };

  const { finalPrice, discountAmount, discountPercent } = selectedProduct 
    ? calculatePricing(selectedProduct.base_price) 
    : { finalPrice: 0, discountAmount: 0, discountPercent: 0 };

  // Status Logic
  const getTableStatus = () => {
    if (!table) return null;
    
    // FIX: Show specific warning if inactive but has dates
    if (!table.active) {
      if (table.valid_from || table.valid_until) {
        return {
          type: 'danger',
          message: 'AGENDAMENTO PAUSADO',
          desc: 'Esta tabela possui datas definidas, mas está DESATIVADA. O cliente NÃO verá esta tabela até que você clique em "ATIVAR TABELA".'
        };
      }
      return null;
    }
    
    const now = new Date().toISOString();
    if (table.valid_from && table.valid_from > now) {
      return { 
        type: 'warning', 
        message: 'TABELA AGENDADA', 
        desc: 'Esta tabela está ativa, mas só ficará visível para o cliente na data de início.' 
      };
    }
    if (table.valid_until && table.valid_until < now) {
      return { 
        type: 'danger', 
        message: 'TABELA EXPIRADA', 
        desc: 'Esta tabela está ativa, mas não está mais visível para o cliente pois a data de fim expirou.' 
      };
    }
    
    return {
      type: 'success',
      message: 'TABELA VIGENTE',
      desc: 'Esta tabela está ativa e visível para o cliente.'
    };
  };

  const statusAlert = getTableStatus();

  if (loading) return <div className="flex justify-center h-full p-12"><Loader2 className="animate-spin text-black" size={32} /></div>;
  if (!table) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate('/price-tables')}
          className="flex items-center gap-2 text-black font-bold uppercase hover:underline w-fit"
        >
          <ArrowLeft size={20} />
          VOLTAR PARA TABELAS
        </button>

        {statusAlert && (
          <div className={cn(
            "p-4 border-2 border-black flex items-start gap-3",
            statusAlert.type === 'warning' ? "bg-white text-black border-dashed" : 
            statusAlert.type === 'success' ? "bg-black text-white" :
            "bg-white text-black border-dashed border-red-600"
          )}>
            {statusAlert.type === 'warning' ? <Clock size={24} /> : 
             statusAlert.type === 'success' ? <CheckCircle2 size={24} /> :
             <AlertTriangle size={24} className="text-red-600" />}
            <div>
              <h3 className={cn("font-black uppercase text-lg", statusAlert.type === 'danger' && "text-red-600")}>
                {statusAlert.message}
              </h3>
              <p className="font-medium text-sm">{statusAlert.desc}</p>
            </div>
          </div>
        )}

        <div className="bg-white p-6 border-2 border-black shadow-sharp flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-black text-black uppercase">{table.name}</h1>
              <Badge variant={table.active ? 'success' : 'neutral'}>
                {table.active ? 'ATIVA' : 'INATIVA'}
              </Badge>
              <button 
                onClick={openSettingsModal}
                className="p-1.5 text-black hover:bg-black hover:text-white transition-colors border border-transparent hover:border-black"
                title="EDITAR CONFIGURAÇÕES"
              >
                <Edit2 size={16} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-black font-medium uppercase">
              <span className="flex items-center gap-1.5">
                <span>CLIENTE:</span> 
                {table.clients?.nome_fantasia}
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="flex items-center gap-1.5">
                <span>PEDIDO MÍNIMO:</span> 
                <span className="font-mono">{formatCurrency(table.min_order)}</span>
              </span>
              {table.payment_terms && (
                <>
                  <span className="hidden sm:inline">|</span>
                  <span className="flex items-center gap-1.5">
                    <CreditCard size={14} />
                    <span>PAGAMENTO:</span> 
                    <span>{table.payment_terms}</span>
                  </span>
                </>
              )}
            </div>
            {(table.valid_from || table.valid_until) && (
              <div className="mt-3 text-xs font-bold text-black bg-gray-100 p-2 border border-black w-fit flex items-center gap-2 uppercase">
                <CalendarClock size={14} />
                <span>
                  Válida: {table.valid_from ? formatDateTime(table.valid_from) : 'IMEDIATO'} 
                  {' até '} 
                  {table.valid_until ? formatDateTime(table.valid_until) : 'INDETERMINADO'}
                </span>
              </div>
            )}
            {table.notes && (
              <div className="mt-3 text-xs font-medium text-gray-600 flex items-start gap-2 max-w-2xl">
                <StickyNote size={14} className="shrink-0 mt-0.5" />
                <span className="uppercase">{table.notes}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              onClick={toggleActive}
              variant={table.active ? 'secondary' : 'primary'}
              className="flex-1 md:flex-none"
            >
              {table.active ? 'DESATIVAR TABELA' : 'ATIVAR TABELA'}
            </Button>
            <Button
              onClick={openItemModal}
              leftIcon={<Plus size={18} />}
              className="flex-1 md:flex-none"
            >
              ADICIONAR PRODUTO
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-black shadow-sharp">
        <div className="p-5 border-b-2 border-black bg-white flex justify-between items-center">
          <h3 className="font-bold text-black uppercase">PRODUTOS NA TABELA</h3>
          <span className="text-xs font-bold text-black bg-white px-2 py-1 border border-black">
            {items.length} ITENS
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-black">
            <AlertCircle className="mx-auto mb-4" size={32} />
            <p className="font-bold uppercase">Nenhum produto adicionado</p>
            <Button onClick={openItemModal} variant="outline" size="sm" className="mt-4">
              ADICIONAR PRIMEIRO PRODUTO
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-white font-bold uppercase border-b-2 border-black">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4 hidden sm:table-cell">SKU</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Qtd. Mínima</th>
                  <th className="px-6 py-4">Preço Definido</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-black uppercase">{item.products?.name}</div>
                      <div className="text-xs text-gray-600 sm:hidden font-mono">{item.products?.sku}</div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell text-black font-mono font-bold text-xs">
                      {item.products?.sku}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Tag size={14} className="text-black" />
                        <span className="text-xs font-bold uppercase text-black">
                          {item.price_type || 'FIXO'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-white border border-black text-black px-2 py-1 text-xs font-bold">
                        {item.min_quantity} UN
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-black font-mono text-base">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-black hover:bg-black hover:text-white transition-colors"
                        title="REMOVER PRODUTO"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isItemModalOpen}
        onClose={closeItemModal}
        title="ADICIONAR PRODUTO"
      >
        <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-black uppercase">Produto</label>
            <select
              {...itemForm.register('product_id', { required: 'Produto é obrigatório' })}
              className="w-full h-10 px-3 py-2 border border-black rounded-none focus:ring-1 focus:ring-black outline-none bg-white text-sm text-black"
            >
              <option value="">SELECIONE UM PRODUTO...</option>
              {availableProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name.toUpperCase()} (SKU: {p.sku})
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
              <div className="bg-gray-50 border border-black p-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-600 uppercase">Preço Base do Produto</span>
                  <span className="font-mono font-bold text-black">{formatCurrency(selectedProduct.base_price)}</span>
                </div>
              </div>

              {/* Simulador de Desconto */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-black block uppercase tracking-wider">
                  Simular Desconto
                </label>
                <div className="flex">
                  <div className="flex border border-black border-r-0">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={cn(
                        "px-3 py-2 text-sm font-bold uppercase transition-colors",
                        discountType === 'percentage' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                      )}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={cn(
                        "px-3 py-2 text-sm font-bold uppercase transition-colors border-l border-black",
                        discountType === 'fixed' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
                      )}
                    >
                      R$
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step={discountType === 'percentage' ? '1' : '0.01'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="flex-1 h-10 border border-black px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="0"
                  />
                </div>
                
                {/* Feedback em Tempo Real */}
                <div className="h-5">
                  {parseFloat(discountValue) > 0 && (
                    <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                      <ArrowRight size={12} />
                      {discountType === 'percentage' 
                        ? `Desconto de ${formatCurrency(discountAmount)}`
                        : `Equivalente a ${discountPercent.toFixed(1)}%`
                      }
                    </p>
                  )}
                </div>
              </div>

              {/* Tabela de Cálculo */}
              <div className="bg-gray-50 border border-black p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-bold uppercase">Preço Base</span>
                  <span className="font-mono font-medium">{formatCurrency(selectedProduct.base_price)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-bold uppercase">Desconto Aplicado</span>
                  <span className="font-mono font-medium text-red-600">
                    - {formatCurrency(discountAmount)}
                  </span>
                </div>
                <div className="border-t border-black pt-3 flex justify-between items-center">
                  <span className="text-black font-black uppercase tracking-wide">Preço Final Simulado</span>
                  <span className="font-black text-lg font-mono bg-black text-white px-2 py-0.5">
                    {formatCurrency(finalPrice)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input
                label="Preço Final (R$)"
                type="number"
                step="0.01"
                {...itemForm.register('value', { required: 'Preço é obrigatório', min: 0.01 })}
                placeholder="0.00"
                error={itemForm.formState.errors.value?.message}
              />
            </div>

            <div className="space-y-2">
              <Input
                label="Qtd. Mínima"
                type="number"
                {...itemForm.register('min_quantity', { required: true, min: 1 })}
                placeholder="1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-black mt-6">
            <Button type="button" variant="ghost" onClick={closeItemModal}>
              CANCELAR
            </Button>
            <Button
              type="submit"
              isLoading={itemForm.formState.isSubmitting}
              disabled={availableProducts.length === 0}
            >
              ADICIONAR
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isSettingsModalOpen}
        onClose={closeSettingsModal}
        title="CONFIGURAÇÕES DA TABELA"
      >
        <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Input
              label="Nome da Tabela"
              {...settingsForm.register('name', { required: 'Nome é obrigatório' })}
              placeholder="EX: TABELA PADRÃO 2025"
              error={settingsForm.formState.errors.name?.message}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Input
                label="Pedido Mínimo (R$)"
                type="number"
                step="0.01"
                {...settingsForm.register('min_order', { min: 0 })}
                placeholder="0.00"
                error={settingsForm.formState.errors.min_order?.message}
              />
            </div>
            
            <div className="space-y-2">
              <Input
                label="Condição de Pagamento"
                {...settingsForm.register('payment_terms')}
                placeholder="EX: 30/60/90 DIAS"
                icon={<CreditCard size={18} />}
                list="payment-terms-list-edit"
              />
              <datalist id="payment-terms-list-edit">
                <option value="À VISTA" />
                <option value="30 DIAS" />
                <option value="30/60 DIAS" />
                <option value="30/60/90 DIAS" />
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-black block uppercase flex items-center gap-2">
              <StickyNote size={16} /> Observações
            </label>
            <textarea
              {...settingsForm.register('notes')}
              rows={3}
              className="w-full px-3 py-2 border border-black rounded-none focus:ring-1 focus:ring-black focus:border-black outline-none resize-none text-sm text-black placeholder:text-gray-400"
              placeholder="INFORMAÇÕES ADICIONAIS SOBRE ESTA TABELA..."
            />
          </div>

          <div className="p-4 bg-gray-50 border border-black">
            <h4 className="text-sm font-black text-black uppercase mb-4 flex items-center gap-2">
              <CalendarClock size={16} />
              Período de Validade
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  type="datetime-local"
                  label="Válida a partir de"
                  {...settingsForm.register('valid_from')}
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="datetime-local"
                  label="Válida até"
                  {...settingsForm.register('valid_until')}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-black mt-6">
            <Button type="button" variant="ghost" onClick={closeSettingsModal}>
              CANCELAR
            </Button>
            <Button type="submit" isLoading={settingsForm.formState.isSubmitting}>
              SALVAR ALTERAÇÕES
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
