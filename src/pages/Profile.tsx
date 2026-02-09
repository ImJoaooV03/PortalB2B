import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { User, Mail, Phone, MapPin, Save, Loader2, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface ProfileFormData {
  full_name: string;
  phone: string;
  address: string;
  password?: string;
  confirm_password?: string;
}

export default function Profile() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm<ProfileFormData>({
    defaultValues: {
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      address: profile?.address || ''
    }
  });

  const password = watch('password');

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    try {
      // 1. Update Profile Data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          address: data.address
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // 2. Update Password (if provided)
      if (data.password) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: data.password
        });
        if (passwordError) throw passwordError;
      }

      toast.success('Perfil atualizado com sucesso!');
      
      // Clear password fields
      if (data.password) {
        reset({
          full_name: data.full_name,
          phone: data.phone,
          address: data.address,
          password: '',
          confirm_password: ''
        });
      }

    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-500">Gerencie suas informações pessoais e segurança</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b bg-gray-50/50 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold border-2 border-white shadow-sm">
            {profile?.full_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{profile?.full_name || 'Usuário'}</h2>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <span className="capitalize bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-bold">
                {profile?.role}
              </span>
              {user?.email}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                Nome Completo
              </label>
              <input
                {...register('full_name', { required: 'Nome é obrigatório' })}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
              {errors.full_name && <span className="text-xs text-red-500">{errors.full_name.message}</span>}
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                E-mail
              </label>
              <input
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2.5 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400">O e-mail não pode ser alterado.</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                Telefone / WhatsApp
              </label>
              <input
                {...register('phone')}
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {/* Address */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin size={16} className="text-gray-400" />
                Endereço Completo
              </label>
              <input
                {...register('address')}
                placeholder="Rua, Número, Bairro, Cidade - UF"
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="border-t pt-6 mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock size={16} className="text-gray-400" />
              Alterar Senha (Opcional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nova Senha</label>
                <input
                  type="password"
                  {...register('password', { minLength: { value: 6, message: 'Mínimo de 6 caracteres' } })}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.password && <span className="text-xs text-red-500">{errors.password.message}</span>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Confirmar Senha</label>
                <input
                  type="password"
                  {...register('confirm_password', { 
                    validate: val => !password || val === password || 'As senhas não conferem'
                  })}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.confirm_password && <span className="text-xs text-red-500">{errors.confirm_password.message}</span>}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm hover:shadow disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
