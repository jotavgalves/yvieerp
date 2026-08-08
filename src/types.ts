export type OrderStatus = 'Separando' | 'Pronto' | 'Entregue' | 'Cancelado';
export type PaymentStatus = 'Pago' | 'Pendente';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  instagram: string | null;
  email: string | null;
  city: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
}

export interface Variant {
  id: string;
  productId: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  stock: number;
  minStock: number;
  averageCost: number;
  salePrice: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  collection: string | null;
  status: 'Ativo' | 'Arquivado';
  variants: Variant[];
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  variantId: string;
  productName: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface Sale {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  costTotal: number;
  profit: number;
  createdAt: string;
  items: SaleItem[];
}

export interface StockEntry {
  id: string;
  productId: string;
  productName: string;
  description: string;
  entryDate: string;
  totalUnits: number;
  totalCost: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
  recurring: boolean;
  notes: string | null;
  createdAt: string;
}

export interface PricingRecord {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  color: string | null;
  size: string | null;
  pieceCost: number;
  freightCost: number;
  otherCost: number;
  totalCost: number;
  targetMargin: number;
  cardFee: number;
  cashPrice: number;
  cardPrice: number;
  appliedPrice: number;
  createdAt: string;
}

export interface Summary {
  revenue: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  orders: number;
  ticketAverage: number;
  stockUnits: number;
  stockCost: number;
}

export interface BootstrapData {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  entries: StockEntry[];
  expenses: Expense[];
  pricing: PricingRecord[];
  summary: Summary;
}
