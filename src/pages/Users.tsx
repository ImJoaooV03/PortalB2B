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

  useEffect(() => { fetchData(); }, [user, isSeller]);
  useEffect(() => {
    if (isSeller && !editingUser && isModalOpen) setValue('role', 'cliente');
  }, [isSeller, editingUser, isModalOpen, setValue]);

  async function fetchData() {
    setLoading(true);
    try {
      let clientsQuery = supabase.from('clients').select('*').eq('status', 'active');
      if (isSeller && user) {
        clientsQuery = clientsQuery.eq('vendedor_id', user.id);
      }
      const { data: clientsData, error: clientsError } = await clientsQuery;
      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (error: any) {
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

  const visibleUsers = users.filter(u => {
    if (isAdmin) return true;
    if (isSeller) {
      if (u.role !== 'cliente') return false;
      if (!u.client_id) return false;
      return clients.some(c => c.id === u.client_id);
    }
    return false;
  });

  const filteredUsers = visibleUsers.filter(u => 
    (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (!isAdmin && !isSeller) return <div className="p-8 text-center text-black font-bold uppercase">Acesso restrito.</div>;

  return (
    <div className="animate-in fade-in duration-500">
      <PageHeader 
        title="Usuários de Acesso"
        subtitle="Gerencie os usuários e permissões de acesso ao portal."
        action={
          <Button onClick={() => openModal()} leftIcon={<UserPlus size={18} />}>
            {isAdmin ? 'NOVO MEMBRO' : 'NOVO CLIENTE'}
          </Button>
        }
      />

      <div className="bg-white border-2 border-black shadow-sharp">
        <div className="p-5 border-b-2 border-black bg-white">
          <Input 
            placeholder="BUSCAR POR NOME OU E-MAIL..."
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
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center text-black">
            <div className="w-16 h-16 bg-black text-white flex items-center justify-center mb-4 border-2 border-black">
              {searchTerm ? <Search size={32} /> : <UserX size={32} />}
            </div>
            <h3 className="text-lg font-bold uppercase mb-2">
              {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário vinculado'}
            </h3>
            {!searchTerm && (
              <Button onClick={() => openModal()} className="mt-6" leftIcon={<UserPlus size={18} />}>
                CADASTRAR USUÁRIO
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black text-white font-bold uppercase border-b-2 border-black">
                <tr>
                  <th className="px-6 py-4 w-[35%]">Usuário</th>
                  <th className="px-6 py-4 w-[20%]">Contato</th>
                  <th className="px-6 py-4 w-[15%]">Função</th>
                  <th className="px-6 py-4 w-[20%]">Empresa</th>
                  <th className="px-6 py-4 text-right w-[10%]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-white border border-black flex items-center justify-center text-black font-bold text-sm shrink-0">
                          {user.full_name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-black truncate uppercase">{user.full_name || 'SEM NOME'}</p>
                          <p className="text-xs text-gray-600 font-medium truncate uppercase">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-black font-medium">
                      {user.phone || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge 
                        variant={
                          user.role === 'admin' ? 'warning' : 
                          user.role === 'vendedor' ? 'info' : 
                          'success'
                        }
                      >
                        {user.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {user.client_id ? (
                        <div className="flex items-center gap-2 text-black bg-white px-2 py-1 border border-black w-fit">
                          <Building2 size={12} />
                          <span className="font-bold text-xs truncate max-w-[120px] uppercase">
                            {clients.find(c => c.id === user.client_id)?.nome_fantasia || '...'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic uppercase">NÃO VINCULADO</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openModal(user)}
                        leftIcon={<Edit2 size={14} />}
                      >
                        EDITAR
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
        title={editingUser ? "EDITAR USUÁRIO" : "NOVO CADASTRO"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Input
                label="Nome Completo"
                {...register('full_name', { required: 'Nome é obrigatório' })}
                error={errors.full_name?.message}
                placeholder="EX: JOÃO SILVA"
                icon={<User size={18} />}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Input
                label="E-mail"
                {...register('email', { required: 'Email é obrigatório' })}
                disabled={!!editingUser}
                error={errors.email?.message}
                placeholder="NOME@EMPRESA.COM"
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
              <label className="text-sm font-bold text-black block mb-1.5 uppercase">Função</label>
              <select
                {...register('role')}
                disabled={isSeller}
                className={cn(
                  "flex h-10 w-full rounded-none border border-black bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-1 focus:ring-black",
                  isSeller && "bg-gray-100 cursor-not-allowed text-gray-500"
                )}
              >
                {isAdmin && <option value="admin">ADMINISTRADOR</option>}
                {isAdmin && <option value="vendedor">VENDEDOR</option>}
                <option value="cliente">CLIENTE</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className={cn("text-sm font-bold block mb-1.5 uppercase", selectedRole === 'cliente' ? "text-black" : "text-gray-300")}>
                Vincular Empresa <span className={selectedRole === 'cliente' ? "text-black" : "hidden"}>*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Building2 size={18} className={cn(selectedRole === 'cliente' ? "text-black" : "text-gray-200")} />
                </div>
                <select
                  {...register('client_id', { required: selectedRole === 'cliente' })}
                  disabled={selectedRole !== 'cliente'}
                  className={cn(
                    "flex h-10 w-full rounded-none border pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black",
                    selectedRole === 'cliente' 
                      ? "border-black bg-white text-black" 
                      : "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                  )}
                >
                  <option value="">SELECIONE UMA EMPRESA...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-black mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              CANCELAR
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSeller && clients.length === 0}>
              {editingUser ? 'SALVAR ALTERAÇÕES' : 'CRIAR CONTA'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
