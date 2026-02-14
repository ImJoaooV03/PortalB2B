import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Order, StatusHistoryItem } from '../lib/types';
import { 
  Loader2, FileText, Calendar, User, ChevronDown, ChevronUp, 
  PackageCheck, Clock, Search, Filter, Download, AlertTriangle, 
  Printer, History, FileBarChart, CheckSquare, Square, X
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, cn } from '../lib/utils';
import { ORDER_STATUSES, getStatusConfig } from '../lib/constants';
import PageHeader from '../components/ui/PageHeader';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';

// Report Types
interface ReportConfig {
  startDate: string;
  endDate: string;
  statuses: string[];
  columns: {
    id: boolean;
    date: boolean;
    client: boolean;
    status: boolean;
    total: boolean;
    items_summary: boolean;
  };
  format: 'pdf' | 'csv';
}

const INITIAL_REPORT_CONFIG: ReportConfig = {
  startDate: '',
  endDate: '',
  statuses: [],
  columns: {
    id: true,
    date: true,
    client: true,
    status: true,
    total: true,
    items_summary: true // Default to true now
  },
  format: 'pdf'
};

export default function Orders() {
  const { isClient, isAdmin, isSeller } = useAuth();
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Report State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>(INITIAL_REPORT_CONFIG);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, clients (nome_fantasia, razao_social, cnpj), order_items (*, products (name, sku))`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data as any || []);
    } catch (error) {
      toast.error('Erro ao carregar lista de pedidos.');
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: string, currentHistory: StatusHistoryItem[], e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingStatus(orderId);
    try {
      const newHistoryEntry = { status: newStatus, updated_at: new Date().toISOString() };
      const updatedHistory = [...(currentHistory || []), newHistoryEntry];
      
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, status_history: updatedHistory })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus, status_history: updatedHistory } : o));
      toast.success(`Status atualizado para ${newStatus.toUpperCase()}!`);
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast.error(`Erro ao atualizar: ${error.message || 'Tente novamente.'}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const generateSinglePDF = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.order_items || order.order_items.length === 0) {
      toast.error('Pedido sem itens.');
      return;
    }
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text('PORTAL OBJETIVUS', 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text('CONFERÊNCIA DE PEDIDO', 14, 26);
      doc.text(`EMISSÃO: ${new Date().toLocaleString('pt-BR')}`, 14, 31);
      
      // Box Info
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(14, 38, 182, 35);
      
      // Order Info
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`PEDIDO #${order.id.slice(0, 8).toUpperCase()}`, 20, 48);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`DATA: ${formatDate(order.created_at)}`, 20, 54);
      doc.text(`STATUS: ${order.status.toUpperCase()}`, 20, 60);
      doc.text(`TOTAL: ${formatCurrency(order.total_amount)}`, 20, 66);

      // Client Info
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text('DADOS DO CLIENTE', 110, 48);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`${order.clients?.nome_fantasia || 'N/A'}`, 110, 54);
      doc.text(`${order.clients?.razao_social || 'N/A'}`, 110, 60);
      if (order.clients?.cnpj) doc.text(`CNPJ: ${order.clients.cnpj}`, 110, 66);
      
      const tableBody = order.order_items.map(item => [
        item.products?.sku || 'N/A',
        item.products?.name || 'PRODUTO INDISPONÍVEL',
        item.quantity,
        formatCurrency(item.unit_price),
        formatCurrency(item.subtotal)
      ]);

      autoTable(doc, {
        startY: 80,
        head: [['SKU', 'PRODUTO', 'QTD.', 'UNIT.', 'TOTAL']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'left' },
        styles: { fontSize: 9, cellPadding: 3, lineColor: 0, lineWidth: 0.1, textColor: 0 },
        columnStyles: {
          0: { cellWidth: 30 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' }
        },
        foot: [['', '', '', 'TOTAL FINAL', formatCurrency(order.total_amount)]],
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'right' }
      });

      doc.save(`pedido_${order.id.slice(0, 8)}.pdf`);
      toast.success('PDF gerado!');
    } catch (error) {
      toast.error('Erro ao gerar PDF.');
    }
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.print();
  };

  // --- Report Logic ---

  const toggleReportStatus = (status: string) => {
    setReportConfig(prev => {
      const newStatuses = prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status];
      return { ...prev, statuses: newStatuses };
    });
  };

  const toggleReportColumn = (column: keyof ReportConfig['columns']) => {
    setReportConfig(prev => ({
      ...prev,
      columns: { ...prev.columns, [column]: !prev.columns[column] }
    }));
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      // 1. Filter Data locally
      const filteredData = orders.filter(order => {
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

        // Status Filter (if empty, assume all)
        if (reportConfig.statuses.length > 0) {
          if (!reportConfig.statuses.includes(order.status)) return false;
        }

        return true;
      });

      if (filteredData.length === 0) {
        toast.info('Nenhum pedido encontrado com os filtros selecionados.');
        setIsGeneratingReport(false);
        return;
      }

      // Calculate Total Value of the Report
      const totalReportValue = filteredData.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

      // Helper to format date string (YYYY-MM-DD) to DD/MM/YYYY without timezone shift
      const formatReportDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
      };

      // 2. Prepare Data for Export
      const exportData = filteredData.map(order => {
        const row: any = {};
        if (reportConfig.columns.id) row['ID'] = `#${order.id.slice(0, 8).toUpperCase()}`;
        if (reportConfig.columns.date) row['DATA'] = formatDate(order.created_at);
        if (reportConfig.columns.client) row['CLIENTE'] = order.clients?.nome_fantasia || 'N/A';
        if (reportConfig.columns.status) row['STATUS'] = order.status.toUpperCase();
        if (reportConfig.columns.total) row['TOTAL'] = reportConfig.format === 'csv' ? order.total_amount : formatCurrency(order.total_amount);
        
        if (reportConfig.columns.items_summary) {
          // Logic for CSV vs PDF
          if (reportConfig.format === 'csv') {
             // Single line for CSV
             const summary = order.order_items?.map(i => `${i.quantity}x ${i.products?.name}`).join(' | ') || '';
             row['ITENS'] = summary;
          } else {
             // New lines for PDF
             const summary = order.order_items?.map(i => `${i.quantity}x ${i.products?.name}`).join('\n') || '';
             row['ITENS'] = summary;
          }
        }
        return row;
      });

      // 3. Generate File
      if (reportConfig.format === 'csv') {
        const csv = Papa.unparse(exportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_pedidos_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text('RELATÓRIO DE PEDIDOS', 14, 20);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 26);
        
        // Summary Box
        doc.setDrawColor(0);
        doc.setFillColor(245, 245, 245);
        doc.rect(14, 32, 182, 18, 'F');
        doc.rect(14, 32, 182, 18, 'S'); // Border

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text('RESUMO DO PERÍODO', 20, 40);
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Período: ${formatReportDate(reportConfig.startDate)} à ${formatReportDate(reportConfig.endDate)}`, 20, 46);
        doc.text(`Total de Registros: ${filteredData.length}`, 80, 46);
        doc.text(`Valor Total: ${formatCurrency(totalReportValue)}`, 140, 46);

        const headers = Object.keys(exportData[0]);
        const body = exportData.map(obj => Object.values(obj));

        autoTable(doc, {
          startY: 55,
          head: [headers],
          body: body,
          theme: 'grid', // Changed from plain to grid for better readability
          headStyles: { 
            fillColor: [0, 0, 0], 
            textColor: 255, 
            fontStyle: 'bold',
            halign: 'left',
            lineWidth: 0.1,
            lineColor: 0
          },
          styles: { 
            fontSize: 8, 
            cellPadding: 3, 
            lineColor: 0, 
            lineWidth: 0.1,
            textColor: 0,
            valign: 'middle'
          },
          columnStyles: {
            // Adjust widths based on content
            0: { cellWidth: 25 }, // ID
            1: { cellWidth: 25 }, // Data
            4: { halign: 'right', fontStyle: 'bold' }, // Total
            5: { cellWidth: 'auto' } // Itens (takes remaining space)
          },
          didParseCell: (data) => {
             // Center align status if it exists
             if (data.section === 'body' && data.column.index === 3) {
                data.cell.styles.halign = 'center';
             }
          },
          // Add Footer with Page Numbers
          didDrawPage: (data) => {
            const pageCount = doc.internal.pages.length - 1;
            doc.setFontSize(8);
            doc.text(
              `Página ${data.pageNumber}`, 
              doc.internal.pageSize.width - 20, 
              doc.internal.pageSize.height - 10,
              { align: 'right' }
            );
            doc.text(
              'Portal Objetivus', 
              14, 
              doc.internal.pageSize.height - 10
            );
          }
        });

        doc.save(`relatorio_pedidos_${new Date().toISOString().split('T')[0]}.pdf`);
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

  // --- End Report Logic ---

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clients?.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-black" size={40} /></div>;

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <PageHeader 
        title={isClient ? 'Meus Pedidos' : 'Gestão de Pedidos'}
        subtitle={isClient ? 'Acompanhe suas compras' : 'Visualize e atualize o status das vendas'}
        action={
          <Button 
            variant="secondary" 
            onClick={() => setIsReportModalOpen(true)} 
            leftIcon={<FileBarChart size={18} />}
          >
            RELATÓRIOS
          </Button>
        }
      />

      {orders.length === 0 ? (
        <div className="bg-white border-2 border-black border-dashed p-16 text-center">
          <FileText className="mx-auto mb-4 text-black" size={32} />
          <h3 className="text-lg font-bold uppercase">Nenhum pedido encontrado</h3>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-4 border-2 border-black shadow-sharp flex flex-col md:flex-row gap-4 no-print">
             <div className="flex-1">
               <Input 
                  placeholder="BUSCAR POR ID OU CLIENTE..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<Search size={18} />}
               />
             </div>
             <div className="w-full md:w-64 relative">
               <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
               <select
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
                 className="w-full h-10 pl-9 pr-8 bg-white border border-black text-sm font-bold text-black focus:ring-1 focus:ring-black outline-none appearance-none cursor-pointer uppercase"
               >
                 <option value="all">TODOS OS STATUS</option>
                 {ORDER_STATUSES.map(s => (
                   <option key={s.value} value={s.value}>{s.label}</option>
                 ))}
               </select>
               <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
             </div>
          </div>

          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
               <div className="text-center py-12 text-black bg-white border-2 border-dashed border-black uppercase font-bold">
                 Nenhum pedido corresponde aos filtros.
               </div>
            ) : (
              filteredOrders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const StatusIcon = statusConfig.icon;
                const canEdit = isAdmin || isSeller;
                const isExpanded = expandedOrder === order.id;
                
                return (
                  <div 
                    key={order.id} 
                    className={cn(
                      "bg-white border-2 border-black transition-all duration-200 group",
                      isExpanded ? "shadow-sharp" : "shadow-sm hover:shadow-sharp no-print"
                    )}
                  >
                    <div 
                      className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 cursor-pointer"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className="h-12 w-12 bg-black text-white flex items-center justify-center shrink-0 border-2 border-black">
                          <FileText size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-black text-black text-lg uppercase">#{order.id.slice(0, 8)}</h3>
                            {!canEdit && (
                              <span className={cn("text-xs font-bold uppercase px-2 py-0.5 flex items-center gap-1 border-2", statusConfig.style)}>
                                <StatusIcon size={12} />
                                {statusConfig.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-black font-medium uppercase">
                            <span className="flex items-center gap-1.5 text-xs">
                              <Calendar size={14} />
                              ENVIADO EM: {formatDateTime(order.created_at)}
                            </span>
                            {!isClient && (
                              <span className="flex items-center gap-1.5 text-xs">
                                <User size={14} />
                                {order.clients?.nome_fantasia || 'CLIENTE DESCONHECIDO'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full lg:w-auto justify-between lg:justify-end border-t-2 border-black lg:border-t-0 pt-4 lg:pt-0 mt-2 lg:mt-0 no-print">
                        {canEdit ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <div className="relative">
                              {updatingStatus === order.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                                  <Loader2 className="animate-spin text-black" size={16} />
                                </div>
                              )}
                              <select
                                value={order.status}
                                onChange={(e) => handleStatusChange(order.id, e.target.value, order.status_history, e as any)}
                                className={cn(
                                  "appearance-none pl-9 pr-8 py-2 text-sm font-bold border-2 outline-none cursor-pointer uppercase transition-colors",
                                  statusConfig.style
                                )}
                              >
                                {ORDER_STATUSES.map(s => (
                                  <option key={s.value} value={s.value} className="bg-white text-black">
                                    {s.label.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                              <StatusIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-6 ml-auto sm:ml-0">
                          <div className="text-right">
                            <p className="text-xs text-black font-bold uppercase tracking-widest mb-0.5">TOTAL</p>
                            <p className="text-xl font-black text-black tracking-tight">{formatCurrency(order.total_amount)}</p>
                          </div>
                          <div className={cn(
                            "p-2 transition-colors border-2 border-black",
                            isExpanded ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"
                          )}>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t-2 border-black bg-white p-6 animate-in slide-in-from-top-2">
                        
                        {/* Timeline Section */}
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

                        <div className="flex justify-between items-center mb-4 no-print">
                          <h4 className="text-sm font-bold text-black flex items-center gap-2 uppercase">
                            <PackageCheck size={18} />
                            Itens do Pedido
                          </h4>
                          <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={(e) => handlePrint(e)} leftIcon={<Printer size={14} />}>
                              IMPRIMIR
                            </Button>
                            <Button variant="secondary" size="sm" onClick={(e) => generateSinglePDF(order, e)} leftIcon={<Download size={14} />}>
                              BAIXAR PDF
                            </Button>
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
                              {(!order.order_items || order.order_items.length === 0) ? (
                                <tr>
                                  <td colSpan={4} className="p-8 text-center text-black font-bold uppercase">
                                    <AlertTriangle className="mx-auto mb-2" size={24} />
                                    Erro ao carregar itens
                                  </td>
                                </tr>
                              ) : (
                                order.order_items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <p className="font-bold text-black uppercase">{item.products?.name || 'REMOVIDO'}</p>
                                      <p className="text-xs font-mono text-gray-600">{item.products?.sku}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.unit_price)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-black">{formatCurrency(item.subtotal)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot className="bg-gray-100 font-black text-black border-t-2 border-black">
                              <tr>
                                <td colSpan={3} className="px-4 py-3 text-right uppercase">Total Final</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(order.total_amount)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Report Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="GERAR RELATÓRIO"
      >
        <div className="space-y-8">
          {/* Date Range */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1">
              1. Período
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

          {/* Status Filter */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1">
              2. Filtrar por Status
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

          {/* Columns */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1">
              3. Colunas do Relatório
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={reportConfig.columns.id}
                  onChange={() => toggleReportColumn('id')}
                  className="hidden"
                />
                <div className={cn(
                  "w-5 h-5 border-2 flex items-center justify-center transition-colors",
                  reportConfig.columns.id ? "bg-black border-black text-white" : "bg-white border-black group-hover:bg-gray-100"
                )}>
                  {reportConfig.columns.id && <CheckSquare size={14} />}
                </div>
                <span className="text-sm font-bold uppercase">ID do Pedido</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={reportConfig.columns.date}
                  onChange={() => toggleReportColumn('date')}
                  className="hidden"
                />
                <div className={cn(
                  "w-5 h-5 border-2 flex items-center justify-center transition-colors",
                  reportConfig.columns.date ? "bg-black border-black text-white" : "bg-white border-black group-hover:bg-gray-100"
                )}>
                  {reportConfig.columns.date && <CheckSquare size={14} />}
                </div>
                <span className="text-sm font-bold uppercase">Data</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={reportConfig.columns.client}
                  onChange={() => toggleReportColumn('client')}
                  className="hidden"
                />
                <div className={cn(
                  "w-5 h-5 border-2 flex items-center justify-center transition-colors",
                  reportConfig.columns.client ? "bg-black border-black text-white" : "bg-white border-black group-hover:bg-gray-100"
                )}>
                  {reportConfig.columns.client && <CheckSquare size={14} />}
                </div>
                <span className="text-sm font-bold uppercase">Cliente</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={reportConfig.columns.status}
                  onChange={() => toggleReportColumn('status')}
                  className="hidden"
                />
                <div className={cn(
                  "w-5 h-5 border-2 flex items-center justify-center transition-colors",
                  reportConfig.columns.status ? "bg-black border-black text-white" : "bg-white border-black group-hover:bg-gray-100"
                )}>
                  {reportConfig.columns.status && <CheckSquare size={14} />}
                </div>
                <span className="text-sm font-bold uppercase">Status</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={reportConfig.columns.total}
                  onChange={() => toggleReportColumn('total')}
                  className="hidden"
                />
                <div className={cn(
                  "w-5 h-5 border-2 flex items-center justify-center transition-colors",
                  reportConfig.columns.total ? "bg-black border-black text-white" : "bg-white border-black group-hover:bg-gray-100"
                )}>
                  {reportConfig.columns.total && <CheckSquare size={14} />}
                </div>
                <span className="text-sm font-bold uppercase">Valor Total</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={reportConfig.columns.items_summary}
                  onChange={() => toggleReportColumn('items_summary')}
                  className="hidden"
                />
                <div className={cn(
                  "w-5 h-5 border-2 flex items-center justify-center transition-colors",
                  reportConfig.columns.items_summary ? "bg-black border-black text-white" : "bg-white border-black group-hover:bg-gray-100"
                )}>
                  {reportConfig.columns.items_summary && <CheckSquare size={14} />}
                </div>
                <span className="text-sm font-bold uppercase">Resumo de Itens</span>
              </label>
            </div>
          </div>

          {/* Format */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-black uppercase border-b-2 border-black pb-1">
              4. Formato de Exportação
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
                <FileText size={20} /> PDF
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
              onClick={generateReport} 
              isLoading={isGeneratingReport}
              leftIcon={<Download size={18} />}
            >
              BAIXAR RELATÓRIO
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
