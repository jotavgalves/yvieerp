import type { BootstrapData } from '../types';

function setWidths(sheet:any,widths:number[]){sheet['!cols']=widths.map(w=>({wch:w}))}

export async function exportYvieWorkbook(data:BootstrapData){
  const XLSX=await import('xlsx');
  const wb=XLSX.utils.book_new();
  wb.Props={Title:'YVIE Gestão',Subject:'Exportação completa do ERP YVIE',Author:'YVIE'};

  const summary=[
    ['YVIE — Resumo gerencial',''],
    ['Indicador','Valor'],
    ['Faturamento',data.summary.revenue],
    ['Lucro bruto',data.summary.grossProfit],
    ['Despesas',data.summary.expenses],
    ['Lucro líquido',data.summary.netProfit],
    ['Pedidos',data.summary.orders],
    ['Ticket médio',data.summary.ticketAverage],
    ['Peças em estoque',data.summary.stockUnits],
    ['Capital investido no estoque',data.summary.stockCost],
    ['Faturamento potencial do estoque',data.summary.stockPotentialRevenue],
    ['Lucro bruto potencial do estoque',data.summary.stockPotentialProfit],
    ['Compras pendentes',data.summary.pendingPurchases],
    ['Exportado em',new Date().toLocaleString('pt-BR')],
  ];
  const wsSummary=XLSX.utils.aoa_to_sheet(summary);setWidths(wsSummary,[38,22]);XLSX.utils.book_append_sheet(wb,wsSummary,'Resumo');

  const stockRows=data.products.flatMap(p=>p.variants.filter(v=>v.active).map(v=>({
    Produto:p.name,Categoria:p.category,Coleção:p.collection||'',Cor:v.color||'',Tamanho:v.size||'',SKU:v.sku||'',Quantidade:v.stock,
    'Custo médio':v.averageCost,'Preço de venda':v.salePrice,'Capital investido':v.stock*v.averageCost,'Faturamento potencial':v.stock*v.salePrice,'Lucro potencial':v.stock*(v.salePrice-v.averageCost),
  })));
  const wsStock=XLSX.utils.json_to_sheet(stockRows);setWidths(wsStock,[26,18,16,16,12,18,12,14,14,18,20,18]);XLSX.utils.book_append_sheet(wb,wsStock,'Estoque');

  const salesRows=data.sales.map(s=>({'Pedido':s.number,'Data':s.createdAt,'Cliente':s.customerName,'Status do pedido':s.orderStatus,'Status pagamento':s.paymentStatus,'Forma de pagamento':s.paymentMethod,'Subtotal':s.subtotal,'Desconto':s.discount,'Faturamento':s.total,'Custo':s.costTotal,'Lucro':s.profit}));
  const wsSales=XLSX.utils.json_to_sheet(salesRows);setWidths(wsSales,[16,22,28,18,18,20,14,12,14,14,14]);XLSX.utils.book_append_sheet(wb,wsSales,'Vendas');

  const saleItems=data.sales.flatMap(s=>s.items.map(i=>({'Pedido':s.number,'Cliente':s.customerName,'Produto':i.productName,'Cor':i.color||'','Tamanho':i.size||'','Quantidade':i.quantity,'Preço unitário':i.unitPrice,'Custo unitário':i.unitCost,'Total vendido':i.quantity*i.unitPrice,'Lucro do item':i.quantity*(i.unitPrice-i.unitCost)})));
  const wsSaleItems=XLSX.utils.json_to_sheet(saleItems);setWidths(wsSaleItems,[16,26,26,15,12,12,16,16,16,16]);XLSX.utils.book_append_sheet(wb,wsSaleItems,'Itens de vendas');

  const expenseRows=data.expenses.map(e=>({'Data':e.expenseDate,'Descrição':e.description,'Categoria':e.category,'Valor':e.amount,'Recorrente':e.recurring?'Sim':'Não','Observações':e.notes||''}));
  const wsExpenses=XLSX.utils.json_to_sheet(expenseRows);setWidths(wsExpenses,[14,30,20,14,12,35]);XLSX.utils.book_append_sheet(wb,wsExpenses,'Despesas');

  const customerRows=data.customers.map(c=>({'Nome':c.name,'Telefone':c.phone,'Instagram':c.instagram||'','E-mail':c.email||'','Cidade':c.city||'','Tags':c.tags.join(', '),'Observações':c.notes||'','Cadastro':c.createdAt}));
  const wsCustomers=XLSX.utils.json_to_sheet(customerRows);setWidths(wsCustomers,[28,18,20,30,18,24,38,22]);XLSX.utils.book_append_sheet(wb,wsCustomers,'Clientes');

  const supplierRows=data.suppliers.map(s=>({'Nome':s.name,'Telefone':s.phone||'','Instagram':s.instagram||'','E-mail':s.email||'','CNPJ':s.cnpj||'','Status':s.active?'Ativo':'Arquivado','Observações':s.notes||''}));
  const wsSuppliers=XLSX.utils.json_to_sheet(supplierRows);setWidths(wsSuppliers,[30,18,20,30,20,14,38]);XLSX.utils.book_append_sheet(wb,wsSuppliers,'Fornecedores');

  const purchaseRows=data.purchases.map(p=>({'Compra':p.number,'Data':p.purchaseDate,'Fornecedor':p.supplierName,'Status':p.status,'Unidades':p.totalUnits,'Mercadorias':p.itemsSubtotal,'Frete':p.freightCost,'Outros custos':p.otherCost,'Custo total':p.totalCost,'Recebido em':p.receivedAt||'','Observações':p.notes||''}));
  const wsPurchases=XLSX.utils.json_to_sheet(purchaseRows);setWidths(wsPurchases,[20,14,28,14,12,14,12,14,14,22,35]);XLSX.utils.book_append_sheet(wb,wsPurchases,'Compras');

  const purchaseItems=data.purchases.flatMap(p=>p.items.map(i=>({'Compra':p.number,'Fornecedor':p.supplierName,'Produto':i.productName,'Cor':i.color||'','Tamanho':i.size||'','SKU':i.sku||'','Quantidade':i.quantity,'Custo unitário':i.unitCost,'Subtotal':i.quantity*i.unitCost})));
  const wsPurchaseItems=XLSX.utils.json_to_sheet(purchaseItems);setWidths(wsPurchaseItems,[20,28,26,15,12,18,12,16,14]);XLSX.utils.book_append_sheet(wb,wsPurchaseItems,'Itens de compras');

  const pricingRows=data.pricing.map(r=>({'Data':r.createdAt,'Produto':r.productName,'Cor':r.color||'','Tamanho':r.size||'','Custo da peça':r.pieceCost,'Frete':r.freightCost,'Outros custos':r.otherCost,'Custo total':r.totalCost,'Margem alvo %':r.targetMargin,'Taxa cartão %':r.cardFee,'Preço à vista':r.cashPrice,'Preço cartão':r.cardPrice,'Preço aplicado':r.appliedPrice}));
  const wsPricing=XLSX.utils.json_to_sheet(pricingRows);setWidths(wsPricing,[22,26,15,12,16,12,14,14,16,16,16,16,16]);XLSX.utils.book_append_sheet(wb,wsPricing,'Precificação');

  const date=new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb,`YVIE_Gestao_${date}.xlsx`,{compression:true});
}
