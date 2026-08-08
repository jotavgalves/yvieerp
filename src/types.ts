export type OrderStatus = 'Separando' | 'Pronto' | 'Entregue' | 'Cancelado';
export type PaymentStatus = 'Pago' | 'Pendente';
export type PurchaseStatus = 'Pedido' | 'Recebido' | 'Cancelado';

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
  imageKey: string | null;
  imageUrl: string | null;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  collection: string | null;
  status: 'Ativo' | 'Arquivado';
  imageKey: string | null;
  imageUrl: string | null;
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

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
  email: string | null;
  cnpj: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  variantId: string;
  productName: string;
  color: string | null;
  size: string | null;
  sku: string | null;
  quantity: number;
  unitCost: number;
}

export interface Purchase {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  status: PurchaseStatus;
  itemsSubtotal: number;
  freightCost: number;
  otherCost: number;
  totalCost: number;
  totalUnits: number;
  notes: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseItem[];
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
  stockPotentialRevenue: number;
  stockPotentialProfit: number;
  pendingPurchases: number;
}

export interface BootstrapData {
  customers: Customer[];
  products: Product[];
  sales: Sale[];
  entries: StockEntry[];
  expenses: Expense[];
  pricing: PricingRecord[];
  suppliers: Supplier[];
  purchases: Purchase[];
  summary: Summary;
}
