import type { Env } from './types';

export const makeId=(prefix:string)=>`${prefix}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}`;
export const now=()=>new Date().toISOString();
export const nullable=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
export const number=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
export const integer=(value:unknown,fallback=0)=>Math.max(0,Math.trunc(number(value,fallback)));

export async function bootstrap(env:Env){
  const [customersR,productsR,variantsR,salesR,itemsR,entriesR,expensesR,pricingR,suppliersR,purchasesR,purchaseItemsR,receivablesR,movementsR,returnsR,returnItemsR,countsR,countItemsR]=await Promise.all([
    env.DB.prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM products ORDER BY status ASC, updated_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM product_variants ORDER BY created_at ASC`).all(),
    env.DB.prepare(`SELECT s.*, c.name AS customer_name FROM sales s JOIN customers c ON c.id=s.customer_id ORDER BY s.created_at DESC`).all(),
    env.DB.prepare(`SELECT si.*, p.name AS product_name, v.color, v.size FROM sale_items si JOIN products p ON p.id=si.product_id JOIN product_variants v ON v.id=si.variant_id ORDER BY si.rowid ASC`).all(),
    env.DB.prepare(`SELECT e.*, p.name AS product_name FROM stock_entries e JOIN products p ON p.id=e.product_id ORDER BY e.entry_date DESC, e.created_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC`).all(),
    env.DB.prepare(`SELECT ph.*, p.name AS product_name, v.color, v.size FROM pricing_history ph JOIN products p ON p.id=ph.product_id JOIN product_variants v ON v.id=ph.variant_id ORDER BY ph.created_at DESC LIMIT 500`).all(),
    env.DB.prepare(`SELECT * FROM suppliers ORDER BY active DESC,name ASC`).all(),
    env.DB.prepare(`SELECT pu.*,s.name AS supplier_name FROM purchases pu JOIN suppliers s ON s.id=pu.supplier_id ORDER BY pu.purchase_date DESC,pu.created_at DESC`).all(),
    env.DB.prepare(`SELECT pi.*,p.name AS product_name,v.color,v.size,v.sku FROM purchase_items pi JOIN products p ON p.id=pi.product_id JOIN product_variants v ON v.id=pi.variant_id ORDER BY pi.rowid ASC`).all(),
    env.DB.prepare(`SELECT ar.*,s.number AS sale_number,c.name AS customer_name FROM accounts_receivable ar JOIN sales s ON s.id=ar.sale_id JOIN customers c ON c.id=s.customer_id ORDER BY COALESCE(ar.due_date,substr(ar.created_at,1,10)) ASC,ar.created_at DESC`).all(),
    env.DB.prepare(`SELECT m.*,p.name AS product_name,v.color,v.size FROM inventory_movements m JOIN products p ON p.id=m.product_id JOIN product_variants v ON v.id=m.variant_id ORDER BY m.created_at DESC LIMIT 1500`).all(),
    env.DB.prepare(`SELECT r.*,s.number AS sale_number,c.name AS customer_name FROM returns r JOIN sales s ON s.id=r.sale_id JOIN customers c ON c.id=s.customer_id ORDER BY r.created_at DESC`).all(),
    env.DB.prepare(`SELECT ri.*,p.name AS product_name,v.color,v.size FROM return_items ri JOIN products p ON p.id=ri.product_id JOIN product_variants v ON v.id=ri.variant_id ORDER BY ri.rowid ASC`).all(),
    env.DB.prepare(`SELECT * FROM inventory_counts ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT ici.*,p.name AS product_name,v.color,v.size FROM inventory_count_items ici JOIN products p ON p.id=ici.product_id JOIN product_variants v ON v.id=ici.variant_id ORDER BY ici.rowid ASC`).all()
  ]);

  const variants=(variantsR.results as any[]).map(v=>({id:v.id,productId:v.product_id,color:v.color,size:v.size,sku:v.sku,stock:v.stock,minStock:v.min_stock,averageCost:v.average_cost,salePrice:v.sale_price,active:!!v.active,imageKey:v.image_key||null,imageUrl:v.image_key?`/media/${v.image_key}`:null}));
  const products=(productsR.results as any[]).map(p=>({id:p.id,name:p.name,category:p.category,collection:p.collection,status:p.status,imageKey:p.image_key||null,imageUrl:p.image_key?`/media/${p.image_key}`:null,createdAt:p.created_at,updatedAt:p.updated_at,variants:variants.filter(v=>v.productId===p.id)}));
  const items=(itemsR.results as any[]).map(i=>({id:i.id,saleId:i.sale_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,quantity:i.quantity,unitPrice:i.unit_price,unitCost:i.unit_cost}));
  const sales=(salesR.results as any[]).map(s=>({id:s.id,number:s.number,customerId:s.customer_id,customerName:s.customer_name,orderStatus:s.order_status,paymentStatus:s.payment_status,paymentMethod:s.payment_method,subtotal:s.subtotal,discount:s.discount,total:s.total,costTotal:s.cost_total,profit:s.profit,createdAt:s.created_at,deliveredAt:s.delivered_at||null,items:items.filter(i=>i.saleId===s.id)}));
  const customers=(customersR.results as any[]).map(c=>({id:c.id,name:c.name,phone:c.phone,instagram:c.instagram,email:c.email,city:c.city,tags:parseTags(c.tags),notes:c.notes,createdAt:c.created_at}));
  const entries=(entriesR.results as any[]).map(e=>({id:e.id,productId:e.product_id,productName:e.product_name,description:e.description,entryDate:e.entry_date,totalUnits:e.total_units,totalCost:e.total_cost,createdAt:e.created_at}));
  const expenses=(expensesR.results as any[]).map(e=>({id:e.id,description:e.description,category:e.category,amount:e.amount,expenseDate:e.expense_date,recurring:!!e.recurring,status:e.status||'Pago',dueDate:e.due_date||null,paidAt:e.paid_at||null,beneficiary:e.beneficiary||null,notes:e.notes,createdAt:e.created_at}));
  const pricing=(pricingR.results as any[]).map(r=>({id:r.id,productId:r.product_id,variantId:r.variant_id,productName:r.product_name,color:r.color,size:r.size,pieceCost:r.piece_cost,freightCost:r.freight_cost,otherCost:r.other_cost,totalCost:r.total_cost,targetMargin:r.target_margin,cardFee:r.card_fee,cashPrice:r.cash_price,cardPrice:r.card_price,appliedPrice:r.applied_price,createdAt:r.created_at}));
  const suppliers=(suppliersR.results as any[]).map(s=>({id:s.id,name:s.name,phone:s.phone,instagram:s.instagram,email:s.email,cnpj:s.cnpj,notes:s.notes,active:!!s.active,createdAt:s.created_at,updatedAt:s.updated_at}));
  const purchaseItems=(purchaseItemsR.results as any[]).map(i=>({id:i.id,purchaseId:i.purchase_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,sku:i.sku,quantity:i.quantity,unitCost:i.unit_cost}));
  const purchases=(purchasesR.results as any[]).map(p=>({id:p.id,number:p.number,supplierId:p.supplier_id,supplierName:p.supplier_name,purchaseDate:p.purchase_date,status:p.status,itemsSubtotal:p.items_subtotal,freightCost:p.freight_cost,otherCost:p.other_cost,totalCost:p.total_cost,totalUnits:p.total_units,notes:p.notes,receivedAt:p.received_at,createdAt:p.created_at,updatedAt:p.updated_at,items:purchaseItems.filter(i=>i.purchaseId===p.id)}));
  const receivables=(receivablesR.results as any[]).map(r=>({id:r.id,saleId:r.sale_id,saleNumber:r.sale_number,customerName:r.customer_name,description:r.description,amount:r.amount,dueDate:r.due_date,status:r.status,receivedAt:r.received_at,createdAt:r.created_at}));
  const movements=(movementsR.results as any[]).map(m=>({id:m.id,productId:m.product_id,variantId:m.variant_id,productName:m.product_name,color:m.color,size:m.size,type:m.type,quantity:m.quantity,unitCost:m.unit_cost,referenceType:m.reference_type,referenceId:m.reference_id,note:m.note,createdAt:m.created_at}));
  const returnItems=(returnItemsR.results as any[]).map(i=>({id:i.id,returnId:i.return_id,saleItemId:i.sale_item_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,quantity:i.quantity,direction:i.direction,unitCost:i.unit_cost,unitPrice:i.unit_price}));
  const returns=(returnsR.results as any[]).map(r=>({id:r.id,number:r.number,saleId:r.sale_id,saleNumber:r.sale_number,customerName:r.customer_name,type:r.type,refundAmount:r.refund_amount,creditAmount:r.credit_amount,notes:r.notes,createdAt:r.created_at,items:returnItems.filter(i=>i.returnId===r.id)}));
  const countItems=(countItemsR.results as any[]).map(i=>({id:i.id,countId:i.count_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,expectedQuantity:i.expected_quantity,countedQuantity:i.counted_quantity,difference:i.difference}));
  const inventoryCounts=(countsR.results as any[]).map(c=>({id:c.id,title:c.title,status:c.status,notes:c.notes,createdAt:c.created_at,appliedAt:c.applied_at,items:countItems.filter(i=>i.countId===c.id)}));

  const validSales=sales.filter(s=>s.orderStatus!=='Cancelado');
  const grossSales=validSales.reduce((a,s)=>a+s.total,0);
  const baseCost=validSales.reduce((a,s)=>a+s.costTotal,0);
  const returnValue=returns.reduce((a,r)=>a+r.refundAmount+r.creditAmount,0);
  const returnedCost=returnItems.filter(i=>i.direction==='Entrada').reduce((a,i)=>a+i.quantity*i.unitCost,0);
  const exchangeCost=returnItems.filter(i=>i.direction==='Saída').reduce((a,i)=>a+i.quantity*i.unitCost,0);
  const revenue=Math.max(0,grossSales-returnValue);
  const cost=Math.max(0,baseCost-returnedCost+exchangeCost);
  const expenseTotal=expenses.filter(e=>e.status==='Pago').reduce((a,e)=>a+e.amount,0);
  const activeVariants=variants.filter(v=>v.active);
  const stockUnits=activeVariants.reduce((a,v)=>a+v.stock,0);
  const stockCost=activeVariants.reduce((a,v)=>a+v.stock*v.averageCost,0);
  const stockPotentialRevenue=activeVariants.reduce((a,v)=>a+v.stock*v.salePrice,0);
  const stockPotentialProfit=stockPotentialRevenue-stockCost;
  const pendingPurchases=purchases.filter(p=>p.status==='Pedido').reduce((a,p)=>a+p.totalCost,0);
  const receivablePending=receivables.filter(r=>r.status==='Pendente').reduce((a,r)=>a+r.amount,0);
  const payableExpenses=expenses.filter(e=>e.status==='Pendente').reduce((a,e)=>a+e.amount,0);

  return {customers,products,sales,entries,expenses,pricing,suppliers,purchases,receivables,movements,returns,inventoryCounts,summary:{revenue,grossProfit:revenue-cost,expenses:expenseTotal,netProfit:revenue-cost-expenseTotal,orders:validSales.length,ticketAverage:validSales.length?revenue/validSales.length:0,stockUnits,stockCost,stockPotentialRevenue,stockPotentialProfit,pendingPurchases,receivablePending,payableExpenses}};
}
function parseTags(value:string){try{const x=JSON.parse(value);return Array.isArray(x)?x:[]}catch{return[]}}
