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
    // "Meus Pedidos" is hidden for Admin, shown for Seller/Client
    { label: 'Meus Pedidos', path: '/orders', icon: Package, show: !isAdmin }, 
    // "Gestão de Vendas" is shown only for Admin
    { label: 'Gestão de Vendas', path: '/sales', icon: TrendingUp, show: isAdmin },
    { label: 'Clientes (Empresas)', path: '/clients', icon: Building2, show: isAdmin || isSeller },
    { label: isAdmin ? 'Gestão de Time' : 'Usuários de Acesso', path: '/users', icon: UserCog, show: isAdmin || isSeller },
    { label: 'Produtos', path: '/products', icon: Package, show: isAdmin || isSeller },
    { label: 'Tabelas de Preço', path: '/price-tables', icon: Briefcase, show: isAdmin || isSeller }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar Desktop - Fixed */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed inset-y-0 z-30">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              B
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">B2B Portal</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">
            Menu Principal
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                    isActive 
                      ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon size={18} className={cn("transition-colors", isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600")} />
                  {item.label}
                  {isActive && <ChevronRight size={16} className="ml-auto opacity-50" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50/30">
          <Link to="/profile" className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all group mb-2">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shrink-0 border-2 border-white shadow-sm">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {profile?.role}
              </p>
            </div>
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2 py-2 w-full text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay & Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}
      
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden flex flex-col",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b">
          <span className="font-bold text-xl text-indigo-600">Menu</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-500">
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
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium",
                  location.pathname === item.path 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen transition-all">
        {/* Fixed Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between shadow-sm/50 backdrop-blur-xl bg-white/90">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            {/* Breadcrumb / Context Title - Optional, kept simple for now */}
            <div className="hidden md:block text-sm text-gray-500 font-medium">
              Portal Administrativo
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell Removed */}
            
            <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>
            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {profile?.full_name?.charAt(0) || <User size={16} />}
              </div>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
