import { GripVertical } from 'lucide-react';
import type { DragEvent } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../lib/api';
import { money, dateTime } from '../lib/format';
import type { OrderStatus, Sale } from '../types';
import { Badge, PageHeader } from '../components/ui';

const columns:OrderStatus[]=['Separando','Pronto','Entregue'];
export function Orders(){
  const {data,refresh}=useData();
  async function drop(e:DragEvent,status:OrderStatus){e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(!id)return;await api(`/api/sales/${id}/status`,{method:'PATCH',body:JSON.stringify({orderStatus:status})});await refresh()}
  return <><PageHeader title="Pedidos" subtitle="Acompanhe a operação do pedido sem misturar logística com pagamento."/><div className="kanban">{columns.map(col=>{const rows=data?.sales.filter(s=>s.orderStatus===col)||[];return <section className="kanban-column" key={col} onDragOver={e=>e.preventDefault()} onDrop={e=>void drop(e,col)}><header><div><span className={`status-dot dot-${col.toLowerCase()}`}/><strong>{col}</strong></div><b>{rows.length}</b></header><div className="kanban-list">{rows.map(s=><OrderCard sale={s} key={s.id}/>)}</div></section>})}</div></>
}
function OrderCard({sale}:{sale:Sale}){return <article className="order-card" draggable onDragStart={e=>e.dataTransfer.setData('text/plain',sale.id)}><div className="order-card-head"><div><strong>{sale.customerName}</strong><span>{sale.number}</span></div><GripVertical size={16}/></div><div className="order-card-items">{sale.items.slice(0,3).map(i=><span key={i.id}>{i.quantity}× {i.productName} · {[i.color,i.size].filter(Boolean).join(' ')}</span>)}</div><footer><div><strong>{money(sale.total)}</strong><Badge tone={sale.paymentStatus==='Pago'?'success':'warning'}>{sale.paymentMethod}</Badge></div><span>{dateTime(sale.createdAt)}</span></footer></article>}
