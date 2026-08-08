import { ArrowLeft, Check, Layers3, PackagePlus, Plus, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, EmptyState, Field, Input, PageHeader, Select } from '../components/ui';
import { useData } from '../context/DataContext';
import { api, notify } from '../lib/api';
import { money, shortDate } from '../lib/format';

type Row={id:string;variantId?:string;color:string;size:string;quantity:number;unitCost:number;salePrice:number;sku:string;minStock:number};
const id=()=>Math.random().toString(36).slice(2);
const cleanList=(value:string)=>[...new Set(value.split(/[,;\n]/).map(x=>x.trim()).filter(Boolean))];
const key=(color:string,size:string)=>`${color.trim().toLowerCase()}::${size.trim().toLowerCase()}`;

export function Entries({openSignal=0,initialProductId=''}:{openSignal?:number;initialProductId?:string}){
  const {data,refresh}=useData();
  const [creating,setCreating]=useState(false);
  const [productId,setProductId]=useState('');
  const [description,setDescription]=useState('');
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [rows,setRows]=useState<Row[]>([]);
  const [defaultCost,setDefaultCost]=useState(0);
  const [defaultPrice,setDefaultPrice]=useState(0);
  const [defaultMin,setDefaultMin]=useState(1);
  const [newColors,setNewColors]=useState('');
  const [newSizes,setNewSizes]=useState('');
  const [busy,setBusy]=useState(false);

  function blankRow(color='',size=''):Row{return{id:id(),color,size,quantity:0,unitCost:defaultCost,salePrice:defaultPrice,sku:'',minStock:defaultMin}}
  function choose(pid:string){
    setProductId(pid);
    const p=data?.products.find(x=>x.id===pid);
    const active=p?.variants.filter(v=>v.active)||[];
    const first=active[0];
    setDefaultCost(first?.averageCost||0);setDefaultPrice(first?.salePrice||0);setDefaultMin(first?.minStock||1);
    setRows(active.map(v=>({id:id(),variantId:v.id,color:v.color||'',size:v.size||'',quantity:0,unitCost:v.averageCost,salePrice:v.salePrice,sku:v.sku||'',minStock:v.minStock})));
    setDescription(p?`Entrada de ${p.name}`:'');
  }
  function begin(pid=''){
    setCreating(true);setDate(new Date().toISOString().slice(0,10));setNewColors('');setNewSizes('');
    if(pid)choose(pid);else{setProductId('');setRows([]);setDescription('');setDefaultCost(0);setDefaultPrice(0);setDefaultMin(1)}
  }
  useEffect(()=>{if(openSignal>0)begin(initialProductId)},[openSignal,initialProductId]);

  function updateRow(rowId:string,patch:Partial<Row>){setRows(current=>current.map(r=>r.id===rowId?{...r,...patch}:r))}
  function applyCost(){setRows(current=>current.map(r=>({...r,unitCost:defaultCost})))}
  function applyPrice(){setRows(current=>current.map(r=>({...r,salePrice:defaultPrice})))}
  function generate(){
    const colors=cleanList(newColors);const sizes=cleanList(newSizes);
    const cs=colors.length?colors:[''];const ss=sizes.length?sizes:[''];
    setRows(current=>{
      const existing=new Set(current.map(r=>key(r.color,r.size)));const next=[...current];
      cs.forEach(color=>ss.forEach(size=>{if(!existing.has(key(color,size))){next.push(blankRow(color,size));existing.add(key(color,size))}}));
      return next;
    });
    setNewColors('');setNewSizes('');
  }

  const matrix=useMemo(()=>{
    const colors=[...new Set(rows.map(r=>r.color))];const sizes=[...new Set(rows.map(r=>r.size))];
    return {colors:colors.length?colors:[''],sizes:sizes.length?sizes:['']};
  },[rows]);
  const selectedRows=rows.filter(r=>r.quantity>0);
  const totalUnits=selectedRows.reduce((a,r)=>a+r.quantity,0);
  const totalCost=selectedRows.reduce((a,r)=>a+r.quantity*r.unitCost,0);

  async function save(){
    if(!productId||!selectedRows.length)return;
    setBusy(true);
    try{
      await api('/api/inventory/entries',{method:'POST',body:JSON.stringify({productId,description,entryDate:date,items:selectedRows})});
      await refresh();setCreating(false);setProductId('');setRows([]);setDescription('');
      notify(`${totalUnits} unidades adicionadas ao estoque.`);
    }finally{setBusy(false)}
  }

  if(creating)return <div className="entry-workspace">
    <div className="entry-workspace-head"><button className="entry-back" onClick={()=>setCreating(false)}><ArrowLeft size={17}/></button><div><span>Estoque / Nova entrada</span><h1>Registrar entrada</h1><p>Escolha o produto, informe o lote e digite apenas as quantidades na matriz.</p></div></div>

    <section className="entry-step panel"><div className="entry-step-number">1</div><div className="entry-step-content"><div className="entry-step-copy"><strong>Produto e identificação do lote</strong><span>O histórico preserva a data e o custo desta entrada.</span></div><div className="entry-meta-grid"><Field label="Produto" required><Select value={productId} onChange={e=>choose(e.target.value)}><option value="">Selecione...</option>{data?.products.filter(p=>p.status==='Ativo').map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</Select></Field><Field label="Data"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Descrição"><Input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Reposição coleção Noir"/></Field></div></div></section>

    {productId&&<>
      <section className="entry-step panel"><div className="entry-step-number">2</div><div className="entry-step-content"><div className="entry-step-copy"><strong>Valores padrão do lote</strong><span>Defina uma vez e aplique às variantes. Depois você pode alterar exceções individualmente.</span></div><div className="entry-defaults"><Field label="Custo unitário"><Input type="number" min="0" step=".01" value={defaultCost} onChange={e=>setDefaultCost(Number(e.target.value))}/></Field><Button onClick={applyCost}>Aplicar custo a todas</Button><Field label="Preço de venda"><Input type="number" min="0" step=".01" value={defaultPrice} onChange={e=>setDefaultPrice(Number(e.target.value))}/></Field><Button onClick={applyPrice}>Aplicar preço a todas</Button><Field label="Estoque mínimo"><Input type="number" min="0" value={defaultMin} onChange={e=>setDefaultMin(Number(e.target.value))}/></Field></div></div></section>

      <section className="entry-step panel"><div className="entry-step-number">3</div><div className="entry-step-content"><div className="entry-step-copy row"><div><strong>Quantidades por variante</strong><span>Digite somente o que chegou. Células vazias ou zero não entram no lote.</span></div><span className="entry-chip"><Layers3 size={13}/>{rows.length} variantes</span></div>
        {rows.length?<div className="variant-matrix" style={{'--matrix-columns':matrix.sizes.length} as React.CSSProperties}>
          <div className="matrix-row matrix-head"><div>Cor / tamanho</div>{matrix.sizes.map(size=><div key={size||'none'}>{size||'Único'}</div>)}</div>
          {matrix.colors.map(color=><div className="matrix-row" key={color||'none'}><div className="matrix-label">{color||'Sem cor'}</div>{matrix.sizes.map(size=>{const row=rows.find(r=>r.color===color&&r.size===size);return <div className={`matrix-cell ${row&&row.quantity>0?'filled':''}`} key={`${color}-${size}`}>{row?<><Input aria-label={`${color||'Sem cor'} ${size||'Único'}`} type="number" min="0" value={row.quantity||''} placeholder="0" onChange={e=>updateRow(row.id,{quantity:Number(e.target.value)})}/><span>{row.variantId?'existente':'nova'}</span></>:<span className="matrix-na">—</span>}</div>})}</div>)}
        </div>:<EmptyState icon={<Layers3/>} title="Produto sem variantes" text="Gere abaixo as combinações que chegaram neste lote."/>}
        <div className="variant-generator"><div><Sparkles size={16}/><div><strong>Adicionar novas variações</strong><span>Separe valores por vírgula. O sistema cria as combinações automaticamente.</span></div></div><div className="variant-generator-fields"><Field label="Cores"><Input value={newColors} onChange={e=>setNewColors(e.target.value)} placeholder="Preto, Branco, Vinho"/></Field><Field label="Tamanhos"><Input value={newSizes} onChange={e=>setNewSizes(e.target.value)} placeholder="P, M, G ou 36, 38, 40"/></Field><Button onClick={generate} disabled={!newColors.trim()&&!newSizes.trim()}><Plus size={14}/>Gerar combinações</Button></div></div>
      </div></section>

      {selectedRows.length>0&&<section className="entry-step panel"><div className="entry-step-number">4</div><div className="entry-step-content"><div className="entry-step-copy"><strong>Revisar variantes que entrarão</strong><span>Ajuste apenas exceções de custo, preço ou estoque mínimo.</span></div><div className="entry-review-grid">{selectedRows.map(r=><article className="entry-review-card" key={r.id}><div><strong>{[r.color,r.size].filter(Boolean).join(' · ')||'Sem variação'}</strong><span>{r.quantity} unidades</span></div><Field label="Custo"><Input type="number" min="0" step=".01" value={r.unitCost} onChange={e=>updateRow(r.id,{unitCost:Number(e.target.value)})}/></Field><Field label="Venda"><Input type="number" min="0" step=".01" value={r.salePrice} onChange={e=>updateRow(r.id,{salePrice:Number(e.target.value)})}/></Field><Field label="Mín."><Input type="number" min="0" value={r.minStock} onChange={e=>updateRow(r.id,{minStock:Number(e.target.value)})}/></Field></article>)}</div></div></section>}
    </>}

    <div className="entry-sticky-footer"><div><span>Resumo do lote</span><strong>{totalUnits} unidades · {money(totalCost)}</strong></div><div><Button onClick={()=>setCreating(false)}>Cancelar</Button><Button variant="primary" loading={busy} disabled={!productId||!totalUnits} onClick={save}><Check size={15}/>Confirmar entrada</Button></div></div>
  </div>;

  return <>
    <PageHeader title="Entradas" subtitle="Reposições e lotes com custo preservado para manter o lucro confiável." actions={<Button variant="primary" onClick={()=>begin()}><Plus size={16}/>Registrar entrada</Button>}/>
    <section className="table-panel">{data?.entries.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Produto</th><th>Descrição</th><th>Unidades</th><th>Custo total</th><th>Custo médio do lote</th></tr></thead><tbody>{data.entries.map(e=><tr key={e.id}><td>{shortDate(e.entryDate)}</td><td><strong>{e.productName}</strong></td><td>{e.description}</td><td>{e.totalUnits} un.</td><td>{money(e.totalCost)}</td><td>{money(e.totalUnits?e.totalCost/e.totalUnits:0)}</td></tr>)}</tbody></table></div>:<EmptyState icon={<PackagePlus/>} title="Nenhuma entrada registrada" text="Registre a chegada de mercadorias por lote para atualizar o estoque." action={<Button onClick={()=>begin()}>Registrar primeira entrada</Button>}/>}</section>
  </>;
}
