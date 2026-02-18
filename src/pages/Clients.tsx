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
  }, [user, isSeller]);

  async function fetchClients() {
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

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
    if (!confirm('Tem certeza que deseja excluir esta empresa?')) return;
    
    try {
      // 1. Tentar desvincular usuários primeiro (Setar client_id = null)
      // Isso permite excluir a empresa se ela só tiver usuários, mas não pedidos.
      const { error: unlinkUsersError } = await supabase
        .from('profiles')
        .update({ client_id: null })
        .eq('client_id', id);

      if (unlinkUsersError) throw unlinkUsersError;

      // 2. Tentar excluir tabelas de preço vinculadas
      const { error: deleteTablesError } = await supabase
        .from('price_tables')
        .delete()
        .eq('client_id', id);

      if (deleteTablesError) {
         // Se falhar aqui, provavelmente a tabela tem itens ou vínculos. Ignora e tenta deletar o cliente direto para cair no erro principal.
         console.warn('Não foi possível limpar tabelas automaticamente', deleteTablesError);
      }

      // 3. Tentar excluir o cliente
      const { error } = await supabase.from('clients').delete().eq('id', id);
      
      if (error) {
        // Código 23503 = Violação de Chave Estrangeira (Tem Pedidos vinculados)
        if (error.code === '23503') {
          const shouldInactivate = confirm(
            'ATENÇÃO: Esta empresa possui HISTÓRICO DE PEDIDOS e não pode ser excluída permanentemente.\n\nDeseja INATIVAR a empresa? Isso impedirá novos pedidos, mas manterá o histórico salvo.'
          );

          if (shouldInactivate) {
            const { error: updateError } = await supabase
              .from('clients')
              .update({ status: 'inactive' })
              .eq('id', id);

            if (updateError) throw updateError;

            // Atualiza a lista localmente
            setClients(clients.map(c => c.id === id ? { ...c, status: 'inactive' } : c));
            toast.success('Empresa inativada com sucesso.');
            return;
          }
          return; // Usuário cancelou
        }
        throw error; // Outro erro qualquer
      }

      // Sucesso na exclusão total
      setClients(clients.filter(c => c.id !== id));
      toast.success('Empresa removida com sucesso.');

    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao processar a exclusão.');
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

  if (isClient) return <div className="p-8 text-center text-black font-bold uppercase">Acesso restrito.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader
        title="Clientes (Empresas)"
        subtitle="Gerencie sua carteira de clientes e empresas parceiras."
        action={
          <Button onClick={() => openModal()} leftIcon={<Plus size={18} />}>
            NOVA EMPRESA
          </Button>
        }
      />

      <div className="bg-white border-2 border-black shadow-sharp">
        <div className="p-5 border-b-2 border-black bg-white">
          <Input 
            placeholder="BUSCAR POR RAZÃO SOCIAL OU FANTASIA..."
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
        ) : filteredClients.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center text-black">
            <div className="w-16 h-16 bg-black text-white flex items-center justify-center mb-4 border-2 border-black">
              {searchTerm ? <Search size={32} /> : <UserX size={32} />}
            </div>
            <h3 className="text-lg font-bold uppercase mb-2">
              {searchTerm ? 'Nenhum resultado encontrado' : 'Sua carteira está vazia'}
            </h3>
            <p className="text-gray-600 max-w-sm mx-auto mb-6 font-medium">
              {searchTerm 
                ? `Não encontramos empresas com o termo "${searchTerm}".` 
                : 'Você ainda não possui empresas cadastradas.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => openModal()} leftIcon={<Plus size={18} />}>
                CADASTRAR PRIMEIRA EMPRESA
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-white font-bold uppercase border-b-2 border-black">
                <tr>
                  <th className="px-6 py-4">Empresa</th>
                  <th className="px-6 py-4">CNPJ</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-white border border-black flex items-center justify-center text-black">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-black uppercase">{client.nome_fantasia}</p>
                          <p className="text-xs text-gray-500 uppercase">{client.razao_social}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-black font-mono font-bold text-xs">
                      {client.cnpj || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={client.status === 'active' ? 'success' : 'neutral'}>
                        {client.status === 'active' ? 'ATIVO' : 'INATIVO'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          onClick={() => openModal(client)}
                          className="h-8 w-8"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => deleteClient(client.id)}
                          className="h-8 w-8 hover:bg-black hover:text-white"
                          title={client.status === 'active' ? 'Excluir ou Inativar' : 'Excluir'}
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
        title={editingClient ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Input
                label="Nome Fantasia"
                {...register('nome_fantasia', { required: 'Nome Fantasia é obrigatório' })}
                error={errors.nome_fantasia?.message}
                placeholder="EX: MERCADO CENTRAL"
                icon={<Building2 size={18} />}
              />
            </div>
            
            <div className="space-y-2">
              <Input
                label="Razão Social"
                {...register('razao_social', { required: 'Razão Social é obrigatória' })}
                error={errors.razao_social?.message}
                placeholder="EX: MERCADO CENTRAL LTDA"
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
              className="w-4 h-4 rounded-none border-black text-black focus:ring-black cursor-pointer"
            />
            <label htmlFor="status" className="text-sm font-bold text-black cursor-pointer select-none uppercase">Cliente Ativo</label>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-black mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              CANCELAR
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingClient ? 'SALVAR ALTERAÇÕES' : 'SALVAR CLIENTE'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
