import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Client } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Plus, Search, Edit2, Trash2, Building2, Loader2, FileText, Briefcase, UserX } from 'lucide-react';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useForm } from 'react-hook-form';
import { cn } from '../lib/utils';

export default function Clients() {
  const { isClient, user, isSeller } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Partial<Client>>();

  useEffect(() => {
    fetchClients();
  }, [user, isSeller]); // Re-fetch if user context changes

  async function fetchClients() {
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      // STRICT FILTERING: If seller, only show their own clients
      if (isSeller && user) {
        query = query.eq('vendedor_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao carregar lista de clientes.');
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (data: Partial<Client>) => {
    try {
      const payload = { ...data };
      
      // Auto-assign seller ID if creating as a seller
      if (!editingClient && isSeller && user) {
        payload.vendedor_id = user.id;
      }

      if (editingClient) {
        const { error } = await supabase.from('clients').update(payload).eq('id', editingClient.id);
        if (error) throw error;
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('clients').insert([{ ...payload, status: 'active' }]);
        if (error) throw error;
        toast.success('Cliente cadastrado com sucesso!');
      }
      
      await fetchClients();
      closeModal();
    } catch (error: any) {
      let msg = 'Erro ao salvar cliente.';
      if (error.message?.includes('duplicate key')) msg = 'Já existe um cliente com este CNPJ ou Razão Social.';
      toast.error(msg);
    }
  };

  const deleteClient = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      setClients(clients.filter(c => c.id !== id));
      toast.success('Cliente removido com sucesso.');
    } catch (error: any) {
      toast.error('Erro ao excluir cliente. Verifique se existem pedidos vinculados.');
    }
  };

  const openModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      reset(client);
    } else {
      setEditingClient(null);
      reset({ status: 'active' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
    reset();
  };

  const filteredClients = clients.filter(c => 
    c.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isClient) return <div className="p-8 text-center text-gray-500">Acesso restrito.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Clientes (Empresas)"
        subtitle="Gerencie sua carteira de clientes e empresas parceiras."
        action={
          <Button onClick={() => openModal()} leftIcon={<Plus size={18} />}>
            Nova Empresa
          </Button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/30">
          <Input 
            placeholder="Buscar por Razão Social ou Fantasia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
            className="max-w-md bg-white"
          />
        </div>

        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              {searchTerm ? <Search className="text-gray-300" size={32} /> : <UserX className="text-gray-300" size={32} />}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? 'Nenhum resultado encontrado' : 'Sua carteira está vazia'}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">
              {searchTerm 
                ? `Não encontramos empresas com o termo "${searchTerm}".` 
                : 'Você ainda não possui empresas cadastradas na sua carteira. Comece adicionando seu primeiro cliente.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => openModal()} leftIcon={<Plus size={18} />}>
                Cadastrar Primeira Empresa
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Empresa</th>
                  <th className="px-6 py-4">CNPJ</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{client.nome_fantasia}</p>
                          <p className="text-xs text-gray-500">{client.razao_social}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                      {client.cnpj || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={client.status === 'active' ? 'success' : 'neutral'}>
                        {client.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          onClick={() => openModal(client)}
                          title="Editar"
                          className="h-8 w-8"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteClient(client.id)}
                          title="Excluir"
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Input
                label="Nome Fantasia"
                {...register('nome_fantasia', { required: 'Nome Fantasia é obrigatório' })}
                error={errors.nome_fantasia?.message}
                placeholder="Ex: Mercado Central"
                icon={<Building2 size={18} />}
              />
            </div>
            
            <div className="space-y-2">
              <Input
                label="Razão Social"
                {...register('razao_social', { required: 'Razão Social é obrigatória' })}
                error={errors.razao_social?.message}
                placeholder="Ex: Mercado Central LTDA"
                icon={<FileText size={18} />}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Input
              label="CNPJ"
              {...register('cnpj')}
              placeholder="00.000.000/0000-00"
              icon={<Briefcase size={18} />}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="status"
              {...register('status')}
              value="active"
              defaultChecked={!editingClient || editingClient.status === 'active'}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="status" className="text-sm text-gray-700 cursor-pointer select-none">Cliente Ativo</label>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingClient ? 'Salvar Alterações' : 'Salvar Cliente'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
