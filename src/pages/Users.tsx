import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Profile, Client } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Search, Loader2, Building2, UserPlus, User, Mail, Phone, Lock, CheckCircle2, Edit2, UserX } from 'lucide-react';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { useForm } from 'react-hook-form';
import { cn } from '../lib/utils';

// Temporary client configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const createTempClient = () => createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

interface UserFormData {
  email: string;
  password?: string;
  confirm_password?: string;
  full_name: string;
  phone?: string;
  address?: string;
  role: 'admin' | 'vendedor' | 'cliente';
  client_id?: string;
}

export default function Users() {
  const { isAdmin, isSeller, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<UserFormData>();
  const selectedRole = watch('role');
  const password = watch('password');

  useEffect(() => { fetchData(); }, [user, isSeller]); // Re-fetch if user context changes
  useEffect(() => {
    if (isSeller && !editingUser && isModalOpen) setValue('role', 'cliente');
  }, [isSeller, editingUser, isModalOpen, setValue]);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Fetch Clients (Companies)
      // Strict Filter: Sellers only fetch their own clients
      let clientsQuery = supabase.from('clients').select('*').eq('status', 'active');
      
      if (isSeller && user) {
        clientsQuery = clientsQuery.eq('vendedor_id', user.id);
      }
      
      const { data: clientsData, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;
      
      const fetchedClients = clientsData || [];
      setClients(fetchedClients);

      // 2. Fetch Users (Profiles)
      // We fetch all profiles first, then filter in memory for strict safety
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (usersError) throw usersError;

      setUsers(usersData || []);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (data: UserFormData) => {
    try {
      if (editingUser) {
        const { error } = await supabase.from('profiles').update({
          role: data.role,
          client_id: data.role === 'cliente' ? data.client_id : null,
          full_name: data.full_name,
          phone: data.phone,
          address: data.address
        }).eq('id', editingUser.id);
        if (error) throw error;
        toast.success('Usuário atualizado!');
      } else {
        if (!data.password) { toast.error('Senha obrigatória.'); return; }
        const tempSupabase = createTempClient();
        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: { data: { full_name: data.full_name, role: data.role } }
        });
        if (authError) throw authError;

        if (authData.user) {
          await new Promise(r => setTimeout(r, 1500));
          const updatePayload: any = { full_name: data.full_name, phone: data.phone, address: data.address };
          if (data.role === 'cliente' && data.client_id) updatePayload.client_id = data.client_id;
          await supabase.from('profiles').update(updatePayload).eq('id', authData.user.id);
        }
        toast.success('Usuário criado!');
      }
      await fetchData();
      closeModal();
    } catch (error: any) {
      toast.error(error.message || 'Erro na operação.');
    }
  };

  const openModal = (user?: Profile) => {
    if (user) {
      setEditingUser(user);
      reset({
        email: user.email,
        full_name: user.full_name || '',
        phone: user.phone || '',
        address: user.address || '',
        role: user.role,
        client_id: user.client_id || ''
      });
    } else {
      setEditingUser(null);
      reset({
        role: isSeller ? 'cliente' : 'vendedor',
        full_name: '', email: '', password: '', confirm_password: '', phone: '', address: '', client_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingUser(null); reset(); };

  // STRICT FILTERING LOGIC
  const visibleUsers = users.filter(u => {
    if (isAdmin) return true;
    
    if (isSeller) {
      // 1. Must be a client role
      if (u.role !== 'cliente') return false;
      
      // 2. Must be linked to a company
      if (!u.client_id) return false;
      
      // 3. That company must belong to the seller (exist in fetchedClients)
      return clients.some(c => c.id === u.client_id);
    }
    
    return false;
  });

  const filteredUsers = visibleUsers.filter(u => 
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (!isAdmin && !isSeller) return <div className="p-8 text-center text-gray-500">Acesso restrito.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader 
        title="Usuários de Acesso"
        subtitle="Gerencie os usuários e permissões de acesso ao portal."
        action={
          <Button onClick={() => openModal()} leftIcon={<UserPlus size={18} />}>
            {isAdmin ? 'Novo Membro' : 'Novo Cliente'}
          </Button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/30">
          <Input 
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
            className="max-w-md bg-white"
          />
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
            <p className="text-sm">Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              {searchTerm ? <Search className="text-gray-300" size={32} /> : <UserX className="text-gray-300" size={32} />}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário vinculado'}
            </h3>
            <p className="text-gray-500 text-sm mt-1 max-w-sm">
              {searchTerm 
                ? 'Tente buscar por outro termo.' 
                : isSeller 
                  ? 'Você ainda não possui usuários vinculados às suas empresas. Cadastre um novo cliente ou vincule um existente.'
                  : 'Nenhum registro encontrado.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => openModal()} className="mt-6" leftIcon={<UserPlus size={18} />}>
                Cadastrar Usuário
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 w-[35%]">Usuário</th>
                  <th className="px-6 py-4 w-[20%]">Contato</th>
                  <th className="px-6 py-4 w-[15%]">Função</th>
                  <th className="px-6 py-4 w-[20%]">Empresa</th>
                  <th className="px-6 py-4 text-right w-[10%]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm border border-indigo-100 shrink-0">
                          {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{user.full_name || 'Sem nome'}</p>
                          <p className="text-xs text-gray-500 font-medium truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.phone || <span className="text-gray-400 text-xs italic">Não informado</span>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge 
                        variant={
                          user.role === 'admin' ? 'warning' : 
                          user.role === 'vendedor' ? 'info' : 
                          'success'
                        }
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {user.client_id ? (
                        <div className="flex items-center gap-2 text-gray-700 bg-gray-100/50 px-2 py-1 rounded-md w-fit border border-gray-200">
                          <Building2 size={12} className="text-gray-400" />
                          <span className="font-medium text-xs truncate max-w-[120px]">
                            {clients.find(c => c.id === user.client_id)?.nome_fantasia || 'Empresa ID...'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Não vinculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openModal(user)}
                        leftIcon={<Edit2 size={14} />}
                      >
                        Editar
                      </Button>
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
        title={editingUser ? "Editar Usuário" : "Novo Cadastro"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Input
                label="Nome Completo"
                {...register('full_name', { required: 'Nome é obrigatório' })}
                error={errors.full_name?.message}
                placeholder="Ex: João Silva"
                icon={<User size={18} />}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Input
                label="E-mail"
                {...register('email', { required: 'Email é obrigatório' })}
                disabled={!!editingUser}
                error={errors.email?.message}
                placeholder="nome@empresa.com"
                icon={<Mail size={18} />}
              />
            </div>

            {!editingUser && (
              <>
                <div className="space-y-2">
                  <Input
                    type="password"
                    label="Senha"
                    {...register('password', { required: 'Obrigatório', minLength: 6 })}
                    placeholder="••••••••"
                    icon={<Lock size={18} />}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="password"
                    label="Confirmar Senha"
                    {...register('confirm_password', { validate: v => v === password || 'Senhas não conferem' })}
                    error={errors.confirm_password?.message}
                    placeholder="••••••••"
                    icon={<CheckCircle2 size={18} />}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Input
                label="Telefone"
                {...register('phone')}
                placeholder="(00) 00000-0000"
                icon={<Phone size={18} />}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Função</label>
              <div className="relative">
                <select
                  {...register('role')}
                  disabled={isSeller}
                  className={cn(
                    "flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500",
                    isSeller && "bg-gray-100 cursor-not-allowed"
                  )}
                >
                  {isAdmin && <option value="admin">Administrador</option>}
                  {isAdmin && <option value="vendedor">Vendedor</option>}
                  <option value="cliente">Cliente</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className={cn("text-sm font-medium block mb-1.5", selectedRole === 'cliente' ? "text-gray-700" : "text-gray-300")}>
                Vincular Empresa <span className={selectedRole === 'cliente' ? "text-red-500" : "hidden"}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Building2 size={18} className={cn(selectedRole === 'cliente' ? "text-gray-400" : "text-gray-200")} />
                </div>
                <select
                  {...register('client_id', { required: selectedRole === 'cliente' })}
                  disabled={selectedRole !== 'cliente'}
                  className={cn(
                    "flex h-10 w-full rounded-lg border pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                    selectedRole === 'cliente' 
                      ? "border-gray-200 bg-white text-gray-900 focus:border-indigo-500" 
                      : "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                  )}
                >
                  <option value="">Selecione uma empresa...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia}</option>)}
                </select>
              </div>
              {isSeller && clients.length === 0 && (
                 <p className="text-xs text-orange-500 mt-1">
                   Você não possui empresas cadastradas. Vá em "Clientes (Empresas)" para adicionar sua primeira empresa.
                 </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSeller && clients.length === 0}>
              {editingUser ? 'Salvar Alterações' : 'Criar Conta'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
