import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { Loader2, AlertCircle, ShoppingCart, Image as ImageIcon, LayoutGrid, List, Search, ArrowUpDown, PackageX } from 'lucide-react';
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
    base_price: number;
  };
}

type SortOption = 'name-asc' | 'price-asc' | 'price-desc';

export default function Catalog() {
  const { profile, isClient } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');

  useEffect(() => {
    if (profile?.client_id) {
      fetchCatalog(profile.client_id);
    } else if (isClient) {
      setLoading(false);
      setError('Sua conta não está vinculada a uma empresa.');
    } else {
      setLoading(false);
      setError('Acesso restrito.');
    }
  }, [profile]);

  async function fetchCatalog(clientId: string) {
    try {
      const now = new Date();

      // Fetch all active tables for this client
      const { data: tables, error: tablesError } = await supabase
        .from('price_tables')
        .select('id, valid_from, valid_until')
        .eq('client_id', clientId)
        .eq('active', true);

      if (tablesError) throw tablesError;

      // Filter in JS to handle complex date logic (OR conditions)
      const validTable = tables?.find(t => {
        // Parse dates from DB (UTC) to JS Date objects (Local) for comparison
        const fromDate = t.valid_from ? new Date(t.valid_from) : null;
        const untilDate = t.valid_until ? new Date(t.valid_until) : null;

        const isStarted = !fromDate || fromDate <= now;
        const isNotEnded = !untilDate || untilDate >= now;
        
        return isStarted && isNotEnded;
      });

      if (!validTable) {
        setError('Nenhuma tabela de preço ativa encontrada para o período atual.');
        setLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('price_table_items')
        .select(`id, product_id, value, min_quantity, products (id, name, sku, description, image, base_price)`)
        .eq('price_table_id', validTable.id);

      if (itemsError) throw itemsError;
      setItems(itemsData as any || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar catálogo.');
    } finally {
      setLoading(false);
    }
  }

  const handleAddToCart = (item: CatalogItem) => {
    addToCart(item.products as any, item.value, item.min_quantity);
    toast.cart(item.products.name);
  };

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(item => item.products.name.toLowerCase().includes(lowerTerm) || item.products.sku.toLowerCase().includes(lowerTerm));
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc': return a.value - b.value;
        case 'price-desc': return b.value - a.value;
        case 'name-asc': default: return a.products.name.localeCompare(b.products.name);
      }
    });
    return result;
  }, [items, searchTerm, sortBy]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="bg-white border-2 border-black p-6 mb-6">
          <AlertCircle className="text-black" size={48} />
        </div>
        <h2 className="text-2xl font-black text-black mb-3 uppercase">Acesso Indisponível</h2>
        <p className="text-black max-w-md font-medium">{error}</p>
        <Button variant="outline" className="mt-8" onClick={() => window.location.reload()}>
          TENTAR NOVAMENTE
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter uppercase">Catálogo</h1>
            <p className="text-black font-medium mt-1 uppercase text-xs tracking-widest">Produtos selecionados</p>
          </div>
          
          <div className="flex items-center gap-[-1px]">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2.5 border border-black transition-all flex items-center gap-2 text-sm font-bold uppercase",
                viewMode === 'grid' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
              )}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2.5 border border-black border-l-0 transition-all flex items-center gap-2 text-sm font-bold uppercase",
                viewMode === 'list' ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"
              )}
            >
              <List size={20} />
            </button>
          </div>
        </div>

        <div className="bg-white p-4 border-2 border-black flex flex-col md:flex-row gap-4 items-center shadow-sharp">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={20} />
            <input 
              type="text"
              placeholder="BUSCAR PRODUTO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-white border border-black text-black placeholder:text-gray-400 focus:ring-1 focus:ring-black outline-none text-base font-medium"
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-48">
              <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-12 pl-10 pr-4 bg-white border border-black text-sm font-bold text-black focus:ring-1 focus:ring-black outline-none appearance-none cursor-pointer uppercase"
              >
                <option value="name-asc">NOME (A-Z)</option>
                <option value="price-asc">MENOR PREÇO</option>
                <option value="price-desc">MAIOR PREÇO</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-black" size={48} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white border-2 border-black border-dashed">
          <PackageX className="text-black mb-4" size={48} />
          <h3 className="text-xl font-bold text-black mb-2 uppercase">Nenhum produto</h3>
          <Button variant="outline" className="mt-6" onClick={() => { setSearchTerm(''); setSortBy('name-asc'); }}>
            LIMPAR FILTROS
          </Button>
        </div>
      ) : (
        <>
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredItems.map((item) => {
                const hasDiscount = item.products.base_price > item.value;
                const discountPercent = hasDiscount 
                  ? Math.round(((item.products.base_price - item.value) / item.products.base_price) * 100) 
                  : 0;

                return (
                  <div 
                    key={item.id} 
                    className="group bg-white border-2 border-black flex flex-col overflow-hidden hover:shadow-sharp transition-all duration-200"
                  >
                    <div className="aspect-[4/3] bg-white border-b-2 border-black relative overflow-hidden p-6 flex items-center justify-center">
                      {item.products.image ? (
                        <img 
                          src={item.products.image} 
                          alt={item.products.name} 
                          className="w-full h-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500"
                        />
                      ) : (
                        <ImageIcon className="text-gray-300" size={48} strokeWidth={1.5} />
                      )}
                      
                      <div className="absolute top-3 left-3 flex flex-col gap-1">
                        {hasDiscount && (
                          <span className="bg-black text-white text-[10px] font-bold px-2 py-1 uppercase tracking-wider">
                            -{discountPercent}% OFF
                          </span>
                        )}
                      </div>

                      <div className="absolute top-3 right-3">
                        <span className="bg-white text-black text-xs font-mono font-bold px-2 py-1 border border-black">
                          {item.products.sku}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-5 flex flex-col flex-1">
                      <div className="mb-4">
                        <h3 className="font-bold text-black text-lg leading-tight mb-1 line-clamp-2 uppercase">
                          {item.products.name}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5em] uppercase">
                          {item.products.description || 'SEM DESCRIÇÃO.'}
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-black flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-black uppercase mb-0.5">PREÇO</p>
                          <div className="flex flex-col">
                            {hasDiscount && (
                              <span className="text-xs text-gray-400 line-through font-medium">
                                {formatCurrency(item.products.base_price)}
                              </span>
                            )}
                            <p className="text-xl font-black text-black tracking-tight">
                              {formatCurrency(item.value)}
                            </p>
                          </div>
                        </div>
                        
                        {item.min_quantity > 1 && (
                          <div className="text-right">
                            <p className="text-xs font-bold text-black uppercase mb-0.5">MÍNIMO</p>
                            <Badge variant="neutral" className="border-black">
                              {item.min_quantity} UN
                            </Badge>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleAddToCart(item)}
                        className="w-full mt-5 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-bold h-12 px-4 transition-all duration-200 flex items-center justify-center gap-2 uppercase tracking-wide"
                      >
                        <ShoppingCart size={18} />
                        ADICIONAR
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="bg-white border-2 border-black overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black text-white font-bold uppercase border-b-2 border-black">
                    <tr>
                      <th className="px-6 py-4 w-24">Img</th>
                      <th className="px-6 py-4">Produto</th>
                      <th className="px-6 py-4 hidden md:table-cell">SKU</th>
                      <th className="px-6 py-4">Preço</th>
                      <th className="px-6 py-4 text-center">Min</th>
                      <th className="px-6 py-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-black">
                    {filteredItems.map((item) => {
                      const hasDiscount = item.products.base_price > item.value;
                      return (
                        <tr key={item.id} className="group hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="h-12 w-12 border border-black flex items-center justify-center p-1 bg-white">
                              {item.products.image ? (
                                <img src={item.products.image} alt="" className="w-full h-full object-contain grayscale" />
                              ) : (
                                <ImageIcon className="text-gray-300" size={20} />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-black text-base uppercase">
                              {item.products.name}
                            </p>
                            {hasDiscount && (
                              <span className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 uppercase">
                                Oferta
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell font-mono text-xs text-black">
                            {item.products.sku}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              {hasDiscount && (
                                <span className="text-xs text-gray-400 line-through">
                                  {formatCurrency(item.products.base_price)}
                                </span>
                              )}
                              <span className="font-bold text-black text-lg">
                                {formatCurrency(item.value)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge variant="neutral">
                              {item.min_quantity}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button onClick={() => handleAddToCart(item)} size="sm" leftIcon={<ShoppingCart size={16} />}>
                              ADD
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
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
