import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, CheckCircle } from 'lucide-react';
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
    if (message.includes('Database error')) return 'Erro interno ao criar perfil.';
    if (message.includes('Invalid login credentials')) return 'Email ou senha incorretos.';
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
        setSuccessMessage('Conta criada com sucesso!');
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
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="bg-white p-8 w-full max-w-md border-2 border-black shadow-sharp">
        <div className="text-center mb-8">
          <div className="w-full flex items-center justify-center mb-6">
            <img 
              src="https://images.dualite.app/ab2a4a60-cf58-4ef8-ad02-2ec22f8431aa/group-bb75c517-4a93-46f3-bda1-9b5ada908173.webp" 
              alt="Objetivus Logo" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <p className="text-black font-medium mt-2 text-sm uppercase tracking-widest border-b border-black pb-4 inline-block">
            Acesso Parceiros
          </p>
        </div>

        {error && (
          <div className="bg-white border-2 border-black p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-black shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-sm font-bold text-black uppercase">Erro</h3>
              <p className="text-xs text-black mt-1">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="bg-black text-white p-4 mb-6 flex items-start gap-3">
            <CheckCircle className="text-white shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-sm font-bold uppercase">Sucesso</h3>
              <p className="text-xs mt-1">{successMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <Input
            label="Email Corporativo"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="NOME@EMPRESA.COM.BR"
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
            className="w-full text-base h-12"
            size="lg"
          >
            {isSignUp ? 'CADASTRAR EMPRESA' : 'ENTRAR NO PORTAL'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-black text-center">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccessMessage(null);
            }}
            className="text-sm text-black font-bold hover:underline uppercase tracking-wide"
          >
            {isSignUp ? 'Já possui cadastro? Entrar' : 'Solicitar Cadastro'}
          </button>
        </div>
      </div>
    </div>
  );
}
