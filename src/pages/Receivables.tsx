import { CheckCircle2, CircleDollarSign, Clock3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, PageHeader, SearchInput, Select, StatCard } from '../components/ui';
import { useData } from '../context/DataContext';
import { api, notify } from '../lib/api';
import { money, shortDate } from '../lib/format';
import type { Receivable } from '../types';

export function Receivables(){
  const {data,refresh}=useData();const [q,setQ]=useState('');const [status,setStatus]=useState('Pendente');const [busy,setBusy]=useState(false);
  const rows=useMemo(()=>data?.receivables.filter(r=>(!status||r.status===status)&&`${r.saleNumber} ${r.customerName} ${r.description}`.toLowerCase().includes(q.toLowerCase()))||[],[data,q,status]);
  const pending=data?.receivables.filter(r=>r.status==='Pendente').reduce((a,r)=>a+r.amount,0)||0;const received=data?.receivables.filter(r=>r.status==='Recebido').reduce((a,r)=>a+r.amount,0)||0;const overdue=data?.receivables.filter(r=>r.status==='Pendente'&&r.dueDate&&r.dueDate<new Date().toISOString().slice(0,10)).reduce((a,r)=>a+r.amount,0)||0;
  async function receive(r:Receivable){setBusy(true);try{await api(`/api/receivables/${r.id}/receive`,{method:'POST'});await refresh();notify(`${r.saleNumber} marcado como recebido.`)}finally{setBusy(false)}}
  return <>
    <PageHeader title="A receber" subtitle="O saldo nasce do pedido e é ajustado automaticamente por devoluções, trocas e cancelamentos. Aqui você apenas confirma o recebimento."/>
    <div className="stats-grid four"><StatCard label="A receber" value={money(pending)} note="Cobranças pendentes" icon={<Clock3 size={17}/>}/><StatCard label="Recebido" value={money(received)} note="Valores confirmados" icon={<CheckCircle2 size={17}/>}/><StatCard label="Vencido" value={money(overdue)} note="Pendências com vencimento passado" icon={<CircleDollarSign size={17}/>}/><StatCard label="Pendências" value={`${data?.receivables.filter(r=>r.status==='Pendente').length||0}`} note="Quantidade de cobranças" icon={<CircleDollarSign size={17}/>}/></div>
    <div className="finance-scope-note"><strong>Saldo protegido</strong><span>Uma cobrança não é apagada isoladamente. Se o pedido for cancelado ou tiver devolução/troca, o próprio ERP recalcula ou cancela o A receber para manter os módulos sincronizados.</span></div>
    <div className="toolbar toolbar-split"><SearchInput value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar cliente, pedido ou descrição..."/><Select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todas</option><option>Pendente</option><option>Recebido</option><option>Cancelado</option></Select></div>
    <section className="table-panel">{rows.length?<div className="table-scroll"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.saleNumber}</strong></td><td>{r.customerName}</td><td>{r.description}</td><td>{r.dueDate?shortDate(r.dueDate):'—'}</td><td><strong>{money(r.amount)}</strong></td><td><Badge tone={r.status==='Recebido'?'success':r.status==='Cancelado'?'neutral':'warning'}>{r.status}</Badge></td><td><div className="row-actions">{r.status==='Pendente'&&<Button className="btn-compact" disabled={busy} onClick={()=>void receive(r)}><CheckCircle2 size={14}/>Receber</Button>}</div></td></tr>)}</tbody></table></div>:<EmptyState icon={<CircleDollarSign/>} title="Nenhuma conta encontrada" text="Vendas marcadas como pendentes passam a aparecer automaticamente aqui."/>}</section>
  </>;
}
