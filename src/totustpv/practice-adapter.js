/** Training only. Never imports Central's API, credentials or native transport.
 * Synthetic tickets live in a separate, per-user browser namespace. They are
 * not orders, payments, stock receipts or cash closings of the business.
 */
const need=(ok,message)=>{if(!ok)throw new Error(message);};
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const copy=value=>structuredClone(value);
const catalogue=[
 {id:'demo-1',name:'Artículo de práctica',reference:'DEMO-001',category:'Práctica',priceCents:801,stock:20},
 {id:'demo-2',name:'Artículo con variante · Azul',reference:'DEMO-002-A',category:'Variantes',priceCents:1250,stock:12},
 {id:'demo-3',name:'Accesorio de práctica',reference:'DEMO-003',category:'Práctica',priceCents:450,stock:30}
];
export function createTpvPracticeAdapter({actorId,storage,now=Date.now,uuid=()=>crypto.randomUUID(),locks=globalThis.navigator?.locks}={}) {
 need(typeof actorId==='string'&&actorId.length>0&&storage,'La práctica necesita una cuenta identificada.');
 const key=`totus:tpv:practice:v1:${actorId}`;
 let localQueue=Promise.resolve();
 function read() {
  const raw=storage.getItem(key);if(!raw)return {version:1,sessions:[],operations:[],returns:[]};
  need(raw.length<=500000,'El registro de práctica ha superado su límite.');
  let data;try{data=JSON.parse(raw);}catch{throw new Error('El registro de práctica está dañado; no se sobrescribirá.');}
  data.returns??=[];
  need(data?.version===1&&Array.isArray(data.sessions)&&Array.isArray(data.operations)&&Array.isArray(data.returns)&&
   data.sessions.length<=200&&data.operations.length<=1000&&data.returns.length<=1000,'El registro de práctica no es compatible.');
  return data;
 }
 function save(data){storage.setItem(key,JSON.stringify(data));}
 function exclusive(fn) {
  const run=()=>locks?.request?locks.request(key,fn):fn();
  const next=localQueue.then(run,run);localQueue=next.catch(()=>{});return next;
 }
 const getSession=(data,sessionId)=>{
  const session=data.sessions.find(item=>item.id===sessionId);
  need(session&&session.status==='open','Abre una caja de práctica para continuar.');return session;
 };
 const getOperation=(data,operationId)=>{
  const operation=data.operations.find(item=>item.id===operationId);
  need(operation,'No se encuentra el ticket de práctica.');return operation;
 };
 function stockFor(data,session,product) {
  const sold=data.operations.filter(op=>op.status!=='ready'&&op.storeId===session.storeId)
   .flatMap(op=>op.lines).filter(line=>line.productId===product.id).reduce((sum,line)=>sum+line.qty,0);
  const returned=data.returns.filter(op=>op.storeId===session.storeId).flatMap(op=>op.lines)
   .filter(line=>line.productId===product.id&&line.restock).reduce((sum,line)=>sum+line.qty,0);
  return product.stock-sold+returned;
 }
 function quoteIn(data,{sessionId,lines,discountPercent=0}) {
  const session=getSession(data,sessionId);
  need(integer(discountPercent)&&discountPercent<=100,'El descuento debe estar entre 0 y 100 %.');
  need(Array.isArray(lines)&&lines.length>0&&lines.length<=50&&new Set(lines.map(l=>l.productId)).size===lines.length,
   'Añade artículos sin duplicar líneas.');
  const priced=lines.map(line=>{
   const product=catalogue.find(p=>p.id===line.productId);
   need(product&&integer(line.qty)&&line.qty>0&&line.qty<=100,'Cantidad de práctica no válida.');
   need(stockFor(data,session,product)>=line.qty,`No hay existencias de práctica de ${product.name}.`);
   return {productId:product.id,name:product.name,reference:product.reference,qty:line.qty,unitCents:product.priceCents,
    totalCents:product.priceCents*line.qty};
  });
  const subtotalCents=priced.reduce((sum,line)=>sum+line.totalCents,0);
  const discountCents=Math.round(subtotalCents*discountPercent/100),totalCents=subtotalCents-discountCents;
  need(totalCents>0,'El ticket debe tener un importe mayor que cero.');
  // Distribute the paid total exactly; cumulative refunds cannot refund the
  // undiscounted price or lose pennies across several partial returns.
  let remainder=totalCents;
  const allocation=priced.map((line,index)=>({index,fraction:totalCents*line.totalCents%subtotalCents}));
  for(const line of priced){line.paidLineCents=Math.floor(totalCents*line.totalCents/subtotalCents);remainder-=line.paidLineCents;}
  allocation.sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
  for(let n=0;n<remainder;n++)priced[allocation[n].index].paidLineCents++;
  return {sessionId,storeId:session.storeId,drawerId:session.drawerId,currency:'EUR',lines:priced,discountPercent,
   subtotalCents,discountCents,totalCents};
 }
 const fingerprint=quote=>JSON.stringify([quote.sessionId,quote.storeId,quote.drawerId,quote.lines,
  quote.discountPercent,quote.subtotalCents,quote.discountCents,quote.totalCents]);
 function paymentsFor(total,payments) {
  need(Array.isArray(payments)&&payments.length>0&&payments.length<=2,'Selecciona el pago de práctica.');
  need(new Set(payments.map(p=>p.method)).size===payments.length,'No dupliques medios de pago.');
  let allocated=0,changeCents=0;
  const accepted=payments.map(payment=>{
   need(['cash','card'].includes(payment.method)&&integer(payment.amountCents)&&payment.amountCents>0,
    'Importe de pago no válido.');
   allocated+=payment.amountCents;
   if(payment.method==='cash') {
    need(integer(payment.receivedCents)&&payment.receivedCents>=payment.amountCents,'El efectivo recibido no cubre su parte.');
    changeCents=payment.receivedCents-payment.amountCents;
   } else need(payment.simulatedAccepted===true,'Acepta expresamente la tarjeta simulada.');
   return {...copy(payment),simulated:true};
  });
  need(allocated===total,'Los pagos deben cubrir exactamente el total.');
  return {payments:accepted,changeCents};
 }
 return Object.freeze({mode:'practice',
  async context(){return {mode:'practice',operator:actorId,currency:'EUR',stores:[
   {id:'demo-store-a',name:'Tienda de práctica A'},{id:'demo-store-b',name:'Tienda de práctica B'}],
   drawers:[{id:'demo-drawer-a',storeId:'demo-store-a',name:'Caja A'},
    {id:'demo-drawer-b',storeId:'demo-store-b',name:'Caja B'}],sessions:copy(read().sessions)};},
  async searchProducts({sessionId,search='',sortField='name',sortDirection='asc'}) {
   const data=read(),session=getSession(data,sessionId),needle=String(search).toLocaleLowerCase('es');
   return catalogue.filter(p=>`${p.name} ${p.reference}`.toLocaleLowerCase('es').includes(needle))
    .map(product=>({...copy(product),stock:stockFor(data,session,product)})).sort((a,b)=>{
     const key={name:'name',reference:'reference',stock:'stock',price:'priceCents',id:'id',cost:'costCents',manufacturer:'manufacturer',supplier:'supplier'}[sortField]||'name',
      left=a[key]??'',right=b[key]??'',order=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),'es',{numeric:true});
     return (order||String(a.id).localeCompare(String(b.id),'es',{numeric:true}))*(sortDirection==='desc'?-1:1);});
  },
  async openSession({storeId,drawerId,openingCents}) {return exclusive(()=>{
   need(integer(openingCents)&&openingCents<=10000000,'Fondo inicial no válido.');
   need((storeId==='demo-store-a'&&drawerId==='demo-drawer-a')||
    (storeId==='demo-store-b'&&drawerId==='demo-drawer-b'),'La caja no pertenece a esa tienda.');
   const data=read(),existing=data.sessions.find(s=>s.drawerId===drawerId&&s.status==='open');
   if(existing)return copy(existing);
   need(data.sessions.length<200,'Límite de sesiones de práctica alcanzado.');
   const session={id:uuid(),storeId,drawerId,openingCents,status:'open',openedAt:now()};
   data.sessions.push(session);save(data);return copy(session);
  });},
  async quote(command){return exclusive(()=>{
   const data=read(),quote=quoteIn(data,command);
   need(data.operations.length<1000,'Límite de tickets de práctica alcanzado.');
   const operation={...quote,id:uuid(),quoteExpiresAt:now()+120000,status:'ready',createdAt:now(),mode:'practice'};
   data.operations.push(operation);save(data);return copy(operation);
  });},
  async submit({operationId,payments,scenario='normal'}) {return exclusive(()=>{
   need(['normal','lost-response','rejected'].includes(scenario),'Escenario de práctica no válido.');
   const data=read(),operation=getOperation(data,operationId);
   if(operation.status!=='ready')return copy(operation);
   need(operation.quoteExpiresAt>now(),'El cálculo ha caducado. Vuelve al ticket y calcula de nuevo.');
   const fresh=quoteIn(data,operation);
   need(fingerprint(fresh)===fingerprint(operation),'El ticket ha cambiado; calcula de nuevo.');
   const accepted=paymentsFor(operation.totalCents,payments);
   if(scenario==='rejected')throw new Error('Rechazo simulado: no se ha registrado la venta de práctica.');
   operation.status=scenario==='lost-response'?'uncertain':'confirmed';
   operation.payments=accepted.payments;operation.changeCents=accepted.changeCents;
   operation.reference=`PRÁCTICA-${data.operations.indexOf(operation)+1}`;
   operation.confirmedAt=scenario==='normal'?now():null;save(data);
   return copy(operation);
  });},
  async recover({operationId}) {return exclusive(()=>{
   const data=read(),operation=getOperation(data,operationId);
   if(operation.status==='uncertain'){operation.status='confirmed';operation.confirmedAt=now();save(data);}
   return copy(operation);
  });},
  async history({sessionId}) {return copy(read().operations.filter(op=>op.sessionId===sessionId&&op.status!=='ready').reverse());},
  async returnable({sessionId,saleId}) {
   const data=read(),current=getSession(data,sessionId),sale=getOperation(data,saleId);
   need(sale.status==='confirmed'&&sale.storeId===current.storeId,'Sólo puedes devolver una venta confirmada de esta tienda.');
   return {saleId,reference:sale.reference,lines:sale.lines.map(line=>({...copy(line),remainingQty:line.qty-
    data.returns.filter(ret=>ret.saleId===saleId).flatMap(ret=>ret.lines).filter(item=>item.productId===line.productId)
     .reduce((sum,item)=>sum+item.qty,0)}))};
  },
  async refund({operationId,sessionId,saleId,items,refundConfirmed=false}) {return exclusive(()=>{
   need(typeof operationId==='string'&&operationId.length>0&&operationId.length<=100,'Identificador de devolución no válido.');
   const data=read(),current=getSession(data,sessionId),sale=getOperation(data,saleId);
   need(sale.status==='confirmed'&&sale.storeId===current.storeId,'Sólo puedes devolver una venta confirmada de esta tienda.');
   need(Array.isArray(items)&&items.length>0&&items.length<=sale.lines.length&&
    new Set(items.map(item=>item.productId)).size===items.length,'Selecciona líneas de devolución sin duplicarlas.');
   need(refundConfirmed===true,'Confirma el reintegro ficticio antes de registrar la devolución.');
   const intent=JSON.stringify([sessionId,saleId,items.map(({productId,qty,restock})=>({productId,qty,restock})).sort((a,b)=>a.productId.localeCompare(b.productId))]);
   const previous=data.returns.find(ret=>ret.id===operationId);
   if(previous){need(previous.intent===intent,'Ese identificador ya pertenece a otra devolución.');return copy(previous);}
   need(data.returns.length<1000,'Límite de devoluciones de práctica alcanzado.');
   const old=data.returns.filter(ret=>ret.saleId===saleId);
   const returnedLines=items.map(item=>{
    const line=sale.lines.find(line=>line.productId===item.productId);
    need(line&&integer(item.qty)&&item.qty>0&&typeof item.restock==='boolean','Línea de devolución no válida.');
    const returned=old.flatMap(ret=>ret.lines).filter(prior=>prior.productId===item.productId).reduce((sum,prior)=>sum+prior.qty,0);
    need(returned+item.qty<=line.qty,'La cantidad supera lo vendido pendiente de devolver.');
    const paid=line.paidLineCents??line.totalCents;
    return {productId:item.productId,name:line.name,qty:item.qty,restock:item.restock,
     amountCents:Math.round(paid*(returned+item.qty)/line.qty)-Math.round(paid*returned/line.qty)};
   });
   const totalCents=returnedLines.reduce((sum,line)=>sum+line.amountCents,0);
   let pending=totalCents;
   const payments=[];
   for(const original of sale.payments){
    const prior=old.flatMap(ret=>ret.payments).filter(pay=>pay.method===original.method).reduce((sum,pay)=>sum+pay.amountCents,0);
    const amountCents=Math.min(pending,original.amountCents-prior);
    if(amountCents>0){payments.push({method:original.method,amountCents,simulated:true});pending-=amountCents;}
   }
   need(pending===0,'El reintegro supera el pago original disponible.');
   const result={id:operationId,intent,sessionId,saleId,storeId:current.storeId,drawerId:current.drawerId,
    reference:`DEV-PRÁCTICA-${data.returns.length+1}`,lines:returnedLines,totalCents,payments,status:'confirmed',mode:'practice',createdAt:now()};
   data.returns.push(result);save(data);return copy(result);
  });},
  async sessionSummary({sessionId}) {
   const data=read(),session=data.sessions.find(s=>s.id===sessionId);need(session,'Sesión no encontrada.');
   const sales=data.operations.filter(op=>op.sessionId===sessionId&&op.status==='confirmed');
   const cashCents=sales.flatMap(op=>op.payments).filter(p=>p.method==='cash').reduce((sum,p)=>sum+p.amountCents,0);
   const refunds=data.returns.filter(ret=>ret.sessionId===sessionId),refundCashCents=refunds.flatMap(ret=>ret.payments)
    .filter(pay=>pay.method==='cash').reduce((sum,pay)=>sum+pay.amountCents,0);
   return {...copy(session),salesCents:sales.reduce((sum,op)=>sum+op.totalCents,0),cashCents,
    refundsCents:refunds.reduce((sum,ret)=>sum+ret.totalCents,0),refundCashCents,
    expectedCashCents:session.openingCents+cashCents-refundCashCents,
    unresolved:data.operations.filter(op=>op.sessionId===sessionId&&op.status==='uncertain').length};
  },
  async closeSession({sessionId,countedCents}) {return exclusive(()=>{
   const data=read(),session=getSession(data,sessionId);
   need(integer(countedCents)&&countedCents<=10000000,'Recuento no válido.');
   need(!data.operations.some(op=>op.sessionId===sessionId&&op.status==='uncertain'),'Recupera los tickets pendientes antes de cerrar.');
   const cash=data.operations.filter(op=>op.sessionId===sessionId&&op.status==='confirmed').flatMap(op=>op.payments)
    .filter(p=>p.method==='cash').reduce((sum,p)=>sum+p.amountCents,0);
   const refundedCash=data.returns.filter(ret=>ret.sessionId===sessionId).flatMap(ret=>ret.payments)
    .filter(pay=>pay.method==='cash').reduce((sum,pay)=>sum+pay.amountCents,0);
   Object.assign(session,{status:'closed',closedAt:now(),countedCents,differenceCents:countedCents-session.openingCents-cash+refundedCash});
   save(data);return copy(session);
  });}
 });
}
