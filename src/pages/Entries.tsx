import { PackagePlus, Plus, Rows3, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../lib/api';
import { money, shortDate } from '../lib/format';
import { Button, EmptyState, Field, Input, Modal, PageHeader, Select } from '../components/ui';

type Row={id:string;variantId?:string;color:string;size:string;quantity:number;unitCost:number;salePrice:number;sku:string;minStock:number};
const id=()=>Math.random().toString(36).slice(2);
export function Entries({openSignal=0}:{openSignal?:number}){
  const {data,refresh}=useData();const [open,setOpen]=useState(false);const [productId,setProductId]=useState('');const [description,setDescription]=useState('');const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [rows,setRows]=useState<Row[]>([]);const [busy,setBusy]=useState(false);
  useEffect(()=>{ if(openSignal>0) setOpen(true); },[openSignal]);
  function choose(pid:string){setProductId(pid);const p=data?.products.find(x=>x.id===pid);setRows(p?.variants.filter(v=>v.active).map(v=>({id:id(),variantId:v.id,color:v.color||'',size:v.size||'',quantity:0,unitCost:v.averageCost,salePrice:v.salePrice,sku:v.sku||'',minStock:v.minStock}))||[blankRow()])}
  function blankRow():Row{return{id:id(),color:'',size:'',quantity:0,unitCost:0,salePrice:0,sku:'',minStock:1}}
  function update(i:number,key:keyof Row,val:string|number){setRows(rs=>rs.map((r,n)=>n===i?{...r,[key]:val}:r))}
  async function save(){const valid=rows.filter(r=>r.quantity>0);if(!productId||!valid.length)return;setBusy(true);try{await api('/api/inventory/entries',{method:'POST',body:JSON.stringify({productId,description,entryDate:date,items:valid})});setOpen(false);setProductId('');setRows([]);setDescription('');await refresh()}finally{setBusy(false)}}
  const totalUnits=rows.reduce((a,r)=>a+r.quantity,0),totalCost=rows.reduce((a,r)=>a+r.quantity*r.unitCost,0);
  return <>
    <PageHeader title="Entradas" subtitle="Reposições e lotes com custo preservado para manter o lucro confiável." actions={<Button variant="primary" onClick={()=>setOpen(true)}><Plus size={16}/>Registrar entrada</Button>}/>
    <section className="table-panel">{data?.entries.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Produto</th><th>Descrição</th><th>Unidades</th><th>Custo total</th><th>Custo médio do lote</th></tr></thead><tbody>{data.entries.map(e=><tr key={e.id}><td>{shortDate(e.entryDate)}</td><td><strong>{e.productName}</strong></td><td>{e.description}</td><td>{e.totalUnits} un.</td><td>{money(e.totalCost)}</td><td>{money(e.totalUnits?e.totalCost/e.totalUnits:0)}</td></tr>)}</tbody></table></div>:<EmptyState icon={<PackagePlus/>} title="Nenhuma entrada registrada" text="Registre a chegada de mercadorias por lote para atualizar o estoque."/>}</section>
    <Modal wide open={open} title="Nova entrada em lote" subtitle="Uma única entrada pode conter várias cores e tamanhos do mesmo produto." onClose={()=>setOpen(false)} footer={<><div className="modal-summary">{totalUnits} unidades · {money(totalCost)}</div><div className="footer-actions"><Button onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Registrar entrada</Button></div></>}>
      <div className="entry-top"><Field label="Produto" required><Select value={productId} onChange={e=>choose(e.target.value)}><option value="">Selecione...</option>{data?.products.filter(p=>p.status==='Ativo').map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</Select></Field><Field label="Data"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Descrição"><Input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Reposição coleção Noir"/></Field></div>
      <div className="entry-grid-head"><span>Cor</span><span>Tamanho</span><span>Quantidade</span><span>Custo un.</span><span>Preço venda</span><span>SKU</span><span>Mín.</span><span></span></div>
      <div className="entry-grid">{rows.map((r,i)=><div className="entry-grid-row" key={r.id}><Input value={r.color} onChange={e=>update(i,'color',e.target.value)}/><Input value={r.size} onChange={e=>update(i,'size',e.target.value)}/><Input type="number" min="0" value={r.quantity} onChange={e=>update(i,'quantity',Number(e.target.value))}/><Input type="number" min="0" step=".01" value={r.unitCost} onChange={e=>update(i,'unitCost',Number(e.target.value))}/><Input type="number" min="0" step=".01" value={r.salePrice} onChange={e=>update(i,'salePrice',Number(e.target.value))}/><Input value={r.sku} onChange={e=>update(i,'sku',e.target.value)}/><Input type="number" min="0" value={r.minStock} onChange={e=>update(i,'minStock',Number(e.target.value))}/><button className="icon-btn danger-icon" onClick={()=>setRows(x=>x.filter((_,n)=>n!==i))}><Trash2 size={14}/></button></div>)}</div>
      <div className="inline-actions"><Button onClick={()=>setRows(x=>[...x,blankRow()])}><Plus size={14}/>Adicionar linha</Button><Button onClick={()=>setRows(x=>[...x,...Array.from({length:5},blankRow)])}><Rows3 size={14}/>Adicionar 5 linhas</Button></div>
    </Modal>
  </>
}
