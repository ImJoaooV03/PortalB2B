import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, CheckCircle, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate('/', { replace: true });
    }
  }, [session, navigate]);

  const translateError = (message: string) => {
    if (message.includes('Database error')) return 'Erro interno ao criar perfil. Tente outro email ou contate o suporte.';
    if (message.includes('Invalid login credentials')) return 'Email ou senha incorretos.';
    if (message.includes('User already registered')) return 'Este email já está cadastrado.';
    if (message.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
    return message;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0], 
              role: 'cliente'
            }
          }
        });
        
        if (signUpError) throw signUpError;
        setSuccessMessage('Conta criada com sucesso! Entre com seus dados.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(translateError(err.message || 'Ocorreu um erro inesperado.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg transform -rotate-3">
            <Building2 size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Portal B2B</h1>
          <p className="text-gray-500 mt-2 text-sm">Acesso exclusivo para parceiros</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 p-4 mb-6 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-sm font-medium text-red-800">Atenção</h3>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-100 p-4 mb-6 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-sm font-medium text-green-800">Sucesso!</h3>
              <p className="text-xs text-green-700 mt-1">{successMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <Input
            label="Email Corporativo"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@empresa.com.br"
            icon={<Mail size={18} />}
          />

          <Input
            label="Senha"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            icon={<Lock size={18} />}
          />

          <Button
            type="submit"
            isLoading={loading}
            className="w-full text-base"
            size="lg"
          >
            {isSignUp ? 'Cadastrar Empresa' : 'Acessar Portal'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccessMessage(null);
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {isSignUp ? 'Já possui cadastro? Faça login' : 'Não tem acesso? Solicite seu cadastro'}
          </button>
        </div>
      </div>
    </div>
  );
}
