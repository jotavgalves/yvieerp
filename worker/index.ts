import { clearSessionCookie, createSession, passwordMatches, sessionCookie, verifySession } from './auth';
import { bootstrap, integer, makeId, now, nullable, number } from './db';
import type { Env } from './types';

const headers={
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer'
};
const json=(data:unknown,status=200,extra:HeadersInit={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
const fail=(message:string,status=400)=>json({error:message},status);
async function body<T=any>(request:Request):Promise<T>{try{return await request.json() as T}catch{throw new Error('JSON inválido.')}}
function sameOrigin(request:Request){const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin}
function saleNumber(){const d=new Date();const date=`${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;return `YV-${date}-${crypto.randomUUID().slice(0,4).toUpperCase()}`}

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return new Response(null,{status:404});
    try{
      if(url.pathname==='/api/auth/session'&&request.method==='GET')return json({authenticated:await verifySession(request,env)});
      if(url.pathname==='/api/auth/login'&&request.method==='POST'){
        if(!sameOrigin(request))return fail('Origem da requisição não autorizada.',403);
        const input=await body<{password?:string}>(request);if(!input.password||!(await passwordMatches(input.password,env)))return fail('Senha de acesso inválida.',401);
        const token=await createSession(env);return json({ok:true},200,{'Set-Cookie':sessionCookie(token,request)});
      }
      if(url.pathname==='/api/auth/logout'&&request.method==='POST'){if(!sameOrigin(request))return fail('Origem da requisição não autorizada.',403);return json({ok:true},200,{'Set-Cookie':clearSessionCookie(request)});}
      if(!(await verifySession(request,env)))return fail('Sessão expirada. Entre novamente.',401);
      if(['POST','PUT','PATCH','DELETE'].includes(request.method)&&!sameOrigin(request))return fail('Origem da requisição não autorizada.',403);

      if(url.pathname==='/api/bootstrap'&&request.method==='GET')return json(await bootstrap(env));

      if(url.pathname==='/api/customers'&&request.method==='POST'){
        const x=await body<any>(request);if(!String(x.name||'').trim()||!String(x.phone||'').trim())return fail('Nome e WhatsApp são obrigatórios.');const id=makeId('cus');
        await env.DB.prepare(`INSERT INTO customers(id,name,phone,instagram,email,city,tags,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(id,String(x.name).trim(),String(x.phone).replace(/\D/g,''),nullable(x.instagram),nullable(x.email),nullable(x.city),JSON.stringify(Array.isArray(x.tags)?x.tags:[]),nullable(x.notes),now()).run();return json({id},201);
      }
      const customerMatch=url.pathname.match(/^\/api\/customers\/([^/]+)$/);
      if(customerMatch&&request.method==='PUT'){
        const x=await body<any>(request);if(!String(x.name||'').trim()||!String(x.phone||'').trim())return fail('Nome e WhatsApp são obrigatórios.');await env.DB.prepare(`UPDATE customers SET name=?,phone=?,instagram=?,email=?,city=?,tags=?,notes=? WHERE id=?`).bind(String(x.name||'').trim(),String(x.phone||'').replace(/\D/g,''),nullable(x.instagram),nullable(x.email),nullable(x.city),JSON.stringify(Array.isArray(x.tags)?x.tags:[]),nullable(x.notes),customerMatch[1]).run();return json({ok:true});
      }
      if(customerMatch&&request.method==='DELETE'){
        const used=await env.DB.prepare(`SELECT COUNT(*) AS n FROM sales WHERE customer_id=?`).bind(customerMatch[1]).first<{n:number}>();if((used?.n||0)>0)return fail('Este cliente possui vendas e não pode ser excluído.',409);await env.DB.prepare(`DELETE FROM customers WHERE id=?`).bind(customerMatch[1]).run();return new Response(null,{status:204});
      }

      if(url.pathname==='/api/products'&&request.method==='POST')return createProduct(request,env);
      const productMatch=url.pathname.match(/^\/api\/products\/([^/]+)$/);
      if(productMatch&&request.method==='PUT')return updateProduct(request,env,productMatch[1]);
      const duplicateMatch=url.pathname.match(/^\/api\/products\/([^/]+)\/duplicate$/);
      if(duplicateMatch&&request.method==='POST')return duplicateProduct(env,duplicateMatch[1]);
      const archiveMatch=url.pathname.match(/^\/api\/products\/([^/]+)\/archive$/);
      if(archiveMatch&&request.method==='POST'){await env.DB.prepare(`UPDATE products SET status='Arquivado',updated_at=? WHERE id=?`).bind(now(),archiveMatch[1]).run();return json({ok:true});}

      const adjustMatch=url.pathname.match(/^\/api\/inventory\/([^/]+)\/adjust$/);
      if(adjustMatch&&request.method==='POST')return adjustStock(request,env,adjustMatch[1]);
      if(url.pathname==='/api/inventory/entries'&&request.method==='POST')return createEntry(request,env);

      if(url.pathname==='/api/sales'&&request.method==='POST')return createSale(request,env);
      const saleStatus=url.pathname.match(/^\/api\/sales\/([^/]+)\/status$/);
      if(saleStatus&&request.method==='PATCH'){const x=await body<any>(request);if(!['Separando','Pronto','Entregue'].includes(x.orderStatus))return fail('Status inválido.');await env.DB.prepare(`UPDATE sales SET order_status=?,updated_at=? WHERE id=? AND order_status<>'Cancelado'`).bind(x.orderStatus,now(),saleStatus[1]).run();return json({ok:true});}
      const saleCancel=url.pathname.match(/^\/api\/sales\/([^/]+)\/cancel$/);
      if(saleCancel&&request.method==='POST')return cancelSale(env,saleCancel[1]);

      if(url.pathname==='/api/expenses'&&request.method==='POST'){
        const x=await body<any>(request);if(!String(x.description||'').trim()||number(x.amount)<=0)return fail('Descrição e valor são obrigatórios.');const id=makeId('exp');await env.DB.prepare(`INSERT INTO expenses(id,description,category,amount,expense_date,recurring,notes,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id,String(x.description).trim(),String(x.category||'Outros').trim()||'Outros',number(x.amount),String(x.expenseDate||new Date().toISOString().slice(0,10)),x.recurring?1:0,nullable(x.notes),now()).run();return json({id},201);
      }
      const expenseMatch=url.pathname.match(/^\/api\/expenses\/([^/]+)$/);if(expenseMatch&&request.method==='DELETE'){await env.DB.prepare(`DELETE FROM expenses WHERE id=?`).bind(expenseMatch[1]).run();return new Response(null,{status:204});}
      return fail('Rota não encontrada.',404);
    }catch(error){console.error(error);const msg=error instanceof Error?error.message:'Erro interno.';if(msg.includes('CHECK constraint failed'))return fail('A operação deixaria o estoque negativo. Atualize os dados e tente novamente.',409);if(msg.includes('UNIQUE constraint failed'))return fail('Já existe um registro com este SKU ou identificador.',409);return fail('Não foi possível concluir a operação.',500)}
  }
} satisfies ExportedHandler<Env>;

async function createProduct(request:Request,env:Env){
  const x=await body<any>(request);const name=String(x.name||'').trim();if(!name)return fail('Nome do produto é obrigatório.');const pid=makeId('prd'),created=now();const variants=Array.isArray(x.variants)?x.variants:[];const statements:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO products(id,name,category,collection,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).bind(pid,name,String(x.category||'Sem categoria').trim()||'Sem categoria',nullable(x.collection),x.status==='Arquivado'?'Arquivado':'Ativo',created,created)];
  for(const v of variants){const vid=makeId('var'),stock=integer(v.stock);statements.push(env.DB.prepare(`INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(vid,pid,nullable(v.color),nullable(v.size),nullable(v.sku),stock,integer(v.minStock,1),Math.max(0,number(v.averageCost)),Math.max(0,number(v.salePrice)),v.active===false?0:1,created,created));if(stock>0)statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('mov'),pid,vid,'Ajuste',stock,Math.max(0,number(v.averageCost)),'Estoque inicial',created));}
  await env.DB.batch(statements);return json({id:pid},201);
}

