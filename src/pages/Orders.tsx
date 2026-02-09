import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Order, StatusHistoryItem } from '../lib/types';
import { 
  Loader2, 
  FileText, 
  Calendar, 
  User, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  XCircle, 
  PackageCheck, 
  Clock,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Printer,
  History,
  ArrowRight
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, cn } from '../lib/utils';
import PageHeader from '../components/ui/PageHeader';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ORDER_STATUSES = [
  { value: 'rascunho', label: 'Rascunho', icon: FileText, color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'enviado', label: 'Enviado', icon: Clock, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'aprovado', label: 'Aprovado', icon: CheckCircle2, color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'faturado', label: 'Faturado', icon: FileText, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'entregue', label: 'Entregue', icon: PackageCheck, color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'cancelado', label: 'Cancelado', icon: XCircle, color: 'bg-red-50 text-red-700 border-red-200' },
];

export default function Orders() {
  const { isClient, isAdmin, isSeller } = useAuth();
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          clients (nome_fantasia, razao_social, cnpj),
          order_items (
            *,
            products (name, sku)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data as any || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Erro ao carregar lista de pedidos.');
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: string, currentHistory: StatusHistoryItem[], e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingStatus(orderId);
    
    try {
      // Create new history entry
      const newHistoryEntry = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Append to existing history (handle null case)
      const updatedHistory = [...(currentHistory || []), newHistoryEntry];

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          status_history: updatedHistory 
        })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.map(o => o.id === orderId ? { 
        ...o, 
        status: newStatus,
        status_history: updatedHistory
      } : o));
      
      toast.success(`Status atualizado para ${ORDER_STATUSES.find(s => s.value === newStatus)?.label}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const generatePDF = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!order.order_items || order.order_items.length === 0) {
      toast.error('Este pedido não possui itens visíveis para gerar o PDF.');
      return;
    }

    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text('Conferência de Pedido', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

      // Order Info Box
      doc.setDrawColor(229, 231, 235);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(14, 35, 182, 40, 3, 3, 'FD');

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Pedido #${order.id.slice(0, 8).toUpperCase()}`, 20, 45);
      
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Data: ${formatDate(order.created_at)}`, 20, 52);
      doc.text(`Status: ${order.status.toUpperCase()}`, 20, 58);

      // Client Info
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Dados do Cliente', 110, 45);
      
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`${order.clients?.razao_social || 'N/A'}`, 110, 52);
      doc.text(`Fantasia: ${order.clients?.nome_fantasia || 'N/A'}`, 110, 58);
      if (order.clients?.cnpj) {
        doc.text(`CNPJ: ${order.clients.cnpj}`, 110, 64);
      }

      // Table
      const tableBody = order.order_items.map(item => [
        item.products?.sku || 'N/A',
        item.products?.name || 'Produto Indisponível',
        item.quantity,
        formatCurrency(item.unit_price),
        formatCurrency(item.subtotal)
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['SKU', 'Produto', 'Qtd.', 'Preço Unit.', 'Subtotal']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 30 }, // SKU
          1: { cellWidth: 'auto' }, // Product
          2: { cellWidth: 20, halign: 'center' }, // Qty
          3: { cellWidth: 30, halign: 'right' }, // Price
          4: { cellWidth: 30, halign: 'right' } // Subtotal
        },
        foot: [['', '', '', 'Total Final', formatCurrency(order.total_amount)]],
        footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold', halign: 'right' }
      });

      // Footer Note
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Documento para conferência interna e separação de estoque.', 14, finalY + 10);

      doc.save(`pedido_${order.id.slice(0, 8)}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF.');
    }
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.print();
  };

  const getStatusConfig = (status: string) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clients?.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <p className="text-gray-500 font-medium">Carregando pedidos...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <PageHeader 
        title={isClient ? 'Meus Pedidos' : 'Gestão de Pedidos'}
        subtitle={isClient ? 'Acompanhe suas compras' : 'Visualize e atualize o status das vendas'}
      />

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
            <FileText className="text-gray-300" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum pedido encontrado</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            {isClient 
              ? 'Você ainda não realizou nenhuma compra. Visite o catálogo para começar.' 
              : 'Nenhum pedido recebido até o momento.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 no-print">
             <div className="flex-1">
               <Input 
                  placeholder="Buscar por ID ou Cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<Search size={18} />}
                  className="bg-gray-50 border-transparent focus:bg-white"
               />
             </div>
             <div className="w-full md:w-64 relative">
               <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
               <select
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
                 className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-transparent rounded-lg text-sm text-gray-700 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer"
               >
                 <option value="all">Todos os Status</option>
                 {ORDER_STATUSES.map(s => (
                   <option key={s.value} value={s.value}>{s.label}</option>
                 ))}
               </select>
               <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none opacity-50" />
             </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
               <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
                 Nenhum pedido corresponde aos filtros selecionados.
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
                      "bg-white rounded-xl border transition-all duration-200 group",
                      isExpanded ? "border-indigo-200 shadow-md ring-1 ring-indigo-50 print-content" : "border-gray-200 shadow-sm hover:shadow-md no-print"
                    )}
                  >
                    {/* Main Row */}
                    <div 
                      className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 cursor-pointer"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    >
                      {/* Left Info */}
                      <div className="flex items-start gap-4 flex-1">
                        <div className={cn(
                          "h-12 w-12 rounded-xl hidden sm:flex items-center justify-center shrink-0 transition-colors",
                          isExpanded ? "bg-indigo-100 text-indigo-700" : "bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                        )}>
                          <FileText size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-gray-900 text-lg">#{order.id.slice(0, 8)}</h3>
                            {!canEdit && (
                              <Badge className={cn(statusConfig.color)}>
                                <StatusIcon size={12} className="mr-1" />
                                {statusConfig.label}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
                            {/* Detailed Timestamp */}
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Calendar size={14} className="text-gray-400" />
                              Enviado em: {formatDateTime(order.created_at)}
                            </span>
                            {!isClient && (
                              <span className="flex items-center gap-1.5 font-medium text-gray-700 text-xs">
                                <User size={14} className="text-gray-400" />
                                {order.clients?.nome_fantasia || 'Cliente Desconhecido'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Actions & Status Control */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-4 lg:pt-0 mt-2 lg:mt-0 no-print">
                        
                        {/* Status Selector for Admin/Seller */}
                        {canEdit ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <div className="relative">
                              {updatingStatus === order.id && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-lg">
                                  <Loader2 className="animate-spin text-indigo-600" size={16} />
                                </div>
                              )}
                              <select
                                value={order.status}
                                onChange={(e) => handleStatusChange(order.id, e.target.value, order.status_history, e as any)}
                                className={cn(
                                  "appearance-none pl-9 pr-8 py-2 rounded-lg text-sm font-bold border outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer transition-all",
                                  statusConfig.color,
                                  "focus:ring-indigo-500/20"
                                )}
                              >
                                {ORDER_STATUSES.map(s => (
                                  <option key={s.value} value={s.value} className="bg-white text-gray-900">
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                              <StatusIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-70" />
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                            </div>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-6 ml-auto sm:ml-0">
                          <div className="text-right">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total</p>
                            <p className="text-xl font-bold text-gray-900">{formatCurrency(order.total_amount)}</p>
                          </div>
                          <div className={cn(
                            "p-2 rounded-full transition-colors border",
                            isExpanded 
                              ? "bg-indigo-50 text-indigo-600 border-indigo-100" 
                              : "text-gray-400 border-transparent group-hover:bg-gray-50"
                          )}>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/30 p-6 animate-in slide-in-from-top-2">
                        
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

                        <div className="flex justify-between items-center mb-4 no-print">
                          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <PackageCheck size={18} className="text-indigo-600" />
                            Itens do Pedido
                          </h4>
                          <div className="flex gap-2">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={(e) => handlePrint(e)}
                              leftIcon={<Printer size={14} />}
                            >
                              Imprimir
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={(e) => generatePDF(order, e)}
                              leftIcon={<Download size={14} />}
                            >
                              Baixar PDF
                            </Button>
                          </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                              <tr>
                                <th className="px-4 py-3 font-semibold">Produto</th>
                                <th className="px-4 py-3 text-center font-semibold">Qtd.</th>
                                <th className="px-4 py-3 text-right font-semibold">Preço Unit.</th>
                                <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(!order.order_items || order.order_items.length === 0) ? (
                                <tr>
                                  <td colSpan={4} className="p-8 text-center text-gray-500">
                                    <AlertTriangle className="mx-auto mb-2 text-orange-400" size={24} />
                                    Não foi possível carregar os itens deste pedido.
                                  </td>
                                </tr>
                              ) : (
                                order.order_items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-3">
                                      {item.products ? (
                                        <>
                                          <p className="font-medium text-gray-900">{item.products.name}</p>
                                          <p className="text-xs text-gray-500 font-mono">{item.products.sku}</p>
                                        </>
                                      ) : (
                                        <p className="text-gray-400 italic">Produto Indisponível (Excluído)</p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-600 font-medium">
                                      {item.quantity}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">
                                      {formatCurrency(item.unit_price)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                      {formatCurrency(item.subtotal)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot className="bg-gray-50/80 font-bold text-gray-900 border-t border-gray-200">
                              <tr>
                                <td colSpan={3} className="px-4 py-3 text-right text-gray-600">Total Final</td>
                                <td className="px-4 py-3 text-right text-indigo-600 text-lg">{formatCurrency(order.total_amount)}</td>
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
    </div>
  );
}
