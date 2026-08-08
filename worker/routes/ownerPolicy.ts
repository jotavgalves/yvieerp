import { now, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

type Payload={reservePercent?:number;monthlyProLabore?:number};
const emptyPolicy={configured:false,reservePercent:0,monthlyProLabore:0};

export async function getOwnerPolicy(env:Env){
  const row=await env.DB.prepare(`SELECT value FROM app_settings WHERE key='owner_policy'`).first<{value:string}>();
  if(!row?.value)return json(emptyPolicy);
  try{
    const parsed=JSON.parse(row.value) as Payload&{configured?:boolean};
    return json({configured:parsed.configured===true,reservePercent:Math.min(100,Math.max(0,number(parsed.reservePercent))),monthlyProLabore:Math.max(0,number(parsed.monthlyProLabore))});
  }catch{return json(emptyPolicy)}
}

export async function saveOwnerPolicy(request:Request,env:Env){
  const input=await readJson<Payload>(request);
  const reservePercent=Math.min(100,Math.max(0,number(input.reservePercent)));
  const monthlyProLabore=Math.max(0,number(input.monthlyProLabore));
  if(!Number.isFinite(reservePercent)||!Number.isFinite(monthlyProLabore))return fail('Regra inválida.');
  const value=JSON.stringify({configured:true,reservePercent,monthlyProLabore});
  await env.DB.prepare(`INSERT INTO app_settings(key,value,updated_at) VALUES('owner_policy',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(value,now()).run();
  return json({configured:true,reservePercent,monthlyProLabore});
}
