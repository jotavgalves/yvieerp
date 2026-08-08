import { AlertTriangle, Boxes, CircleDollarSign, PackageCheck, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PeriodFilter, currentMonthRange, inRange } from '../components/PeriodFilter';
import { useData } from '../context/DataContext';
import { money, dateTime } from '../lib/format';
import { Badge, EmptyState, PageHeader, StatCard } from '../components/ui';

export function Dashboard(){
  const {data}=useData();const [range,setRange]=useState(currentMonthRange());
  const period=useMemo(()=>{if(!data)return null;const sales=data.sales.filter(s=>s.orderStatus!=='Cancelado'&&inRange(s.createdAt,range));const returns=data.returns.filter(r=>inRange(r.createdAt,range));const revenue=sales.reduce((a,s)=>a+s.total,0)-returns.reduce((a,r)=>a+r.refundAmount+r.creditAmount,0);const saleCost=sales.reduce((a,s)=>a+s.costTotal,0);const returnedCost=returns.flatMap(r=>r.items).filter(i=>i.direction==='Entrada').reduce((a,i)=>a+i.quantity*i.unitCost,0);const exchangeCost=returns.flatMap(r=>r.items).filter(i=>i.direction==='Saída').reduce((a,i)=>a+i.quantity*i.unitCost,0);const cost=saleCost-returnedCost+exchangeCost;const expenses=data.expenses.filter(e=>e.status==='Pago'&&inRange(e.expenseDate,range)).reduce((a,e)=>a+e.amount,0);return{sales,revenue,grossProfit:revenue-cost,expenses,netProfit:revenue-cost-expenses,ticket:sales.length?revenue/sales.length:0}},[data,range]);
  if(!data||!period)return null;
  const low=data.products.flatMap(p=>p.variants.filter(v=>v.active&&v.stock<=v.minStock).map(v=>({p,v}))).slice(0,6);
  const top=data.products.map(p=>({p,qty:period.sales.flatMap(x=>x.items).filter(i=>i.productId===p.id).reduce((a,i)=>a+i.quantity,0)})).sort((a,b)=>b.qty-a.qty).slice(0,5);
  return <>
    <PageHeader title="Visão geral" subtitle="O que precisa de atenção e como a operação está performando." actions={<PeriodFilter value={range} onChange={setRange}/>}/>
    <div className="stats-grid">
      <StatCard label="Faturamento" value={money(period.revenue)} note={range.label} icon={<TrendingUp size={17}/>}/>
      <StatCard label="Lucro bruto" value={money(period.grossProfit)} note="Após custo das peças e trocas" icon={<CircleDollarSign size={17}/>}/>
      <StatCard label="Despesas" value={money(period.expenses)} note="Somente despesas pagas" icon={<Receipt size={17}/>}/>
      <StatCard label="Lucro líquido" value={money(period.netProfit)} note="Resultado do período" icon={<Wallet size={17}/>}/>
      <StatCard label="Pedidos" value={String(period.sales.length)} note={range.label} icon={<ShoppingBag size={17}/>}/>
      <StatCard label="Estoque" value={`${data.summary.stockUnits} un.`} note={`${money(data.summary.stockCost)} em custo agora`} icon={<Boxes size={17}/>}/>
    </div>
    <div className="dashboard-grid">
      <section className="panel panel-span-2"><div className="panel-head"><div><h2>Vendas do período</h2><p>Movimentações comerciais dentro do filtro selecionado.</p></div></div><div className="activity-list">{period.sales.length?period.sales.slice(0,7).map(sale=><div className="activity-row" key={sale.id}><div className="activity-mark"><ShoppingBag size={15}/></div><div className="activity-main"><strong>{sale.customerName}</strong><span>{sale.number} · {dateTime(sale.createdAt)}</span></div><div className="activity-side"><strong>{money(sale.total)}</strong><Badge tone={sale.orderStatus==='Entregue'?'success':sale.orderStatus==='Pronto'?'info':'warning'}>{sale.orderStatus}</Badge></div></div>):<EmptyState icon={<ShoppingBag/>} title="Nenhuma venda no período" text="Altere o filtro ou registre uma nova venda."/>}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Estoque em atenção</h2><p>Variantes no limite ou abaixo dele.</p></div><AlertTriangle size={17}/></div>{low.length?<div className="compact-list">{low.map(({p,v})=><div className="compact-row" key={v.id}><div><strong>{p.name}</strong><span>{v.color||'Sem cor'} · {v.size||'Sem tamanho'}</span></div><Badge tone={v.stock===0?'danger':'warning'}>{v.stock} un.</Badge></div>)}</div>:<EmptyState icon={<PackageCheck/>} title="Estoque saudável" text="Nenhuma variante está abaixo do mínimo."/>}</section>
      <section className="panel"><div className="panel-head"><div><h2>Mais vendidos</h2><p>Ranking do período por quantidade.</p></div></div><div className="ranking-list">{top.map((x,i)=><div className="ranking-row" key={x.p.id}><b>{String(i+1).padStart(2,'0')}</b><div><strong>{x.p.name}</strong><span>{x.p.category}</span></div><em>{x.qty} un.</em></div>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Indicadores</h2><p>Leitura rápida do período.</p></div></div><div className="summary-lines"><div><span>Ticket médio</span><strong>{money(period.ticket)}</strong></div><div><span>Margem bruta</span><strong>{period.revenue?((period.grossProfit/period.revenue)*100).toFixed(1):'0.0'}%</strong></div><div><span>Margem líquida</span><strong>{period.revenue?((period.netProfit/period.revenue)*100).toFixed(1):'0.0'}%</strong></div><div><span>A receber hoje</span><strong>{money(data.summary.receivablePending)}</strong></div></div></section>
    </div>
  </>
}
