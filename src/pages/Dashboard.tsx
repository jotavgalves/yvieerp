import { AlertTriangle, Boxes, CircleDollarSign, PackageCheck, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useData } from '../context/DataContext';
import { money, dateTime } from '../lib/format';
import { Badge, EmptyState, PageHeader, StatCard } from '../components/ui';

export function Dashboard(){
  const {data}=useData(); if(!data)return null;
  const s=data.summary;
  const low=data.products.flatMap(p=>p.variants.filter(v=>v.active&&v.stock<=v.minStock).map(v=>({p,v}))).slice(0,6);
  const top=data.products.map(p=>({p,qty:data.sales.filter(x=>x.orderStatus!=='Cancelado').flatMap(x=>x.items).filter(i=>i.productId===p.id).reduce((a,i)=>a+i.quantity,0)})).sort((a,b)=>b.qty-a.qty).slice(0,5);
  return <>
    <PageHeader title="Visão geral" subtitle="O que precisa de atenção e como a operação está performando."/>
    <div className="stats-grid">
      <StatCard label="Faturamento" value={money(s.revenue)} note="Vendas não canceladas" icon={<TrendingUp size={17}/>}/>
      <StatCard label="Lucro bruto" value={money(s.grossProfit)} note="Após custo das peças" icon={<CircleDollarSign size={17}/>}/>
      <StatCard label="Despesas" value={money(s.expenses)} note="Despesas cadastradas" icon={<Receipt size={17}/>}/>
      <StatCard label="Lucro líquido" value={money(s.netProfit)} note="Resultado após despesas" icon={<Wallet size={17}/>}/>
      <StatCard label="Pedidos" value={String(s.orders)} note="No histórico" icon={<ShoppingBag size={17}/>}/>
      <StatCard label="Estoque" value={`${s.stockUnits} un.`} note={`${money(s.stockCost)} em custo`} icon={<Boxes size={17}/>}/>
    </div>
    <div className="dashboard-grid">
      <section className="panel panel-span-2"><div className="panel-head"><div><h2>Últimas vendas</h2><p>Movimentações comerciais mais recentes.</p></div></div><div className="activity-list">{data.sales.length?data.sales.slice(0,7).map(sale=><div className="activity-row" key={sale.id}><div className="activity-mark"><ShoppingBag size={15}/></div><div className="activity-main"><strong>{sale.customerName}</strong><span>{sale.number} · {dateTime(sale.createdAt)}</span></div><div className="activity-side"><strong>{money(sale.total)}</strong><Badge tone={sale.orderStatus==='Entregue'?'success':sale.orderStatus==='Pronto'?'info':sale.orderStatus==='Cancelado'?'danger':'warning'}>{sale.orderStatus}</Badge></div></div>):<EmptyState icon={<ShoppingBag/>} title="Nenhuma venda ainda" text="A primeira venda aparecerá aqui automaticamente."/>}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Estoque em atenção</h2><p>Variantes no limite ou abaixo dele.</p></div><AlertTriangle size={17}/></div>{low.length?<div className="compact-list">{low.map(({p,v})=><div className="compact-row" key={v.id}><div><strong>{p.name}</strong><span>{v.color||'Sem cor'} · {v.size||'Sem tamanho'}</span></div><Badge tone={v.stock===0?'danger':'warning'}>{v.stock} un.</Badge></div>)}</div>:<EmptyState icon={<PackageCheck/>} title="Estoque saudável" text="Nenhuma variante está abaixo do mínimo."/>}</section>
      <section className="panel"><div className="panel-head"><div><h2>Mais vendidos</h2><p>Ranking por quantidade de peças.</p></div></div><div className="ranking-list">{top.map((x,i)=><div className="ranking-row" key={x.p.id}><b>{String(i+1).padStart(2,'0')}</b><div><strong>{x.p.name}</strong><span>{x.p.category}</span></div><em>{x.qty} un.</em></div>)}</div></section>
      <section className="panel"><div className="panel-head"><div><h2>Indicadores</h2><p>Leitura rápida da operação.</p></div></div><div className="summary-lines"><div><span>Ticket médio</span><strong>{money(s.ticketAverage)}</strong></div><div><span>Margem bruta</span><strong>{s.revenue?((s.grossProfit/s.revenue)*100).toFixed(1):'0.0'}%</strong></div><div><span>Margem líquida</span><strong>{s.revenue?((s.netProfit/s.revenue)*100).toFixed(1):'0.0'}%</strong></div></div></section>
    </div>
  </>
}
