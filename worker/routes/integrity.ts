import { now } from '../db';
import { json } from '../http';
import type { Env } from '../types';

type IntegrityIssue={code:string;severity:'critical'|'warning';entity:string;message:string;details?:Record<string,unknown>};

export async function checkIntegrity(env:Env){
  const issues:IntegrityIssue[]=[];

  const stock=await env.DB.prepare(`
    SELECT v.id variant_id,p.name product_name,v.color,v.size,v.stock,
           COALESCE(SUM(m.quantity),0) ledger_stock
    FROM product_variants v
    JOIN products p ON p.id=v.product_id
    LEFT JOIN inventory_movements m ON m.variant_id=v.id
    GROUP BY v.id,p.name,v.color,v.size,v.stock
    HAVING ABS(v.stock-COALESCE(SUM(m.quantity),0))>0.0001
  `).all<any>();
  for(const row of stock.results||[])issues.push({code:'STOCK_LEDGER_MISMATCH',severity:'critical',entity:row.variant_id,message:`${[row.product_name,row.color,row.size].filter(Boolean).join(' · ')}: estoque atual ${row.stock}, mas as movimentações somam ${row.ledger_stock}.`,details:{stock:Number(row.stock),ledgerStock:Number(row.ledger_stock)}});

  const payment=await env.DB.prepare(`
    SELECT s.id,s.number,s.payment_status,s.order_status,s.deleted_at,
           COALESCE(SUM(CASE WHEN ar.status='Pendente' THEN ar.amount ELSE 0 END),0) pending_amount,
           COALESCE(SUM(CASE WHEN ar.status='Pendente' THEN 1 ELSE 0 END),0) pending_count
    FROM sales s
    LEFT JOIN accounts_receivable ar ON ar.sale_id=s.id
    GROUP BY s.id,s.number,s.payment_status,s.order_status,s.deleted_at
    HAVING
      (s.deleted_at IS NULL AND s.order_status<>'Cancelado' AND s.payment_status='Pendente' AND pending_amount<=0.009)
      OR (s.deleted_at IS NULL AND s.order_status<>'Cancelado' AND s.payment_status='Pago' AND pending_amount>0.009)
      OR ((s.deleted_at IS NOT NULL OR s.order_status='Cancelado') AND pending_amount>0.009)
      OR (s.deleted_at IS NULL AND s.order_status<>'Cancelado' AND pending_count>1)
  `).all<any>();
  for(const row of payment.results||[]){
    const pendingCount=Number(row.pending_count||0);
    issues.push({code:pendingCount>1?'MULTIPLE_PENDING_RECEIVABLES':'PAYMENT_RECEIVABLE_MISMATCH',severity:'critical',entity:row.id,message:pendingCount>1?`${row.number}: existem ${pendingCount} cobranças pendentes simultâneas para o mesmo pedido. O ERP deve manter apenas um saldo corrente.`:`${row.number}: status financeiro ${row.payment_status}, mas o A receber pendente é R$ ${Number(row.pending_amount).toFixed(2)}.`,details:{paymentStatus:row.payment_status,pendingAmount:Number(row.pending_amount),pendingCount,orderStatus:row.order_status}});
  }

  const credits=await env.DB.prepare(`
    SELECT c.id,c.name,COALESCE(SUM(ccm.amount),0) balance
    FROM customers c LEFT JOIN customer_credit_movements ccm ON ccm.customer_id=c.id
    GROUP BY c.id,c.name HAVING COALESCE(SUM(ccm.amount),0)<-0.009
  `).all<any>();
  for(const row of credits.results||[])issues.push({code:'NEGATIVE_CUSTOMER_CREDIT',severity:'critical',entity:row.id,message:`${row.name}: saldo de crédito negativo (R$ ${Number(row.balance).toFixed(2)}).`,details:{balance:Number(row.balance)}});

  const returned=await env.DB.prepare(`
    SELECT si.id,s.number,p.name product_name,v.color,v.size,si.quantity,si.returned_quantity,
           COALESCE(SUM(CASE WHEN ri.direction='Entrada' THEN ri.quantity ELSE 0 END),0) ledger_returned
    FROM sale_items si
    JOIN sales s ON s.id=si.sale_id
    JOIN products p ON p.id=si.product_id
    JOIN product_variants v ON v.id=si.variant_id
    LEFT JOIN return_items ri ON ri.sale_item_id=si.id
    GROUP BY si.id,s.number,p.name,v.color,v.size,si.quantity,si.returned_quantity
    HAVING si.returned_quantity<>COALESCE(SUM(CASE WHEN ri.direction='Entrada' THEN ri.quantity ELSE 0 END),0)
       OR si.returned_quantity>si.quantity
  `).all<any>();
  for(const row of returned.results||[])issues.push({code:'RETURN_QUANTITY_MISMATCH',severity:'critical',entity:row.id,message:`${row.number} · ${[row.product_name,row.color,row.size].filter(Boolean).join(' · ')}: controle de devolução ${row.returned_quantity}, histórico ${row.ledger_returned}.`,details:{sold:Number(row.quantity),returned:Number(row.returned_quantity),ledgerReturned:Number(row.ledger_returned)}});

  const settlements=await env.DB.prepare(`
    SELECT r.id,r.number,s.number sale_number,
           r.returned_value,r.exchange_value,r.debt_offset,r.refund_amount,r.credit_amount,r.additional_amount,r.additional_payment_status,
           CASE WHEN r.returned_value>=r.exchange_value THEN r.returned_value-r.exchange_value ELSE 0 END customer_favor,
           CASE WHEN r.exchange_value>r.returned_value THEN r.exchange_value-r.returned_value ELSE 0 END expected_additional
    FROM returns r
    JOIN sales s ON s.id=r.sale_id
    WHERE ABS(
      (CASE WHEN r.returned_value>=r.exchange_value THEN r.returned_value-r.exchange_value ELSE 0 END)
      -(r.debt_offset+r.refund_amount+r.credit_amount)
    )>0.009
       OR ABS(r.additional_amount-(CASE WHEN r.exchange_value>r.returned_value THEN r.exchange_value-r.returned_value ELSE 0 END))>0.009
       OR (r.additional_amount>0.009 AND r.additional_payment_status IS NULL)
       OR (r.additional_amount<=0.009 AND r.additional_payment_status IS NOT NULL)
  `).all<any>();
  for(const row of settlements.results||[])issues.push({code:'RETURN_SETTLEMENT_MISMATCH',severity:'critical',entity:row.id,message:`${row.number} · ${row.sale_number}: o acerto financeiro da troca/devolução não fecha com o valor das mercadorias.`,details:{returnedValue:Number(row.returned_value),exchangeValue:Number(row.exchange_value),debtOffset:Number(row.debt_offset),refund:Number(row.refund_amount),credit:Number(row.credit_amount),additional:Number(row.additional_amount)}});

  const purchases=await env.DB.prepare(`
    SELECT pu.id,pu.number,pu.status,pu.received_at,pu.reversed_at,
           COALESCE(SUM(CASE WHEN m.reference_type='purchase' AND m.type='Entrada' THEN m.quantity ELSE 0 END),0) received_qty,
           COALESCE(SUM(CASE WHEN m.reference_type='purchase_reversal' THEN m.quantity ELSE 0 END),0) reversed_qty
    FROM purchases pu LEFT JOIN inventory_movements m ON m.reference_id=pu.id
    GROUP BY pu.id,pu.number,pu.status,pu.received_at,pu.reversed_at
    HAVING (pu.status='Recebido' AND received_qty<=0)
       OR (pu.reversed_at IS NOT NULL AND ABS(received_qty+reversed_qty)>0.0001)
  `).all<any>();
  for(const row of purchases.results||[])issues.push({code:'PURCHASE_STOCK_MISMATCH',severity:'critical',entity:row.id,message:`${row.number}: estado da compra não corresponde às movimentações de estoque.`,details:{status:row.status,receivedQty:Number(row.received_qty),reversedQty:Number(row.reversed_qty)}});

  const archived=await env.DB.prepare(`
    SELECT p.id,p.name,COALESCE(SUM(v.stock),0) stock
    FROM products p LEFT JOIN product_variants v ON v.product_id=p.id
    WHERE p.status='Arquivado' GROUP BY p.id,p.name HAVING COALESCE(SUM(v.stock),0)>0
  `).all<any>();
  for(const row of archived.results||[])issues.push({code:'ARCHIVED_WITH_STOCK',severity:'warning',entity:row.id,message:`${row.name} está arquivado, mas ainda possui ${row.stock} unidade(s) em estoque.`,details:{stock:Number(row.stock)}});

  return json({ok:!issues.some(i=>i.severity==='critical'),checkedAt:now(),issues,counts:{critical:issues.filter(i=>i.severity==='critical').length,warning:issues.filter(i=>i.severity==='warning').length,total:issues.length}});
}
