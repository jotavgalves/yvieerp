import { X, LoaderCircle, Search, ChevronDown } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

function useOverlayLock(open:boolean){
  useEffect(()=>{
    if(!open)return;
    const body=document.body;
    const previousOverflow=body.style.overflow;
    const previousPadding=body.style.paddingRight;
    const scrollbar=window.innerWidth-document.documentElement.clientWidth;
    body.classList.add('overlay-open');
    body.style.overflow='hidden';
    if(scrollbar>0)body.style.paddingRight=`${scrollbar}px`;
    return()=>{body.classList.remove('overlay-open');body.style.overflow=previousOverflow;body.style.paddingRight=previousPadding};
  },[open]);
}

export function Button({ className = '', children, variant = 'secondary', loading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'ghost'|'danger'; loading?: boolean }) {
  return <button className={`btn btn-${variant} ${className}`} disabled={loading || props.disabled} {...props}>{loading ? <LoaderCircle className="spin" size={16}/> : children}</button>;
}

export function IconButton({ label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={`icon-btn ${className}`} aria-label={label} title={label} {...props} />;
}

export function Field({ label, helper, required, children, className = '' }: { label: string; helper?: string; required?: boolean; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span className="field-label">{label}{required && <b>*</b>}</span>{children}{helper && <span className="field-helper">{helper}</span>}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className="input" {...props}/>; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className="textarea" {...props}/>; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <div className="select-wrap"><select className="select" {...props}/><ChevronDown size={14}/></div>; }

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <div className="search-field"><Search size={16}/><input {...props}/></div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral'|'success'|'warning'|'danger'|'info' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function Modal({ open, title, subtitle, children, footer, onClose, wide = false }: { open: boolean; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean }) {
  useOverlayLock(open);
  if (!open) return null;
  return <div className="overlay" role="dialog" aria-modal="true" onWheel={e=>e.stopPropagation()}><div className={`modal ${wide?'modal-wide':''}`}><header className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton label="Fechar" onClick={onClose}><X size={18}/></IconButton></header><div className="modal-body">{children}</div>{footer && <footer className="modal-foot">{footer}</footer>}</div></div>;
}

export function Drawer({ open, title, subtitle, children, footer, onClose }: { open: boolean; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  useOverlayLock(open);
  if (!open) return null;
  return <div className="overlay drawer-overlay" role="dialog" aria-modal="true" onWheel={e=>e.stopPropagation()}><aside className="drawer"><header className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><IconButton label="Fechar" onClick={onClose}><X size={18}/></IconButton></header><div className="drawer-body">{children}</div>{footer && <footer className="modal-foot">{footer}</footer>}</aside></div>;
}

export function StatCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{note}</small></article>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function ConfirmDialog({ open, title, text, onClose, onConfirm, busy }: { open:boolean; title:string; text:string; onClose:()=>void; onConfirm:()=>void; busy?:boolean }) {
  return <Modal open={open} title={title} subtitle={text} onClose={onClose} footer={<><Button onClick={onClose}>Voltar</Button><Button variant="danger" onClick={onConfirm} loading={busy}>Confirmar</Button></>}><div className="danger-note">Esta ação será aplicada imediatamente.</div></Modal>;
}
