import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  Briefcase, 
  UserCog, 
  LogOut, 
  Menu, 
  X, 
  ChevronRight,
  Building2,
  User,
  TrendingUp 
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function DashboardLayout() {
  const { profile, signOut, isAdmin, isSeller } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Visão Geral', path: '/', icon: LayoutDashboard, show: true },
    { label: 'Meus Pedidos', path: '/orders', icon: Package, show: !isAdmin }, 
    { label: 'Gestão de Vendas', path: '/sales', icon: TrendingUp, show: isAdmin },
    { label: 'Clientes', path: '/clients', icon: Building2, show: isAdmin || isSeller },
    { label: isAdmin ? 'Time' : 'Usuários', path: '/users', icon: UserCog, show: isAdmin || isSeller },
    { label: 'Produtos', path: '/products', icon: Package, show: isAdmin || isSeller },
    { label: 'Tabelas', path: '/price-tables', icon: Briefcase, show: isAdmin || isSeller }
  ];

  return (
    <div className="min-h-screen bg-white flex font-sans text-black">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r-2 border-black fixed inset-y-0 z-30">
        <div className="h-16 flex items-center px-6 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <img 
              src="https://images.dualite.app/ab2a4a60-cf58-4ef8-ad02-2ec22f8431aa/group-bb75c517-4a93-46f3-bda1-9b5ada908173.webp" 
              alt="Objetivus" 
              className="h-8 w-auto object-contain"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3">
          <div className="text-xs font-bold text-black uppercase tracking-wider mb-4 px-3 border-b border-black pb-2">
            Menu
          </div>
          <nav className="space-y-1">
            {navItems.filter(item => item.show).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-none text-sm font-bold transition-all duration-200 group border border-transparent",
                    isActive 
                      ? "bg-black text-white border-black" 
                      : "text-black hover:bg-gray-100 hover:border-black"
                  )}
                >
                  <Icon size={18} className={cn("transition-colors", isActive ? "text-white" : "text-black")} />
                  {item.label}
                  {isActive && <ChevronRight size={16} className="ml-auto text-white" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t-2 border-black">
          <Link to="/profile" className="flex items-center gap-3 p-2 hover:bg-gray-100 border border-transparent hover:border-black transition-all group mb-2">
            <div className="w-9 h-9 bg-black flex items-center justify-center text-white font-bold shrink-0">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-black truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-gray-600 truncate capitalize">
                {profile?.role}
              </p>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2 py-2 w-full text-sm font-bold text-black hover:bg-black hover:text-white border border-transparent hover:border-black transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-white/90 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
      
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r-2 border-black transform transition-transform duration-300 ease-in-out md:hidden flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b-2 border-black">
          <img 
            src="https://images.dualite.app/ab2a4a60-cf58-4ef8-ad02-2ec22f8431aa/group-bb75c517-4a93-46f3-bda1-9b5ada908173.webp" 
            alt="Objetivus" 
            className="h-8 w-auto object-contain"
          />
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-black">
            <X size={24} />
          </button>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 border border-transparent text-sm font-bold",
                  location.pathname === item.path 
                    ? "bg-black text-white border-black" 
                    : "text-black hover:bg-gray-100 hover:border-black"
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen transition-all">
        <header className="h-16 bg-white border-b-2 border-black sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="md:hidden p-2 -ml-2 text-black hover:bg-gray-100"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:block text-sm text-black font-bold uppercase tracking-wider">
              Painel Administrativo
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-black mx-1 hidden sm:block"></div>
            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-sm">
                {profile?.full_name?.charAt(0) || <User size={16} />}
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 overflow-x-hidden bg-white">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
