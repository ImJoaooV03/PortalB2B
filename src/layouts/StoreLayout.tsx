import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { 
  ShoppingCart, 
  LogOut, 
  Package, 
  FileText, 
  User,
  Menu,
  X,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function StoreLayout() {
  const { profile, signOut } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0 w-[200px]">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                L
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">Loja B2B</span>
            </div>

            {/* Desktop Nav - Centered */}
            <nav className="hidden md:flex items-center justify-center flex-1 gap-8">
              <Link 
                to="/catalog" 
                className={cn(
                  "text-sm font-medium transition-all hover:text-indigo-600",
                  location.pathname === '/catalog' ? "text-indigo-600 font-semibold" : "text-gray-600"
                )}
              >
                Catálogo
              </Link>
              <Link 
                to="/orders" 
                className={cn(
                  "text-sm font-medium transition-all hover:text-indigo-600",
                  location.pathname === '/orders' ? "text-indigo-600 font-semibold" : "text-gray-600"
                )}
              >
                Meus Pedidos
              </Link>
            </nav>

            {/* Right Actions */}
            <div className="flex items-center justify-end gap-4 w-[200px]">
              <Link 
                to="/cart" 
                className="relative p-2.5 text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded-full transition-colors"
              >
                <ShoppingCart size={22} strokeWidth={2} />
                {itemCount > 0 && (
                  <span className="absolute top-1 right-1 bg-indigo-600 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full ring-2 ring-white">
                    {itemCount}
                  </span>
                )}
              </Link>

              <div className="h-6 w-px bg-gray-200 hidden md:block mx-1"></div>

              <div className="hidden md:flex items-center gap-3">
                <div className="text-right hidden lg:block group leading-tight">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {profile?.full_name?.split(' ')[0]}
                  </p>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">Cliente</p>
                </div>
                
                <Link
                  to="/profile"
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Configurações"
                >
                  <Settings size={20} />
                </Link>
                
                <button 
                  onClick={handleSignOut}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>

              {/* Mobile Menu Button */}
              <button 
                className="md:hidden p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-white p-4 space-y-2 animate-in slide-in-from-top-2 shadow-lg absolute w-full left-0 z-50">
            <Link 
              to="/catalog" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium"
            >
              <Package size={20} className="text-indigo-600" /> Catálogo
            </Link>
            <Link 
              to="/orders" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium"
            >
              <FileText size={20} className="text-indigo-600" /> Meus Pedidos
            </Link>
            <Link 
              to="/profile" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium"
            >
              <User size={20} className="text-indigo-600" /> Meu Perfil
            </Link>
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                  {profile?.full_name?.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{profile?.full_name}</p>
                  <p className="text-xs text-gray-500">{profile?.email}</p>
                </div>
              </div>
              <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-medium transition-colors"
              >
                <LogOut size={20} /> Sair da Conta
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm font-medium">
            &copy; 2025 Portal B2B. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
