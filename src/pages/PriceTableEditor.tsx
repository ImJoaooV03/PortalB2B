import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PriceTable, PriceTableItem, Product } from '../lib/types';
import { ArrowLeft, Plus, Save, Trash2, Loader2, AlertCircle, Edit2, Tag } from 'lucide-react';
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
  
  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Forms
  const itemForm = useForm<Partial<PriceTableItem>>();
  const settingsForm = useForm<Partial<PriceTable>>();

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  async function fetchData() {
    try {
      // Fetch Table Info
      const { data: tableData, error: tableError } = await supabase
        .from('price_tables')
        .select('*, clients(nome_fantasia)')
        .eq('id', id)
        .single();
      
      if (tableError) throw tableError;
      setTable(tableData);

      // Fetch Items
      const { data: itemsData, error: itemsError } = await supabase
        .from('price_table_items')
        .select('*, products(*)')
        .eq('price_table_id', id);
        
      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch Available Products
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
      
      // CRITICAL FIX: If activating this table, we must first deactivate ALL other tables for this client
      // to avoid violating the database unique constraint "one_active_table_per_client".
      if (newStatus === true) {
        const { error: deactivateError } = await supabase
          .from('price_tables')
          .update({ active: false })
          .eq('client_id', table.client_id); // Deactivate all for this client
          
        if (deactivateError) throw deactivateError;
      }

      // Now it's safe to update the current table
      const { error } = await supabase
        .from('price_tables')
        .update({ active: newStatus })
        .eq('id', table.id);

      if (error) throw error;
      setTable({ ...table, active: newStatus });
    } catch (error: any) {
      console.error('Error updating status:', error);
      if (error.code === '23505') {
        alert('Conflito de tabelas ativas. Tente novamente.');
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
        .update({
          name: data.name,
          min_order: data.min_order
        })
        .eq('id', table.id);

      if (error) throw error;

      setTable({ ...table, ...data });
      closeSettingsModal();
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Erro ao atualizar configurações.');
    }
  };

  const onItemSubmit = async (data: Partial<PriceTableItem>) => {
    if (!id) return;
    try {
      const payload = {
        ...data,
        price_table_id: id,
        price_type: 'fixo' // Default to fixed for now
      };

      const { error } = await supabase
        .from('price_table_items')
        .insert([payload]);

      if (error) throw error;

      await fetchData();
      closeItemModal();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Erro ao salvar item. Verifique se o produto já está na lista.');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm('Remover este produto da tabela?')) return;
    try {
      const { error } = await supabase
        .from('price_table_items')
        .delete()
        .eq('id', itemId);

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
      settingsForm.reset({
        name: table.name,
        min_order: table.min_order
      });
      setIsSettingsModalOpen(true);
    }
  };

  const closeSettingsModal = () => {
    setIsSettingsModalOpen(false);
    settingsForm.reset();
  };

  const availableProducts = products.filter(
    p => !items.some(i => i.product_id === p.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!table) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => navigate('/price-tables')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 w-fit transition-colors"
        >
          <ArrowLeft size={20} />
          Voltar para Tabelas
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{table.name}</h1>
              <Badge variant={table.active ? 'success' : 'neutral'}>
                {table.active ? 'Ativa' : 'Inativa'}
              </Badge>
              <button 
                onClick={openSettingsModal}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Editar Configurações"
              >
                <Edit2 size={16} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-gray-700">Cliente:</span> 
                {table.clients?.nome_fantasia}
              </span>
              <span className="hidden sm:inline text-gray-300">|</span>
              <span className="flex items-center gap-1.5">
                <span className="font-medium text-gray-700">Pedido Mínimo:</span> 
                {formatCurrency(table.min_order)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              onClick={toggleActive}
              variant={table.active ? 'danger' : 'secondary'}
              className={cn(
                "flex-1 md:flex-none",
                !table.active && "text-green-700 bg-green-50 hover:bg-green-100 border-green-200"
              )}
            >
              {table.active ? 'Desativar Tabela' : 'Ativar Tabela'}
            </Button>
            <Button
              onClick={openItemModal}
              leftIcon={<Plus size={18} />}
              className="flex-1 md:flex-none"
            >
              Adicionar Produto
            </Button>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Produtos na Tabela</h3>
          <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded border shadow-sm">
            {items.length} itens
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-gray-400" size={24} />
            </div>
            <p className="font-medium text-gray-900">Nenhum produto adicionado</p>
            <p className="text-sm mt-1 mb-4">Comece adicionando produtos para este cliente.</p>
            <Button onClick={openItemModal} variant="outline" size="sm">
              Adicionar Primeiro Produto
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4 hidden sm:table-cell">SKU</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Qtd. Mínima</th>
                  <th className="px-6 py-4">Preço Definido</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{item.products?.name}</div>
                      <div className="text-xs text-gray-500 sm:hidden">{item.products?.sku}</div>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell text-gray-500 font-mono text-xs">
                      {item.products?.sku}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Tag size={14} className="text-gray-400" />
                        <span className="text-xs font-medium uppercase text-gray-600">
                          {item.price_type || 'fixo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                        {item.min_quantity} un.
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {formatCurrency(item.value)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => deleteItem(item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover produto"
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

      {/* Add Item Modal */}
      <Modal
        isOpen={isItemModalOpen}
        onClose={closeItemModal}
        title="Adicionar Produto à Tabela"
      >
        <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Produto</label>
            <select
              {...itemForm.register('product_id', { required: 'Produto é obrigatório' })}
              className="w-full h-10 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Selecione um produto...</option>
              {availableProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (SKU: {p.sku})
                </option>
              ))}
            </select>
            {itemForm.formState.errors.product_id && (
              <span className="text-xs text-red-500">{itemForm.formState.errors.product_id.message}</span>
            )}
            {availableProducts.length === 0 && (
              <p className="text-xs text-orange-500 mt-1">Todos os produtos ativos já foram adicionados.</p>
            )}
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

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
            <Button type="button" variant="ghost" onClick={closeItemModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={itemForm.formState.isSubmitting}
              disabled={availableProducts.length === 0}
            >
              Adicionar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Settings Modal */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={closeSettingsModal}
        title="Configurações da Tabela"
      >
        <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Input
              label="Nome da Tabela"
              {...settingsForm.register('name', { required: 'Nome é obrigatório' })}
              placeholder="Ex: Tabela Padrão 2025"
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
            <p className="text-xs text-gray-500">
              O cliente só poderá fechar o pedido se o valor total atingir este montante.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
            <Button type="button" variant="ghost" onClick={closeSettingsModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={settingsForm.formState.isSubmitting}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
