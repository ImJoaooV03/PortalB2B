import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Order, Client } from '../lib/types';
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
  Download,
  CheckSquare,
  Square,
  History,
  Clock,
  Printer,
  XCircle,
  FileBarChart,
  Building2
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, cn } from '../lib/utils';
import { ORDER_STATUSES, getStatusConfig } from '../lib/constants';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

interface SellerProfile {
  id: string;
  full_name: string;
  email: string;
}

// Report Configuration Interface
interface AdminReportConfig {
  startDate: string;
  endDate: string;
  sellerId: string; // 'all' or specific ID
  clientId: string; // 'all' or specific ID
  statuses: string[];
  includeCharts: boolean; // For PDF visual summary
  format: 'pdf' | 'csv';
}

export default function SalesManagement() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  
  // Data State
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State (On Screen)
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // UI State
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  
  // Batch Actions State
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);

  // Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportConfig, setReportConfig] = useState<AdminReportConfig>({
    startDate: new Date().toISOString().split('T')[0], // Default today
    endDate: new Date().toISOString().split('T')[0],
    sellerId: 'all',
    clientId: 'all',
    statuses: [],
    includeCharts: true,
    format: 'pdf'
  });

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  async function fetchData() {
    try {
      setLoading(true);
      
      const { data: sellersData, error: sellersError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'vendedor');

      if (sellersError) throw sellersError;
      setSellers(sellersData || []);

      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, nome_fantasia, razao_social')
        .eq('status', 'active')
        .order('nome_fantasia');

      if (clientsError) throw clientsError;
      setClients(clientsData as any || []);

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

  // --- Computed Data for Screen ---
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (selectedSellerId !== 'all') {
        if (order.clients.vendedor_id !== selectedSellerId) return false;
      }

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        order.id.toLowerCase().includes(searchLower) ||
        order.clients.nome_fantasia.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      if (dateRange.start && dateRange.end) {
        const orderDate = new Date(order.created_at);
        
        // FIX: Construct local dates manually to avoid UTC shift
        const [startYear, startMonth, startDay] = dateRange.start.split('-').map(Number);
        const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
        
        const [endYear, endMonth, endDay] = dateRange.end.split('-').map(Number);
        const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
        
        if (orderDate < start || orderDate > end) return false;
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

  // --- PDF Generation Logic (Single/Batch) ---
  const generatePDF = (order: Order, doc?: jsPDF, isBatch = false) => {
    const pdf = doc || new jsPDF();
    
    // ... (Existing Single PDF Logic - kept for batch/single button)
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.text('PEDIDO DE VENDA', 14, 22);
    
    pdf.setFontSize(10);
    pdf.setTextColor(0);
    pdf.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(14, 35, 182, 40);

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text(`PEDIDO #${order.id.slice(0, 8).toUpperCase()}`, 20, 45);
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`DATA: ${formatDate(order.created_at)}`, 20, 52);
    pdf.text(`STATUS: ${order.status.toUpperCase()}`, 20, 58);

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text('CLIENTE', 110, 45);
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`${order.clients?.razao_social || 'N/A'}`, 110, 52);
    pdf.text(`FANTASIA: ${order.clients?.nome_fantasia || 'N/A'}`, 110, 58);
    if (order.clients?.cnpj) pdf.text(`CNPJ: ${order.clients.cnpj}`, 110, 64);

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
      theme: 'plain',
      headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' },
      styles: { fontSize: 9, cellPadding: 4, textColor: 0, lineColor: 0, lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 30 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      },
      foot: [['', '', '', 'TOTAL FINAL', formatCurrency(order.total_amount)]],
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'right' }
    });

    if (!doc) {
      pdf.save(`pedido_${order.id.slice(0, 8)}.pdf`);
    }
  };

  // --- NEW: Advanced Admin Report Generation ---
  const generateAdminReport = async () => {
    setIsGeneratingReport(true);
    try {
      // 1. Filter Data based on Report Config
      const reportData = orders.filter(order => {
        // Seller Filter
        if (reportConfig.sellerId !== 'all') {
          if (order.clients.vendedor_id !== reportConfig.sellerId) return false;
        }

        // Client Filter
        if (reportConfig.clientId !== 'all') {
          if (order.client_id !== reportConfig.clientId) return false;
        }

        // Date Filter - FIX: Use local time construction
        if (reportConfig.startDate) {
          const orderDate = new Date(order.created_at);
          const [y, m, d] = reportConfig.startDate.split('-').map(Number);
          const start = new Date(y, m - 1, d, 0, 0, 0, 0);
          if (orderDate < start) return false;
        }
        if (reportConfig.endDate) {
          const orderDate = new Date(order.created_at);
          const [y, m, d] = reportConfig.endDate.split('-').map(Number);
          const end = new Date(y, m - 1, d, 23, 59, 59, 999);
          if (orderDate > end) return false;
        }

        // Status Filter
        if (reportConfig.statuses.length > 0) {
          if (!reportConfig.statuses.includes(order.status)) return false;
        }

        return true;
      });

      if (reportData.length === 0) {
        toast.info('Nenhum dado encontrado para os filtros selecionados.');
        setIsGeneratingReport(false);
        return;
      }

      // 2. Calculate Aggregates
      const totalValue = reportData.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
      const averageTicket = totalValue / reportData.length;
      
      // Group by Seller
      const salesBySeller: Record<string, { name: string, total: number, count: number }> = {};
      reportData.forEach(order => {
        const sellerId = order.clients.vendedor_id || 'unknown';
        const sellerName = sellers.find(s => s.id === sellerId)?.full_name || 'Desconhecido/Sistema';
        
        if (!salesBySeller[sellerId]) {
          salesBySeller[sellerId] = { name: sellerName, total: 0, count: 0 };
        }
        salesBySeller[sellerId].total += order.total_amount;
        salesBySeller[sellerId].count += 1;
      });
      const topSeller = Object.values(salesBySeller).sort((a, b) => b.total - a.total)[0];

      // Group by Product
      const salesByProduct: Record<string, { name: string, qty: number, total: number }> = {};
      reportData.forEach(order => {
        order.order_items.forEach(item => {
          const sku = item.products?.sku || 'unknown';
          if (!salesByProduct[sku]) {
            salesByProduct[sku] = { name: item.products?.name || 'Item Removido', qty: 0, total: 0 };
          }
          salesByProduct[sku].qty += item.quantity;
          salesByProduct[sku].total += item.subtotal;
        });
      });
      const topProducts = Object.values(salesByProduct).sort((a, b) => b.qty - a.qty).slice(0, 5);

      // Helper to format date string (YYYY-MM-DD) to DD/MM/YYYY without timezone shift
      const formatReportDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
      };

      // 3. Generate Output
      if (reportConfig.format === 'csv') {
        const csvData = reportData.map(o => ({
          ID: o.id,
          DATA: formatDate(o.created_at),
          CLIENTE: o.clients.nome_fantasia,
          VENDEDOR: sellers.find(s => s.id === o.clients.vendedor_id)?.full_name || 'N/A',
          STATUS: o.status.toUpperCase(),
          TOTAL: o.total_amount
        }));
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_gerencial_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      } else {
        // PDF Generation
        const doc = new jsPDF();
        
        // --- Header ---
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text('RELATÓRIO GERENCIAL', 14, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 26);
        doc.text(`Período: ${formatReportDate(reportConfig.startDate)} à ${formatReportDate(reportConfig.endDate)}`, 14, 31);
        
        // Add Client Name if specific
        if (reportConfig.clientId !== 'all') {
          const clientName = clients.find(c => c.id === reportConfig.clientId)?.nome_fantasia || 'Cliente Específico';
          doc.text(`Cliente: ${clientName.toUpperCase()}`, 14, 36);
        }

        // --- Executive Summary Cards ---
        const startY = reportConfig.clientId !== 'all' ? 45 : 40;
        const isGeneralReport = reportConfig.sellerId === 'all' && reportConfig.clientId === 'all';
        
        // Layout Logic: If specific seller or client, use 2 wider cards. If general, use 3 cards.
        const gap = 4;
        const totalWidth = 182; // A4 width (210) - margins (14*2)
        const cardHeight = 25;
        
        // Card 1: VENDAS TOTAIS
        // If General: ~60 width. If Specific: ~90 width
        const col1Width = isGeneralReport ? 60 : 90;
        
        doc.setDrawColor(0);
        doc.setFillColor(0, 0, 0); // Black bg
        doc.rect(14, startY, col1Width, cardHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text('VENDAS TOTAIS', 19, startY + 8);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(totalValue), 19, startY + 18);

        // Card 2: PEDIDOS
        const col2X = 14 + col1Width + gap;
        const col2Width = isGeneralReport ? 60 : (totalWidth - col1Width - gap); // Fill rest if specific

        doc.setFillColor(255, 255, 255); // White bg
        doc.setDrawColor(0); // Black border
        doc.rect(col2X, startY, col2Width, cardHeight, 'FD');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text('PEDIDOS', col2X + 5, startY + 8);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(reportData.length.toString(), col2X + 5, startY + 18);

        // Card 3: MELHOR VENDEDOR (Only if General Report)
        if (isGeneralReport) {
          const col3X = col2X + col2Width + gap;
          const col3Width = totalWidth - col1Width - col2Width - (gap * 2);
          
          doc.rect(col3X, startY, col3Width, cardHeight, 'S');
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text('MELHOR VENDEDOR', col3X + 5, startY + 8);
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(topSeller?.name.split(' ')[0].toUpperCase() || '-', col3X + 5, startY + 18);
        }

        let currentY = startY + 35;

        // --- Ranking by Seller (Only if All Sellers selected) ---
        if (reportConfig.sellerId === 'all') {
          doc.setFontSize(12);
          doc.setTextColor(0);
          doc.text('DESEMPENHO POR VENDEDOR', 14, currentY);
          
          const sellerTableData = Object.values(salesBySeller)
            .sort((a, b) => b.total - a.total)
            .map(s => [s.name.toUpperCase(), s.count, formatCurrency(s.total)]);

          autoTable(doc, {
            startY: currentY + 5,
            head: [['VENDEDOR', 'PEDIDOS', 'TOTAL']],
            body: sellerTableData,
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, textColor: 0, lineColor: 0 },
          });
          
          currentY = (doc as any).lastAutoTable.finalY + 15;
        }

        // --- Top Products ---
        doc.setFontSize(12);
        doc.text('PRODUTOS MAIS VENDIDOS', 14, currentY);
        
        const productTableData = topProducts.map(p => [p.name.toUpperCase(), p.qty, formatCurrency(p.total)]);
        
        autoTable(doc, {
          startY: currentY + 5,
          head: [['PRODUTO', 'QTD', 'RECEITA']],
          body: productTableData,
          theme: 'grid',
          headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineColor: 0 },
          styles: { fontSize: 9, textColor: 0, lineColor: 0 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // --- Detailed List ---
        doc.addPage(); // Start details on new page
        doc.setFontSize(12);
        doc.text('DETALHAMENTO DE PEDIDOS', 14, 20);

        const detailsData = reportData.map(o => [
          formatDate(o.created_at),
          `#${o.id.slice(0, 6)}`,
          o.clients.nome_fantasia.substring(0, 20),
          sellers.find(s => s.id === o.clients.vendedor_id)?.full_name.split(' ')[0] || '-',
          o.status.toUpperCase(),
          formatCurrency(o.total_amount)
        ]);

        autoTable(doc, {
          startY: 25,
          head: [['DATA', 'ID', 'CLIENTE', 'VEND.', 'STATUS', 'VALOR']],
          body: detailsData,
          theme: 'plain',
          headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 8, cellPadding: 3 },
          columnStyles: { 5: { halign: 'right' } }
        });

        // Add Footer
        const pageCount = doc.internal.pages.length - 1;
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Portal Objetivus - Relatório Gerencial', 14, doc.internal.pageSize.height - 10);
        }

        doc.save(`relatorio_gerencial_${new Date().toISOString().split('T')[0]}.pdf`);
      }

      toast.success('Relatório gerado com sucesso!');
      setIsReportModalOpen(false);

    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar relatório.');
    } finally {
      setIsGeneratingReport(false);
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

  const toggleReportStatus = (status: string) => {
    setReportConfig(prev => {
      const newStatuses = prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status];
      return { ...prev, statuses: newStatuses };
    });
  };

  if (!isAdmin) return <div className="p-8 text-center text-black font-bold uppercase">Acesso restrito.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Gestão de Vendas" 
        subtitle={`Segunda-Feira, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} • Analise o desempenho da sua equipe comercial.`}
        action={
          <Button 
            onClick={() => setIsReportModalOpen(true)} 
            leftIcon={<FileBarChart size={18} />}
            className="shadow-sharp hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            RELATÓRIO GERENCIAL
          </Button>
        }
      />

      {/* Main Dashboard Content */}
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

      {/* Metrics Cards */}
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

      {/* Orders List */}
      <div className="space-y-4">
        <div className="bg-white p-3 border-2 border-black shadow-sharp flex flex-col md:flex-row gap-4 items-center">
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

        {/* Batch Action Bar */}
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
                  <div 
                    className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <div onClick={(e) => { e.stopPropagation(); toggleSelectOrder(order.id); }}>
                        {isSelected ? (
                          <CheckSquare size={24} className="text-black cursor-pointer" />
                        ) : (
                          <Square size={24} className="text-black hover:opacity-60 cursor-pointer" />
                        )}
                      </div>

                      <div className="h-12 w-12 bg-black text-white flex items-center justify-center shrink-0 border-2 border-black">
                        <FileText size={24} strokeWidth={1.5} />
                      </div>
                      
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

                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end pl-[88px] md:pl-0 border-t-2 border-black md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0">
                      
                      <div className={cn("px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-2", statusConfig.style)}>
                        <StatusIcon size={14} />
                        {statusConfig.label}
                      </div>

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

                  {isExpanded && (
                    <div className="border-t-2 border-black bg-white p-6 animate-in slide-in-from-top-2">
                      
                      <div className="mb-8 border-2 border-black p-4 bg-white">
                        <h4 className="text-xs font-black text-black uppercase tracking-widest mb-4 flex items-center gap-2 border-b-2 border-black pb-2 w-fit">
                          <History size={14} />
                          Histórico
                        </h4>
                        <div className="flex flex-col gap-4 pl-2">
                          <div className="flex items-center gap-4 text-sm">
                            <div className="w-3 h-3 bg-black shrink-0"></div>
                            <span className="text-black w-36 text-xs font-mono font-bold">{formatDateTime(order.created_at)}</span>
                            <span className="font-bold text-black flex items-center gap-2 uppercase text-xs">
                              <Clock size={14} />
                              Pedido Criado
                            </span>
                          </div>
                          
                          {order.status_history && order.status_history.map((history, idx) => {
                            const histConfig = getStatusConfig(history.status);
                            return (
                              <div key={idx} className="flex items-center gap-4 text-sm">
                                <div className="w-3 h-3 bg-white border-2 border-black shrink-0"></div>
                                <span className="text-black w-36 text-xs font-mono font-bold">{formatDateTime(history.updated_at)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold uppercase">Status:</span>
                                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 border", histConfig.style)}>
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

      {/* Admin Report Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="CONFIGURAR RELATÓRIO GERENCIAL"
      >
        <div className="space-y-8">
          
          {/* 1. Scope */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1 flex items-center gap-2">
              <User size={16} />
              1. Filtros de Entidade
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Vendedor</label>
                <select
                  value={reportConfig.sellerId}
                  onChange={(e) => setReportConfig({ ...reportConfig, sellerId: e.target.value, clientId: 'all' })}
                  className="w-full h-10 pl-3 pr-8 bg-white border border-black text-sm font-bold text-black focus:ring-1 focus:ring-black outline-none uppercase"
                >
                  <option value="all">TODOS OS VENDEDORES</option>
                  {sellers.map(seller => (
                    <option key={seller.id} value={seller.id}>
                      {seller.full_name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Cliente</label>
                <select
                  value={reportConfig.clientId}
                  onChange={(e) => setReportConfig({ ...reportConfig, clientId: e.target.value })}
                  className="w-full h-10 pl-3 pr-8 bg-white border border-black text-sm font-bold text-black focus:ring-1 focus:ring-black outline-none uppercase"
                >
                  <option value="all">TODOS OS CLIENTES</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.nome_fantasia.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Date Range */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1 flex items-center gap-2">
              <Calendar size={16} />
              2. Período
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="date"
                label="Data Inicial"
                value={reportConfig.startDate}
                onChange={(e) => setReportConfig({ ...reportConfig, startDate: e.target.value })}
              />
              <Input
                type="date"
                label="Data Final"
                value={reportConfig.endDate}
                onChange={(e) => setReportConfig({ ...reportConfig, endDate: e.target.value })}
              />
            </div>
          </div>

          {/* 3. Status Filter */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1 flex items-center gap-2">
              <Filter size={16} />
              3. Filtrar Status
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ORDER_STATUSES.map((status) => {
                const isSelected = reportConfig.statuses.includes(status.value);
                return (
                  <button
                    key={status.value}
                    onClick={() => toggleReportStatus(status.value)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 border-2 text-xs font-bold uppercase transition-all",
                      isSelected 
                        ? "bg-black text-white border-black" 
                        : "bg-white text-black border-gray-200 hover:border-black"
                    )}
                  >
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    {status.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 font-medium">* Se nenhum for selecionado, todos serão incluídos.</p>
          </div>

          {/* 4. Format */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1 flex items-center gap-2">
              <FileText size={16} />
              4. Formato
            </h4>
            <div className="flex gap-4">
              <button
                onClick={() => setReportConfig({ ...reportConfig, format: 'pdf' })}
                className={cn(
                  "flex-1 py-3 border-2 font-bold uppercase transition-all flex items-center justify-center gap-2",
                  reportConfig.format === 'pdf' 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-black border-gray-200 hover:border-black"
                )}
              >
                <FileText size={20} /> PDF (Analítico)
              </button>
              <button
                onClick={() => setReportConfig({ ...reportConfig, format: 'csv' })}
                className={cn(
                  "flex-1 py-3 border-2 font-bold uppercase transition-all flex items-center justify-center gap-2",
                  reportConfig.format === 'csv' 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-black border-gray-200 hover:border-black"
                )}
              >
                <FileBarChart size={20} /> CSV (Excel)
              </button>
            </div>
          </div>

          <div className="pt-6 border-t-2 border-black flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsReportModalOpen(false)}>
              CANCELAR
            </Button>
            <Button 
              onClick={generateAdminReport} 
              isLoading={isGeneratingReport}
              leftIcon={<Download size={18} />}
            >
              GERAR RELATÓRIO
            </Button>
          </div>
        </div>
      </Modal>
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
