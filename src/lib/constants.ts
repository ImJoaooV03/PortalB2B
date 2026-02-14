import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  DollarSign, 
  PackageCheck, 
  XCircle 
} from 'lucide-react';

export const ORDER_STATUSES = [
  { 
    value: 'rascunho', 
    label: 'Rascunho', 
    icon: FileText, 
    style: 'bg-gray-100 text-gray-800 border-gray-300' 
  },
  { 
    value: 'enviado', 
    label: 'Enviado', 
    icon: Clock, 
    style: 'bg-yellow-100 text-yellow-800 border-yellow-300' 
  },
  { 
    value: 'aprovado', 
    label: 'Aprovado', 
    icon: CheckCircle2, 
    style: 'bg-blue-100 text-blue-800 border-blue-300' 
  },
  { 
    value: 'faturado', 
    label: 'Faturado', 
    icon: DollarSign, 
    style: 'bg-indigo-100 text-indigo-800 border-indigo-300' 
  },
  { 
    value: 'entregue', 
    label: 'Entregue', 
    icon: PackageCheck, 
    style: 'bg-green-100 text-green-800 border-green-300' 
  },
  { 
    value: 'cancelado', 
    label: 'Cancelado', 
    icon: XCircle, 
    style: 'bg-red-100 text-red-800 border-red-300 line-through decoration-1' 
  },
];

export const getStatusConfig = (status: string) => {
  return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
};
