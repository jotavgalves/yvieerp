import { AlertTriangle, Calculator, CreditCard, History, Search, Sparkles, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Field, Input, PageHeader, StatCard } from '../components/ui';
import { useData } from '../context/DataContext';
import { api, notify } from '../lib/api';
import { dateTime, money } from '../lib/format';

const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const margin=(price:number,cost:number)=>price>0?((price-cost)/price)*100:0;

export function Pricing({openSignal=0,initialProductId=''}:{openSignal?:number;initialProductId?:string}){
  const {data,refresh}=useData();
  const [q,setQ]=useState('');
  const [productId,setProductId]=useState('');
  const [variantId,setVariantId]=useState('');
  const [pieceCost,setPieceCost]=useState(0);
  const [freightCost,setFreightCost]=useState(0);
  const [otherCost,setOtherCost]=useState(0);
  const [targetMargin,setTargetMargin]=useState(55);
  const [cardFee,setCardFee]=useState(6.12);
  const [busy,setBusy]=useState(false);

  const products=useMemo(()=>data?.products.filter(p=>p.status==='Ativo'&&`${p.name} ${p.category} ${p.collection||''}`.toLowerCase().includes(q.toLowerCase()))||[],[data,q]);
  const product=data?.products.find(p=>p.id===productId);
  const variants=product?.variants.filter(v=>v.active)||[];
  const variant=variants.find(v=>v.id===variantId);

  function selectProduct(id:string){
    setProductId(id);
    const p=data?.products.find(x=>x.id===id);
    const v=p?.variants.find(x=>x.active);
    setVariantId(v?.id||'');
    setPieceCost(v?.averageCost||0);
  }
  function selectVariant(id:string){
    setVariantId(id);
    const v=variants.find(x=>x.id===id);
    if(v)setPieceCost(v.averageCost);
  }
  useEffect(()=>{
    if(openSignal>0&&initialProductId)selectProduct(initialProductId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[openSignal,initialProductId]);

  const totalCost=round(pieceCost+freightCost+otherCost);
  const cashPrice=targetMargin>=100?0:round(totalCost/(1-targetMargin/100));
  const cardPrice=cardFee>=100?cashPrice:round(cashPrice/(1-cardFee/100));
  const cashProfit=round(cashPrice-totalCost);
  const cardNet=round(cardPrice*(1-cardFee/100));
  const cardProfit=round(cardNet-totalCost);
  const selectedHistory=(data?.pricing||[]).filter(r=>r.variantId===variantId);
  const allVariants=data?.products.flatMap(p=>p.status==='Ativo'?p.variants.filter(v=>v.active).map(v=>({p,v})):[])||[];
  const lowMargin=allVariants.filter(({v})=>v.cashPrice>0&&margin(v.cashPrice,v.averageCost)<40).length;
  const belowCost=allVariants.filter(({v})=>v.cashPrice>0&&v.cashPrice<v.averageCost).length;

  async function savePrices(){
    if(!variant)return;
    setBusy(true);
    try{
      await api(`/api/pricing/${variant.id}`,{method:'POST',body:JSON.stringify({pieceCost,freightCost,otherCost,targetMargin,cardFee})});
      await refresh();
      notify(`Preços salvos: ${money(cashPrice)} à vista e ${money(cardPrice)} no cartão.`);
    }finally{setBusy(false)}
  }

  return <>
    <PageHeader title="Precificação" subtitle="Defina a margem uma vez e mantenha, para cada variante, um preço à vista e outro no cartão."/>
    <div className="stats-grid four pricing-stats">
      <StatCard label="Produtos ativos" value={String(data?.products.filter(p=>p.status==='Ativo').length||0)} note="Catálogo disponível" icon={<Tag size={16}/>}/>
      <StatCard label="Margem abaixo de 40%" value={String(lowMargin)} note="Com base no preço à vista" icon={<AlertTriangle size={16}/>}/>
      <StatCard label="Abaixo do custo" value={String(belowCost)} note="Venda potencialmente negativa" icon={<AlertTriangle size={16}/>}/>
      <StatCard label="Reprecificações" value={String(data?.pricing.length||0)} note="Histórico preservado" icon={<History size={16}/>}/>
    </div>

    <div className="pricing-layout">
      <section className="pricing-catalog panel">
        <div className="panel-head"><div><h2>Catálogo</h2><p>Escolha o produto e a variante que deseja precificar.</p></div><Calculator size={18}/></div>
        <div className="pricing-search"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar produto..."/></div>
        <div className="pricing-product-list">{products.length?products.map(p=>{
          const active=p.variants.filter(v=>v.active);const avg=active.length?active.reduce((a,v)=>a+margin(v.cashPrice,v.averageCost),0)/active.length:0;
          return <button key={p.id} className={`pricing-product ${productId===p.id?'active':''}`} onClick={()=>selectProduct(p.id)}><div><strong>{p.name}</strong><span>{p.category} · {active.length} variantes</span></div><Badge tone={avg<40?'warning':'success'}>{avg.toFixed(0)}% margem</Badge></button>
        }):<EmptyState icon={<Tag/>} title="Nenhum produto" text="Cadastre produtos para começar a precificar."/>}</div>
      </section>

      <section className="pricing-workspace panel">
        {!product||!variant?<EmptyState icon={<Calculator/>} title="Selecione um produto" text="A calculadora será aberta com o custo médio atual da variante."/>:<>
          <div className="pricing-workspace-head"><div><span className="eyebrow">{product.category}</span><h2>{product.name}</h2><p>Custo médio atual {money(variant.averageCost)} · à vista {money(variant.cashPrice)} · cartão {money(variant.cardPrice)}</p></div><div className="pricing-current-margin"><span>Margem à vista</span><strong>{margin(variant.cashPrice,variant.averageCost).toFixed(1)}%</strong></div></div>
          <div className="pricing-variant-strip">{variants.map(v=><button key={v.id} className={v.id===variantId?'active':''} onClick={()=>selectVariant(v.id)}><strong>{[v.color,v.size].filter(Boolean).join(' · ')||'Sem variação'}</strong><span>{v.stock} un. · {money(v.cashPrice)} / {money(v.cardPrice)}</span></button>)}</div>

          <div className="pricing-form-grid">
            <div className="pricing-block"><div className="pricing-block-title"><span>1</span><div><strong>Composição de custo</strong><small>Use o custo médio ou simule um novo cenário.</small></div></div><div className="form-grid"><Field label="Custo da peça"><Input type="number" min="0" step=".01" value={pieceCost} onChange={e=>setPieceCost(Number(e.target.value))}/></Field><Field label="Frete por peça"><Input type="number" min="0" step=".01" value={freightCost} onChange={e=>setFreightCost(Number(e.target.value))}/></Field><Field label="Outros custos" className="span-2"><Input type="number" min="0" step=".01" value={otherCost} onChange={e=>setOtherCost(Number(e.target.value))}/></Field></div><div className="pricing-total-line"><span>Custo total</span><strong>{money(totalCost)}</strong></div></div>
            <div className="pricing-block"><div className="pricing-block-title"><span>2</span><div><strong>Estratégia</strong><small>Defina margem e taxa do cartão. Os dois preços são salvos juntos.</small></div></div><div className="form-grid"><Field label="Margem desejada %"><Input type="number" min="0" max="95" step=".1" value={targetMargin} onChange={e=>setTargetMargin(Number(e.target.value))}/></Field><Field label="Taxa cartão %"><Input type="number" min="0" max="40" step=".01" value={cardFee} onChange={e=>setCardFee(Number(e.target.value))}/></Field></div><div className="pricing-suggestions"><article><span>Preço à vista / Pix</span><strong>{money(cashPrice)}</strong><small>Lucro {money(cashProfit)} · margem {margin(cashPrice,totalCost).toFixed(1)}%</small></article><article><span>Preço no cartão</span><strong>{money(cardPrice)}</strong><small>Após taxa, lucro líquido {money(cardProfit)}</small></article></div></div>
          </div>

          <div className="pricing-apply"><div><strong>Salvar os dois preços</strong><span>Você não escolhe um deles aqui. Na venda ou pedido, o sistema usa automaticamente o preço correto conforme a forma de pagamento.</span></div><div className="pricing-mode"><button className="active" type="button">À vista / Pix<br/><strong>{money(cashPrice)}</strong></button><button className="active" type="button">Cartão<br/><strong>{money(cardPrice)}</strong></button></div><Button variant="primary" loading={busy} onClick={savePrices}><Sparkles size={15}/>Salvar preços</Button></div>
        </>}
      </section>
    </div>

    <section className="panel pricing-history"><div className="panel-head"><div><h2>Histórico de precificação</h2><p>{variant?'Decisões registradas para a variante selecionada.':'Selecione uma variante para ver o histórico.'}</p></div><History size={18}/></div>{selectedHistory.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Custo peça</th><th>Frete</th><th>Outros</th><th>Custo total</th><th>Margem alvo</th><th>Preço à vista</th><th>Preço cartão</th></tr></thead><tbody>{selectedHistory.map(r=><tr key={r.id}><td>{dateTime(r.createdAt)}</td><td>{money(r.pieceCost)}</td><td>{money(r.freightCost)}</td><td>{money(r.otherCost)}</td><td>{money(r.totalCost)}</td><td>{r.targetMargin.toFixed(1)}%</td><td><strong>{money(r.cashPrice)}</strong></td><td><strong>{money(r.cardPrice)}</strong></td></tr>)}</tbody></table></div>:<div className="pricing-history-empty"><CreditCard size={18}/><span>Nenhuma precificação registrada para esta variante.</span></div>}</section>
  </>
}
