import { Archive, Building2, MessageCircle, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, ConfirmDialog, Drawer, EmptyState, Field, Input, PageHeader, SearchInput, Textarea } from '../components/ui';
import { useData } from '../context/DataContext';
import { api, notify } from '../lib/api';
import { money, shortDate } from '../lib/format';
import type { Supplier } from '../types';

const blank={name:'',phone:'',instagram:'',email:'',cnpj:'',notes:'',active:true};
export function Suppliers(){
  const {data,refresh}=useData();
  const [q,setQ]=useState('');const [open,setOpen]=useState(false);const [editing,setEditing]=useState<Supplier|null>(null);const [form,setForm]=useState(blank);const [busy,setBusy]=useState(false);const [archive,setArchive]=useState<Supplier|null>(null);
  const rows=useMemo(()=>data?.suppliers.filter(s=>`${s.name} ${s.phone||''} ${s.instagram||''} ${s.cnpj||''}`.toLowerCase().includes(q.toLowerCase()))||[],[data,q]);
  function create(){setEditing(null);setForm(blank);setOpen(true)}
  function edit(s:Supplier){setEditing(s);setForm({name:s.name,phone:s.phone||'',instagram:s.instagram||'',email:s.email||'',cnpj:s.cnpj||'',notes:s.notes||'',active:s.active});setOpen(true)}
  async function save(){if(!form.name.trim())return;setBusy(true);try{await api(editing?`/api/suppliers/${editing.id}`:'/api/suppliers',{method:editing?'PUT':'POST',body:JSON.stringify(form)});setOpen(false);await refresh();notify(`Fornecedor ${editing?'atualizado':'cadastrado'} com sucesso.`)}finally{setBusy(false)}}
  async function doArchive(){if(!archive)return;setBusy(true);try{await api(`/api/suppliers/${archive.id}/archive`,{method:'POST'});setArchive(null);await refresh();notify('Fornecedor arquivado.')}finally{setBusy(false)}}
  function whats(phone:string|null){if(!phone)return;const digits=phone.replace(/\D/g,'');window.open(`https://wa.me/${digits.startsWith('55')?digits:`55${digits}`}`,'_blank','noopener,noreferrer')}
  return <>
    <PageHeader title="Fornecedores" subtitle="Contatos, histórico de compras e origem do custo das mercadorias." actions={<Button variant="primary" onClick={create}><Plus size={16}/>Novo fornecedor</Button>}/>
    <div className="toolbar"><SearchInput value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar fornecedor, telefone, Instagram ou CNPJ..."/></div>
    <section className="table-panel">{rows.length?<div className="table-scroll"><table><thead><tr><th>Fornecedor</th><th>Contato</th><th>CNPJ</th><th>Compras</th><th>Total comprado</th><th>Última compra</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(s=>{const purchases=data?.purchases.filter(p=>p.supplierId===s.id&&p.status!=='Cancelado')||[];const total=purchases.reduce((a,p)=>a+p.totalCost,0);const last=[...purchases].sort((a,b)=>b.purchaseDate.localeCompare(a.purchaseDate))[0];return <tr key={s.id}><td><div className="entity"><div className="entity-icon"><Building2 size={16}/></div><div><strong>{s.name}</strong><span>{s.instagram||s.email||'Sem contato secundário'}</span></div></div></td><td>{s.phone||'—'}</td><td className="muted-cell">{s.cnpj||'—'}</td><td>{purchases.length}</td><td>{money(total)}</td><td>{last?shortDate(last.purchaseDate):'—'}</td><td><Badge tone={s.active?'success':'neutral'}>{s.active?'Ativo':'Arquivado'}</Badge></td><td><div className="row-actions">{s.phone&&<button className="icon-btn" title="Abrir WhatsApp" onClick={()=>whats(s.phone)}><MessageCircle size={15}/></button>}<button className="icon-btn" title="Editar" onClick={()=>edit(s)}><Pencil size={15}/></button>{s.active&&<button className="icon-btn danger-icon" title="Arquivar" onClick={()=>setArchive(s)}><Archive size={15}/></button>}</div></td></tr>})}</tbody></table></div>:<EmptyState icon={<Building2/>} title="Nenhum fornecedor" text="Cadastre fornecedores para vincular compras, custos e reposições." action={<Button onClick={create}>Cadastrar fornecedor</Button>}/>}</section>
    <Drawer open={open} title={editing?'Editar fornecedor':'Novo fornecedor'} subtitle="As informações ficam vinculadas ao histórico de compras." onClose={()=>setOpen(false)} footer={<><Button onClick={()=>setOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={save}>Salvar fornecedor</Button></>}>
      <div className="form-grid"><Field label="Nome" required className="span-2"><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome ou razão social"/></Field><Field label="WhatsApp"><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(81) 99999-9999"/></Field><Field label="Instagram"><Input value={form.instagram} onChange={e=>setForm({...form,instagram:e.target.value})} placeholder="@fornecedor"/></Field><Field label="E-mail"><Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="CNPJ"><Input value={form.cnpj} onChange={e=>setForm({...form,cnpj:e.target.value})}/></Field><Field label="Observações" className="span-2"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Prazo, condições, catálogo, pessoa de contato..."/></Field></div>
    </Drawer>
    <ConfirmDialog open={!!archive} title="Arquivar fornecedor?" text="O histórico de compras será preservado. O fornecedor deixa de aparecer em novas compras." onClose={()=>setArchive(null)} onConfirm={doArchive} busy={busy}/>
  </>
}
