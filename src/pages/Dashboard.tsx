import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Activity, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  TrendingUp, 
  AlertCircle,
  ArrowRight,
  Package,
  Clock,
  ShieldAlert,
  BarChart3,
  UserPlus
} from 'lucide-react';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { Link } from 'react-router-dom';
import SalesChart from '../components/dashboard/SalesChart';
import { subDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Button from '../components/ui/Button';

export default function Dashboard() {
  const { profile, isAdmin, isSeller, isClient } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ordersCount: 0,
    salesTotal: 0,
    clientsCount: 0,
    pendingCount: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<{ date: string; value: number }[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (isClient) {
        setLoading(false);
        return;
      }

      try {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, total_amount, status, created_at');
        
        const { count: clientsCount } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });

        const ordersData = orders || [];
        const totalSales = ordersData.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const pending = ordersData.filter(o => o.status === 'enviado').length;

        setStats({
          ordersCount: ordersData.length,
          salesTotal: totalSales,
          clientsCount: clientsCount || 0,
          pendingCount: pending
        });

        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const d = subDays(new Date(), 29 - i);
          return format(d, 'yyyy-MM-dd');
        });

        const salesByDate = ordersData.reduce((acc: any, order) => {
          const date = order.created_at.split('T')[0];
          acc[date] = (acc[date] || 0) + (order.total_amount || 0);
          return acc;
        }, {});

        const chartData = last30Days.map(date => ({
          date: format(parseISO(date), 'dd/MM', { locale: ptBR }),
          value: salesByDate[date] || 0
        }));

        setSalesData(chartData);

        const { data: recent } = await supabase
          .from('orders')
          .select('*, clients(nome_fantasia)')
          .order('created_at', { ascending: false })
          .limit(5);
        
        setRecentOrders(recent || []);

        const { data: items } = await supabase
          .from('order_items')
          .select('quantity, products(name, sku)');
        
        if (items) {
          const productMap = new Map();
          items.forEach((item: any) => {
             const key = item.products?.sku;
             if (!key) return;
             const current = productMap.get(key) || { 
               name: item.products.name, 
               sku: key, 
               totalQty: 0 
             };
             current.totalQty += item.quantity;
             productMap.set(key, current);
          });

          const sortedProducts = Array.from(productMap.values())
            .sort((a, b) => b.totalQty - a.totalQty)
            .slice(0, 5);
            
          setTopProducts(sortedProducts);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isClient]);

  if (isClient) {
    const isLinked = !!profile?.client_id;
    const firstName = profile?.full_name?.split(' ')[0].toLowerCase();

    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-180px)] animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white w-full max-w-3xl border-2 border-black shadow-sharp p-8 md:p-16 text-center mx-auto">
          
          <div className={cn(
            "w-24 h-24 flex items-center justify-center mx-auto mb-8 border-2 border-black",
            isLinked ? "bg-black text-white" : "bg-white text-black"
          )}>
            {isLinked ? (
              <ShoppingBag size={42} strokeWidth={1.5} />
            ) : (
              <ShieldAlert size={42} strokeWidth={1.5} />
            )}
          </div>
          
          <h1 className="text-4xl font-black text-black mb-4 tracking-tighter uppercase">
            Olá, <span className="capitalize">{firstName}</span>
          </h1>

          {isLinked ? (
            <>
              <p className="text-black text-lg mb-10 max-w-xl mx-auto font-medium">
                SEU PORTAL DE COMPRAS EXCLUSIVO. ACESSE O CATÁLOGO E FAÇA PEDIDOS.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link 
                  to="/catalog"
                  className="w-full sm:w-auto min-w-[200px] bg-black text-white border border-black px-8 py-3.5 font-bold hover:bg-white hover:text-black transition-all shadow-sharp hover:translate-y-0.5 hover:shadow-none flex items-center justify-center gap-2.5 uppercase tracking-wide"
                >
                  <Package size={20} />
                  Ver Catálogo
                </Link>
                <Link 
                  to="/orders"
                  className="w-full sm:w-auto min-w-[200px] bg-white text-black border border-black px-8 py-3.5 font-bold hover:bg-black hover:text-white transition-all shadow-sharp hover:translate-y-0.5 hover:shadow-none flex items-center justify-center gap-2.5 uppercase tracking-wide"
                >
                  <Activity size={20} />
                  Meus Pedidos
                </Link>
              </div>
            </>
          ) : (
            <div className="max-w-md mx-auto mt-6">
              <div className="bg-white border-2 border-black p-6 text-left">
                <h3 className="font-bold text-black mb-2 flex items-center gap-2 uppercase">
                  <Clock size={18} /> Conta em Análise
                </h3>
                <p className="text-sm text-black leading-relaxed font-medium">
                  Seu cadastro foi realizado. Aguarde a liberação do administrador.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tight">Visão Geral</h2>
          <p className="text-black font-medium text-sm">DESEMPENHO EM TEMPO REAL</p>
        </div>
        {(isAdmin || isSeller) && (
          <Link 
            to={isAdmin ? "/sales" : "/orders"}
            className="text-sm font-bold text-black hover:bg-black hover:text-white border border-black px-4 py-2 transition-colors flex items-center gap-2 uppercase"
          >
            {isAdmin ? "Gestão de Vendas" : "Ver Pedidos"} <ArrowRight size={16} />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vendas Totais" 
          value={loading ? "..." : formatCurrency(stats.salesTotal)} 
          icon={DollarSign} 
        />
        <StatCard 
          title="Pedidos" 
          value={loading ? "..." : stats.ordersCount.toString()} 
          icon={ShoppingBag} 
        />
        <StatCard 
          title="Clientes" 
          value={loading ? "..." : stats.clientsCount.toString()} 
          icon={Users} 
        />
        <StatCard 
          title="Pendentes" 
          value={loading ? "..." : stats.pendingCount.toString()} 
          icon={AlertCircle} 
          highlight={stats.pendingCount > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-white border-2 border-black p-6 shadow-sharp">
            <h3 className="font-bold text-black mb-6 flex items-center gap-2 uppercase tracking-wide">
              <TrendingUp size={20} />
              Vendas (30 Dias)
            </h3>
            <SalesChart data={salesData} loading={loading} />
          </div>

          <div className="bg-white border-2 border-black flex flex-col shadow-sharp">
            <div className="p-6 border-b-2 border-black flex justify-between items-center">
              <h3 className="font-bold text-black flex items-center gap-2 uppercase tracking-wide">
                <Activity size={20} />
                Últimos Pedidos
              </h3>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-black font-medium">Carregando...</div>
              ) : recentOrders.length === 0 ? (
                <div className="p-12 text-center text-black">
                  <p>Nenhum pedido realizado ainda.</p>
                </div>
              ) : (
                <div className="divide-y divide-black">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="p-4 hover:bg-black hover:text-white transition-colors flex items-center justify-between gap-4 group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-black text-white group-hover:bg-white group-hover:text-black flex items-center justify-center font-bold text-xs border border-black">
                          {order.clients?.nome_fantasia?.substring(0, 2).toUpperCase() || 'CL'}
                        </div>
                        <div>
                          <p className="text-sm font-bold uppercase">
                            {order.clients?.nome_fantasia || 'Cliente Desconhecido'}
                          </p>
                          <p className="text-xs font-mono">
                            {formatDate(order.created_at)} • #{order.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(order.total_amount)}</p>
                        <span className="text-[10px] font-bold uppercase border border-current px-2 py-0.5">
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t-2 border-black bg-white text-center">
              <Link to={isAdmin ? "/sales" : "/orders"} className="text-sm text-black font-bold hover:underline uppercase">
                Ver Todos
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          
          <div className="bg-white border-2 border-black p-6 shadow-sharp">
            <h3 className="font-bold text-black mb-4 flex items-center gap-2 uppercase tracking-wide">
              <BarChart3 size={20} />
              Top Produtos
            </h3>
            {loading ? (
              <div className="text-sm">Carregando...</div>
            ) : topProducts.length === 0 ? (
              <div className="text-sm">Sem dados suficientes.</div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((p) => (
                  <div key={p.sku} className="space-y-1">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="truncate max-w-[180px]">{p.name}</span>
                      <span>{p.totalQty} un.</span>
                    </div>
                    <div className="h-2 bg-gray-200 w-full">
                      <div 
                        className="h-full bg-black"
                        style={{ width: `${(p.totalQty / topProducts[0].totalQty) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border-2 border-black p-6 shadow-sharp">
            <h3 className="font-bold text-black mb-4 uppercase tracking-wide">Ações Rápidas</h3>
            <div className="space-y-3">
              <QuickAction 
                to="/clients" 
                title="Nova Empresa" 
                icon={Users}
              />
              <QuickAction 
                to="/products" 
                title="Novo Produto" 
                icon={Package}
              />
              <QuickAction 
                to="/price-tables" 
                title="Criar Tabela" 
                icon={DollarSign}
              />
              {(isAdmin || isSeller) && (
                <QuickAction 
                  to="/users" 
                  title={isAdmin ? "Gerenciar Time" : "Novo Usuário"} 
                  icon={UserPlus}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, highlight }: any) {
  return (
    <div className={cn(
      "bg-white p-6 border-2 border-black shadow-sharp transition-all hover:-translate-y-1",
      highlight && "bg-black text-white"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2 border-2", highlight ? "border-white bg-white text-black" : "border-black bg-black text-white")}>
          <Icon size={24} />
        </div>
      </div>
      <div>
        <p className={cn("text-sm font-bold uppercase mb-1", highlight ? "text-gray-300" : "text-gray-600")}>{title}</p>
        <p className="text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}

function QuickAction({ to, title, icon: Icon }: any) {
  return (
    <Link 
      to={to} 
      className="flex items-center gap-3 p-3 border border-black hover:bg-black hover:text-white transition-all group"
    >
      <div className="w-8 h-8 flex items-center justify-center bg-black text-white group-hover:bg-white group-hover:text-black border border-black">
        <Icon size={16} />
      </div>
      <span className="font-bold text-sm uppercase">{title}</span>
      <ArrowRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
