import { BanknoteArrowDown, Landmark, Pencil, Plus, ShieldCheck, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { currentMonthRange, inRange } from '../components/PeriodFilter';
import { Badge, Button, ConfirmDialog, Drawer, EmptyState, Field, Input, PageHeader, Select, Textarea } from '../components/ui';
import { useData } from '../context/DataContext';
import { api, notify } from '../lib/api';
import { money, shortDate } from '../lib/format';
import type { OwnerPolicy, OwnerTransaction } from '../types';

const blank=()=>({type:'Pró-labore' as OwnerTransaction['type'],amount:0,transactionDate:new Date().toISOString().slice(0,10),notes:''});
const emptyPolicy:OwnerPolicy={configured:false,reservePercent:0,monthlyProLabore:0};

export function Capital(){
  const {data,refresh}=useData();
  const [open,setOpen]=useState(false);const [policyOpen,setPolicyOpen]=useState(false);const [form,setForm]=useState(blank());const [busy,setBusy]=useState(false);const [del,setDel]=useState<OwnerTransaction|null>(null);
  const [policy,setPolicy]=useState<OwnerPolicy>(emptyPolicy);const [policyDraft,setPolicyDraft]=useState({reservePercent:0,monthlyProLabore:0});
  useEffect(()=>{api<OwnerPolicy>('/api/owner-policy').then(p=>{setPolicy(p);setPolicyDraft({reservePercent:p.reservePercent,monthlyProLabore:p.monthlyProLabore})}).catch(()=>undefined)},[]);
  const month=useMemo(()=>currentMonthRange(),[]);
  const calc=useMemo(()=>{
    if(!data)return null;
    const sales=data.sales.filter(s=>s.orderStatus!=='Cancelado'&&inRange(s.createdAt,month));
    const returns=data.returns.filter(r=>inRange(r.createdAt,month));
    const revenue=sales.reduce((a,s)=>a+s.total,0)-returns.reduce((a,r)=>a+r.refundAmount+r.creditAmount,0);
    const saleCost=sales.reduce((a,s)=>a+s.costTotal,0);
    const returnedCost=returns.flatMap(r=>r.items).filter(i=>i.direction==='Entrada').reduce((a,i)=>a+i.quantity*i.unitCost,0);
    const exchangeCost=returns.flatMap(r=>r.items).filter(i=>i.direction==='Saída').reduce((a,i)=>a+i.quantity*i.unitCost,0);
    const cost=saleCost-returnedCost+exchangeCost;
    const paidExpenses=data.expenses.filter(e=>e.status==='Pago'&&inRange(e.expenseDate,month)).reduce((a,e)=>a+e.amount,0);
    const net=revenue-cost-paidExpenses;
    const pendingExpenses=data.expenses.filter(e=>e.status==='Pendente').reduce((a,e)=>a+e.amount,0);
    const ownerMonth=data.ownerTransactions.filter(t=>inRange(t.transactionDate,month));
    const payroll=ownerMonth.filter(t=>t.type==='Pró-labore').reduce((a,t)=>a+t.amount,0);
    const withdrawals=ownerMonth.filter(t=>t.type==='Retirada').reduce((a,t)=>a+t.amount,0);
    const contributions=ownerMonth.filter(t=>t.type==='Aporte').reduce((a,t)=>a+t.amount,0);
    const reserve=policy.configured?Math.max(0,net)*(policy.reservePercent/100):0;
    const available=policy.configured?Math.max(0,net-reserve-pendingExpenses-payroll-withdrawals):0;
    const proLaboreRemaining=Math.max(0,policy.monthlyProLabore-payroll);
    return{net,pendingExpenses,payroll,withdrawals,contributions,reserve,available,proLaboreRemaining};
  },[data,month,policy]);
  if(!data||!calc)return null;

  async function save(){if(form.amount<=0)return;setBusy(true);try{await api('/api/owner-transactions',{method:'POST',body:JSON.stringify(form)});setOpen(false);setForm(blank());await refresh();notify('Movimentação dos sócios registrada.')}finally{setBusy(false)}}
  async function savePolicy(){setBusy(true);try{const saved=await api<OwnerPolicy>('/api/owner-policy',{method:'PUT',body:JSON.stringify(policyDraft)});setPolicy(saved);setPolicyOpen(false);notify('Regra de retirada salva.')}finally{setBusy(false)}}
  async function remove(){if(!del)return;setBusy(true);try{await api(`/api/owner-transactions/${del.id}`,{method:'DELETE'});setDel(null);await refresh();notify('Movimentação removida.')}finally{setBusy(false)}}
  function openPolicy(){setPolicyDraft({reservePercent:policy.reservePercent,monthlyProLabore:policy.monthlyProLabore});setPolicyOpen(true)}
  const label=(type:OwnerTransaction['type'])=>type==='Retirada'?'Retirada de lucro':type==='Aporte'?'Aporte de sócio':'Pró-labore';

  return <>
    <PageHeader title="Sócios e retiradas" subtitle="Defina quanto do lucro fica na empresa e acompanhe apenas o dinheiro que entra ou sai para os sócios." actions={<div className="page-actions"><Button onClick={openPolicy}><Pencil size={15}/>Regra de retirada</Button><Button variant="primary" onClick={()=>{setForm(blank());setOpen(true)}}><Plus size={16}/>Registrar movimentação</Button></div>}/>

    {!policy.configured?<section className="owner-rule-empty"><ShieldCheck size={26}/><div><h2>Defina primeiro a regra da empresa</h2><p>O sistema não vai inventar quanto você pode retirar. Informe qual percentual do lucro deve permanecer na YVIE e, se quiser, uma meta mensal de pró-labore.</p></div><Button variant="primary" onClick={openPolicy}>Definir regra</Button></section>:
    <section className="withdrawal-hero"><div className="withdrawal-main"><span>Disponível para novas retiradas neste mês</span><strong>{money(calc.available)}</strong><p>Resultado depois da reserva definida, despesas pendentes, pró-labore e retiradas já feitas no mês.</p></div><div className="withdrawal-rule"><div><span>Lucro que fica na empresa</span><strong>{policy.reservePercent.toFixed(0)}%</strong></div><div><span>Meta mensal de pró-labore</span><strong>{money(policy.monthlyProLabore)}</strong></div><button onClick={openPolicy}><Pencil size={13}/>Alterar regra</button></div></section>}

    <div className="owner-month-cards"><article><div><BanknoteArrowDown size={16}/><span>Pró-labore pago no mês</span></div><strong>{money(calc.payroll)}</strong><small>{policy.monthlyProLabore>0?`${money(calc.proLaboreRemaining)} ainda previsto pela meta`:'Sem meta mensal definida'}</small></article><article><div><WalletCards size={16}/><span>Retiradas de lucro no mês</span></div><strong>{money(calc.withdrawals)}</strong><small>Fora do pró-labore</small></article><article><div><Landmark size={16}/><span>Aportes no mês</span></div><strong>{money(calc.contributions)}</strong><small>Dinheiro colocado pelos sócios</small></article></div>

    <section className="owner-calculation panel"><div className="panel-head"><div><h2>Como o limite é calculado</h2><p>{month.label}. A conta usa somente registros já existentes no ERP.</p></div></div>{policy.configured?<div className="owner-waterfall"><div><span>Lucro líquido do mês</span><strong>{money(calc.net)}</strong></div><div><span>(−) Reserva da empresa · {policy.reservePercent.toFixed(0)}%</span><strong>{money(calc.reserve)}</strong></div><div><span>(−) Despesas ainda pendentes</span><strong>{money(calc.pendingExpenses)}</strong></div><div><span>(−) Pró-labore já pago</span><strong>{money(calc.payroll)}</strong></div><div><span>(−) Retiradas de lucro já feitas</span><strong>{money(calc.withdrawals)}</strong></div><div className="owner-waterfall-total"><span>= Ainda disponível pela regra</span><strong>{money(calc.available)}</strong></div></div>:<div className="owner-no-formula">A fórmula aparecerá depois que a regra de retirada for definida.</div>}</section>

    <div className="owner-explanation"><strong>O que não entra aqui</strong><span>Estoque e faturamento ficam nas áreas próprias. Esta tela não chama mercadoria de “dinheiro disponível” e não usa crédito de cliente duas vezes no cálculo. O limite é gerencial; se o saldo real da conta bancária for menor, vale o saldo bancário.</span></div>

    <section className="table-panel">{data.ownerTransactions.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Movimentação</th><th>Valor</th><th>Observação</th><th></th></tr></thead><tbody>{data.ownerTransactions.map(t=><tr key={t.id}><td>{shortDate(t.transactionDate)}</td><td><Badge tone={t.type==='Aporte'?'success':t.type==='Pró-labore'?'info':'warning'}>{label(t.type)}</Badge></td><td><strong>{money(t.amount)}</strong></td><td>{t.notes||'—'}</td><td><button className="icon-btn danger-icon" title="Excluir movimentação" onClick={()=>setDel(t)}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>:<EmptyState icon={<Landmark/>} title="Nenhuma movimentação dos sócios" text="Quando houver aporte, pagamento de pró-labore ou retirada de lucro, registre aqui."/>}</section>

    <Drawer open={open} title="Movimentação dos sócios" subtitle="Escolha exatamente o que aconteceu com o dinheiro." onClose={()=>setOpen(false)} footer={<><Button onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} disabled={form.amount<=0} onClick={()=>void save()}>Salvar</Button></>}><div className="form-grid one-col"><Field label="O que aconteceu?"><Select value={form.type} onChange={e=>setForm({...form,type:e.target.value as OwnerTransaction['type']})}><option value="Aporte">Aporte de sócio — entrou dinheiro pessoal na empresa</option><option value="Pró-labore">Pró-labore — remuneração pelo trabalho</option><option value="Retirada">Retirada de lucro — saiu lucro para o sócio</option></Select></Field><Field label="Valor"><Input type="number" min="0" step=".01" value={form.amount||''} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></Field><Field label="Data"><Input type="date" value={form.transactionDate} onChange={e=>setForm({...form,transactionDate:e.target.value})}/></Field><Field label="Observação"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Ex.: pró-labore de agosto"/></Field></div></Drawer>

    <Drawer open={policyOpen} title="Regra de retirada" subtitle="Essa é a regra interna da YVIE. Você pode mudar quando a política da empresa mudar." onClose={()=>setPolicyOpen(false)} footer={<><Button onClick={()=>setPolicyOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={()=>void savePolicy()}>Salvar regra</Button></>}><div className="form-grid one-col"><Field label="Quanto do lucro fica na empresa?" helper="Ex.: 40 significa guardar 40% do lucro líquido e deixar até 60% disponível para sócios."><Input type="number" min="0" max="100" step="1" value={policyDraft.reservePercent} onChange={e=>setPolicyDraft({...policyDraft,reservePercent:Math.min(100,Math.max(0,Number(e.target.value)))})}/></Field><Field label="Meta mensal de pró-labore" helper="Opcional. Serve para mostrar quanto já foi pago e quanto ainda falta no mês."><Input type="number" min="0" step=".01" value={policyDraft.monthlyProLabore||''} onChange={e=>setPolicyDraft({...policyDraft,monthlyProLabore:Math.max(0,Number(e.target.value))})}/></Field><div className="owner-policy-example"><strong>Exemplo</strong><span>Se o lucro líquido for R$ 1.000 e a reserva for 40%, R$ 400 ficam na empresa. Antes de mostrar o restante como disponível, o ERP desconta despesas pendentes e o que os sócios já retiraram naquele mês.</span></div></div></Drawer>
    <ConfirmDialog open={!!del} title="Excluir movimentação?" text="O valor será retirado do histórico dos sócios e os cálculos do mês serão refeitos." onClose={()=>setDel(null)} onConfirm={remove} busy={busy}/>
  </>;
}
