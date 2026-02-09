import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext'; // Import Toast
import { 
  Loader2, 
  AlertCircle, 
  ShoppingCart, 
  Image as ImageIcon, 
  LayoutGrid, 
  List, 
  Search, 
  SlidersHorizontal,
  ArrowUpDown,
  PackageX
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

interface CatalogItem {
  id: string;
  product_id: string;
  value: number;
  min_quantity: number;
  products: {
    id: string;
    name: string;
    sku: string;
    description: string;
    image: string;
  };
}

type SortOption = 'name-asc' | 'price-asc' | 'price-desc';

export default function Catalog() {
  const { profile, isClient } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast(); // Hook
  
  // Data State
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (profile?.client_id) {
      fetchCatalog(profile.client_id);
    } else if (isClient) {
      setLoading(false);
      setError('Sua conta não está vinculada a uma empresa. Contate o administrador.');
    } else {
      setLoading(false);
      setError('Acesso restrito ao catálogo.');
    }
  }, [profile]);

  async function fetchCatalog(clientId: string) {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from('price_tables')
        .select('id')
        .eq('client_id', clientId)
        .eq('active', true)
        .single();

      if (tableError || !tableData) {
        setError('Nenhuma tabela de preço ativa encontrada para sua empresa.');
        setLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('price_table_items')
        .select(`
          id,
          product_id,
          value,
          min_quantity,
          products (
            id,
            name,
            sku,
            description,
            image
          )
        `)
        .eq('price_table_id', tableData.id);

      if (itemsError) throw itemsError;
      setItems(itemsData as any || []);
    } catch (err: any) {
      console.error('Error fetching catalog:', err);
      setError(err.message || 'Erro ao carregar catálogo.');
    } finally {
      setLoading(false);
    }
  }

  // Wrapper function to handle Add to Cart with Toast
  const handleAddToCart = (item: CatalogItem) => {
    addToCart(item.products as any, item.value, item.min_quantity);
    toast.cart(item.products.name); // Trigger custom cart toast
  };

  // Filter & Sort Logic
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.products.name.toLowerCase().includes(lowerTerm) ||
        item.products.sku.toLowerCase().includes(lowerTerm)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return a.value - b.value;
        case 'price-desc':
          return b.value - a.value;
        case 'name-asc':
        default:
          return a.products.name.localeCompare(b.products.name);
      }
    });

    return result;
  }, [items, searchTerm, sortBy]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-red-50 p-6 rounded-full mb-6 ring-8 ring-red-50/50">
          <AlertCircle className="text-red-500" size={48} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Acesso Indisponível</h2>
        <p className="text-gray-500 max-w-md text-lg leading-relaxed">{error}</p>
        <Button 
          variant="secondary" 
          className="mt-8"
          onClick={() => window.location.reload()}
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Catálogo de Produtos</h1>
            <p className="text-gray-500 mt-1 text-lg">Explore os produtos selecionados para sua empresa</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2.5 rounded-lg transition-all flex items-center gap-2 text-sm font-medium",
                viewMode === 'grid' 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
              title="Visualização em Grade"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2.5 rounded-lg transition-all flex items-center gap-2 text-sm font-medium",
                viewMode === 'list' 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-100" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
              title="Visualização em Lista"
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar por nome, SKU ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-gray-50 border-transparent focus:bg-white border focus:border-indigo-500 rounded-xl focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-base"
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-48">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <ArrowUpDown size={16} />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-12 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none cursor-pointer transition-all hover:border-gray-300"
              >
                <option value="name-asc">Nome (A-Z)</option>
                <option value="price-asc">Menor Preço</option>
                <option value="price-desc">Maior Preço</option>
              </select>
            </div>
            
            <Button 
              variant="secondary" 
              className="h-12 w-12 md:w-auto px-0 md:px-4 shrink-0"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              title="Filtros Avançados"
            >
              <SlidersHorizontal size={20} />
              <span className="hidden md:inline ml-2">Filtros</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 space-y-4 border border-gray-100 shadow-sm">
              <div className="aspect-[4/3] bg-gray-100 rounded-xl animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="h-6 bg-gray-100 rounded w-24 animate-pulse" />
                <div className="h-10 bg-gray-100 rounded w-10 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
          <div className="bg-gray-50 p-6 rounded-full mb-4">
            <PackageX className="text-gray-400" size={48} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhum produto encontrado</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Não encontramos resultados para "{searchTerm}". Tente buscar por outros termos ou limpe os filtros.
          </p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => { setSearchTerm(''); setSortBy('name-asc'); }}
          >
            Limpar Filtros
          </Button>
        </div>
      ) : (
        <>
          {/* GRID VIEW */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => (
                <div 
                  key={item.id} 
                  className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 flex flex-col overflow-hidden relative"
                >
                  {/* Image Container */}
                  <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden p-6 flex items-center justify-center group-hover:bg-gray-100/50 transition-colors">
                    {item.products.image ? (
                      <img 
                        src={item.products.image} 
                        alt={item.products.name} 
                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <ImageIcon className="text-gray-300" size={48} strokeWidth={1.5} />
                    )}
                    
                    {/* Floating Badge */}
                    <div className="absolute top-3 right-3">
                      <span className="bg-white/90 backdrop-blur text-gray-600 text-xs font-mono font-medium px-2 py-1 rounded-lg border shadow-sm">
                        {item.products.sku}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="mb-4">
                      <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                        {item.products.name}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5em]">
                        {item.products.description || 'Sem descrição disponível.'}
                      </p>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-gray-50 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Preço</p>
                        <p className="text-xl font-bold text-indigo-600 tracking-tight">
                          {formatCurrency(item.value)}
                        </p>
                      </div>
                      
                      {item.min_quantity > 1 && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Mínimo</p>
                          <Badge variant="neutral" className="bg-gray-100 text-gray-600 border-gray-200">
                            {item.min_quantity} un
                          </Badge>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleAddToCart(item)}
                      className="w-full mt-5 bg-gray-900 hover:bg-indigo-600 text-white font-medium h-11 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 shadow-sm hover:shadow-indigo-500/25"
                    >
                      <ShoppingCart size={18} />
                      Adicionar ao Pedido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/50 text-gray-500 font-semibold border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 w-24">Imagem</th>
                      <th className="px-6 py-4">Produto</th>
                      <th className="px-6 py-4 hidden md:table-cell">SKU</th>
                      <th className="px-6 py-4">Preço</th>
                      <th className="px-6 py-4 text-center">Mínimo</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="h-16 w-16 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center p-2">
                            {item.products.image ? (
                              <img src={item.products.image} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                            ) : (
                              <ImageIcon className="text-gray-300" size={24} />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900 text-base group-hover:text-indigo-600 transition-colors">
                            {item.products.name}
                          </p>
                          <p className="text-gray-500 line-clamp-1 max-w-md mt-0.5">
                            {item.products.description}
                          </p>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell font-mono text-xs text-gray-500">
                          {item.products.sku}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-indigo-600 text-lg">
                            {formatCurrency(item.value)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="neutral" className="bg-white border-gray-200 text-gray-600">
                            {item.min_quantity} un
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            onClick={() => handleAddToCart(item)}
                            className="bg-gray-900 hover:bg-indigo-600 border-transparent text-white shadow-sm hover:shadow-indigo-500/25"
                            size="sm"
                            leftIcon={<ShoppingCart size={16} />}
                          >
                            Adicionar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
