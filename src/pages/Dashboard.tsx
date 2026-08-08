import { AlertTriangle, Clock3, PackageCheck, Repeat2, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PeriodFilter, currentMonthRange, inRange } from '../components/PeriodFilter';
import { useData } from '../context/DataContext';
import { money, dateTime, shortDate } from '../lib/format';
import { Badge, EmptyState, PageHeader, StatCard } from '../components/ui';

export function Dashboard(){
  const {data}=useData();const [range,setRange]=useState(currentMonthRange());
  const period=useMemo(()=>{if(!data)return null;const sales=data.sales.filter(s=>s.orderStatus!=='Cancelado'&&inRange(s.createdAt,range));const returns=data.returns.filter(r=>inRange(r.createdAt,range));return{sales,returns}},[data,range]);
  if(!data||!period)return null;
  const activeOrders=data.sales.filter(s=>s.orderStatus==='Separando'||s.orderStatus==='Pronto');
  const low=data.products.flatMap(p=>p.variants.filter(v=>v.active&&v.stock<=v.minStock).map(v=>({p,v})));
  const pendingPurchases=data.purchases.filter(p=>p.status==='Pedido');
  const today=new Date().toISOString().slice(0,10);
  const overdue=data.receivables.filter(r=>r.status==='Pendente'&&!!r.dueDate&&r.dueDate<today);
  const top=data.products.map(p=>({p,qty:period.sales.flatMap(x=>x.items).filter(i=>i.productId===p.id).reduce((a,i)=>a+i.quantity,0)})).filter(x=>x.qty>0).sort((a,b)=>b.qty-a.qty).slice(0,5);
  return <>
    <PageHeader title="Visão geral" subtitle="Pendências e tarefas que precisam de atenção. Os valores financeiros detalhados ficam somente no Financeiro." actions={<PeriodFilter value={range} onChange={setRange}/>}/>
    <div className="stats-grid">
      <StatCard label="Pedidos em andamento" value={String(activeOrders.length)} note="Separando ou pronto" icon={<ShoppingBag size={17}/>}/>
      <StatCard label="Vendas no período" value={String(period.sales.length)} note={range.label} icon={<ShoppingBag size={17}/>}/>
      <StatCard label="Estoque em atenção" value={String(low.length)} note="Variantes no mínimo ou zeradas" icon={<AlertTriangle size={17}/>}/>
      <StatCard label="Contas vencidas" value={String(overdue.length)} note="Recebimentos que precisam de cobrança" icon={<Clock3 size={17}/>}/>
      <StatCard label="Compras pendentes" value={String(pendingPurchases.length)} note="Ainda não recebidas" icon={<ShoppingCart size={17}/>}/>
      <StatCard label="Trocas/devoluções" value={String(period.returns.length)} note={range.label} icon={<Repeat2 size={17}/>}/>
    </div>

    <div className="dashboard-grid">
      <section className="panel panel-span-2"><div className="panel-head"><div><h2>Pedidos que ainda estão rodando</h2><p>O que precisa ser separado, finalizado ou entregue.</p></div></div>{activeOrders.length?<div className="activity-list">{activeOrders.slice(0,8).map(sale=><div className="activity-row" key={sale.id}><div className="activity-mark"><ShoppingBag size={15}/></div><div className="activity-main"><strong>{sale.customerName}</strong><span>{sale.number} · {sale.items.reduce((a,i)=>a+i.quantity,0)} peça(s) · {dateTime(sale.createdAt)}</span></div><div className="activity-side"><strong>{money(sale.total)}</strong><Badge tone={sale.orderStatus==='Pronto'?'info':'warning'}>{sale.orderStatus}</Badge></div></div>)}</div>:<EmptyState icon={<PackageCheck/>} title="Nenhum pedido em andamento" text="Não há pedidos aguardando separação ou entrega."/>}</section>

      <section className="panel"><div className="panel-head"><div><h2>Estoque em atenção</h2><p>Variantes no limite ou abaixo dele.</p></div><AlertTriangle size={17}/></div>{low.length?<div className="compact-list">{low.slice(0,6).map(({p,v})=><div className="compact-row" key={v.id}><div><strong>{p.name}</strong><span>{v.color||'Sem cor'} · {v.size||'Sem tamanho'}</span></div><Badge tone={v.stock===0?'danger':'warning'}>{v.stock} un.</Badge></div>)}</div>:<EmptyState icon={<PackageCheck/>} title="Estoque saudável" text="Nenhuma variante está abaixo do mínimo."/>}</section>

      <section className="panel"><div className="panel-head"><div><h2>Contas vencidas</h2><p>Clientes que precisam de acompanhamento.</p></div><Clock3 size={17}/></div>{overdue.length?<div className="compact-list">{overdue.slice(0,6).map(r=><div className="compact-row" key={r.id}><div><strong>{r.customerName}</strong><span>{r.saleNumber} · venceu {shortDate(r.dueDate!)}</span></div><Badge tone="danger">{money(r.amount)}</Badge></div>)}</div>:<EmptyState icon={<Clock3/>} title="Nenhuma conta vencida" text="Não há recebimentos pendentes fora do prazo."/>}</section>

      <section className="panel"><div className="panel-head"><div><h2>Mais vendidos</h2><p>Ranking por quantidade no período escolhido.</p></div></div>{top.length?<div className="ranking-list">{top.map((x,i)=><div className="ranking-row" key={x.p.id}><b>{String(i+1).padStart(2,'0')}</b><div><strong>{x.p.name}</strong><span>{x.p.category}</span></div><em>{x.qty} un.</em></div>)}</div>:<EmptyState icon={<ShoppingBag/>} title="Sem vendas no período" text="O ranking aparecerá conforme houver vendas."/>}</section>
    </div>
  </>
}
