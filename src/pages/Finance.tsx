import { CircleDollarSign, Clock3, CreditCard, Receipt, ShoppingCart, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PeriodFilter, currentMonthRange, inRange } from '../components/PeriodFilter';
import { useData } from '../context/DataContext';
import { money, shortDate } from '../lib/format';
import { Badge, EmptyState, PageHeader, StatCard } from '../components/ui';

export function Finance(){
  const {data}=useData();const [range,setRange]=useState(currentMonthRange());
  const period=useMemo(()=>{if(!data)return null;const sales=data.sales.filter(s=>s.orderStatus!=='Cancelado'&&inRange(s.createdAt,range));const returns=data.returns.filter(r=>inRange(r.createdAt,range));const returnedRevenue=returns.flatMap(r=>r.items).filter(i=>i.direction==='Entrada').reduce((a,i)=>a+i.quantity*i.unitPrice,0);const exchangeRevenue=returns.flatMap(r=>r.items).filter(i=>i.direction==='Saída').reduce((a,i)=>a+i.quantity*i.unitPrice,0);const revenue=sales.reduce((a,s)=>a+s.total,0)-returnedRevenue+exchangeRevenue;const saleCost=sales.reduce((a,s)=>a+s.costTotal,0);const returnedCost=returns.flatMap(r=>r.items).filter(i=>i.direction==='Entrada').reduce((a,i)=>a+i.quantity*i.unitCost,0);const exchangeCost=returns.flatMap(r=>r.items).filter(i=>i.direction==='Saída').reduce((a,i)=>a+i.quantity*i.unitCost,0);const cost=saleCost-returnedCost+exchangeCost;const expenses=data.expenses.filter(e=>e.status==='Pago'&&inRange(e.expenseDate,range)).reduce((a,e)=>a+e.amount,0);return{revenue,cost,expenses,net:revenue-cost-expenses}},[data,range]);
  if(!data||!period)return null;const s=data.summary;
  const pendingReceivables=data.receivables.filter(r=>r.status==='Pendente');
  const pendingExpenses=data.expenses.filter(e=>e.status==='Pendente');
  return <>
    <PageHeader title="Financeiro" subtitle="Aqui ficam os números de dinheiro: vendas, custos, despesas, valores a receber e compromissos a pagar." actions={<PeriodFilter value={range} onChange={setRange}/>}/>
    <div className="stats-grid four">
      <StatCard label="Faturamento" value={money(period.revenue)} note={range.label} icon={<WalletCards size={17}/>}/>
      <StatCard label="Custo das peças vendidas" value={money(period.cost)} note="Custo do que efetivamente saiu" icon={<ShoppingCart size={17}/>}/>
      <StatCard label="Despesas pagas" value={money(period.expenses)} note="Despesas quitadas no período" icon={<Receipt size={17}/>}/>
      <StatCard label="Lucro líquido" value={money(period.net)} note="Faturamento − peças − despesas" icon={<CircleDollarSign size={17}/>}/>
    </div>
    <div className="finance-position-grid">
      <article><div><Clock3 size={17}/><span>A receber</span></div><strong>{money(s.receivablePending)}</strong><small>{pendingReceivables.length} conta{pendingReceivables.length===1?'':'s'} pendente{pendingReceivables.length===1?'':'s'}</small></article>
      <article><div><Receipt size={17}/><span>Despesas a pagar</span></div><strong>{money(s.payableExpenses)}</strong><small>{pendingExpenses.length} despesa{pendingExpenses.length===1?'':'s'} pendente{pendingExpenses.length===1?'':'s'}</small></article>
      <article><div><CreditCard size={17}/><span>Créditos de clientes</span></div><strong>{money(s.customerCreditOutstanding)}</strong><small>Saldo que clientes podem usar em novas compras</small></article>
      <article><div><ShoppingCart size={17}/><span>Compras em aberto</span></div><strong>{money(s.pendingPurchases)}</strong><small>Pedidos de compra ainda não recebidos</small></article>
    </div>
    <div className="finance-grid finance-operational-grid">
      <section className="panel"><div className="panel-head"><div><h2>Próximos recebimentos</h2><p>O que ainda precisa entrar.</p></div></div>{pendingReceivables.length?<div className="activity-list">{pendingReceivables.slice(0,8).map(r=><div className="activity-row" key={r.id}><div className="activity-mark"><Clock3 size={15}/></div><div className="activity-main"><strong>{r.customerName}</strong><span>{r.saleNumber} · {r.dueDate?`vence ${shortDate(r.dueDate)}`:'sem vencimento'}</span></div><div className="activity-side"><strong>{money(r.amount)}</strong><Badge tone="warning">Pendente</Badge></div></div>)}</div>:<EmptyState icon={<Clock3/>} title="Nada a receber" text="Não há vendas com saldo financeiro pendente."/>}</section>
      <section className="panel"><div className="panel-head"><div><h2>Despesas pendentes</h2><p>O que ainda precisa sair.</p></div></div>{pendingExpenses.length?<div className="activity-list">{pendingExpenses.slice(0,8).map(e=><div className="activity-row" key={e.id}><div className="activity-mark"><Receipt size={15}/></div><div className="activity-main"><strong>{e.description}</strong><span>{e.beneficiary||e.category}{e.dueDate?` · vence ${shortDate(e.dueDate)}`:''}</span></div><div className="activity-side"><strong>{money(e.amount)}</strong><Badge tone="warning">Pendente</Badge></div></div>)}</div>:<EmptyState icon={<Receipt/>} title="Nenhuma despesa pendente" text="Todas as despesas cadastradas estão quitadas."/>}</section>
    </div>
    <div className="finance-scope-note"><strong>Sem duplicidade de função</strong><span>Valor investido em mercadoria fica em Estoque. Pró-labore, aportes e retirada de lucro ficam em Sócios e retiradas. O Financeiro concentra apenas o resultado e os compromissos financeiros.</span></div>
  </>
}
