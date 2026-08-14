import { AlertTriangle, Calculator, CreditCard, History, Search, Sparkles, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Field, Input, PageHeader, StatCard } from '../components/ui';
import { useData } from '../context/DataContext';
import { api, notify } from '../lib/api';
import { dateTime, money } from '../lib/format';

const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const margin=(price:number,cost:number)=>price>0?((price-cost)/price)*100:0;
const nonNegative=(value:string)=>Math.max(0,Number(value)||0);

type VariantPricingSetting={
  id:string;
  active:boolean;
  averageCost:number;
  targetMarginOverride:number|null;
  cardFeeOverride:number|null;
  pieceCostOverride:number|null;
  freightCostOverride:number|null;
  otherCostOverride:number|null;
  effectiveTargetMargin:number;
  effectiveCardFee:number;
  effectivePieceCost:number;
  effectiveFreightCost:number;
  effectiveOtherCost:number;
  usesStockCost:boolean;
  inheritsProduct:boolean;
};
type ProductPricingSettings={
  productId:string;
  productName:string;
  defaultTargetMargin:number;
  defaultCardFee:number;
  defaultPieceCost:number|null;
  defaultFreightCost:number;
  defaultOtherCost:number;
  variants:VariantPricingSetting[];
};

export function Pricing({openSignal=0,initialProductId=''}:{openSignal?:number;initialProductId?:string}){
  const {data,refresh}=useData();
  const [q,setQ]=useState('');
  const [productId,setProductId]=useState('');
  const [variantId,setVariantId]=useState('');
  const [settings,setSettings]=useState<ProductPricingSettings|null>(null);
  const [productMargin,setProductMargin]=useState(55);
  const [productCardFee,setProductCardFee]=useState(6.12);
  const [productPieceCost,setProductPieceCost]=useState<number|null>(null);
  const [productFreightCost,setProductFreightCost]=useState(0);
  const [productOtherCost,setProductOtherCost]=useState(0);
  const [customVariant,setCustomVariant]=useState(false);
  const [pieceCost,setPieceCost]=useState(0);
  const [freightCost,setFreightCost]=useState(0);
  const [otherCost,setOtherCost]=useState(0);
  const [targetMargin,setTargetMargin]=useState(55);
  const [cardFee,setCardFee]=useState(6.12);
  const [busy,setBusy]=useState(false);
  const [settingsBusy,setSettingsBusy]=useState(false);

  const products=useMemo(()=>data?.products.filter(p=>p.status==='Ativo'&&`${p.name} ${p.category} ${p.collection||''}`.toLowerCase().includes(q.toLowerCase()))||[],[data,q]);
  const product=data?.products.find(p=>p.id===productId);
  const variants=product?.variants.filter(v=>v.active)||[];
  const variant=variants.find(v=>v.id===variantId);
  const selectedHistory=(data?.pricing||[]).filter(r=>r.variantId===variantId);
  const variantSetting=settings?.variants.find(v=>v.id===variantId)||null;

  async function loadSettings(id:string){
    if(!id){setSettings(null);return null;}
    const loaded=await api<ProductPricingSettings>(`/api/pricing/products/${id}/settings`);
    setSettings(loaded);
    setProductMargin(loaded.defaultTargetMargin);
    setProductCardFee(loaded.defaultCardFee);
    setProductPieceCost(loaded.defaultPieceCost);
    setProductFreightCost(loaded.defaultFreightCost);
    setProductOtherCost(loaded.defaultOtherCost);
    return loaded;
  }

  function selectProduct(id:string){
    setProductId(id);
    const p=data?.products.find(x=>x.id===id);
    const v=p?.variants.find(x=>x.active);
    setVariantId(v?.id||'');
    setSettings(null);
    void loadSettings(id);
  }
  function selectVariant(id:string){setVariantId(id)}

  useEffect(()=>{
    if(openSignal>0&&initialProductId)selectProduct(initialProductId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[openSignal,initialProductId]);

  useEffect(()=>{
    if(!variantId||!data||!settings)return;
    const current=data.products.flatMap(p=>p.variants).find(v=>v.id===variantId);
    const configured=settings.variants.find(v=>v.id===variantId);
    if(!current||!configured)return;
    setCustomVariant(!configured.inheritsProduct);
    setPieceCost(configured.effectivePieceCost);
    setFreightCost(configured.effectiveFreightCost);
    setOtherCost(configured.effectiveOtherCost);
    setTargetMargin(configured.effectiveTargetMargin);
    setCardFee(configured.effectiveCardFee);
  },[variantId,data,settings]);

  const inheritedPieceCost=variant?(settings?.defaultPieceCost??variant.averageCost):0;
  const effectivePieceCost=customVariant?pieceCost:inheritedPieceCost;
  const effectiveFreightCost=customVariant?freightCost:(settings?.defaultFreightCost??productFreightCost);
  const effectiveOtherCost=customVariant?otherCost:(settings?.defaultOtherCost??productOtherCost);
  const effectiveMargin=customVariant?targetMargin:(settings?.defaultTargetMargin??productMargin);
  const effectiveCardFee=customVariant?cardFee:(settings?.defaultCardFee??productCardFee);
  const totalCost=round(effectivePieceCost+effectiveFreightCost+effectiveOtherCost);
  const cashPrice=effectiveMargin>=100?0:round(totalCost/(1-effectiveMargin/100));
  const cardPrice=effectiveCardFee>=100?cashPrice:round(cashPrice/(1-effectiveCardFee/100));
  const cashProfit=round(cashPrice-totalCost);
  const cardNet=round(cardPrice*(1-effectiveCardFee/100));
  const cardProfit=round(cardNet-totalCost);
  const allVariants=data?.products.flatMap(p=>p.status==='Ativo'?p.variants.filter(v=>v.active).map(v=>({p,v})):[])||[];
  const lowMargin=allVariants.filter(({v})=>v.cashPrice>0&&margin(v.cashPrice,v.averageCost)<40).length;
  const belowCost=allVariants.filter(({v})=>v.cashPrice>0&&v.cashPrice<v.averageCost).length;

  async function saveProductRule(){
    if(!product)return;
    setSettingsBusy(true);
    try{
      const saved=await api<{targetMargin:number;cardFee:number;pieceCost:number|null;freightCost:number;otherCost:number;inheritedVariants:number}>(`/api/pricing/products/${product.id}/settings`,{
        method:'PUT',
        body:JSON.stringify({targetMargin:productMargin,cardFee:productCardFee,pieceCost:productPieceCost,freightCost:productFreightCost,otherCost:productOtherCost})
      });
      await loadSettings(product.id);
      notify(`Padrão de ${product.name} salvo · margem ${saved.targetMargin.toFixed(1)}% · taxa ${saved.cardFee.toFixed(2)}% · frete ${money(saved.freightCost)} · outros ${money(saved.otherCost)}.`);
    }finally{setSettingsBusy(false)}
  }

  function inheritVariant(){
    if(!variant)return;
    setCustomVariant(false);
    setPieceCost(settings?.defaultPieceCost??variant.averageCost);
    setFreightCost(settings?.defaultFreightCost??0);
    setOtherCost(settings?.defaultOtherCost??0);
    setTargetMargin(settings?.defaultTargetMargin??productMargin);
    setCardFee(settings?.defaultCardFee??productCardFee);
  }

  function customizeVariant(){
    if(!variant)return;
    setCustomVariant(true);
    setPieceCost(variantSetting?.effectivePieceCost??settings?.defaultPieceCost??variant.averageCost);
    setFreightCost(variantSetting?.effectiveFreightCost??settings?.defaultFreightCost??0);
    setOtherCost(variantSetting?.effectiveOtherCost??settings?.defaultOtherCost??0);
    setTargetMargin(variantSetting?.effectiveTargetMargin??settings?.defaultTargetMargin??productMargin);
    setCardFee(variantSetting?.effectiveCardFee??settings?.defaultCardFee??productCardFee);
  }

  async function savePrices(){
    if(!variant||!product)return;
    setBusy(true);
    try{
      if(customVariant){
        await api(`/api/pricing/variants/${variant.id}/settings`,{
          method:'PUT',
          body:JSON.stringify({inheritProduct:false,targetMargin,cardFee,pieceCost,freightCost,otherCost})
        });
      }else{
        await api(`/api/pricing/variants/${variant.id}/settings`,{method:'PUT',body:JSON.stringify({inheritProduct:true})});
      }
      const saved=await api<{cashPrice:number;cardPrice:number;pieceCost:number;freightCost:number;otherCost:number;targetMargin:number;cardFee:number;inheritsProduct:boolean;persisted:boolean}>(`/api/pricing/${variant.id}`,{method:'POST',body:'{}'});
      if(!saved.persisted)throw new Error('O banco não confirmou a precificação.');
      await refresh();
      await loadSettings(product.id);
      notify(`Salvo: custo ${money(saved.pieceCost)} + frete ${money(saved.freightCost)} + outros ${money(saved.otherCost)} → ${money(saved.cashPrice)} à vista / ${money(saved.cardPrice)} cartão.`);
    }finally{setBusy(false)}
  }

  return <>
    <PageHeader title="Precificação" subtitle="Cada produto pode ter custo-base, frete, outros custos, margem e taxa próprios. Cada variação pode herdar tudo ou ter uma composição totalmente personalizada."/>
    <div className="stats-grid four pricing-stats">
      <StatCard label="Produtos ativos" value={String(data?.products.filter(p=>p.status==='Ativo').length||0)} note="Cada produto pode ter sua regra" icon={<Tag size={16}/>}/>
      <StatCard label="Margem abaixo de 40%" value={String(lowMargin)} note="Com base no preço à vista" icon={<AlertTriangle size={16}/>}/>
      <StatCard label="Abaixo do custo real" value={String(belowCost)} note="Preço à vista abaixo do custo médio do estoque" icon={<AlertTriangle size={16}/>}/>
      <StatCard label="Reprecificações" value={String(data?.pricing.length||0)} note="Histórico por variação" icon={<History size={16}/>}/>
    </div>

    <div className="pricing-layout">
      <section className="pricing-catalog panel">
        <div className="panel-head"><div><h2>Catálogo</h2><p>As regras e os custos de formação são isolados por produto.</p></div><Calculator size={18}/></div>
        <div className="pricing-search"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar produto..."/></div>
        <div className="pricing-product-list">{products.length?products.map(p=>{
          const active=p.variants.filter(v=>v.active);const avg=active.length?active.reduce((a,v)=>a+margin(v.cashPrice,v.averageCost),0)/active.length:0;
          return <button key={p.id} className={`pricing-product ${productId===p.id?'active':''}`} onClick={()=>selectProduct(p.id)}><div><strong>{p.name}</strong><span>{p.category} · {active.length} variantes</span></div><Badge tone={avg<40?'warning':'success'}>{avg.toFixed(0)}% margem atual</Badge></button>
        }):<EmptyState icon={<Tag/>} title="Nenhum produto" text="Cadastre produtos para começar a precificar."/>}</div>
      </section>

      <section className="pricing-workspace panel">
        {!product||!variant?<EmptyState icon={<Calculator/>} title="Selecione um produto" text="Defina o padrão comercial do produto e personalize somente as variações que precisarem ser diferentes."/>:<>
          <div className="pricing-workspace-head"><div><span className="eyebrow">{product.category}</span><h2>{product.name}</h2><p>Custo médio real do estoque {money(variant.averageCost)} · à vista {money(variant.cashPrice)} · cartão {money(variant.cardPrice)}</p></div><div className="pricing-current-margin"><span>Margem atual sobre estoque</span><strong>{margin(variant.cashPrice,variant.averageCost).toFixed(1)}%</strong></div></div>

          <div className="pricing-block">
            <div className="pricing-block-title"><span>P</span><div><strong>Padrão comercial de {product.name}</strong><small>Esses valores pertencem somente a este produto. Deixe o custo-base vazio para cada variação usar automaticamente o próprio custo médio real do estoque.</small></div></div>
            <div className="form-grid">
              <Field label="Custo-base padrão" helper="Opcional. Vazio = usar o custo médio real de cada variação."><Input type="number" min="0" step=".01" value={productPieceCost===null?'':productPieceCost} placeholder="Usar custo do estoque" onChange={e=>setProductPieceCost(e.target.value===''?null:nonNegative(e.target.value))}/></Field>
              <Field label="Frete padrão por peça"><Input type="number" min="0" step=".01" value={productFreightCost} onChange={e=>setProductFreightCost(nonNegative(e.target.value))}/></Field>
              <Field label="Outros custos padrão"><Input type="number" min="0" step=".01" value={productOtherCost} onChange={e=>setProductOtherCost(nonNegative(e.target.value))}/></Field>
              <Field label="Margem padrão %"><Input type="number" min="0" max="95" step=".1" value={productMargin} onChange={e=>setProductMargin(Math.min(95,nonNegative(e.target.value)))}/></Field>
              <Field label="Taxa de maquineta padrão %"><Input type="number" min="0" max="40" step=".01" value={productCardFee} onChange={e=>setProductCardFee(Math.min(40,nonNegative(e.target.value)))}/></Field>
            </div>
            <div className="pricing-apply"><div><strong>Salvar padrão deste produto</strong><span>Não altera outros produtos nem variações personalizadas. Também não muda o custo médio contábil do estoque.</span></div><Button loading={settingsBusy} onClick={()=>void saveProductRule()}>Salvar padrão do produto</Button></div>
          </div>

          <div className="pricing-variant-strip">{variants.map(v=>{const s=settings?.variants.find(x=>x.id===v.id);return <button key={v.id} className={v.id===variantId?'active':''} onClick={()=>selectVariant(v.id)}><strong>{[v.color,v.size].filter(Boolean).join(' · ')||'Sem variação'}</strong><span>{v.stock} un. · {s&&!s.inheritsProduct?'Personalizada':'Padrão do produto'} · {money(v.cashPrice)} / {money(v.cardPrice)}</span></button>})}</div>

          <div className="pricing-block">
            <div className="pricing-block-title"><span>V</span><div><strong>Configuração desta variação</strong><small>Você pode herdar todos os valores de {product.name} ou liberar os cinco componentes para esta variação.</small></div></div>
            <div className="pricing-mode">
              <button type="button" className={!customVariant?'active':''} onClick={inheritVariant}>Herdar do produto<br/><strong>Padrão de {product.name}</strong></button>
              <button type="button" className={customVariant?'active':''} onClick={customizeVariant}>Personalizar variação<br/><strong>{customVariant?'Custos e regra próprios':'Ativar'}</strong></button>
            </div>
          </div>

          <div className="pricing-form-grid">
            <div className="pricing-block">
              <div className="pricing-block-title"><span>1</span><div><strong>Composição de custo</strong><small>{customVariant?'Edite livremente o custo-base, frete e outros custos desta variação.':'Esta variação está herdando a composição do produto.'}</small></div></div>
              <div className="form-grid">
                <Field label="Custo-base para precificação" helper={`Custo médio real do estoque: ${money(variant.averageCost)}. Alterar aqui não muda o capital em estoque.`}><Input type="number" min="0" step=".01" value={effectivePieceCost} disabled={!customVariant} onChange={e=>setPieceCost(nonNegative(e.target.value))}/></Field>
                <Field label="Frete por peça"><Input type="number" min="0" step=".01" value={effectiveFreightCost} disabled={!customVariant} onChange={e=>setFreightCost(nonNegative(e.target.value))}/></Field>
                <Field label="Outros custos"><Input type="number" min="0" step=".01" value={effectiveOtherCost} disabled={!customVariant} onChange={e=>setOtherCost(nonNegative(e.target.value))}/></Field>
              </div>
              {customVariant&&<div className="pricing-apply"><div><strong>Atalho de custo</strong><span>Use o custo médio real atual como ponto de partida sem alterar o estoque.</span></div><Button onClick={()=>setPieceCost(variant.averageCost)}>Usar {money(variant.averageCost)}</Button></div>}
              <div className="pricing-total-line"><span>Custo total usado para formar o preço</span><strong>{money(totalCost)}</strong></div>
            </div>

            <div className="pricing-block">
              <div className="pricing-block-title"><span>2</span><div><strong>Margem e maquineta</strong><small>{customVariant?'Margem e taxa exclusivas desta variação.':'Herdando margem e taxa do produto.'}</small></div></div>
              <div className="form-grid">
                <Field label="Margem %"><Input type="number" min="0" max="95" step=".1" value={effectiveMargin} disabled={!customVariant} onChange={e=>setTargetMargin(Math.min(95,nonNegative(e.target.value)))}/></Field>
                <Field label="Taxa de maquineta %"><Input type="number" min="0" max="40" step=".01" value={effectiveCardFee} disabled={!customVariant} onChange={e=>setCardFee(Math.min(40,nonNegative(e.target.value)))}/></Field>
              </div>
              <div className="pricing-suggestions"><article><span>Preço à vista / Pix</span><strong>{money(cashPrice)}</strong><small>Lucro {money(cashProfit)} · margem {margin(cashPrice,totalCost).toFixed(1)}%</small></article><article><span>Preço no cartão</span><strong>{money(cardPrice)}</strong><small>Taxa {effectiveCardFee.toFixed(2)}% · lucro líquido {money(cardProfit)}</small></article></div>
            </div>
          </div>

          <div className="pricing-apply"><div><strong>{customVariant?'Salvar composição + regra desta variação':'Salvar usando integralmente o padrão do produto'}</strong><span>{customVariant?'Custo-base, frete, outros custos, margem e taxa ficarão gravados apenas nesta variação.':'A variação volta a acompanhar futuras alterações no padrão do produto.'}</span></div><div className="pricing-mode"><button className="active" type="button">À vista / Pix<br/><strong>{money(cashPrice)}</strong></button><button className="active" type="button">Cartão<br/><strong>{money(cardPrice)}</strong></button></div><Button variant="primary" loading={busy} disabled={!settings} onClick={()=>void savePrices()}><Sparkles size={15}/>Salvar precificação</Button></div>
        </>}
      </section>
    </div>

    <section className="panel pricing-history"><div className="panel-head"><div><h2>Histórico de precificação</h2><p>{variant?'Histórico exclusivo da variação selecionada.':'Selecione uma variação para ver o histórico.'}</p></div><History size={18}/></div>{selectedHistory.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Custo-base</th><th>Frete</th><th>Outros</th><th>Custo total</th><th>Margem usada</th><th>Taxa cartão</th><th>Preço à vista</th><th>Preço cartão</th></tr></thead><tbody>{selectedHistory.map(r=><tr key={r.id}><td>{dateTime(r.createdAt)}</td><td>{money(r.pieceCost)}</td><td>{money(r.freightCost)}</td><td>{money(r.otherCost)}</td><td>{money(r.totalCost)}</td><td>{r.targetMargin.toFixed(1)}%</td><td>{r.cardFee.toFixed(2)}%</td><td><strong>{money(r.cashPrice)}</strong></td><td><strong>{money(r.cardPrice)}</strong></td></tr>)}</tbody></table></div>:<div className="pricing-history-empty"><CreditCard size={18}/><span>Nenhuma precificação registrada para esta variação.</span></div>}</section>
  </>
}
