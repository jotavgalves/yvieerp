import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui';
import { Logo } from '../components/Logo';

export function Login({ onSuccess }:{onSuccess:()=>void}) {
  const [password,setPassword]=useState('');
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({password})});onSuccess()}catch(err){setError(err instanceof Error?err.message:'Senha inválida.')}finally{setBusy(false)}}
  return <div className="login-screen">
    <div className="login-ambient ambient-a"/><div className="login-ambient ambient-b"/>
    <section className="login-card">
      <div className="login-brand"><Logo/><span>ACESSO RESTRITO</span></div>
      <div className="login-copy"><h1>Gestão da marca,<br/>sem ruído.</h1><p>Vendas, estoque, clientes e resultado em um único ambiente.</p></div>
      <form onSubmit={submit} className="login-form">
        <label><span>Senha de acesso</span><div className="password-field"><LockKeyhole size={17}/><input autoFocus autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} type={show?'text':'password'} placeholder="Digite a senha"/><button type="button" onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        {error&&<div className="login-error">{error}</div>}
        <Button variant="primary" loading={busy} disabled={!password} className="login-submit">Entrar no sistema <ArrowRight size={16}/></Button>
      </form>
      <footer>YVIE · Sistema interno</footer>
    </section>
  </div>
}
