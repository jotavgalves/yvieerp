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
  creditBalance: number;
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
  cashPrice: number;
  cardPrice: number;
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
  customerPhone: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  creditUsed: number;
  total: number;
  amountDue: number;
  costTotal: number;
  profit: number;
  deliveryMethod: string | null;
  deliveryAddress: string | null;
  promisedDate: string | null;
  orderNotes: string | null;
  createdAt: string;
  deliveredAt: string | null;
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
  status: 'Pago' | 'Pendente';
  dueDate: string | null;
  paidAt: string | null;
  beneficiary: string | null;
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

export interface Receivable {
  id: string;
  saleId: string;
  saleNumber: string;
  customerName: string;
  description: string;
  amount: number;
  dueDate: string | null;
  status: 'Pendente' | 'Recebido' | 'Cancelado';
  receivedAt: string | null;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  color: string | null;
  size: string | null;
  type: 'Entrada' | 'Venda' | 'Ajuste' | 'Cancelamento' | 'Devolução';
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  saleItemId: string | null;
  productId: string;
  variantId: string;
  productName: string;
  color: string | null;
  size: string | null;
  quantity: number;
  direction: 'Entrada' | 'Saída';
  unitCost: number;
  unitPrice: number;
}

export interface ReturnRecord {
  id: string;
  number: string;
  saleId: string;
  saleNumber: string;
  customerName: string;
  type: 'Devolução' | 'Troca';
  refundAmount: number;
  creditAmount: number;
  notes: string | null;
  createdAt: string;
  items: ReturnItem[];
}

export interface CustomerCreditMovement {
  id: string;
  customerId: string;
  customerName: string;
  saleId: string | null;
  saleNumber: string | null;
  returnId: string | null;
  type: 'Crédito' | 'Uso' | 'Estorno' | 'Ajuste';
  amount: number;
  note: string | null;
  createdAt: string;
}

export interface InventoryCountItem {
  id: string;
  countId: string;
  productId: string;
  variantId: string;
  productName: string;
  color: string | null;
  size: string | null;
  expectedQuantity: number;
  countedQuantity: number;
  difference: number;
}

export interface InventoryCount {
  id: string;
  title: string;
  status: 'Rascunho' | 'Aplicado' | 'Cancelado';
  notes: string | null;
  createdAt: string;
  appliedAt: string | null;
  items: InventoryCountItem[];
}

export interface OwnerTransaction {
  id: string;
  type: 'Aporte' | 'Pró-labore' | 'Retirada';
  amount: number;
  transactionDate: string;
  notes: string | null;
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
  stockPotentialRevenue: number;
  stockPotentialProfit: number;
  pendingPurchases: number;
  receivablePending: number;
  payableExpenses: number;
  customerCreditOutstanding: number;
  ownerContributions: number;
  ownerWithdrawals: number;
  ownerPayroll: number;
  retainedProfit: number;
  suggestedWithdrawal: number;
  workingCapitalPosition: number;
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
  receivables: Receivable[];
  movements: InventoryMovement[];
  returns: ReturnRecord[];
  customerCredits: CustomerCreditMovement[];
  inventoryCounts: InventoryCount[];
  ownerTransactions: OwnerTransaction[];
  summary: Summary;
}
