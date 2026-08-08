import {
  BadgeDollarSign, Boxes, Building2, ChartNoAxesCombined, CircleDollarSign, Columns3, Database, Landmark, LayoutDashboard, LogOut, Menu, PackagePlus, Receipt,
  Repeat2, Search, Settings2, ShoppingBag, ShoppingCart, Shirt, Users, WalletCards, X
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { BootstrapData } from '../types';
import { Button } from './ui';
import { Logo } from './Logo';

export type PageKey='dashboard'|'sales'|'orders'|'returns'|'customers'|'products'|'inventory'|'entries'|'pricing'|'suppliers'|'purchases'|'finance'|'receivables'|'expenses'|'capital'|'reports'|'data'|'settings';

const items:Array<{key:PageKey;label:string;icon:typeof LayoutDashboard;section:string}>=[
  {key:'dashboard',label:'Visão geral',icon:LayoutDashboard,section:'Visão'},
  {key:'sales',label:'Vendas',icon:ShoppingBag,section:'Vendas'},
  {key:'orders',label:'Pedidos',icon:Columns3,section:'Vendas'},
  {key:'returns',label:'Trocas e devoluções',icon:Repeat2,section:'Vendas'},
  {key:'customers',label:'Clientes',icon:Users,section:'Vendas'},
  {key:'products',label:'Produtos',icon:Shirt,section:'Catálogo'},
  {key:'inventory',label:'Estoque',icon:Boxes,section:'Catálogo'},
  {key:'entries',label:'Entradas',icon:PackagePlus,section:'Catálogo'},
  {key:'pricing',label:'Precificação',icon:BadgeDollarSign,section:'Catálogo'},
  {key:'purchases',label:'Compras',icon:ShoppingCart,section:'Compras'},
  {key:'suppliers',label:'Fornecedores',icon:Building2,section:'Compras'},
  {key:'finance',label:'Financeiro',icon:WalletCards,section:'Financeiro'},
  {key:'receivables',label:'A receber',icon:CircleDollarSign,section:'Financeiro'},
  {key:'expenses',label:'Despesas',icon:Receipt,section:'Financeiro'},
  {key:'capital',label:'Capital e retiradas',icon:Landmark,section:'Financeiro'},
  {key:'reports',label:'Relatórios',icon:ChartNoAxesCombined,section:'Análise'},
  {key:'data',label:'Dados',icon:Database,section:'Sistema'},
  {key:'settings',label:'Configurações',icon:Settings2,section:'Sistema'},
];

export function AppShell({page,onPage,data,onNewSale,onLogout,children}:{page:PageKey;onPage:(p:PageKey)=>void;data:BootstrapData|null;onNewSale:()=>void;onLogout:()=>void;children:ReactNode}){
  const [mobileOpen,setMobileOpen]=useState(false);const [q,setQ]=useState('');const [searchOpen,setSearchOpen]=useState(false);
  const sections=[...new Set(items.map(i=>i.section))];const pending=data?.sales.filter(s=>s.orderStatus==='Separando'||s.orderStatus==='Pronto').length||0;const pendingPurchases=data?.purchases.filter(p=>p.status==='Pedido').length||0;const pendingReceivables=data?.receivables.filter(r=>r.status==='Pendente').length||0;const pendingExpenses=data?.expenses.filter(e=>e.status==='Pendente').length||0;
  const results=useMemo(()=>{const term=q.trim().toLowerCase();if(!term||!data)return[];const out:Array<{kind:string;title:string;sub:string;page:PageKey}>=[];data.customers.filter(c=>`${c.name} ${c.phone} ${c.instagram||''}`.toLowerCase().includes(term)).slice(0,3).forEach(c=>out.push({kind:'Cliente',title:c.name,sub:c.creditBalance>0?`${c.phone} · crédito disponível`:c.phone,page:'customers'}));data.products.filter(p=>`${p.name} ${p.category}`.toLowerCase().includes(term)).slice(0,3).forEach(p=>out.push({kind:'Produto',title:p.name,sub:`${p.variants.reduce((n,v)=>n+v.stock,0)} un. em estoque`,page:'products'}));data.sales.filter(s=>`${s.number} ${s.customerName}`.toLowerCase().includes(term)).slice(0,3).forEach(s=>out.push({kind:'Pedido',title:s.number,sub:s.customerName,page:'orders'}));data.suppliers.filter(s=>`${s.name} ${s.phone||''} ${s.instagram||''} ${s.cnpj||''}`.toLowerCase().includes(term)).slice(0,2).forEach(s=>out.push({kind:'Fornecedor',title:s.name,sub:s.phone||s.instagram||'Fornecedor',page:'suppliers'}));data.purchases.filter(p=>`${p.number} ${p.supplierName}`.toLowerCase().includes(term)).slice(0,2).forEach(p=>out.push({kind:'Compra',title:p.number,sub:p.supplierName,page:'purchases'}));return out},[q,data]);
  async function logout(){await api('/api/auth/logout',{method:'POST'}).catch(()=>undefined);onLogout()}
  return <div className="app-shell"><aside className={`sidebar ${mobileOpen?'sidebar-open':''}`}><div className="sidebar-head"><Logo/><button className="sidebar-close" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div><nav className="nav">{sections.map(section=><div key={section} className="nav-group"><span className="nav-section">{section}</span>{items.filter(i=>i.section===section).map(item=>{const Icon=item.icon;const count=item.key==='orders'?pending:item.key==='purchases'?pendingPurchases:item.key==='receivables'?pendingReceivables:item.key==='expenses'?pendingExpenses:0;return <button key={item.key} className={`nav-item ${page===item.key?'active':''}`} onClick={()=>{onPage(item.key);setMobileOpen(false)}}><Icon size={18}/><span>{item.label}</span>{count>0&&<b>{count}</b>}</button>})}</div>)}</nav><div className="sidebar-foot"><div className="account"><div className="avatar">Y</div><div><strong>YVIE</strong><span>Administrador</span></div></div><button className="logout" onClick={logout} title="Sair"><LogOut size={17}/></button></div></aside><section className="main-area"><header className="topbar"><button className="mobile-toggle" onClick={()=>setMobileOpen(true)}><Menu size={19}/></button><div className="global-search"><Search size={16}/><input value={q} onFocus={()=>setSearchOpen(true)} onChange={e=>{setQ(e.target.value);setSearchOpen(true)}} placeholder="Pesquisar cliente, produto, compra ou pedido..."/>{searchOpen&&q&&<div className="search-popover">{results.length?results.map((r,i)=><button key={`${r.kind}-${i}`} onClick={()=>{onPage(r.page);setQ('');setSearchOpen(false)}}><span>{r.kind}</span><strong>{r.title}</strong><small>{r.sub}</small></button>):<div className="search-empty">Nenhum resultado.</div>}</div>}</div><div className="topbar-actions"><Button variant="primary" onClick={onNewSale}><ShoppingBag size={16}/>Nova venda</Button></div></header><main className="page-content">{children}</main></section></div>
}
