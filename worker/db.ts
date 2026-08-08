import type { Env } from './types';

export const makeId=(prefix:string)=>`${prefix}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}`;
export const now=()=>new Date().toISOString();
export const nullable=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
export const number=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
export const integer=(value:unknown,fallback=0)=>Math.max(0,Math.trunc(number(value,fallback)));

export async function bootstrap(env:Env){
  const [customersR,productsR,variantsR,salesR,itemsR,entriesR,expensesR,pricingR,suppliersR,purchasesR,purchaseItemsR,receivablesR,movementsR,returnsR,returnItemsR,creditsR,countsR,countItemsR,ownerR]=await Promise.all([
    env.DB.prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM products ORDER BY status ASC, updated_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM product_variants ORDER BY created_at ASC`).all(),
    env.DB.prepare(`SELECT s.*,c.name AS customer_name,c.phone AS customer_phone FROM sales s JOIN customers c ON c.id=s.customer_id WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC`).all(),
    env.DB.prepare(`SELECT si.*,p.name AS product_name,v.color,v.size FROM sale_items si JOIN sales s ON s.id=si.sale_id JOIN products p ON p.id=si.product_id JOIN product_variants v ON v.id=si.variant_id WHERE s.deleted_at IS NULL ORDER BY si.rowid ASC`).all(),
    env.DB.prepare(`SELECT e.*,p.name AS product_name FROM stock_entries e JOIN products p ON p.id=e.product_id WHERE e.deleted_at IS NULL ORDER BY e.entry_date DESC,e.created_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM expenses ORDER BY expense_date DESC,created_at DESC`).all(),
    env.DB.prepare(`SELECT ph.*,p.name AS product_name,v.color,v.size FROM pricing_history ph JOIN products p ON p.id=ph.product_id JOIN product_variants v ON v.id=ph.variant_id ORDER BY ph.created_at DESC LIMIT 500`).all(),
    env.DB.prepare(`SELECT * FROM suppliers ORDER BY active DESC,name ASC`).all(),
    env.DB.prepare(`SELECT pu.*,s.name AS supplier_name FROM purchases pu JOIN suppliers s ON s.id=pu.supplier_id ORDER BY pu.purchase_date DESC,pu.created_at DESC`).all(),
    env.DB.prepare(`SELECT pi.*,p.name AS product_name,v.color,v.size,v.sku FROM purchase_items pi JOIN products p ON p.id=pi.product_id JOIN product_variants v ON v.id=pi.variant_id ORDER BY pi.rowid ASC`).all(),
    env.DB.prepare(`SELECT ar.*,s.number AS sale_number,c.name AS customer_name FROM accounts_receivable ar JOIN sales s ON s.id=ar.sale_id JOIN customers c ON c.id=s.customer_id WHERE s.deleted_at IS NULL ORDER BY COALESCE(ar.due_date,substr(ar.created_at,1,10)) ASC,ar.created_at DESC`).all(),
    env.DB.prepare(`SELECT m.*,p.name AS product_name,v.color,v.size FROM inventory_movements m JOIN products p ON p.id=m.product_id JOIN product_variants v ON v.id=m.variant_id ORDER BY m.created_at DESC LIMIT 2000`).all(),
    env.DB.prepare(`SELECT r.*,s.number AS sale_number,c.name AS customer_name FROM returns r JOIN sales s ON s.id=r.sale_id JOIN customers c ON c.id=s.customer_id WHERE s.deleted_at IS NULL AND s.order_status<>'Cancelado' ORDER BY r.created_at DESC`).all(),
    env.DB.prepare(`SELECT ri.*,p.name AS product_name,v.color,v.size FROM return_items ri JOIN returns r ON r.id=ri.return_id JOIN sales s ON s.id=r.sale_id JOIN products p ON p.id=ri.product_id JOIN product_variants v ON v.id=ri.variant_id WHERE s.deleted_at IS NULL AND s.order_status<>'Cancelado' ORDER BY ri.rowid ASC`).all(),
    env.DB.prepare(`SELECT ccm.*,c.name AS customer_name,s.number AS sale_number FROM customer_credit_movements ccm JOIN customers c ON c.id=ccm.customer_id LEFT JOIN sales s ON s.id=ccm.sale_id ORDER BY ccm.created_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM inventory_counts ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT ici.*,p.name AS product_name,v.color,v.size FROM inventory_count_items ici JOIN products p ON p.id=ici.product_id JOIN product_variants v ON v.id=ici.variant_id ORDER BY ici.rowid ASC`).all(),
    env.DB.prepare(`SELECT * FROM owner_transactions ORDER BY transaction_date DESC,created_at DESC`).all()
  ]);

  const variants=(variantsR.results as any[]).map(v=>{const cash=Number(v.cash_price||v.sale_price||0);const card=Number(v.card_price||cash);return{id:v.id,productId:v.product_id,color:v.color,size:v.size,sku:v.sku,stock:Number(v.stock),minStock:Number(v.min_stock),averageCost:Number(v.average_cost),salePrice:cash,cashPrice:cash,cardPrice:card,active:!!v.active,imageKey:v.image_key||null,imageUrl:v.image_key?`/media/${v.image_key}`:null}});
  const products=(productsR.results as any[]).map(p=>({id:p.id,name:p.name,category:p.category,collection:p.collection,status:p.status,imageKey:p.image_key||null,imageUrl:p.image_key?`/media/${p.image_key}`:null,createdAt:p.created_at,updatedAt:p.updated_at,variants:variants.filter(v=>v.productId===p.id)}));
  const items=(itemsR.results as any[]).map(i=>({id:i.id,saleId:i.sale_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,quantity:Number(i.quantity),unitPrice:Number(i.unit_price),unitCost:Number(i.unit_cost)}));
  const sales=(salesR.results as any[]).map(s=>{const creditUsed=Number(s.credit_used||0),total=Number(s.total);return{id:s.id,number:s.number,customerId:s.customer_id,customerName:s.customer_name,customerPhone:s.customer_phone,orderStatus:s.order_status,paymentStatus:s.payment_status,paymentMethod:s.payment_method,subtotal:Number(s.subtotal),discount:Number(s.discount),creditUsed,total,amountDue:Math.max(0,total-creditUsed),costTotal:Number(s.cost_total),profit:Number(s.profit),deliveryMethod:s.delivery_method||null,deliveryAddress:s.delivery_address||null,promisedDate:s.promised_date||null,orderNotes:s.order_notes||null,createdAt:s.created_at,deliveredAt:s.delivered_at||null,items:items.filter(i=>i.saleId===s.id)}});
  const customerCredits=(creditsR.results as any[]).map(c=>({id:c.id,customerId:c.customer_id,customerName:c.customer_name,saleId:c.sale_id||null,saleNumber:c.sale_number||null,returnId:c.return_id||null,type:c.type,amount:Number(c.amount),note:c.note||null,createdAt:c.created_at}));
  const creditByCustomer=new Map<string,number>();for(const c of customerCredits)creditByCustomer.set(c.customerId,(creditByCustomer.get(c.customerId)||0)+c.amount);
  const customers=(customersR.results as any[]).map(c=>({id:c.id,name:c.name,phone:c.phone,instagram:c.instagram,email:c.email,city:c.city,tags:parseTags(c.tags),notes:c.notes,creditBalance:Math.max(0,creditByCustomer.get(c.id)||0),createdAt:c.created_at}));
  const entries=(entriesR.results as any[]).map(e=>({id:e.id,productId:e.product_id,productName:e.product_name,description:e.description,entryDate:e.entry_date,totalUnits:Number(e.total_units),totalCost:Number(e.total_cost),createdAt:e.created_at}));
  const expenses=(expensesR.results as any[]).map(e=>({id:e.id,description:e.description,category:e.category,amount:Number(e.amount),expenseDate:e.expense_date,recurring:!!e.recurring,status:e.status||'Pago',dueDate:e.due_date||null,paidAt:e.paid_at||null,beneficiary:e.beneficiary||null,notes:e.notes,createdAt:e.created_at}));
  const pricing=(pricingR.results as any[]).map(r=>({id:r.id,productId:r.product_id,variantId:r.variant_id,productName:r.product_name,color:r.color,size:r.size,pieceCost:Number(r.piece_cost),freightCost:Number(r.freight_cost),otherCost:Number(r.other_cost),totalCost:Number(r.total_cost),targetMargin:Number(r.target_margin),cardFee:Number(r.card_fee),cashPrice:Number(r.cash_price),cardPrice:Number(r.card_price),appliedPrice:Number(r.applied_price),createdAt:r.created_at}));
  const suppliers=(suppliersR.results as any[]).map(s=>({id:s.id,name:s.name,phone:s.phone,instagram:s.instagram,email:s.email,cnpj:s.cnpj,notes:s.notes,active:!!s.active,createdAt:s.created_at,updatedAt:s.updated_at}));
  const purchaseItems=(purchaseItemsR.results as any[]).map(i=>({id:i.id,purchaseId:i.purchase_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,sku:i.sku,quantity:Number(i.quantity),unitCost:Number(i.unit_cost)}));
  const purchases=(purchasesR.results as any[]).map(p=>({id:p.id,number:p.number,supplierId:p.supplier_id,supplierName:p.supplier_name,purchaseDate:p.purchase_date,status:p.status,itemsSubtotal:Number(p.items_subtotal),freightCost:Number(p.freight_cost),otherCost:Number(p.other_cost),totalCost:Number(p.total_cost),totalUnits:Number(p.total_units),notes:p.notes,receivedAt:p.received_at,createdAt:p.created_at,updatedAt:p.updated_at,items:purchaseItems.filter(i=>i.purchaseId===p.id)}));
  const receivables=(receivablesR.results as any[]).map(r=>({id:r.id,saleId:r.sale_id,saleNumber:r.sale_number,customerName:r.customer_name,description:r.description,amount:Number(r.amount),dueDate:r.due_date,status:r.status,receivedAt:r.received_at,createdAt:r.created_at}));
  const movements=(movementsR.results as any[]).map(m=>({id:m.id,productId:m.product_id,variantId:m.variant_id,productName:m.product_name,color:m.color,size:m.size,type:m.type,quantity:Number(m.quantity),unitCost:m.unit_cost===null?null:Number(m.unit_cost),referenceType:m.reference_type,referenceId:m.reference_id,note:m.note,createdAt:m.created_at}));
  const returnItems=(returnItemsR.results as any[]).map(i=>({id:i.id,returnId:i.return_id,saleItemId:i.sale_item_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,quantity:Number(i.quantity),direction:i.direction,unitCost:Number(i.unit_cost),unitPrice:Number(i.unit_price)}));
  const returns=(returnsR.results as any[]).map(r=>({id:r.id,number:r.number,saleId:r.sale_id,saleNumber:r.sale_number,customerName:r.customer_name,type:r.type,refundAmount:Number(r.refund_amount),creditAmount:Number(r.credit_amount),returnedValue:Number(r.returned_value||0),exchangeValue:Number(r.exchange_value||0),debtOffset:Number(r.debt_offset||0),additionalAmount:Number(r.additional_amount||0),additionalPaymentStatus:r.additional_payment_status||null,notes:r.notes,createdAt:r.created_at,items:returnItems.filter(i=>i.returnId===r.id)}));
  const countItems=(countItemsR.results as any[]).map(i=>({id:i.id,countId:i.count_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,expectedQuantity:Number(i.expected_quantity),countedQuantity:Number(i.counted_quantity),difference:Number(i.difference)}));
  const inventoryCounts=(countsR.results as any[]).map(c=>({id:c.id,title:c.title,status:c.status,notes:c.notes,createdAt:c.created_at,appliedAt:c.applied_at,items:countItems.filter(i=>i.countId===c.id)}));
  const ownerTransactions=(ownerR.results as any[]).map(o=>({id:o.id,type:o.type,amount:Number(o.amount),transactionDate:o.transaction_date,notes:o.notes||null,createdAt:o.created_at}));

  const validSales=sales.filter(s=>s.orderStatus!=='Cancelado');
  const grossSales=validSales.reduce((a,s)=>a+s.total,0);
  const baseCost=validSales.reduce((a,s)=>a+s.costTotal,0);
  const returnedRevenue=returnItems.filter(i=>i.direction==='Entrada').reduce((a,i)=>a+i.quantity*i.unitPrice,0);
  const exchangeRevenue=returnItems.filter(i=>i.direction==='Saída').reduce((a,i)=>a+i.quantity*i.unitPrice,0);
  const returnedCost=returnItems.filter(i=>i.direction==='Entrada').reduce((a,i)=>a+i.quantity*i.unitCost,0);
  const exchangeCost=returnItems.filter(i=>i.direction==='Saída').reduce((a,i)=>a+i.quantity*i.unitCost,0);
  const revenue=Math.max(0,grossSales-returnedRevenue+exchangeRevenue);
  const cost=Math.max(0,baseCost-returnedCost+exchangeCost);
  const expenseTotal=expenses.filter(e=>e.status==='Pago').reduce((a,e)=>a+e.amount,0);
  const grossProfit=revenue-cost;const netProfit=grossProfit-expenseTotal;
  const activeVariants=variants.filter(v=>v.active);
  const stockUnits=activeVariants.reduce((a,v)=>a+v.stock,0);
  const stockCost=activeVariants.reduce((a,v)=>a+v.stock*v.averageCost,0);
  const stockPotentialRevenue=activeVariants.reduce((a,v)=>a+v.stock*v.cashPrice,0);
  const stockPotentialProfit=stockPotentialRevenue-stockCost;
  const pendingPurchases=purchases.filter(p=>p.status==='Pedido').reduce((a,p)=>a+p.totalCost,0);
  const receivablePending=receivables.filter(r=>r.status==='Pendente').reduce((a,r)=>a+r.amount,0);
  const payableExpenses=expenses.filter(e=>e.status==='Pendente').reduce((a,e)=>a+e.amount,0);
  const customerCreditOutstanding=[...creditByCustomer.values()].reduce((a,v)=>a+Math.max(0,v),0);
  const ownerContributions=ownerTransactions.filter(o=>o.type==='Aporte').reduce((a,o)=>a+o.amount,0);
  const ownerWithdrawals=ownerTransactions.filter(o=>o.type==='Retirada').reduce((a,o)=>a+o.amount,0);
  const ownerPayroll=ownerTransactions.filter(o=>o.type==='Pró-labore').reduce((a,o)=>a+o.amount,0);
  const retainedProfit=netProfit-ownerWithdrawals-ownerPayroll;
  const suggestedWithdrawal=Math.max(0,retainedProfit-payableExpenses-customerCreditOutstanding);
  const workingCapitalPosition=stockCost+receivablePending+ownerContributions-payableExpenses-customerCreditOutstanding-ownerWithdrawals-ownerPayroll;

  return {customers,products,sales,entries,expenses,pricing,suppliers,purchases,receivables,movements,returns,customerCredits,inventoryCounts,ownerTransactions,summary:{revenue,grossProfit,expenses:expenseTotal,netProfit,orders:validSales.length,ticketAverage:validSales.length?revenue/validSales.length:0,stockUnits,stockCost,stockPotentialRevenue,stockPotentialProfit,pendingPurchases,receivablePending,payableExpenses,customerCreditOutstanding,ownerContributions,ownerWithdrawals,ownerPayroll,retainedProfit,suggestedWithdrawal,workingCapitalPosition}};
}
function parseTags(value:string){try{const x=JSON.parse(value);return Array.isArray(x)?x:[]}catch{return[]}}
