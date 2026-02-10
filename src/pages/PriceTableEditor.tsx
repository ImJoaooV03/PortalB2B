import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PriceTable, PriceTableItem, Product } from '../lib/types';
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Edit2, Tag } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { cn, formatCurrency } from '../lib/utils';
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
  
  const itemForm = useForm<Partial<PriceTableItem>>();
  const settingsForm = useForm<Partial<PriceTable>>();

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

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
      if (newStatus === true) {
        const { error: deactivateError } = await supabase
          .from('price_tables')
          .update({ active: false })
          .eq('client_id', table.client_id);
        if (deactivateError) throw deactivateError;
      }
      const { error } = await supabase
        .from('price_tables')
        .update({ active: newStatus })
        .eq('id', table.id);

      if (error) throw error;
      setTable({ ...table, active: newStatus });
    } catch (error: any) {
      if (error.code === '23505') {
        alert('Conflito de tabelas ativas.');
      } else {
        alert('Erro ao atualizar status.');
      }
    }
  };

  const onSettingsSubmit = async (data: Partial<PriceTable>) => {
    if (!table) return;
    try {
      const { error } = await supabase
        .from('price_tables')
        .update({ name: data.name, min_order: data.min_order })
        .eq('id', table.id);

      if (error) throw error;
      setTable({ ...table, ...data });
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
    setIsItemModalOpen(true);
  };
  const closeItemModal = () => {
    setIsItemModalOpen(false);
    itemForm.reset();
  };
  const openSettingsModal = () => {
    if (table) {
      settingsForm.reset({ name: table.name, min_order: table.min_order });
      setIsSettingsModalOpen(true);
    }
  };
  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
    settingsForm.reset();
  };

  const availableProducts = products.filter(p => !items.some(i => i.product_id === p.id));

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
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Input
                label="Preço (R$)"
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
