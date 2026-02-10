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
  History,
  ArrowRight
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

// Monochrome Status Configuration
const ORDER_STATUSES = [
  { value: 'rascunho', label: 'Rascunho', icon: FileText, style: 'bg-white text-black border border-black border-dashed' },
  { value: 'enviado', label: 'Enviado', icon: Clock, style: 'bg-white text-black border border-black' },
  { value: 'aprovado', label: 'Aprovado', icon: CheckCircle2, style: 'bg-black text-white border border-black' },
  { value: 'faturado', label: 'Faturado', icon: DollarSign, style: 'bg-black text-white border border-black ring-2 ring-white ring-offset-1 ring-offset-black' }, // Double border effect
  { value: 'entregue', label: 'Entregue', icon: PackageCheck, style: 'bg-black text-white border border-black' },
  { value: 'cancelado', label: 'Cancelado', icon: XCircle, style: 'bg-white text-black border border-black line-through decoration-1' },
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
    
    // Header - Monochrome PDF
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.text('PEDIDO DE VENDA', 14, 22);
    
    pdf.setFontSize(10);
    pdf.setTextColor(0);
    pdf.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    // Box Info
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(14, 35, 182, 40); // Simple rect, no fill

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(`PEDIDO #${order.id.slice(0, 8).toUpperCase()}`, 20, 45);
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`DATA: ${formatDate(order.created_at)}`, 20, 52);
    pdf.text(`STATUS: ${order.status.toUpperCase()}`, 20, 58);

    // Client Info
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text('CLIENTE', 110, 45);
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`${order.clients?.razao_social || 'N/A'}`, 110, 52);
    pdf.text(`FANTASIA: ${order.clients?.nome_fantasia || 'N/A'}`, 110, 58);
    if (order.clients?.cnpj) pdf.text(`CNPJ: ${order.clients.cnpj}`, 110, 64);

    // Items
    const tableBody = order.order_items?.map(item => [
      item.products?.sku || '-',
      item.products?.name || 'PRODUTO INDISPONÍVEL',
      item.quantity,
      formatCurrency(item.unit_price),
      formatCurrency(item.subtotal)
    ]) || [];

    autoTable(pdf, {
      startY: 85,
      head: [['SKU', 'PRODUTO', 'QTD.', 'UNITÁRIO', 'TOTAL']],
      body: tableBody,
      theme: 'plain', // Minimalist theme
      headStyles: { 
        fillColor: [0, 0, 0], 
        textColor: 255, 
        fontStyle: 'bold',
        halign: 'left'
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 4,
        textColor: 0,
        lineColor: 0,
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      },
      foot: [['', '', '', 'TOTAL FINAL', formatCurrency(order.total_amount)]],
      footStyles: { 
        fillColor: [240, 240, 240], 
        textColor: 0, 
        fontStyle: 'bold', 
        halign: 'right' 
      }
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
      await new Promise(r => setTimeout(r, 100));

      const doc = new jsPDF();
      const ordersToPrint = filteredOrders.filter(o => selectedOrders.has(o.id));

      ordersToPrint.forEach((order, index) => {
        if (index > 0) doc.addPage();
        generatePDF(order, doc, true);
      });

      doc.save(`pedidos_lote_${formatDate(new Date().toISOString()).replace(/\//g, '-')}.pdf`);
      toast.success(`${ordersToPrint.length} pedidos exportados com sucesso!`);
      setSelectedOrders(new Set());
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

  if (!isAdmin) return <div className="p-8 text-center text-black font-bold uppercase">Acesso restrito.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Gestão de Vendas" 
        subtitle={`Segunda-Feira, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} • Analise o desempenho da sua equipe comercial.`}
      />

      {/* --- Filters Section --- */}
      <div className="bg-white p-6 border-2 border-black shadow-sharp">
        <div className="flex flex-col lg:flex-row gap-6 items-end">
          <div className="w-full lg:w-1/3 space-y-2">
            <label className="text-sm font-bold text-black flex items-center gap-2 uppercase tracking-wide">
              <User size={16} />
              Filtrar por Vendedor
            </label>
            <div className="relative">
              <select
                value={selectedSellerId}
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="w-full h-12 pl-4 pr-10 bg-white border border-black rounded-none text-sm font-medium focus:ring-2 focus:ring-black focus:border-black outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="all">Todos os Vendedores</option>
                {sellers.map(seller => (
                  <option key={seller.id} value={seller.id}>
                    {seller.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
            </div>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col sm:flex-row gap-4">
             <div className="flex-1 space-y-2">
               <label className="text-sm font-bold text-black flex items-center gap-2 uppercase tracking-wide">
                 <Calendar size={16} />
                 Data Inicial
               </label>
               <input 
                 type="date"
                 value={dateRange.start}
                 onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                 className="w-full h-12 px-3 bg-white border border-black rounded-none text-sm font-medium focus:ring-2 focus:ring-black outline-none"
               />
             </div>
             <div className="flex-1 space-y-2">
               <label className="text-sm font-bold text-black flex items-center gap-2 uppercase tracking-wide">
                 <Calendar size={16} />
                 Data Final
               </label>
               <input 
                 type="date"
                 value={dateRange.end}
                 onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                 className="w-full h-12 px-3 bg-white border border-black rounded-none text-sm font-medium focus:ring-2 focus:ring-black outline-none"
               />
             </div>
             <div className="pb-0.5">
               <button 
                 onClick={() => setDateRange({ start: '', end: '' })}
                 className="h-12 px-6 text-sm font-bold text-black border border-black hover:bg-black hover:text-white transition-colors uppercase tracking-wide"
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
          subtitle="Mês atual"
        />
        <MetricCard 
          title="Pedidos Filtrados" 
          value={metrics.count.toString()} 
          icon={ShoppingBag} 
          subtitle="Total no período"
        />
        <MetricCard 
          title="Ticket Médio" 
          value={formatCurrency(metrics.ticket)} 
          icon={DollarSign} 
          subtitle="Média por pedido"
        />
      </div>

      {/* --- Orders List --- */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="bg-white p-3 border-2 border-black shadow-sharp flex flex-col md:flex-row gap-4 items-center">
          {/* Select All Checkbox */}
          <div className="pl-2 pr-2 flex items-center h-full">
             <button 
               onClick={toggleSelectAll}
               className="text-black hover:opacity-70 transition-opacity"
               title="Selecionar Todos"
             >
               {selectedOrders.size > 0 && selectedOrders.size === filteredOrders.length ? (
                 <CheckSquare size={24} className="text-black" />
               ) : (
                 <Square size={24} className="text-black" />
               )}
             </button>
          </div>

          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={18} />
            <input 
              type="text"
              placeholder="BUSCAR POR ID OU CLIENTE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-black text-sm font-medium focus:ring-2 focus:ring-black outline-none transition-all placeholder:text-gray-400"
            />
          </div>
          <div className="relative w-full md:w-64">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 pl-9 pr-8 bg-white border border-black text-sm font-bold text-black focus:ring-2 focus:ring-black outline-none appearance-none cursor-pointer uppercase"
            >
              <option value="all">Todos os Status</option>
              {ORDER_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
          </div>
        </div>

        {/* Batch Action Floating Bar */}
        {selectedOrders.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-black text-white px-8 py-4 shadow-sharp border-2 border-white flex items-center gap-6 animate-in slide-in-from-bottom-4">
            <span className="font-bold text-sm uppercase tracking-wide">{selectedOrders.size} SELECIONADOS</span>
            <div className="h-6 w-px bg-white/30"></div>
            <button 
              onClick={handleBatchDownload}
              disabled={isGeneratingBatch}
              className="flex items-center gap-2 text-sm font-bold hover:underline transition-all disabled:opacity-50 uppercase tracking-wide"
            >
              {isGeneratingBatch ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              BAIXAR PDF UNIFICADO
            </button>
            <button 
              onClick={() => setSelectedOrders(new Set())}
              className="ml-2 p-1 hover:bg-white hover:text-black transition-colors border border-transparent hover:border-white"
            >
              <XCircle size={20} />
            </button>
          </div>
        )}

        {/* List Content */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-black" size={48} />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border-2 border-black border-dashed p-16 text-center text-black">
            <div className="w-16 h-16 bg-black text-white flex items-center justify-center mx-auto mb-4 border-2 border-black">
              <Search size={32} />
            </div>
            <p className="font-bold uppercase tracking-wide">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
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
                    "bg-white border-2 border-black transition-all duration-200 overflow-hidden group",
                    isSelected ? "bg-gray-50" : "bg-white",
                    isExpanded ? "shadow-sharp" : "shadow-sm hover:shadow-sharp"
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
                          <CheckSquare size={24} className="text-black cursor-pointer" />
                        ) : (
                          <Square size={24} className="text-black hover:opacity-60 cursor-pointer" />
                        )}
                      </div>

                      {/* Icon Box */}
                      <div className="h-12 w-12 bg-black text-white flex items-center justify-center shrink-0 border-2 border-black">
                        <FileText size={24} strokeWidth={1.5} />
                      </div>
                      
                      {/* Info */}
                      <div className="min-w-0">
                        <h3 className="text-xl font-black text-black tracking-tighter flex items-center gap-2 uppercase">
                          #{order.id.slice(0, 8)}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-black mt-1">
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                            <Calendar size={14} />
                            {formatDateTime(order.created_at)}
                          </span>
                          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wide truncate max-w-[150px] sm:max-w-none border-l-2 border-black pl-3">
                            <User size={14} />
                            {order.clients.nome_fantasia}
                          </span>
                          {selectedSellerId === 'all' && (
                             <span className="hidden sm:inline-block text-[10px] font-bold bg-black text-white px-2 py-0.5 uppercase tracking-wider">
                               {sellerName}
                             </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Status, Actions & Total */}
                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end pl-[88px] md:pl-0 border-t-2 border-black md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0">
                      
                      <div className={cn("px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2", statusConfig.style)}>
                        <StatusIcon size={14} />
                        {statusConfig.label}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 mr-2">
                         <button 
                           onClick={(e) => handleSinglePrint(order, e)}
                           className="p-2 text-black hover:bg-black hover:text-white border border-transparent hover:border-black transition-colors"
                           title="Imprimir"
                         >
                           <Printer size={20} />
                         </button>
                         <button 
                           onClick={(e) => handleSingleDownload(order, e)}
                           className="p-2 text-black hover:bg-black hover:text-white border border-transparent hover:border-black transition-colors"
                           title="Baixar PDF"
                         >
                           <Download size={20} />
                         </button>
                      </div>
                      
                      <div className="text-right min-w-[120px]">
                        <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-0.5">TOTAL</p>
                        <p className="text-xl font-black text-black tracking-tight">{formatCurrency(order.total_amount)}</p>
                      </div>

                      <div className={cn(
                        "p-2 transition-colors border-2 border-black bg-white text-black hover:bg-black hover:text-white",
                        isExpanded && "bg-black text-white"
                      )}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t-2 border-black bg-white p-6 animate-in slide-in-from-top-2">
                      
                      {/* Timeline */}
                      <div className="mb-8 border-2 border-black p-4 bg-white">
                        <h4 className="text-xs font-black text-black uppercase tracking-widest mb-4 flex items-center gap-2 border-b-2 border-black pb-2 w-fit">
                          <History size={14} />
                          Histórico
                        </h4>
                        <div className="flex flex-col gap-4 pl-2">
                          {/* Initial */}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="w-3 h-3 bg-black shrink-0"></div>
                            <span className="text-black w-36 text-xs font-mono font-bold">{formatDateTime(order.created_at)}</span>
                            <span className="font-bold text-black flex items-center gap-2 uppercase text-xs">
                              <Clock size={14} />
                              Pedido Criado
                            </span>
                          </div>
                          
                          {/* Updates */}
                          {order.status_history && order.status_history.map((history, idx) => {
                            const histConfig = getStatusConfig(history.status);
                            return (
                              <div key={idx} className="flex items-center gap-4 text-sm">
                                <div className="w-3 h-3 bg-white border-2 border-black shrink-0"></div>
                                <span className="text-black w-36 text-xs font-mono font-bold">{formatDateTime(history.updated_at)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold uppercase">Status:</span>
                                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5", histConfig.style)}>
                                    {histConfig.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-2 border-black">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-black text-white font-bold uppercase text-xs tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Produto</th>
                              <th className="px-4 py-3 text-center">Qtd.</th>
                              <th className="px-4 py-3 text-right">Unitário</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-black">
                            {order.order_items?.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <p className="font-bold text-black uppercase">{item.products?.name || 'Produto Removido'}</p>
                                  <p className="text-xs font-mono text-gray-600">{item.products?.sku}</p>
                                </td>
                                <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                                <td className="px-4 py-3 text-right font-bold text-black">{formatCurrency(item.subtotal)}</td>
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

function MetricCard({ title, value, icon: Icon, subtitle }: any) {
  return (
    <div className="bg-white p-6 border-2 border-black shadow-sharp transition-all hover:-translate-y-1">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 border-2 border-black bg-black text-white">
          <Icon size={24} />
        </div>
      </div>
      <div>
        <p className="text-sm font-bold uppercase mb-1 text-gray-600 tracking-wide">{title}</p>
        <h3 className="text-3xl font-black text-black tracking-tighter">{value}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1 font-medium uppercase">{subtitle}</p>}
      </div>
    </div>
  );
}
