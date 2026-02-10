import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { 
  ShoppingCart, 
  LogOut, 
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
    <div className="min-h-screen bg-white flex flex-col font-sans text-black">
      {/* Navbar */}
      <header className="bg-white border-b-2 border-black sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            
            <div className="flex items-center gap-3 shrink-0 w-[240px]">
              <img 
                src="https://images.dualite.app/ab2a4a60-cf58-4ef8-ad02-2ec22f8431aa/group-bb75c517-4a93-46f3-bda1-9b5ada908173.webp" 
                alt="Objetivus" 
                className="h-10 w-auto object-contain"
              />
            </div>

            <nav className="hidden md:flex items-center justify-center flex-1 gap-8">
              <Link 
                to="/catalog" 
                className={cn(
                  "text-sm font-bold uppercase tracking-wide transition-all border-b-2",
                  location.pathname === '/catalog' ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"
                )}
              >
                Catálogo
              </Link>
              <Link 
                to="/orders" 
                className={cn(
                  "text-sm font-bold uppercase tracking-wide transition-all border-b-2",
                  location.pathname === '/orders' ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black"
                )}
              >
                Meus Pedidos
              </Link>
            </nav>

            <div className="flex items-center justify-end gap-4 w-[200px]">
              <Link 
                to="/cart" 
                className="relative p-2.5 text-black hover:bg-black hover:text-white transition-colors border border-transparent hover:border-black"
              >
                <ShoppingCart size={22} strokeWidth={2} />
                {itemCount > 0 && (
                  <span className="absolute top-0 right-0 bg-black text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center border border-white">
                    {itemCount}
                  </span>
                )}
              </Link>

              <div className="h-6 w-px bg-black hidden md:block mx-1"></div>

              <div className="hidden md:flex items-center gap-3">
                <div className="text-right hidden lg:block group leading-tight">
                  <p className="text-sm font-bold text-black">
                    {profile?.full_name?.split(' ')[0]}
                  </p>
                </div>
                
                <Link
                  to="/profile"
                  className="p-2 text-black hover:bg-black hover:text-white transition-colors"
                  title="Configurações"
                >
                  <Settings size={20} />
                </Link>
                
                <button 
                  onClick={handleSignOut}
                  className="p-2 text-black hover:bg-black hover:text-white transition-colors"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>

              <button 
                className="md:hidden p-2 text-black hover:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b-2 border-black bg-white p-4 space-y-2 absolute w-full left-0 z-50">
            <Link 
              to="/catalog" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 border border-black hover:bg-black hover:text-white font-bold uppercase"
            >
              Catálogo
            </Link>
            <Link 
              to="/orders" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 border border-black hover:bg-black hover:text-white font-bold uppercase"
            >
              Meus Pedidos
            </Link>
            <Link 
              to="/profile" 
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-3 p-3 border border-black hover:bg-black hover:text-white font-bold uppercase"
            >
              Meu Perfil
            </Link>
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 p-3 text-black border border-black hover:bg-black hover:text-white font-bold uppercase mt-4"
            >
              <LogOut size={20} /> Sair
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t-2 border-black py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-black text-sm font-bold uppercase">
            &copy; 2025 Portal Objetivus
          </p>
        </div>
      </footer>
    </div>
  );
}
