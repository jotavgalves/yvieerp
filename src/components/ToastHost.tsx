import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Toast = { id: number; message: string; tone: 'success' | 'error' };
let nextId = 1;

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; tone?: 'success' | 'error' }>).detail;
      if (!detail?.message) return;
      const toast: Toast = { id: nextId++, message: detail.message, tone: detail.tone || 'success' };
      setItems(current => [...current.slice(-3), toast]);
      window.setTimeout(() => setItems(current => current.filter(item => item.id !== toast.id)), 4200);
    };
    window.addEventListener('yvie:toast', handler);
    return () => window.removeEventListener('yvie:toast', handler);
  }, []);

  if (!items.length) return null;
  return <div className="toast-host" aria-live="polite">{items.map(item => <div className={`toast toast-${item.tone}`} key={item.id}>{item.tone === 'error' ? <CircleAlert size={17}/> : <CheckCircle2 size={17}/>}<span>{item.message}</span><button onClick={() => setItems(current => current.filter(x => x.id !== item.id))} aria-label="Fechar aviso"><X size={14}/></button></div>)}</div>;
}