async function updateProduct(request:Request,env:Env,pid:string){
  const x=await body<any>(request);if(!String(x.name||'').trim())return fail('Nome do produto é obrigatório.');const current=await env.DB.prepare(`SELECT * FROM product_variants WHERE product_id=?`).bind(pid).all<any>();const old=new Map<string,any>((current.results||[]).map((v:any)=>[v.id,v]));const incoming=Array.isArray(x.variants)?x.variants:[];const keep=new Set<string>();const t=now();const statements:D1PreparedStatement[]=[env.DB.prepare(`UPDATE products SET name=?,category=?,collection=?,status=?,updated_at=? WHERE id=?`).bind(String(x.name||'').trim(),String(x.category||'Sem categoria').trim()||'Sem categoria',nullable(x.collection),x.status==='Arquivado'?'Arquivado':'Ativo',t,pid)];
  for(const v of incoming){if(v.id&&old.has(v.id)){keep.add(v.id);const prev=old.get(v.id)!;const stock=integer(v.stock);statements.push(env.DB.prepare(`UPDATE product_variants SET color=?,size=?,sku=?,stock=?,min_stock=?,average_cost=?,sale_price=?,active=?,updated_at=? WHERE id=? AND product_id=?`).bind(nullable(v.color),nullable(v.size),nullable(v.sku),stock,integer(v.minStock,1),Math.max(0,number(v.averageCost)),Math.max(0,number(v.salePrice)),v.active===false?0:1,t,v.id,pid));const delta=stock-number(prev.stock);if(delta!==0)statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('mov'),pid,v.id,'Ajuste',delta,Math.max(0,number(v.averageCost)),'Edição do produto',t));}else{const vid=makeId('var'),stock=integer(v.stock);statements.push(env.DB.prepare(`INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(vid,pid,nullable(v.color),nullable(v.size),nullable(v.sku),stock,integer(v.minStock,1),Math.max(0,number(v.averageCost)),Math.max(0,number(v.salePrice)),v.active===false?0:1,t,t));if(stock>0)statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('mov'),pid,vid,'Ajuste',stock,Math.max(0,number(v.averageCost)),'Nova variante',t));}}
  for(const v of old.values())if(!keep.has(v.id))statements.push(env.DB.prepare(`UPDATE product_variants SET active=0,updated_at=? WHERE id=?`).bind(t,v.id));await env.DB.batch(statements);return json({ok:true});
}

async function duplicateProduct(env:Env,pid:string){
  const p=await env.DB.prepare(`SELECT * FROM products WHERE id=?`).bind(pid).first<any>();if(!p)return fail('Produto não encontrado.',404);const vars=await env.DB.prepare(`SELECT * FROM product_variants WHERE product_id=? AND active=1`).bind(pid).all<any>();const np=makeId('prd'),t=now(),stmts:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO products(id,name,category,collection,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).bind(np,`${p.name} — cópia`,p.category,p.collection,'Ativo',t,t)];for(const v of vars.results||[])stmts.push(env.DB.prepare(`INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(makeId('var'),np,v.color,v.size,null,0,v.min_stock,v.average_cost,v.sale_price,1,t,t));await env.DB.batch(stmts);return json({id:np},201);
}

async function adjustStock(request:Request,env:Env,variantId:string){
  const x=await body<any>(request),v=await env.DB.prepare(`SELECT * FROM product_variants WHERE id=?`).bind(variantId).first<any>();if(!v)return fail('Variante não encontrada.',404);const next=integer(x.quantity),delta=next-number(v.stock),t=now();await env.DB.batch([env.DB.prepare(`UPDATE product_variants SET stock=?,updated_at=? WHERE id=?`).bind(next,t,variantId),env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,note,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(makeId('mov'),v.product_id,variantId,'Ajuste',delta,v.average_cost,[String(x.reason||'Ajuste'),String(x.note||'')].filter(Boolean).join(' · '),t)]);return json({ok:true});
}

async function createEntry(request:Request,env:Env){
  const x=await body<any>(request),pid=String(x.productId||''),items=(Array.isArray(x.items)?x.items:[]).filter((i:any)=>integer(i.quantity)>0);if(!pid||!items.length)return fail('Produto e ao menos uma quantidade são obrigatórios.');const product=await env.DB.prepare(`SELECT id FROM products WHERE id=?`).bind(pid).first();if(!product)return fail('Produto não encontrado.',404);const variantsForProduct=await env.DB.prepare(`SELECT id FROM product_variants WHERE product_id=? AND active=1`).bind(pid).all<{id:string}>();const allowedVariantIds=new Set((variantsForProduct.results||[]).map(v=>v.id));for(const i of items)if(i.variantId&&!allowedVariantIds.has(String(i.variantId)))return fail('Uma variante não pertence ao produto selecionado.',409);const eid=makeId('ent'),t=now(),totalUnits=items.reduce((a:number,i:any)=>a+integer(i.quantity),0),totalCost=items.reduce((a:number,i:any)=>a+integer(i.quantity)*Math.max(0,number(i.unitCost)),0);const stmts:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO stock_entries(id,product_id,description,entry_date,total_units,total_cost,created_at) VALUES(?,?,?,?,?,?,?)`).bind(eid,pid,String(x.description||'Entrada de estoque').trim()||'Entrada de estoque',String(x.entryDate||new Date().toISOString().slice(0,10)),totalUnits,totalCost,t)];
  for(const i of items){let vid=String(i.variantId||'');if(vid){const q=integer(i.quantity),c=Math.max(0,number(i.unitCost));stmts.push(env.DB.prepare(`UPDATE product_variants SET average_cost=CASE WHEN stock+? > 0 THEN ((stock*average_cost)+(?*?))/(stock+?) ELSE ? END, stock=stock+?, sale_price=?, sku=COALESCE(?,sku), min_stock=?, updated_at=? WHERE id=? AND product_id=?`).bind(q,q,c,q,c,q,Math.max(0,number(i.salePrice)),nullable(i.sku),integer(i.minStock,1),t,vid,pid));}else{vid=makeId('var');stmts.push(env.DB.prepare(`INSERT INTO product_variants(id,product_id,color,size,sku,stock,min_stock,average_cost,sale_price,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?)`).bind(vid,pid,nullable(i.color),nullable(i.size),nullable(i.sku),integer(i.quantity),integer(i.minStock,1),Math.max(0,number(i.unitCost)),Math.max(0,number(i.salePrice)),t,t));}stmts.push(env.DB.prepare(`INSERT INTO stock_entry_items(id,entry_id,variant_id,quantity,unit_cost,sale_price) VALUES(?,?,?,?,?,?)`).bind(makeId('eni'),eid,vid,integer(i.quantity),Math.max(0,number(i.unitCost)),Math.max(0,number(i.salePrice))));stmts.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),pid,vid,'Entrada',integer(i.quantity),Math.max(0,number(i.unitCost)),'stock_entry',eid,String(x.description||'Entrada de estoque'),t));}
  await env.DB.batch(stmts);return json({id:eid},201);
}

async function createSale(request:Request,env:Env){
  const x=await body<any>(request),items=Array.isArray(x.items)?x.items:[];if(!x.customerId||!items.length)return fail('Cliente e itens são obrigatórios.');const customer=await env.DB.prepare(`SELECT id FROM customers WHERE id=?`).bind(String(x.customerId)).first();if(!customer)return fail('Cliente não encontrado.',404);const loaded=[] as any[];for(const item of items){const v=await env.DB.prepare(`SELECT v.*,p.name AS product_name,p.status AS product_status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=? AND v.product_id=?`).bind(String(item.variantId),String(item.productId)).first<any>();if(!v||!v.active||v.product_status!=='Ativo')return fail('Um dos produtos não está disponível.',409);const qty=integer(item.quantity);if(qty<1||v.stock<qty)return fail(`Estoque insuficiente para ${v.product_name}.`,409);loaded.push({...item,db:v,qty,unitPrice:Math.max(0,number(item.unitPrice,v.sale_price))});}
  const subtotal=loaded.reduce((a,i)=>a+i.qty*i.unitPrice,0),discount=Math.min(Math.max(0,number(x.discount)),subtotal),total=subtotal-discount,cost=loaded.reduce((a,i)=>a+i.qty*number(i.db.average_cost),0),sid=makeId('sal'),t=now(),numberText=saleNumber(),order=['Separando','Pronto','Entregue'].includes(x.orderStatus)?x.orderStatus:'Separando',pay=x.paymentStatus==='Pendente'?'Pendente':'Pago';const stmts:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO sales(id,number,customer_id,order_status,payment_status,payment_method,subtotal,discount,total,cost_total,profit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(sid,numberText,String(x.customerId),order,pay,String(x.paymentMethod||'Pix'),subtotal,discount,total,cost,total-cost,t,t)];
  for(const i of loaded){stmts.push(env.DB.prepare(`UPDATE product_variants SET stock=stock-?,updated_at=? WHERE id=?`).bind(i.qty,t,i.db.id));stmts.push(env.DB.prepare(`INSERT INTO sale_items(id,sale_id,product_id,variant_id,quantity,unit_price,unit_cost) VALUES(?,?,?,?,?,?,?)`).bind(makeId('sai'),sid,i.db.product_id,i.db.id,i.qty,i.unitPrice,i.db.average_cost));stmts.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),i.db.product_id,i.db.id,'Venda',-i.qty,i.db.average_cost,'sale',sid,numberText,t));}
  await env.DB.batch(stmts);return json({id:sid,number:numberText},201);
}

async function cancelSale(env:Env,sid:string){
  const sale=await env.DB.prepare(`SELECT * FROM sales WHERE id=?`).bind(sid).first<any>();if(!sale)return fail('Venda não encontrada.',404);if(sale.order_status==='Cancelado')return json({ok:true});const items=await env.DB.prepare(`SELECT * FROM sale_items WHERE sale_id=?`).bind(sid).all<any>();const t=now(),stmts:D1PreparedStatement[]=[env.DB.prepare(`UPDATE sales SET order_status='Cancelado',updated_at=? WHERE id=?`).bind(t,sid)];for(const i of items.results||[]){stmts.push(env.DB.prepare(`UPDATE product_variants SET stock=stock+?,updated_at=? WHERE id=?`).bind(i.quantity,t,i.variant_id));stmts.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),i.product_id,i.variant_id,'Cancelamento',i.quantity,i.unit_cost,'sale',sid,`Cancelamento ${sale.number}`,t));}await env.DB.batch(stmts);return json({ok:true});
}
