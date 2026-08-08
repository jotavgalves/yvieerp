import { now, number } from '../db';
import { fail, json, readJson } from '../http';
import type { Env } from '../types';

type Payload={reservePercent?:number;monthlyProLabore?:number};

export async function saveOwnerPolicy(request:Request,env:Env){
  const input=await readJson<Payload>(request);
  const reservePercent=Math.min(100,Math.max(0,number(input.reservePercent)));
  const monthlyProLabore=Math.max(0,number(input.monthlyProLabore));
  if(!Number.isFinite(reservePercent)||!Number.isFinite(monthlyProLabore))return fail('Regra inválida.');
  const value=JSON.stringify({configured:true,reservePercent,monthlyProLabore});
  await env.DB.prepare(`INSERT INTO app_settings(key,value,updated_at) VALUES('owner_policy',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(value,now()).run();
  return json({configured:true,reservePercent,monthlyProLabore});
}
