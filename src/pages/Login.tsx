import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
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

  const translateError = (error: any) => {
    const message = error.message || '';
    if (message.includes('Database error')) return 'Erro interno ao criar perfil.';
    if (message.includes('Invalid login credentials') || error.code === 'invalid_credentials') {
      return 'Email ou senha incorretos.';
    }
    if (message.includes('Email not confirmed')) {
      return 'Email não confirmado. Verifique sua caixa de entrada.';
    }
    return message || 'Ocorreu um erro inesperado.';
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Sanitize inputs to prevent whitespace errors
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: cleanEmail.split('@')[0], 
              role: 'cliente'
            }
          }
        });
        
        if (signUpError) throw signUpError;
        setSuccessMessage('Conta criada com sucesso! Aguarde aprovação ou verifique seu email.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        
        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white">
      {/* Left Side - Store Image */}
      <div className="hidden lg:block w-1/2 relative border-r-2 border-black overflow-hidden">
        <div className="absolute inset-0 bg-black/10 z-10"></div>
        <img 
          src="https://images.dualite.app/ab2a4a60-cf58-4ef8-ad02-2ec22f8431aa/loja-ee25fb25-77cd-477b-ae6c-fa346754ccfe.webp" 
          alt="Loja Objetivus" 
          className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
        />
        <div className="absolute bottom-0 left-0 w-full p-12 z-20 bg-gradient-to-t from-black/90 to-transparent">
          <h2 className="text-white text-4xl font-black uppercase tracking-tighter mb-2">
            Portal Objetivus
          </h2>
          <p className="text-white/80 text-lg font-medium max-w-md">
            Excelência em distribuição e gestão de pedidos B2B.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-24 relative">
        <div className="w-full max-w-md space-y-10">
          
          {/* Header */}
          <div className="text-center">
            <div className="w-full flex items-center justify-center mb-8">
              <img 
                src="https://images.dualite.app/ab2a4a60-cf58-4ef8-ad02-2ec22f8431aa/group-bb75c517-4a93-46f3-bda1-9b5ada908173.webp" 
                alt="Objetivus Logo" 
                className="h-24 w-auto object-contain"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black text-black uppercase tracking-tight">
                {isSignUp ? 'Criar Conta' : 'Acesso ao Portal'}
              </h1>
              <p className="text-gray-500 font-medium">
                {isSignUp ? 'Preencha os dados para solicitar acesso' : 'Entre com suas credenciais corporativas'}
              </p>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="bg-white border-2 border-black p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="text-black shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-bold text-black uppercase">Erro de Acesso</h3>
                <p className="text-sm text-black mt-1">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="bg-black text-white p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="text-white shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-bold uppercase">Sucesso</h3>
                <p className="text-sm mt-1">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-6">
              <Input
                label="Email Corporativo"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="NOME@EMPRESA.COM.BR"
                icon={<Mail size={20} />}
                className="h-12 text-base"
              />

              <div className="space-y-2">
                <Input
                  label="Senha"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  icon={<Lock size={20} />}
                  className="h-12 text-base"
                />
                {!isSignUp && (
                  <div className="flex justify-end">
                    <button type="button" className="text-xs font-bold text-gray-500 hover:text-black uppercase">
                      Esqueceu a senha?
                    </button>
                  </div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              isLoading={loading}
              className="w-full h-14 text-lg shadow-sharp hover:translate-y-1 hover:shadow-none transition-all"
              size="lg"
            >
              {isSignUp ? 'SOLICITAR CADASTRO' : 'ENTRAR NO SISTEMA'}
              {!loading && <ArrowRight className="ml-2" size={20} />}
            </Button>
          </form>

          {/* Footer */}
          <div className="pt-8 border-t-2 border-black text-center">
            <p className="text-sm font-medium text-gray-600 mb-4">
              {isSignUp ? 'Já possui uma conta?' : 'Ainda não é parceiro?'}
            </p>
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-black font-black hover:underline uppercase tracking-wide border-2 border-black px-6 py-2 hover:bg-black hover:text-white transition-colors"
            >
              {isSignUp ? 'Fazer Login' : 'Solicitar Acesso'}
            </button>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="absolute bottom-6 text-center w-full text-xs font-bold text-gray-400 uppercase">
          &copy; 2025 Portal Objetivus. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
