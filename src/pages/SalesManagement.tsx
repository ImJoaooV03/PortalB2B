import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Order, StatusHistoryItem } from '../lib/types';
import { 
  User, 
  Search, 
  Filter, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag,
  Loader2,
  PackageCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Printer,
  Download,
  CheckSquare,
  Square,
  History
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, cn } from '../lib/utils';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SellerProfile {
  id: string;
  full_name: string;
  email: string;
}

const ORDER_STATUSES = [
  { value: 'rascunho', label: 'Rascunho', icon: FileText, color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'enviado', label: 'Enviado', icon: Clock, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'aprovado', label: 'Aprovado', icon: CheckCircle2, color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'faturado', label: 'Faturado', icon: FileText, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'entregue', label: 'Entregue', icon: PackageCheck, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'cancelado', label: 'Cancelado', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200' },
];

export default function SalesManagement() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  
  // Data State
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // UI State
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  
  // Batch Actions State
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  async function fetchData() {
    try {
      setLoading(true);
      
      // 1. Fetch Sellers
      const { data: sellersData, error: sellersError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'vendedor');

      if (sellersError) throw sellersError;
      setSellers(sellersData || []);

      // 2. Fetch All Orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          clients!inner (
            nome_fantasia,
            razao_social,
            cnpj,
            vendedor_id
          ),
          order_items (
            quantity,
            unit_price,
            subtotal,
            products (name, sku)
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData as any || []);

    } catch (error) {
      console.error('Error fetching sales data:', error);
      toast.error('Erro ao carregar dados de vendas.');
    } finally {
      setLoading(false);
    }
  }

  // --- Computed Data ---
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Seller Filter
      if (selectedSellerId !== 'all') {
        if (order.clients.vendedor_id !== selectedSellerId) return false;
      }

      // 2. Search Filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        order.id.toLowerCase().includes(searchLower) ||
        order.clients.nome_fantasia.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      // 3. Status Filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // 4. Date Filter
      if (dateRange.start && dateRange.end) {
        const orderDate = parseISO(order.created_at);
        const start = parseISO(dateRange.start);
        const end = parseISO(dateRange.end);
        end.setHours(23, 59, 59, 999);
        
        if (!isWithinInterval(orderDate, { start, end })) return false;
      }

      return true;
    });
  }, [orders, selectedSellerId, searchTerm, statusFilter, dateRange]);

  const metrics = useMemo(() => {
    const now = new Date();
    const startMonth = startOfMonth(now);
    const endMonth = endOfMonth(now);

    const currentMonthOrders = filteredOrders.filter(o => 
      isWithinInterval(parseISO(o.created_at), { start: startMonth, end: endMonth })
    );

    const totalSales = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const monthSales = currentMonthOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const count = filteredOrders.length;
    const ticket = count > 0 ? totalSales / count : 0;

    return { totalSales, monthSales, count, ticket };
  }, [filteredOrders]);

  // --- Batch Actions ---
  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleSelectOrder = (id: string) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedOrders(newSet);
  };

  // --- PDF Generation Logic ---
  const generatePDF = (order: Order, doc?: jsPDF, isBatch = false) => {
    const pdf = doc || new jsPDF();
    
    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(79, 70, 229); // Indigo 600
    pdf.text('Pedido de Venda', 14, 22);
    
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    // Box Info
    pdf.setDrawColor(229, 231, 235);
    pdf.setFillColor(249, 250, 251);
    pdf.roundedRect(14, 35, 182, 40, 3, 3, 'FD');

    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text(`Pedido #${order.id.slice(0, 8).toUpperCase()}`, 20, 45);
    
    pdf.setFontSize(10);
    pdf.setTextColor(80);
    pdf.text(`Data: ${formatDate(order.created_at)}`, 20, 52);
    pdf.text(`Status: ${order.status.toUpperCase()}`, 20, 58);

    // Client Info
    pdf.setFontSize(12);
    pdf.setTextColor(0);
    pdf.text('Cliente', 110, 45);
    
    pdf.setFontSize(10);
    pdf.setTextColor(80);
    pdf.text(`${order.clients?.razao_social || 'N/A'}`, 110, 52);
    pdf.text(`Fantasia: ${order.clients?.nome_fantasia || 'N/A'}`, 110, 58);
    if (order.clients?.cnpj) pdf.text(`CNPJ: ${order.clients.cnpj}`, 110, 64);

    // Items
    const tableBody = order.order_items?.map(item => [
      item.products?.sku || '-',
      item.products?.name || 'Produto Indisponível',
      item.quantity,
      formatCurrency(item.unit_price),
      formatCurrency(item.subtotal)
    ]) || [];

    autoTable(pdf, {
      startY: 85,
      head: [['SKU', 'Produto', 'Qtd.', 'Unitário', 'Total']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      },
      foot: [['', '', '', 'Total Final', formatCurrency(order.total_amount)]],
      footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold', halign: 'right' }
    });

    if (!doc) {
      pdf.save(`pedido_${order.id.slice(0, 8)}.pdf`);
    }
  };

  const handleSingleDownload = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      generatePDF(order);
      toast.success('PDF baixado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF.');
    }
  };

  const handleSinglePrint = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const doc = new jsPDF();
      generatePDF(order, doc);
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao preparar impressão.');
    }
  };

  const handleBatchDownload = async () => {
    if (selectedOrders.size === 0) return;
    setIsGeneratingBatch(true);
    toast.info('Gerando arquivo unificado...');

    try {
      // Small delay to allow UI to update
      await new Promise(r => setTimeout(r, 100));

      const doc = new jsPDF();
      const ordersToPrint = filteredOrders.filter(o => selectedOrders.has(o.id));

      ordersToPrint.forEach((order, index) => {
        if (index > 0) doc.addPage();
        generatePDF(order, doc, true);
      });

      doc.save(`pedidos_lote_${formatDate(new Date().toISOString()).replace(/\//g, '-')}.pdf`);
      toast.success(`${ordersToPrint.length} pedidos exportados com sucesso!`);
      setSelectedOrders(new Set()); // Clear selection
    } catch (err) {
      console.error(err);
      toast.error('Erro na exportação em lote.');
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const getStatusConfig = (status: string) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
  };

  if (!isAdmin) return <div className="p-8 text-center text-gray-500">Acesso restrito a administradores.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Gestão de Vendas" 
        subtitle={`Segunda-Feira, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} • Analise o desempenho da sua equipe comercial.`}
      />

      {/* --- Filters Section --- */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-6 items-end">
          <div className="w-full lg:w-1/3 space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User size={16} className="text-indigo-600" />
              Filtrar por Vendedor
            </label>
            <div className="relative">
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="w-full h-11 pl-4 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="all">Todos os Vendedores</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.id}>
                    {seller.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col sm:flex-row gap-4">
             <div className="flex-1 space-y-2">
               <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                 <Calendar size={16} className="text-gray-400" />
                 Data Inicial
               </label>
               <input 
                 type="date"
                 value={dateRange.start}
                 onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                 className="w-full h-11 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
               />
             </div>
             <div className="flex-1 space-y-2">
               <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                 <Calendar size={16} className="text-gray-400" />
                 Data Final
               </label>
               <input 
                 type="date"
                 value={dateRange.end}
                 onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                 className="w-full h-11 px-3 bg-white border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
               />
             </div>
             <div className="pb-0.5">
               <button 
                 onClick={() => setDateRange({ start: '', end: '' })}
                 className="h-11 px-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
               >
                 Limpar
               </button>
             </div>
          </div>
        </div>
      </div>

      {/* --- Metrics Cards --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Vendas no Mês" 
          value={formatCurrency(metrics.monthSales)} 
          icon={TrendingUp} 
          color="bg-green-50 text-green-600"
          subtitle="Mês atual"
        />
        <MetricCard 
          title="Pedidos Filtrados" 
          value={metrics.count.toString()} 
          icon={ShoppingBag} 
          color="bg-blue-50 text-blue-600"
          subtitle="Total no período"
        />
        <MetricCard 
          title="Ticket Médio" 
          value={formatCurrency(metrics.ticket)} 
          icon={DollarSign} 
          color="bg-purple-50 text-purple-600"
          subtitle="Média por pedido"
        />
      </div>

      {/* --- Orders List --- */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-2 items-center">
          {/* Select All Checkbox */}
          <div className="pl-4 pr-2 flex items-center h-full border-r border-gray-100 md:border-r-0 md:border-r-transparent">
             <button 
               onClick={toggleSelectAll}
               className="text-gray-400 hover:text-indigo-600 transition-colors"
               title="Selecionar Todos"
             >
               {selectedOrders.size > 0 && selectedOrders.size === filteredOrders.length ? (
                 <CheckSquare size={20} className="text-indigo-600" />
               ) : (
                 <Square size={20} />
               )}
             </button>
          </div>

          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar por ID ou Cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-gray-50 border-transparent rounded-lg text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
          <div className="relative w-full md:w-64">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              {ORDER_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none opacity-50" />
          </div>
        </div>

        {/* Batch Action Floating Bar */}
        {selectedOrders.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
            <span className="font-medium text-sm">{selectedOrders.size} pedidos selecionados</span>
            <div className="h-4 w-px bg-gray-700"></div>
            <button 
              onClick={handleBatchDownload}
              disabled={isGeneratingBatch}
              className="flex items-center gap-2 text-sm font-bold hover:text-indigo-300 transition-colors disabled:opacity-50"
            >
              {isGeneratingBatch ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Baixar PDF Unificado
            </button>
            <button 
              onClick={() => setSelectedOrders(new Set())}
              className="ml-2 p-1 hover:bg-gray-800 rounded-full transition-colors"
            >
              <XCircle size={16} className="text-gray-400" />
            </button>
          </div>
        )}

        {/* List Content */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search className="text-gray-300" size={24} />
            </div>
            <p>Nenhum pedido encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const StatusIcon = statusConfig.icon;
              const isExpanded = expandedOrder === order.id;
              const sellerName = sellers.find(s => s.id === order.clients.vendedor_id)?.full_name || 'Vendedor Excluído';
              const isSelected = selectedOrders.has(order.id);

              return (
                <div 
                  key={order.id} 
                  className={cn(
                    "bg-white rounded-xl border transition-all duration-200 overflow-hidden group",
                    isSelected ? "border-indigo-300 bg-indigo-50/10" : "border-gray-200",
                    isExpanded ? "shadow-md ring-1 ring-indigo-50" : "shadow-sm hover:shadow-md"
                  )}
                >
                  {/* Card Header Row */}
                  <div 
                    className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      {/* Checkbox */}
                      <div onClick={(e) => { e.stopPropagation(); toggleSelectOrder(order.id); }}>
                        {isSelected ? (
                          <CheckSquare size={20} className="text-indigo-600 cursor-pointer" />
                        ) : (
                          <Square size={20} className="text-gray-300 hover:text-gray-400 cursor-pointer" />
                        )}
                      </div>

                      {/* Icon Box */}
                      <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                        <FileText size={24} strokeWidth={1.5} />
                      </div>
                      
                      {/* Info */}
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                          #{order.id.slice(0, 8)}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar size={14} className="text-gray-400" />
                            Enviado em: {formatDateTime(order.created_at)}
                          </span>
                          <span className="flex items-center gap-1.5 font-medium text-gray-700 truncate max-w-[150px] sm:max-w-none">
                            <User size={14} className="text-gray-400" />
                            {order.clients.nome_fantasia}
                          </span>
                          {selectedSellerId === 'all' && (
                             <span className="hidden sm:inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                               {sellerName}
                             </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Status, Actions & Total */}
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end pl-[88px] md:pl-0 border-t md:border-t-0 pt-3 md:pt-0 mt-1 md:mt-0">
                      
                      <Badge className={cn("px-3 py-1 text-sm hidden sm:flex", statusConfig.color)}>
                        <StatusIcon size={14} className="mr-1.5" />
                        {statusConfig.label}
                      </Badge>

                      {/* Quick Actions (Visible on Row) */}
                      <div className="flex items-center gap-1 mr-2">
                         <button 
                           onClick={(e) => handleSinglePrint(order, e)}
                           className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                           title="Imprimir Pedido"
                         >
                           <Printer size={18} />
                         </button>
                         <button 
                           onClick={(e) => handleSingleDownload(order, e)}
                           className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                           title="Baixar PDF"
                         >
                           <Download size={18} />
                         </button>
                      </div>
                      
                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Total</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(order.total_amount)}</p>
                      </div>

                      <div className={cn(
                        "p-2 rounded-full transition-colors text-gray-400",
                        isExpanded ? "bg-indigo-50 text-indigo-600" : "hover:bg-gray-50"
                      )}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top-2">
                      
                      {/* Status History Timeline */}
                      <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <History size={14} />
                          Histórico de Atualizações
                        </h4>
                        <div className="flex flex-col gap-3">
                          {/* Initial Creation */}
                          <div className="flex items-center gap-3 text-sm">
                            <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0"></div>
                            <span className="text-gray-500 w-36 text-xs font-mono">{formatDateTime(order.created_at)}</span>
                            <span className="font-medium text-gray-700 flex items-center gap-2">
                              <Clock size={14} className="text-blue-500" />
                              Pedido Enviado
                            </span>
                          </div>
                          
                          {/* Updates */}
                          {order.status_history && order.status_history.map((history, idx) => {
                            const histConfig = getStatusConfig(history.status);
                            return (
                              <div key={idx} className="flex items-center gap-3 text-sm animate-in slide-in-from-left-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>
                                <span className="text-gray-500 w-36 text-xs font-mono">{formatDateTime(history.updated_at)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">Status alterado para:</span>
                                  <Badge className={cn("text-xs py-0 px-2", histConfig.color)}>
                                    {histConfig.label}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                          
                          {(!order.status_history || order.status_history.length === 0) && (
                            <p className="text-xs text-gray-400 italic pl-5">Nenhuma atualização subsequente.</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                              <th className="px-4 py-3">Produto</th>
                              <th className="px-4 py-3 text-center">Qtd.</th>
                              <th className="px-4 py-3 text-right">Preço Unit.</th>
                              <th className="px-4 py-3 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {order.order_items?.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-900">{item.products?.name || 'Produto Removido'}</p>
                                  <p className="text-xs text-gray-500">{item.products?.sku}</p>
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, subtitle }: any) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={cn("p-3 rounded-lg", color)}>
        <Icon size={24} />
      </div>
    </div>
  );
}
