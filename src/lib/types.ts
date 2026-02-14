export type UserRole = 'admin' | 'vendedor' | 'cliente';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string | null;
  address?: string | null;
  role: UserRole;
  client_id?: string;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  image: string | null;
  base_price: number;
  attributes: any;
  status: 'active' | 'inactive';
  created_by: string;
  created_at: string;
}

export interface Client {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string | null;
  vendedor_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface PriceTable {
  id: string;
  client_id: string;
  vendedor_id: string;
  name: string;
  active: boolean;
  min_order: number;
  valid_from?: string | null; // New
  valid_until?: string | null; // New
  created_at: string;
  // Joined fields
  clients?: Client;
  profiles?: { full_name: string | null } | { full_name: string | null }[]; 
}

export interface PriceTableItem {
  id: string;
  price_table_id: string;
  product_id: string;
  price_type: 'base' | 'desconto' | 'fixo';
  value: number;
  min_quantity: number;
  // Joined fields
  products?: Product;
}

export interface StatusHistoryItem {
  status: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products: {
    name: string;
    sku: string;
  } | null;
}

export interface Order {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  client_id: string;
  status_history: StatusHistoryItem[];
  clients: {
    nome_fantasia: string;
    razao_social: string;
    cnpj?: string;
    vendedor_id?: string;
  };
  order_items: OrderItem[];
}
