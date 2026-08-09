import { makeId, now, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface PricingPayload {
  pieceCost?: number;
  freightCost?: number;
  otherCost?: number;
  targetMargin?: number;
  cardFee?: number;
}

const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export async function savePricing(request:Request,env:Env,variantId:string){
  const input=await readJson<PricingPayload>(request);
  const variant=await env.DB.prepare(`SELECT id,product_id,average_cost FROM product_variants WHERE id=? AND active=1`).bind(variantId).first<any>();
  if(!variant)return fail('Variante não encontrada.',404);

  const pieceCost=Math.max(0,number(input.pieceCost,number(variant.average_cost)));
  const freightCost=Math.max(0,number(input.freightCost));
  const otherCost=Math.max(0,number(input.otherCost));
  const targetMargin=clamp(number(input.targetMargin,50),0,95);
  const cardFee=clamp(number(input.cardFee,0),0,40);
  const totalCost=roundMoney(pieceCost+freightCost+otherCost);
  const cashPrice=targetMargin>=100?0:roundMoney(totalCost/(1-targetMargin/100));
  const cardPrice=cardFee>=100?cashPrice:roundMoney(cashPrice/(1-cardFee/100));
  if(cashPrice<=0||cardPrice<=0)return fail('Os preços calculados precisam ser maiores que zero.');

  const id=makeId('prc'),timestamp=now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE product_variants SET sale_price=?,cash_price=?,card_price=?,updated_at=? WHERE id=? AND active=1`).bind(cashPrice,cashPrice,cardPrice,timestamp,variantId),
    env.DB.prepare(`INSERT INTO pricing_history(id,product_id,variant_id,piece_cost,freight_cost,other_cost,total_cost,target_margin,card_fee,cash_price,card_price,applied_price,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,variant.product_id,variantId,pieceCost,freightCost,otherCost,totalCost,targetMargin,cardFee,cashPrice,cardPrice,cashPrice,timestamp)
  ]);

  const persisted=await env.DB.prepare(`SELECT sale_price,cash_price,card_price,updated_at FROM product_variants WHERE id=?`).bind(variantId).first<any>();
  if(!persisted)return fail('A variante deixou de existir durante a precificação.',409);
  const persistedCash=roundMoney(number(persisted.cash_price));
  const persistedCard=roundMoney(number(persisted.card_price));
  if(Math.abs(persistedCash-cashPrice)>0.009||Math.abs(persistedCard-cardPrice)>0.009){
    return fail('O banco não confirmou os preços calculados. Nenhuma confirmação falsa foi exibida; atualize a tela e tente novamente.',409);
  }

  return json({id,totalCost,cashPrice:persistedCash,cardPrice:persistedCard,persisted:true,updatedAt:persisted.updated_at},201);
}
