import { clearSessionCookie, createSession, passwordMatches, sessionCookie, verifySession } from './auth';
import { bootstrap } from './db';
import { fail, json, readJson, sameOrigin } from './http';
import { adjustCustomerCredit } from './routes/customerCredits';
import { createCustomer, deleteCustomer, updateCustomer } from './routes/customers';
import { createExpense, deleteExpense, markExpensePaid, updateExpense } from './routes/expenses';
import { checkIntegrity } from './routes/integrity';
import { adjustStock, createStockEntry, deleteStockEntry } from './routes/inventory';
import { applyInventoryCount, cancelInventoryCount, createInventoryCount } from './routes/inventoryCounts';
import { deleteMedia, getMedia, uploadMedia } from './routes/media';
import { getOwnerPolicy, saveOwnerPolicy } from './routes/ownerPolicy';
import { createOwnerTransaction, deleteOwnerTransaction } from './routes/ownerTransactions';
import { savePricing } from './routes/pricing';
import { archiveProduct, createProduct, deleteProduct, duplicateProduct, updateProduct } from './routes/products';
import { cancelPurchase, createPurchase, receivePurchase, reversePurchase } from './routes/purchases';
import { cancelReceivable, receiveReceivable } from './routes/receivables';
import { createReturn } from './routes/returns';
import { cancelSale, createSale, deleteSale, updateOrderDetails, updateOrderStatus } from './routes/sales';
import { archiveSupplier, createSupplier, updateSupplier } from './routes/suppliers';
import type { Env } from './types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url=new URL(request.url);
    try{
      if(url.pathname==='/api/auth/session'&&request.method==='GET')return json({authenticated:await verifySession(request,env)});
      if(url.pathname==='/api/auth/login'&&request.method==='POST'){
        if(!sameOrigin(request))return fail('Origem da requisição não autorizada.',403);
        const input=await readJson<{password?:string}>(request);
        if(!input.password||!(await passwordMatches(input.password,env)))return fail('Senha de acesso inválida.',401);
        const token=await createSession(env);return json({ok:true},200,{'Set-Cookie':sessionCookie(token,request)});
      }
      if(url.pathname==='/api/auth/logout'&&request.method==='POST'){
        if(!sameOrigin(request))return fail('Origem da requisição não autorizada.',403);
        return json({ok:true},200,{'Set-Cookie':clearSessionCookie(request)});
      }
      if(url.pathname.startsWith('/media/')){
        if(!(await verifySession(request,env)))return fail('Sessão expirada. Entre novamente.',401);
        if(request.method!=='GET')return fail('Método não permitido.',405);
        return getMedia(env,decodeURIComponent(url.pathname.slice('/media/'.length)));
      }
      if(!url.pathname.startsWith('/api/'))return new Response(null,{status:404});
      if(!(await verifySession(request,env)))return fail('Sessão expirada. Entre novamente.',401);
      if(['POST','PUT','PATCH','DELETE'].includes(request.method)&&!sameOrigin(request))return fail('Origem da requisição não autorizada.',403);

      if(url.pathname==='/api/bootstrap'&&request.method==='GET')return json(await bootstrap(env));
      if(url.pathname==='/api/integrity'&&request.method==='GET')return checkIntegrity(env);
      if(url.pathname==='/api/media'&&request.method==='POST')return uploadMedia(request,env);
      const media=url.pathname.match(/^\/api\/media\/([^/]+)$/);if(media&&request.method==='DELETE')return deleteMedia(env,media[1]);

      if(url.pathname==='/api/customers'&&request.method==='POST')return createCustomer(request,env);
      const customerCredit=url.pathname.match(/^\/api\/customers\/([^/]+)\/credit$/);if(customerCredit&&request.method==='POST')return adjustCustomerCredit(request,env,customerCredit[1]);
      const customer=url.pathname.match(/^\/api\/customers\/([^/]+)$/);if(customer&&request.method==='PUT')return updateCustomer(request,env,customer[1]);if(customer&&request.method==='DELETE')return deleteCustomer(env,customer[1]);

      if(url.pathname==='/api/suppliers'&&request.method==='POST')return createSupplier(request,env);
      const supplier=url.pathname.match(/^\/api\/suppliers\/([^/]+)$/);if(supplier&&request.method==='PUT')return updateSupplier(request,env,supplier[1]);
      const supplierArchive=url.pathname.match(/^\/api\/suppliers\/([^/]+)\/archive$/);if(supplierArchive&&request.method==='POST')return archiveSupplier(env,supplierArchive[1]);

      if(url.pathname==='/api/purchases'&&request.method==='POST')return createPurchase(request,env);
      const purchaseReceive=url.pathname.match(/^\/api\/purchases\/([^/]+)\/receive$/);if(purchaseReceive&&request.method==='POST')return receivePurchase(env,purchaseReceive[1]);
      const purchaseCancel=url.pathname.match(/^\/api\/purchases\/([^/]+)\/cancel$/);if(purchaseCancel&&request.method==='POST')return cancelPurchase(env,purchaseCancel[1]);
      const purchaseReverse=url.pathname.match(/^\/api\/purchases\/([^/]+)\/reverse$/);if(purchaseReverse&&request.method==='POST')return reversePurchase(env,purchaseReverse[1]);

      if(url.pathname==='/api/products'&&request.method==='POST')return createProduct(request,env);
      const product=url.pathname.match(/^\/api\/products\/([^/]+)$/);if(product&&request.method==='PUT')return updateProduct(request,env,product[1]);if(product&&request.method==='DELETE')return deleteProduct(env,product[1]);
      const duplicate=url.pathname.match(/^\/api\/products\/([^/]+)\/duplicate$/);if(duplicate&&request.method==='POST')return duplicateProduct(env,duplicate[1]);
      const archive=url.pathname.match(/^\/api\/products\/([^/]+)\/archive$/);if(archive&&request.method==='POST')return archiveProduct(env,archive[1]);

      const adjustment=url.pathname.match(/^\/api\/inventory\/([^/]+)\/adjust$/);if(adjustment&&request.method==='POST')return adjustStock(request,env,adjustment[1]);
      if(url.pathname==='/api/inventory/entries'&&request.method==='POST')return createStockEntry(request,env);
      const entry=url.pathname.match(/^\/api\/inventory\/entries\/([^/]+)$/);if(entry&&request.method==='DELETE')return deleteStockEntry(env,entry[1]);
      if(url.pathname==='/api/inventory/counts'&&request.method==='POST')return createInventoryCount(request,env);
      const countApply=url.pathname.match(/^\/api\/inventory\/counts\/([^/]+)\/apply$/);if(countApply&&request.method==='POST')return applyInventoryCount(env,countApply[1]);
      const countCancel=url.pathname.match(/^\/api\/inventory\/counts\/([^/]+)\/cancel$/);if(countCancel&&request.method==='POST')return cancelInventoryCount(env,countCancel[1]);

      const pricing=url.pathname.match(/^\/api\/pricing\/([^/]+)$/);if(pricing&&request.method==='POST')return savePricing(request,env,pricing[1]);

      if(url.pathname==='/api/sales'&&request.method==='POST')return createSale(request,env);
      const status=url.pathname.match(/^\/api\/sales\/([^/]+)\/status$/);if(status&&request.method==='PATCH')return updateOrderStatus(request,env,status[1]);
      const details=url.pathname.match(/^\/api\/sales\/([^/]+)\/details$/);if(details&&request.method==='PATCH')return updateOrderDetails(request,env,details[1]);
      const cancellation=url.pathname.match(/^\/api\/sales\/([^/]+)\/cancel$/);if(cancellation&&request.method==='POST')return cancelSale(env,cancellation[1]);
      const returnRoute=url.pathname.match(/^\/api\/sales\/([^/]+)\/returns$/);if(returnRoute&&request.method==='POST')return createReturn(request,env,returnRoute[1]);
      const sale=url.pathname.match(/^\/api\/sales\/([^/]+)$/);if(sale&&request.method==='DELETE')return deleteSale(env,sale[1]);

      const receivableReceive=url.pathname.match(/^\/api\/receivables\/([^/]+)\/receive$/);if(receivableReceive&&request.method==='POST')return receiveReceivable(env,receivableReceive[1]);
      const receivableCancel=url.pathname.match(/^\/api\/receivables\/([^/]+)\/cancel$/);if(receivableCancel&&request.method==='POST')return cancelReceivable(env,receivableCancel[1]);

      if(url.pathname==='/api/expenses'&&request.method==='POST')return createExpense(request,env);
      const expensePaid=url.pathname.match(/^\/api\/expenses\/([^/]+)\/paid$/);if(expensePaid&&request.method==='POST')return markExpensePaid(env,expensePaid[1]);
      const expense=url.pathname.match(/^\/api\/expenses\/([^/]+)$/);if(expense&&request.method==='PUT')return updateExpense(request,env,expense[1]);if(expense&&request.method==='DELETE')return deleteExpense(env,expense[1]);

      if(url.pathname==='/api/owner-policy'&&request.method==='GET')return getOwnerPolicy(env);
      if(url.pathname==='/api/owner-policy'&&request.method==='PUT')return saveOwnerPolicy(request,env);
      if(url.pathname==='/api/owner-transactions'&&request.method==='POST')return createOwnerTransaction(request,env);
      const ownerTransaction=url.pathname.match(/^\/api\/owner-transactions\/([^/]+)$/);if(ownerTransaction&&request.method==='DELETE')return deleteOwnerTransaction(env,ownerTransaction[1]);

      return fail('Rota não encontrada.',404);
    }catch(error){
      console.error(error);const message=error instanceof Error?error.message:'';
      if(message==='JSON_INVALID')return fail('Corpo da requisição inválido.',400);
      if(message.includes('CHECK constraint failed'))return fail('A operação deixaria os dados em um estado inválido. Atualize as informações e tente novamente.',409);
      if(message.includes('UNIQUE constraint failed'))return fail('Já existe um registro com este SKU ou identificador.',409);
      return fail('Não foi possível concluir a operação.',500);
    }
  },
} satisfies ExportedHandler<Env>;
