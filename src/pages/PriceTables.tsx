import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PriceTable, Client } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Trash2, FileText, Loader2, User, Building2, ShieldCheck } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { cn, formatCurrency } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';

export default function PriceTables() {
  const { isClient, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Partial<PriceTable>>();

  useEffect(() => {
    fetchTables();
    fetchClients();
  }, []);

  async function fetchTables() {
    try {
      // Fetch seller name using the profiles relationship
      // Note: profiles:vendedor_id is the alias for the joined table
      const { data, error } = await supabase
        .from('price_tables')
        .select('*, clients(nome_fantasia), profiles:vendedor_id(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*').eq('status', 'active');
    setClients(data || []);
  }

  const onSubmit = async (data: Partial<PriceTable>) => {
    try {
      const payload = {
        ...data,
        active: false,
        vendedor_id: user?.id // CRITICAL: Save the creator's ID
      };

      const { data: newTable, error } = await supabase
        .from('price_tables')
        .insert([payload])
        .select()
        .single();
        
      if (error) throw error;
      
      closeModal();
      if (newTable) {
        navigate(`/price-tables/${newTable.id}`);
      }
    } catch (error) {
      console.error('Error creating table:', error);
      alert('Erro ao criar tabela.');
    }
  };

  const deleteTable = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm('Tem certeza? Isso excluirá todos os preços vinculados.')) return;
    
    try {
      const { error } = await supabase.from('price_tables').delete().eq('id', id);
      if (error) throw error;
      setTables(tables.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting table:', error);
      alert('Erro ao excluir tabela.');
    }
  };

  const openModal = () => {
    reset({ min_order: 0 });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    reset();
  };

  // Helper function to safely get seller name
  const getSellerName = (table: PriceTable) => {
    // 1. If I created it
    if (user && table.vendedor_id === user.id) {
      return 'Você';
    }

    // 2. If no ID is saved (Legacy tables created before the fix)
    if (!table.vendedor_id) {
      return 'Sistema';
    }

    // 3. Try to get from joined profile data
    const profileData = table.profiles;
    
    if (!profileData) return 'Desconhecido';
    
    // Handle if Supabase returns an array or object
    if (Array.isArray(profileData)) {
      return profileData[0]?.full_name || 'Desconhecido';
    }
    
    return profileData.full_name || 'Desconhecido';
  };

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.clients?.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isClient) {
    return <div className="p-8 text-center text-gray-500">Acesso restrito.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tabelas de Preço</h1>
          <p className="text-gray-500">Defina preços e regras por cliente</p>
        </div>
        <button 
          onClick={openModal}
          className="flex items-center gap-2 bg-indigo-600 text-white h-10 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Nova Tabela
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por nome ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p>Nenhuma tabela encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {filteredTables.map((table) => {
              const sellerName = getSellerName(table);
              const isMe = sellerName === 'Você';
              const isSystem = sellerName === 'Sistema';

              return (
                <Link 
                  key={table.id} 
                  to={`/price-tables/${table.id}`}
                  className="group block bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all relative flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                      <FileText size={24} />
                    </div>
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold",
                      table.active ? "bg-green-50 text-green-700 border border-green-100" : "bg-gray-50 text-gray-600 border border-gray-100"
                    )}>
                      {table.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-indigo-600 transition-colors truncate">
                    {table.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Building2 size={14} className="text-gray-400" />
                    <span className="truncate">
                      {table.clients?.nome_fantasia || 'Cliente não identificado'}
                    </span>
                  </div>

                  {/* Seller Info - Highlighted for Admin */}
                  {isAdmin && (
                    <div className="mt-auto mb-4 pt-3 border-t border-gray-50">
                      <div className={cn(
                        "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md w-fit border",
                        isMe ? "bg-indigo-50 text-indigo-700 border-indigo-100" : 
                        isSystem ? "bg-gray-100 text-gray-600 border-gray-200" :
                        "bg-white text-gray-600 border-gray-200"
                      )}>
                        {isSystem ? <ShieldCheck size={12} /> : <User size={12} />}
                        <span className="font-medium">Criado por:</span>
                        <span className="truncate max-w-[120px]" title={sellerName}>
                          {sellerName}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Spacer if not admin to push footer down */}
                  {!isAdmin && <div className="mt-auto mb-4"></div>}

                  <div className="flex items-center justify-between text-sm text-gray-500 pt-3 border-t border-gray-100">
                    <span className="font-medium text-gray-900">
                      Mínimo: <span className="text-gray-600 font-normal">{formatCurrency(table.min_order)}</span>
                    </span>
                    <button 
                      onClick={(e) => deleteTable(table.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir Tabela"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Nova Tabela de Preço"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nome da Tabela</label>
            <input
              {...register('name', { required: 'Nome é obrigatório' })}
              className="w-full h-10 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Ex: Tabela Padrão 2025"
            />
            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            <select
              {...register('client_id', { required: 'Cliente é obrigatório' })}
              className="w-full h-10 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.nome_fantasia} ({client.razao_social})
                </option>
              ))}
            </select>
            {errors.client_id && <span className="text-xs text-red-500">{errors.client_id.message}</span>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Pedido Mínimo (R$)</label>
            <input
              type="number"
              step="0.01"
              {...register('min_order', { min: 0 })}
              className="w-full h-10 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={16} />}
              Criar e Editar Itens
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
