import { BarChart3, Boxes, CircleDollarSign, Download, Trophy, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button, PageHeader } from '../components/ui';
import { useData } from '../context/DataContext';
import { exportYvieWorkbook } from '../lib/exportWorkbook';
import { money } from '../lib/format';
import { notify } from '../lib/api';

export function Reports(){
  const {data}=useData();const [exporting,setExporting]=useState(false);if(!data)return null;const current=data;
  const sold=current.products.map(p=>({name:p.name,qty:current.sales.filter(s=>s.orderStatus!=='Cancelado').flatMap(s=>s.items).filter(i=>i.productId===p.id).reduce((a,i)=>a+i.quantity,0)})).sort((a,b)=>b.qty-a.qty);
  const max=Math.max(1,...sold.map(x=>x.qty));
  const customers=current.customers.map(c=>({name:c.name,total:current.sales.filter(s=>s.customerId===c.id&&s.orderStatus!=='Cancelado').reduce((a,s)=>a+s.total,0)})).sort((a,b)=>b.total-a.total);
  const cmax=Math.max(1,...customers.map(x=>x.total));
  async function exportExcel(){setExporting(true);try{await exportYvieWorkbook(current);notify('Planilha Excel gerada com estoque, vendas, compras, clientes, fornecedores, despesas e precificação.')}finally{setExporting(false)}}
  return <><PageHeader title="Relatórios" subtitle="Indicadores objetivos para compra, estoque, produto e relacionamento." actions={<Button variant="primary" loading={exporting} onClick={()=>void exportExcel()}><Download size={16}/>Exportar Excel</Button>}/><div className="reports-grid"><Report icon={<CircleDollarSign/>} title="Margem bruta" value={`${current.summary.revenue?((current.summary.grossProfit/current.summary.revenue)*100).toFixed(1):'0.0'}%`} text="Lucro bruto em relação ao faturamento."/><Report icon={<Boxes/>} title="Capital no estoque" value={money(current.summary.stockCost)} text={`${current.summary.stockUnits} unidades disponíveis.`}/><Report icon={<CircleDollarSign/>} title="Lucro potencial do estoque" value={money(current.summary.stockPotentialProfit)} text={`Faturamento potencial ${money(current.summary.stockPotentialRevenue)}.`}/><Report icon={<BarChart3/>} title="Ticket médio" value={money(current.summary.ticketAverage)} text="Valor médio por venda não cancelada."/><section className="report-card wide"><div className="report-title"><Trophy size={17}/><div><h3>Produtos mais vendidos</h3><p>Quantidade de peças por produto.</p></div></div><div className="bars">{sold.slice(0,6).map(x=><div className="bar-row" key={x.name}><span>{x.name}</span><div><i style={{width:`${x.qty/max*100}%`}}/></div><strong>{x.qty}</strong></div>)}</div></section><section className="report-card wide"><div className="report-title"><Users size={17}/><div><h3>Clientes com maior compra</h3><p>Valor acumulado no histórico.</p></div></div><div className="bars">{customers.slice(0,6).map(x=><div className="bar-row" key={x.name}><span>{x.name}</span><div><i style={{width:`${x.total/cmax*100}%`}}/></div><strong>{money(x.total)}</strong></div>)}</div></section></div></>}
function Report({icon,title,value,text}:{icon:ReactNode;title:string;value:string;text:string}){return <article className="report-card"><div className="report-title">{icon}<div><h3>{title}</h3><p>{text}</p></div></div><strong className="report-value">{value}</strong></article>}
