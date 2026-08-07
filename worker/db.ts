import type { Env } from './types';

export const makeId=(prefix:string)=>`${prefix}_${crypto.randomUUID().replace(/-/g,'').slice(0,20)}`;
export const now=()=>new Date().toISOString();
export const nullable=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
export const number=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
export const integer=(value:unknown,fallback=0)=>Math.max(0,Math.trunc(number(value,fallback)));

export async function bootstrap(env:Env){
  const [customersR,productsR,variantsR,salesR,itemsR,entriesR,expensesR]=await Promise.all([
    env.DB.prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM products ORDER BY status ASC, updated_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM product_variants ORDER BY created_at ASC`).all(),
    env.DB.prepare(`SELECT s.*, c.name AS customer_name FROM sales s JOIN customers c ON c.id=s.customer_id ORDER BY s.created_at DESC`).all(),
    env.DB.prepare(`SELECT si.*, p.name AS product_name, v.color, v.size FROM sale_items si JOIN products p ON p.id=si.product_id JOIN product_variants v ON v.id=si.variant_id ORDER BY si.rowid ASC`).all(),
    env.DB.prepare(`SELECT e.*, p.name AS product_name FROM stock_entries e JOIN products p ON p.id=e.product_id ORDER BY e.entry_date DESC, e.created_at DESC`).all(),
    env.DB.prepare(`SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC`).all()
  ]);
  const variants=(variantsR.results as any[]).map(v=>({id:v.id,productId:v.product_id,color:v.color,size:v.size,sku:v.sku,stock:v.stock,minStock:v.min_stock,averageCost:v.average_cost,salePrice:v.sale_price,active:!!v.active}));
  const products=(productsR.results as any[]).map(p=>({id:p.id,name:p.name,category:p.category,collection:p.collection,status:p.status,createdAt:p.created_at,updatedAt:p.updated_at,variants:variants.filter(v=>v.productId===p.id)}));
  const items=(itemsR.results as any[]).map(i=>({id:i.id,saleId:i.sale_id,productId:i.product_id,variantId:i.variant_id,productName:i.product_name,color:i.color,size:i.size,quantity:i.quantity,unitPrice:i.unit_price,unitCost:i.unit_cost}));
  const sales=(salesR.results as any[]).map(s=>({id:s.id,number:s.number,customerId:s.customer_id,customerName:s.customer_name,orderStatus:s.order_status,paymentStatus:s.payment_status,paymentMethod:s.payment_method,subtotal:s.subtotal,discount:s.discount,total:s.total,costTotal:s.cost_total,profit:s.profit,createdAt:s.created_at,items:items.filter(i=>i.saleId===s.id)}));
  const customers=(customersR.results as any[]).map(c=>({id:c.id,name:c.name,phone:c.phone,instagram:c.instagram,email:c.email,city:c.city,tags:parseTags(c.tags),notes:c.notes,createdAt:c.created_at}));
  const entries=(entriesR.results as any[]).map(e=>({id:e.id,productId:e.product_id,productName:e.product_name,description:e.description,entryDate:e.entry_date,totalUnits:e.total_units,totalCost:e.total_cost,createdAt:e.created_at}));
  const expenses=(expensesR.results as any[]).map(e=>({id:e.id,description:e.description,category:e.category,amount:e.amount,expenseDate:e.expense_date,recurring:!!e.recurring,notes:e.notes,createdAt:e.created_at}));
  const validSales=sales.filter(s=>s.orderStatus!=='Cancelado');const revenue=validSales.reduce((a,s)=>a+s.total,0);const cost=validSales.reduce((a,s)=>a+s.costTotal,0);const expenseTotal=expenses.reduce((a,e)=>a+e.amount,0);const stockUnits=variants.filter(v=>v.active).reduce((a,v)=>a+v.stock,0);const stockCost=variants.filter(v=>v.active).reduce((a,v)=>a+v.stock*v.averageCost,0);
  return {customers,products,sales,entries,expenses,summary:{revenue,grossProfit:revenue-cost,expenses:expenseTotal,netProfit:revenue-cost-expenseTotal,orders:validSales.length,ticketAverage:validSales.length?revenue/validSales.length:0,stockUnits,stockCost}};
}
function parseTags(value:string){try{const x=JSON.parse(value);return Array.isArray(x)?x:[]}catch{return[]}}
