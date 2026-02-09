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
        // 1. Fetch Orders for Stats & Chart
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

        // Process Chart Data (Last 30 days)
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

        // 2. Fetch Recent Activity (Last 5 orders)
        const { data: recent } = await supabase
          .from('orders')
          .select('*, clients(nome_fantasia)')
          .order('created_at', { ascending: false })
          .limit(5);
        
        setRecentOrders(recent || []);

        // 3. Fetch Top Products (Aggregation)
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

  // ==========================================
  // CLIENT VIEW (Refactored based on Image)
  // ==========================================
  if (isClient) {
    const isLinked = !!profile?.client_id;
    const firstName = profile?.full_name?.split(' ')[0].toLowerCase(); // Lowercase for style "jose"

    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-180px)] animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white w-full max-w-3xl rounded-3xl shadow-sm border border-gray-100 p-8 md:p-16 text-center mx-auto">
          
          {/* Icon Circle */}
          <div className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm",
            isLinked ? "bg-indigo-50 text-indigo-600" : "bg-orange-50 text-orange-600"
          )}>
            {isLinked ? (
              <ShoppingBag size={42} strokeWidth={1.5} />
            ) : (
              <ShieldAlert size={42} strokeWidth={1.5} />
            )}
          </div>
          
          {/* Welcome Text */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Bem-vindo, <span className="capitalize">{firstName}</span>!
          </h1>

          {isLinked ? (
            <>
              <p className="text-gray-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                Seu portal de compras exclusivo. Acesse o catálogo personalizado da sua empresa e faça pedidos com facilidade.
              </p>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link 
                  to="/catalog"
                  className="w-full sm:w-auto min-w-[200px] bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-2.5"
                >
                  <Package size={20} />
                  Ver Catálogo
                </Link>
                <Link 
                  to="/orders"
                  className="w-full sm:w-auto min-w-[200px] bg-white text-gray-700 border border-gray-200 px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <Activity size={20} />
                  Meus Pedidos
                </Link>
              </div>
            </>
          ) : (
            <div className="max-w-md mx-auto mt-6">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 text-left shadow-sm">
                <h3 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
                  <Clock size={18} /> Conta em Análise
                </h3>
                <p className="text-sm text-orange-700 leading-relaxed">
                  Seu cadastro foi realizado com sucesso, mas sua conta ainda não está vinculada a uma empresa.
                  Por favor, aguarde o administrador liberar seu acesso ao catálogo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // ADMIN & SELLER VIEW
  // ==========================================
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Visão Geral</h2>
          <p className="text-gray-500">Acompanhe o desempenho do seu negócio em tempo real.</p>
        </div>
        {(isAdmin || isSeller) && (
          <Link 
            to={isAdmin ? "/sales" : "/orders"}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
          >
            {isAdmin ? "Ir para Gestão de Vendas" : "Ver todos os pedidos"} <ArrowRight size={16} />
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Vendas Totais" 
          value={loading ? "..." : formatCurrency(stats.salesTotal)} 
          icon={DollarSign} 
          color="bg-green-50 text-green-600"
          trend={!loading && stats.salesTotal > 0 ? "Atualizado agora" : null}
        />
        <StatCard 
          title="Pedidos Realizados" 
          value={loading ? "..." : stats.ordersCount.toString()} 
          icon={ShoppingBag} 
          color="bg-blue-50 text-blue-600"
        />
        <StatCard 
          title="Clientes Cadastrados" 
          value={loading ? "..." : stats.clientsCount.toString()} 
          icon={Users} 
          color="bg-purple-50 text-purple-600"
        />
        <StatCard 
          title="Pedidos Pendentes" 
          value={loading ? "..." : stats.pendingCount.toString()} 
          icon={AlertCircle} 
          color="bg-orange-50 text-orange-600"
          highlight={stats.pendingCount > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column (Chart + Recent) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Sales Chart */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-gray-400" />
              Vendas nos Últimos 30 Dias
            </h3>
            <SalesChart data={salesData} loading={loading} />
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border shadow-sm flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Activity size={20} className="text-gray-400" />
                Últimos Pedidos
              </h3>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-400">Carregando...</div>
              ) : recentOrders.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <p>Nenhum pedido realizado ainda.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {order.clients?.nome_fantasia?.substring(0, 2).toUpperCase() || 'CL'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {order.clients?.nome_fantasia || 'Cliente Desconhecido'}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={10} /> {formatDate(order.created_at)} • #{order.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(order.total_amount)}</p>
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          order.status === 'enviado' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                        )}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 rounded-b-xl text-center">
              <Link to={isAdmin ? "/sales" : "/orders"} className="text-sm text-indigo-600 font-medium hover:underline">
                {isAdmin ? "Ver gestão completa" : "Ver histórico completo"}
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Top Products Widget */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-gray-400" />
              Produtos Mais Vendidos
            </h3>
            {loading ? (
              <div className="text-sm text-gray-400">Carregando...</div>
            ) : topProducts.length === 0 ? (
              <div className="text-sm text-gray-500">Sem dados suficientes.</div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((p, index) => (
                  <div key={p.sku} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700 truncate max-w-[180px]">{p.name}</span>
                      <span className="text-gray-500">{p.totalQty} un.</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${(p.totalQty / topProducts[0].totalQty) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
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
                title="Criar Tabela de Preço" 
                icon={DollarSign}
              />
              {(isAdmin || isSeller) && (
                <QuickAction 
                  to="/users" 
                  title={isAdmin ? "Gerenciar Time" : "Cadastrar Usuário"} 
                  icon={UserPlus}
                  variant="admin"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend, highlight }: any) {
  return (
    <div className={cn(
      "bg-white p-6 rounded-xl border shadow-sm transition-all hover:shadow-md",
      highlight && "border-orange-200 bg-orange-50/30"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-lg", color)}>
          <Icon size={24} />
        </div>
        {trend && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
            <TrendingUp size={12} />
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function QuickAction({ to, title, icon: Icon, variant }: any) {
  return (
    <Link 
      to={to} 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-sm",
        variant === 'admin' 
          ? "bg-purple-50 border-purple-100 text-purple-700 hover:bg-purple-100" 
          : "bg-white border-gray-100 text-gray-700 hover:border-indigo-200 hover:text-indigo-600"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        variant === 'admin' ? "bg-purple-200/50" : "bg-gray-100"
      )}>
        <Icon size={16} />
      </div>
      <span className="font-medium text-sm">{title}</span>
      <ArrowRight size={14} className="ml-auto opacity-50" />
    </Link>
  );
}
