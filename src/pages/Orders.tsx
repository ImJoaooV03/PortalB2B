import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Order, StatusHistoryItem } from '../lib/types';
import { 
  Loader2, FileText, Calendar, User, ChevronDown, ChevronUp, CheckCircle2, 
  XCircle, PackageCheck, Clock, Search, Filter, Download, AlertTriangle, 
  Printer, History, DollarSign
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, cn } from '../lib/utils';
import PageHeader from '../components/ui/PageHeader';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Monochrome Status Configuration (Same as SalesManagement)
const ORDER_STATUSES = [
  { value: 'rascunho', label: 'Rascunho', icon: FileText, style: 'bg-white text-black border border-black border-dashed' },
  { value: 'enviado', label: 'Enviado', icon: Clock, style: 'bg-white text-black border border-black' },
  { value: 'aprovado', label: 'Aprovado', icon: CheckCircle2, style: 'bg-black text-white border border-black' },
  { value: 'faturado', label: 'Faturado', icon: DollarSign, style: 'bg-black text-white border border-black ring-2 ring-white ring-offset-1 ring-offset-black' },
  { value: 'entregue', label: 'Entregue', icon: PackageCheck, style: 'bg-black text-white border border-black' },
  { value: 'cancelado', label: 'Cancelado', icon: XCircle, style: 'bg-white text-black border border-black line-through decoration-1' },
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
      toast.success('Status atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const generatePDF = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.order_items || order.order_items.length === 0) {
      toast.error('Pedido sem itens.');
      return;
    }
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text('CONFERÊNCIA DE PEDIDO', 14, 22);
      doc.setFontSize(10);
      doc.text(`GERADO EM: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
      
      doc.setDrawColor(0);
      doc.rect(14, 35, 182, 40);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`PEDIDO #${order.id.slice(0, 8).toUpperCase()}`, 20, 45);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`DATA: ${formatDate(order.created_at)}`, 20, 52);
      doc.text(`STATUS: ${order.status.toUpperCase()}`, 20, 58);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text('CLIENTE', 110, 45);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`${order.clients?.razao_social || 'N/A'}`, 110, 52);
      
      const tableBody = order.order_items.map(item => [
        item.products?.sku || 'N/A',
        item.products?.name || 'PRODUTO INDISPONÍVEL',
        item.quantity,
        formatCurrency(item.unit_price),
        formatCurrency(item.subtotal)
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['SKU', 'PRODUTO', 'QTD.', 'UNIT.', 'TOTAL']],
        body: tableBody,
        theme: 'plain',
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3, lineColor: 0, lineWidth: 0.1 },
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

  const getStatusConfig = (status: string) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
  };

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
                 className="w-full h-10 pl-10 pr-4 bg-white border border-black text-sm font-bold text-black focus:ring-1 focus:ring-black outline-none appearance-none cursor-pointer uppercase"
               >
                 <option value="all">TODOS OS STATUS</option>
                 {ORDER_STATUSES.map(s => (
                   <option key={s.value} value={s.value}>{s.label.toUpperCase()}</option>
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
                              <span className={cn("text-xs font-bold uppercase px-2 py-0.5 flex items-center gap-1", statusConfig.style)}>
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
                                  "appearance-none pl-9 pr-8 py-2 text-sm font-bold border-2 border-black outline-none cursor-pointer uppercase",
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
                        <div className="flex justify-between items-center mb-4 no-print">
                          <h4 className="text-sm font-bold text-black flex items-center gap-2 uppercase">
                            <PackageCheck size={18} />
                            Itens do Pedido
                          </h4>
                          <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={(e) => handlePrint(e)} leftIcon={<Printer size={14} />}>
                              IMPRIMIR
                            </Button>
                            <Button variant="secondary" size="sm" onClick={(e) => generatePDF(order, e)} leftIcon={<Download size={14} />}>
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
                                <th className="px-4 py-3 text-right">Unit.</th>
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
    </div>
  );
}
