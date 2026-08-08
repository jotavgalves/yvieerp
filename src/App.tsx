import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppShell, type PageKey } from './components/AppShell';
import { ToastHost } from './components/ToastHost';
import { Button } from './components/ui';
import { DataProvider, useData } from './context/DataContext';
import { api } from './lib/api';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Entries } from './pages/Entries';
import { Finance } from './pages/Finance';
import { Inventory } from './pages/Inventory';
import { Login } from './pages/Login';
import { Orders } from './pages/Orders';
import { Pricing } from './pages/Pricing';
import { Products } from './pages/Products';
import { Purchases } from './pages/Purchases';
import { Reports } from './pages/Reports';
import { SaleModal, Sales } from './pages/Sales';
import { Settings } from './pages/Settings';
import { Suppliers } from './pages/Suppliers';

function AppBody(){
  const {data,loading,error,refresh}=useData();
  const [page,setPage]=useState<PageKey>(()=>(sessionStorage.getItem('yvie.page') as PageKey)||'dashboard');
  const [saleOpen,setSaleOpen]=useState(false);
  const [entryRequest,setEntryRequest]=useState({signal:0,productId:''});
  const [pricingRequest,setPricingRequest]=useState({signal:0,productId:''});
  useEffect(()=>sessionStorage.setItem('yvie.page',page),[page]);
  const openEntry=(productId='')=>{setPage('entries');setEntryRequest(r=>({signal:r.signal+1,productId}))};
  const openPricing=(productId='')=>{setPage('pricing');setPricingRequest(r=>({signal:r.signal+1,productId}))};
  const content=useMemo(()=>({
    dashboard:<Dashboard/>,
    sales:<Sales/>,
    orders:<Orders/>,
    customers:<Customers/>,
    products:<Products onNewEntry={openEntry} onPricing={openPricing}/>,
    inventory:<Inventory onNewEntry={()=>openEntry()}/>,
    entries:<Entries openSignal={entryRequest.signal} initialProductId={entryRequest.productId}/>,
    pricing:<Pricing openSignal={pricingRequest.signal} initialProductId={pricingRequest.productId}/>,
    purchases:<Purchases/>,
    suppliers:<Suppliers/>,
    finance:<Finance/>,
    reports:<Reports/>,
    settings:<Settings/>
  })[page],[page,entryRequest.signal,entryRequest.productId,pricingRequest.signal,pricingRequest.productId]);
  if(loading)return <div className="app-loader"><LoaderCircle className="spin"/><span>Carregando YVIE...</span></div>;
  if(error)return <div className="fatal-state"><TriangleAlert/><h2>Não foi possível carregar o sistema</h2><p>{error}</p><Button onClick={()=>void refresh()}>Tentar novamente</Button></div>;
  return <><AppShell page={page} onPage={setPage} data={data} onNewSale={()=>setSaleOpen(true)} onLogout={()=>window.location.reload()}>{content}</AppShell><SaleModal open={saleOpen} onClose={()=>setSaleOpen(false)}/></>;
}

export default function App(){
  const [auth,setAuth]=useState<'checking'|'in'|'out'>('checking');
  useEffect(()=>{
    api<{authenticated:boolean}>('/api/auth/session').then(r=>setAuth(r.authenticated?'in':'out')).catch(()=>setAuth('out'));
    const unauthorized=()=>setAuth('out');
    window.addEventListener('yvie:unauthorized',unauthorized);
    return()=>window.removeEventListener('yvie:unauthorized',unauthorized);
  },[]);
  let content;
  if(auth==='checking')content=<div className="app-loader"><LoaderCircle className="spin"/><span>Validando sessão...</span></div>;
  else if(auth==='out')content=<Login onSuccess={()=>setAuth('in')}/>;
  else content=<DataProvider><AppBody/></DataProvider>;
  return <>{content}<ToastHost/></>;
}
