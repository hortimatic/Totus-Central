import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {startLocalServer} from './local-static-server.mjs';
import {prepareTpvPrintHtml,receiptHtml,TOTUS_PRINTER_PROFILE} from '../src/totustpv/documents.js';
import {cashReportHtml} from '../src/totustpv/cash-reports.js';
import {receiptLogoUrl} from '../src/totustpv/receipt-options.js';
const document={existing_document:true,kind:'receipt',currency:'EUR',order_id:42,reference:'QA-42',created_at:'2026-11-16 12:00:00',
 merchant:{name:'Totus · laboratorio',address:'Calle de prueba',city:'Madrid'},lines:[{name:'Café ñandú <img src=x onerror=alert(1)>',reference:'REFERENCIA-LARGA-DE-PRUEBA-1234567890',quantity:1,line_cents:801}],
 payments:{bizum:801},total_cents:801,discount_cents:0};
const report={status:'closed',currency:'EUR',environment:'qa',sessionId:'00000000-0000-4000-8000-000000000001',storeName:'Tienda de prueba',drawerName:'Caja 1',
 openedAt:'2026-11-16T08:00:00Z',closedAt:'2026-11-16T12:00:00Z',generatedAt:'2026-11-16T12:01:00Z',openedByName:'Cajero QA',closedByName:'Cajero QA',
 openingCents:10000,expectedCashCents:9900,countedCents:9900,differenceCents:0,orderCount:1,refundCount:1,payments:{bizum:801},refunds:{bizum:801},
 movementCount:1,movements:[{kind:'cash-out',amountCents:100,reason:'Retirada de prueba <script>alert(1)</script>',recordedAt:'2026-11-16T11:00:00Z'}]};
const server=await startLocalServer({enabled:true}),browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({viewport:{width:220,height:900}});await mkdir('artifacts/native-lab',{recursive:true});
 await page.route('https://native-fixture.invalid/img/logo.png',async route=>route.fulfill({contentType:'image/png',body:await readFile('assets/branding/hortimatic.png')}));
 const withLogo={...document,merchant_logo_origin:'https://native-fixture.invalid',merchant:{...document.merchant,logo_path:'/img/logo.png'}};
 for(const [origin,path] of [['javascript:alert(1)','/img/logo.png'],['https://fixture.invalid/path','/img/logo.png'],['https://fixture.invalid','/img/../secret.png'],['https://fixture.invalid','/img/logo.svg'],['https://fixture.invalid','/img/logo.png?secret=1']])assert.equal(receiptLogoUrl(origin,path),null);
 assert.doesNotMatch(receiptHtml(withLogo,{showLogo:false}),/tpv-receipt-logo/);
 const customer={email:'cliente-laboratorio@example.invalid',invoice:{name:'Cliente ficticio',company:'Empresa ficticia',address1:'Calle ficticia 1',postcode:'28001',city:'Madrid',country:'España',phone:'600000000',comment:'Aviso <img src=x onerror=alert(1)>'},delivery:{name:'Destinatario ficticio',address1:'Entrega ficticia 2',city:'Madrid'}};
 const customerOptions={showCustomer:true,showCustomerPhone:true,showCustomerEmail:true,showAddressComment:true,showDeliveryAddress:true,showCustomerCompany:true};
 assert.doesNotMatch(receiptHtml({...document,customer}),/cliente-laboratorio|Cliente ficticio/,'Customer fields are opt-in');
 await page.goto('http://127.0.0.1:4173/tests/totustpv-workspace.html');
 await page.evaluate(async()=>{window.fitPrint=(await import('/src/totustpv/documents.js')).fitTpvPrintPage;});
 assert.deepEqual([TOTUS_PRINTER_PROFILE.paperMm,TOTUS_PRINTER_PROFILE.printableMm],[58,48]);
 for(const [kind,html] of [['receipt',receiptHtml(document)],['gift',receiptHtml({...document,kind:'gift'})],['cash-report',cashReportHtml(report)],
  ['receipt-custom',receiptHtml(document,{title:'Gracias por tu compra',fontFamily:'monospace',fontSize:16,footer:'Hasta pronto\n<img src=x onerror=alert(1)>',showReferences:false,showPayments:false,showOrderReference:false,numberLines:true})],
  ['receipt-logo',receiptHtml(withLogo)],['gift-logo',receiptHtml({...withLogo,kind:'gift'})],
  ['receipt-customer',receiptHtml({...document,customer},customerOptions)],['gift-customer',receiptHtml({...document,customer,kind:'gift'},customerOptions)]]){
  await page.setContent(prepareTpvPrintHtml(html,'TotusTPV · prueba 58 mm'));
  const dimensions=await page.evaluate(()=>window.fitPrint(document));assert.equal(dimensions.paperMm,58);assert.ok(dimensions.heightMm<(kind==='receipt-custom'?400:220));
  assert.equal(await page.locator('script').count(),0,'Document values must remain text, not executable markup');
  assert.equal(await page.locator('img').count(),kind.endsWith('-logo')?1:0,'Only the verified merchant image may render');
  if(kind.endsWith('-logo'))assert.equal(await page.locator('.tpv-receipt-logo').evaluate(img=>img.complete&&img.naturalWidth>0),true,'The logo loads before printing');
  assert.equal(await page.evaluate(()=>document.body.scrollWidth>document.body.clientWidth+1),false,kind+' must fit the 48 mm print area');
  if(kind.startsWith('gift'))assert.doesNotMatch(await page.locator('body').innerText(),/8,01|€/);
  else if(kind==='receipt-custom'){assert.doesNotMatch(await page.locator('body').innerText(),/Bizum|REFERENCIA-LARGA/);
   assert.doesNotMatch(await page.locator('body').innerText(),/QA-42/);assert.match(await page.locator('body').innerText(),/Pedido #42/);
   assert.match(await page.locator('tbody tr').first().innerText(),/^1\. Café/);
   assert.match(await page.locator('body').innerText(),/Gracias por tu compra/);assert.equal(await page.locator('.tpv-document').evaluate(el=>getComputedStyle(el).fontSize),'16px');}
  else assert.match(await page.locator('body').innerText(),/Bizum/);
  if(kind==='receipt-customer')assert.match(await page.locator('.tpv-receipt-customer').innerText(),/Cliente ficticio[\s\S]*Empresa ficticia[\s\S]*600000000[\s\S]*cliente-laboratorio[\s\S]*Aviso <img[\s\S]*Destinatario ficticio/);
  if(kind==='gift-customer')assert.doesNotMatch(await page.locator('body').innerText(),/Cliente ficticio|cliente-laboratorio|600000000/);
  const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true,path:`artifacts/native-lab/${kind}-58mm.pdf`});
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  await page.screenshot({path:`artifacts/native-lab/${kind}-58mm.png`,clip:{x:0,y:0,width:220,height:await page.locator('body').evaluate(el=>Math.ceil(el.getBoundingClientRect().height))}});
 }
 console.log('PASS 58 mm paper / 48 mm content: receipt, gift, cash report, configured 16px monospace receipt, loaded logos, optional customer fields, gift privacy, escaped values and PDF layout. Browser simulation; logo delivery intercepted; physical printer and drawer not tested.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
