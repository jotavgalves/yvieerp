import { integer, makeId, now } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

type CountPayload={title?:string;notes?:string;items?:Array<{variantId?:string;countedQuantity?:number}>};

export async function createInventoryCount(request:Request,env:Env){
  const input=await readJson<CountPayload>(request);const title=String(input.title||'Contagem de estoque').trim()||'Contagem de estoque';const items=Array.isArray(input.items)?input.items:[];
  if(!items.length)return fail('Informe ao menos uma variante contada.');
  const id=makeId('cnt');const timestamp=now();const statements:D1PreparedStatement[]=[env.DB.prepare(`INSERT INTO inventory_counts(id,title,status,notes,created_at) VALUES(?,?,'Rascunho',?,?)`).bind(id,title,typeof input.notes==='string'&&input.notes.trim()?input.notes.trim():null,timestamp)];
  for(const raw of items){
    const variant=await env.DB.prepare(`SELECT id,product_id,stock FROM product_variants WHERE id=?`).bind(String(raw.variantId||'')).first<any>();
    if(!variant)return fail('Uma das variantes não foi encontrada.',404);
    const counted=integer(raw.countedQuantity);const expected=Number(variant.stock);statements.push(env.DB.prepare(`INSERT INTO inventory_count_items(id,count_id,product_id,variant_id,expected_quantity,counted_quantity,difference) VALUES(?,?,?,?,?,?,?)`).bind(makeId('cni'),id,variant.product_id,variant.id,expected,counted,counted-expected));
  }
  await env.DB.batch(statements);return json({id},201);
}

export async function applyInventoryCount(env:Env,id:string){
  const count=await env.DB.prepare(`SELECT * FROM inventory_counts WHERE id=?`).bind(id).first<any>();if(!count)return fail('Contagem não encontrada.',404);if(count.status!=='Rascunho')return fail('Esta contagem já foi finalizada.',409);
  const rows=await env.DB.prepare(`SELECT * FROM inventory_count_items WHERE count_id=?`).bind(id).all<any>();const timestamp=now();const statements:D1PreparedStatement[]=[];
  for(const item of rows.results||[]){
    const current=await env.DB.prepare(`SELECT stock,average_cost FROM product_variants WHERE id=?`).bind(item.variant_id).first<any>();if(!current)continue;
    const difference=Number(item.counted_quantity)-Number(current.stock);if(difference!==0){statements.push(env.DB.prepare(`UPDATE product_variants SET stock=?,updated_at=? WHERE id=?`).bind(item.counted_quantity,timestamp,item.variant_id));statements.push(env.DB.prepare(`INSERT INTO inventory_movements(id,product_id,variant_id,type,quantity,unit_cost,reference_type,reference_id,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId('mov'),item.product_id,item.variant_id,'Ajuste',difference,current.average_cost,'inventory_count',id,`Inventário: ${count.title}`,timestamp));}
  }
  statements.push(env.DB.prepare(`UPDATE inventory_counts SET status='Aplicado',applied_at=? WHERE id=?`).bind(timestamp,id));await env.DB.batch(statements);return json({ok:true});
}

export async function cancelInventoryCount(env:Env,id:string){const result=await env.DB.prepare(`UPDATE inventory_counts SET status='Cancelado' WHERE id=? AND status='Rascunho'`).bind(id).run();if(!result.meta.changes)return fail('Contagem em rascunho não encontrada.',404);return json({ok:true});}
