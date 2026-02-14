import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PriceTable, Client } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, Trash2, FileText, Loader2, User, Building2, ShieldCheck, CalendarClock, AlertTriangle, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useForm } from 'react-hook-form';
import { cn, formatCurrency, formatDateTime } from '../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';

export default function PriceTables() {
  const { isClient, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState<PriceTable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<Partial<PriceTable>>();
  
  // Watch dates to validate range
  const validFrom = watch('valid_from');
  const validUntil = watch('valid_until');

  useEffect(() => {
    fetchTables();
    fetchClients();
  }, []);

  async function fetchTables() {
    try {
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
      // Validate dates
      if (data.valid_from && data.valid_until && new Date(data.valid_from) > new Date(data.valid_until)) {
        alert('A data de fim deve ser posterior à data de início.');
        return;
      }

      // Convert local input time to UTC ISO string for DB
      const validFromUTC = data.valid_from ? new Date(data.valid_from).toISOString() : null;
      const validUntilUTC = data.valid_until ? new Date(data.valid_until).toISOString() : null;

      // FIX: If dates are provided, set active to TRUE automatically so the schedule works immediately
      const shouldActivate = !!(validFromUTC || validUntilUTC);

      // If activating, deactivate others for this client first
      if (shouldActivate && data.client_id) {
         await supabase
          .from('price_tables')
          .update({ active: false })
          .eq('client_id', data.client_id);
      }

      const payload = {
        ...data,
        active: shouldActivate, // Auto-activate if scheduled
        vendedor_id: user?.id,
        valid_from: validFromUTC,
        valid_until: validUntilUTC
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

  const getSellerName = (table: PriceTable) => {
    if (user && table.vendedor_id === user.id) return 'VOCÊ';
    if (!table.vendedor_id) return 'SISTEMA';
    const profileData = table.profiles;
    if (!profileData) return 'DESCONHECIDO';
    if (Array.isArray(profileData)) return profileData[0]?.full_name?.toUpperCase() || 'DESCONHECIDO';
    return profileData.full_name?.toUpperCase() || 'DESCONHECIDO';
  };

  const getTableStatus = (table: PriceTable) => {
    // If inactive, it's inactive regardless of dates
    if (!table.active) return { label: 'INATIVA', variant: 'neutral', icon: XCircle };
    
    const now = new Date().toISOString();
    
    // If active AND has future start date
    if (table.valid_from && table.valid_from > now) {
      return { label: 'AGENDADA', variant: 'warning', icon: Clock };
    }
    
    // If active AND has past end date
    if (table.valid_until && table.valid_until < now) {
      return { label: 'EXPIRADA', variant: 'danger', icon: AlertTriangle };
    }
    
    // Active and within range (or no range)
    return { label: 'VIGENTE', variant: 'success', icon: CheckCircle2 };
  };

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.clients?.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isClient) return <div className="p-8 text-center text-black font-bold uppercase">Acesso restrito.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader 
        title="Tabelas de Preço"
        subtitle="Defina preços e regras por cliente"
        action={
          <Button onClick={openModal} leftIcon={<Plus size={18} />}>
            NOVA TABELA
          </Button>
        }
      />

      <div className="bg-white border-2 border-black shadow-sharp">
        <div className="p-5 border-b-2 border-black bg-white">
          <Input 
            placeholder="BUSCAR POR NOME OU CLIENTE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
            className="max-w-md"
          />
        </div>

        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="animate-spin text-black" size={32} />
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="p-16 text-center text-black">
            <FileText className="mx-auto h-12 w-12 mb-3" />
            <p className="font-bold uppercase">Nenhuma tabela encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {filteredTables.map((table) => {
              const sellerName = getSellerName(table);
              const isMe = sellerName === 'VOCÊ';
              const isSystem = sellerName === 'SISTEMA';
              const hasValidity = table.valid_from || table.valid_until;
              const status = getTableStatus(table);
              const StatusIcon = status.icon;

              return (
                <Link 
                  key={table.id} 
                  to={`/price-tables/${table.id}`}
                  className="group block bg-white border-2 border-black p-5 hover:shadow-sharp transition-all relative flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-black text-white border-2 border-black">
                      <FileText size={24} />
                    </div>
                    <Badge variant={status.variant as any} className="flex items-center gap-1">
                      <StatusIcon size={12} />
                      {status.label}
                    </Badge>
                  </div>
                  
                  <h3 className="font-black text-black text-lg mb-1 uppercase truncate">
                    {table.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium uppercase">
                    <Building2 size={14} />
                    <span className="truncate">
                      {table.clients?.nome_fantasia || 'CLIENTE NÃO IDENTIFICADO'}
                    </span>
                  </div>

                  {hasValidity && (
                    <div className="mb-4 text-xs font-bold text-black bg-gray-100 p-2 border border-black flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 uppercase">
                        <CalendarClock size={12} />
                        Período de Validade:
                      </div>
                      <div className="pl-4 font-mono">
                        {table.valid_from ? formatDateTime(table.valid_from) : 'INÍCIO IMEDIATO'} 
                        <br/>
                        até 
                        <br/>
                        {table.valid_until ? formatDateTime(table.valid_until) : 'INDETERMINADO'}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mt-auto mb-4 pt-3 border-t-2 border-black">
                      <div className={cn(
                        "flex items-center gap-2 text-xs px-2 py-1.5 w-fit border border-black font-bold uppercase",
                        isMe ? "bg-black text-white" : "bg-white text-black"
                      )}>
                        {isSystem ? <ShieldCheck size={12} /> : <User size={12} />}
                        <span>CRIADO POR:</span>
                        <span className="truncate max-w-[120px]" title={sellerName}>
                          {sellerName}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {!isAdmin && !hasValidity && <div className="mt-auto mb-4"></div>}

                  <div className="flex items-center justify-between text-sm pt-3 border-t-2 border-black">
                    <span className="font-bold text-black uppercase">
                      MÍNIMO: <span className="font-mono">{formatCurrency(table.min_order)}</span>
                    </span>
                    <button 
                      onClick={(e) => deleteTable(table.id, e)}
                      className="p-1.5 text-black hover:bg-black hover:text-white transition-colors"
                      title="EXCLUIR TABELA"
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
        title="NOVA TABELA DE PREÇO"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Input
              label="Nome da Tabela"
              {...register('name', { required: 'Nome é obrigatório' })}
              placeholder="EX: TABELA PADRÃO 2025"
              error={errors.name?.message}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-black block uppercase">Cliente</label>
            <select
              {...register('client_id', { required: 'Cliente é obrigatório' })}
              className="w-full h-10 px-3 py-2 border border-black rounded-none focus:ring-1 focus:ring-black outline-none bg-white text-sm text-black uppercase"
            >
              <option value="">SELECIONE UM CLIENTE...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.nome_fantasia.toUpperCase()} ({client.razao_social.toUpperCase()})
                </option>
              ))}
            </select>
            {errors.client_id && <span className="text-xs text-black font-bold mt-1">⚠ {errors.client_id.message}</span>}
          </div>

          <div className="space-y-2">
            <Input
              label="Pedido Mínimo (R$)"
              type="number"
              step="0.01"
              {...register('min_order', { min: 0 })}
              placeholder="0.00"
            />
          </div>

          <div className="p-4 bg-gray-50 border border-black">
            <h4 className="text-sm font-black text-black uppercase mb-4 flex items-center gap-2">
              <CalendarClock size={16} />
              Período de Validade (Opcional)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  type="datetime-local"
                  label="Válida a partir de"
                  {...register('valid_from')}
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="datetime-local"
                  label="Válida até"
                  {...register('valid_until')}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              * A tabela será ativada automaticamente se você definir datas.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-black mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              CANCELAR
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              CRIAR E ATIVAR
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
