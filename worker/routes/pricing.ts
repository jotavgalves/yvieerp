import { makeId, now, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

interface PricingPayload {
  freightCost?: number;
  otherCost?: number;
}
interface ProductPricingSettingsPayload {
  targetMargin?: number;
  cardFee?: number;
}
interface VariantPricingSettingsPayload {
  inheritProduct?: boolean;
  targetMargin?: number;
  cardFee?: number;
}

const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

export async function getProductPricingSettings(env:Env,productId:string){
  const product=await env.DB.prepare(`SELECT id,name,default_target_margin,default_card_fee FROM products WHERE id=?`).bind(productId).first<any>();
  if(!product)return fail('Produto não encontrado.',404);
  const rows=await env.DB.prepare(`SELECT id,target_margin_override,card_fee_override,active FROM product_variants WHERE product_id=? ORDER BY created_at ASC`).bind(productId).all<any>();
  const defaultTargetMargin=number(product.default_target_margin,55);
  const defaultCardFee=number(product.default_card_fee,6.12);
  return json({
    productId:product.id,
    productName:product.name,
    defaultTargetMargin,
    defaultCardFee,
    variants:(rows.results||[]).map(v=>({
      id:v.id,
      active:!!v.active,
      targetMarginOverride:v.target_margin_override===null?null:number(v.target_margin_override),
      cardFeeOverride:v.card_fee_override===null?null:number(v.card_fee_override),
      effectiveTargetMargin:v.target_margin_override===null?defaultTargetMargin:number(v.target_margin_override),
      effectiveCardFee:v.card_fee_override===null?defaultCardFee:number(v.card_fee_override),
      inheritsProduct:v.target_margin_override===null&&v.card_fee_override===null,
    }))
  });
}

export async function saveProductPricingSettings(request:Request,env:Env,productId:string){
  const input=await readJson<ProductPricingSettingsPayload>(request);
  const targetMargin=clamp(number(input.targetMargin,55),0,95);
  const cardFee=clamp(number(input.cardFee,6.12),0,40);
  const product=await env.DB.prepare(`SELECT id FROM products WHERE id=?`).bind(productId).first<any>();
  if(!product)return fail('Produto não encontrado.',404);
  const timestamp=now();
  await env.DB.prepare(`UPDATE products SET default_target_margin=?,default_card_fee=?,updated_at=? WHERE id=?`).bind(targetMargin,cardFee,timestamp,productId).run();
  const inherited=await env.DB.prepare(`SELECT COUNT(*) n FROM product_variants WHERE product_id=? AND active=1 AND target_margin_override IS NULL AND card_fee_override IS NULL`).bind(productId).first<any>();
  return json({productId,targetMargin,cardFee,inheritedVariants:Number(inherited?.n||0)});
}

export async function saveVariantPricingSettings(request:Request,env:Env,variantId:string){
  const input=await readJson<VariantPricingSettingsPayload>(request);
  const variant=await env.DB.prepare(`SELECT v.id,v.product_id,p.default_target_margin,p.default_card_fee FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.id=?`).bind(variantId).first<any>();
  if(!variant)return fail('Variante não encontrada.',404);
  const timestamp=now();
  if(input.inheritProduct!==false){
    await env.DB.prepare(`UPDATE product_variants SET target_margin_override=NULL,card_fee_override=NULL,updated_at=? WHERE id=?`).bind(timestamp,variantId).run();
    return json({variantId,inheritsProduct:true,targetMargin:number(variant.default_target_margin,55),cardFee:number(variant.default_card_fee,6.12)});
  }
  const targetMargin=clamp(number(input.targetMargin,number(variant.default_target_margin,55)),0,95);
  const cardFee=clamp(number(input.cardFee,number(variant.default_card_fee,6.12)),0,40);
  await env.DB.prepare(`UPDATE product_variants SET target_margin_override=?,card_fee_override=?,updated_at=? WHERE id=?`).bind(targetMargin,cardFee,timestamp,variantId).run();
  return json({variantId,inheritsProduct:false,targetMargin,cardFee});
}

export async function savePricing(request:Request,env:Env,variantId:string){
  const input=await readJson<PricingPayload>(request);
  const variant=await env.DB.prepare(`
    SELECT v.id,v.product_id,v.average_cost,v.target_margin_override,v.card_fee_override,
           p.default_target_margin,p.default_card_fee
    FROM product_variants v
    JOIN products p ON p.id=v.product_id
    WHERE v.id=? AND v.active=1
  `).bind(variantId).first<any>();
  if(!variant)return fail('Variante não encontrada.',404);

  // O custo vem do Estoque; margem/taxa vêm da regra persistida do produto ou da variação.
  const pieceCost=Math.max(0,number(variant.average_cost));
  const freightCost=Math.max(0,number(input.freightCost));
  const otherCost=Math.max(0,number(input.otherCost));
  const targetMargin=clamp(variant.target_margin_override===null?number(variant.default_target_margin,55):number(variant.target_margin_override),0,95);
  const cardFee=clamp(variant.card_fee_override===null?number(variant.default_card_fee,6.12):number(variant.card_fee_override),0,40);
  const totalCost=roundMoney(pieceCost+freightCost+otherCost);
  const cashPrice=targetMargin>=100?0:roundMoney(totalCost/(1-targetMargin/100));
  const cardPrice=cardFee>=100?cashPrice:roundMoney(cashPrice/(1-cardFee/100));
  if(cashPrice<=0||cardPrice<=0)return fail('Os preços calculados precisam ser maiores que zero.');

  const id=makeId('prc'),timestamp=now(),guard=`pricing:${variantId}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO operation_guards(operation_key,created_at) VALUES(?,?)`).bind(guard,timestamp),
    env.DB.prepare(`UPDATE product_variants SET sale_price=?,cash_price=?,card_price=?,updated_at=? WHERE id=? AND active=1`).bind(cashPrice,cashPrice,cardPrice,timestamp,variantId),
    env.DB.prepare(`INSERT INTO pricing_history(id,product_id,variant_id,piece_cost,freight_cost,other_cost,total_cost,target_margin,card_fee,cash_price,card_price,applied_price,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,variant.product_id,variantId,pieceCost,freightCost,otherCost,totalCost,targetMargin,cardFee,cashPrice,cardPrice,cashPrice,timestamp),
    env.DB.prepare(`DELETE FROM operation_guards WHERE operation_key=?`).bind(guard)
  ]);

  const persisted=await env.DB.prepare(`SELECT sale_price,cash_price,card_price,average_cost,updated_at FROM product_variants WHERE id=?`).bind(variantId).first<any>();
  if(!persisted)return fail('A variante deixou de existir durante a precificação.',409);
  const persistedCash=roundMoney(number(persisted.cash_price));
  const persistedCard=roundMoney(number(persisted.card_price));
  if(Math.abs(persistedCash-cashPrice)>0.009||Math.abs(persistedCard-cardPrice)>0.009){
    return fail('O banco não confirmou os preços calculados. Nenhuma confirmação falsa foi exibida; atualize a tela e tente novamente.',409);
  }

  return json({
    id,totalCost,pieceCost:roundMoney(number(persisted.average_cost)),cashPrice:persistedCash,cardPrice:persistedCard,
    targetMargin,cardFee,inheritsProduct:variant.target_margin_override===null&&variant.card_fee_override===null,
    persisted:true,updatedAt:persisted.updated_at
  },201);
}
