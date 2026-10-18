
import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[],sizes=[320,390,768,1180,1440,1640,1920];
for(const width of sizes){
 const page=await browser.newPage({viewport:{width,height:900},locale:'es-ES'});
 page.on('pageerror',e=>errors.push(width+' JS '+e.message));
 await page.goto('http://127.0.0.1:4173/tests/ui-harness.html?route=administracion&section=negocio',{waitUntil:'networkidle'});
 const business=await page.evaluate(()=>{
  const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
  const head=document.querySelector('.business-stores-head'),h=head?.querySelector('h2'),b=head?.querySelector('[data-action="store-new"]');
  const parent=document.querySelector('.business-layout');
  if(!h||!b||!parent)return null;
  const ctx=document.createElement('canvas').getContext('2d');ctx.font=getComputedStyle(h).font;
  return {title:box(h),button:box(b),word:ctx.measureText('Establecimientos').width,
    business:box(parent.firstElementChild),stores:box(parent.lastElementChild),screenWidth:innerWidth};
 });
 if(!business){errors.push(width+': missing business view');continue}
 if(business.title.width<business.word-2)errors.push(width+': title narrower than word');
 if(business.button.y<business.title.bottom+5)errors.push(width+': button squeezes heading');
 if(width>1100&&business.business.height>=business.stores.height-6)errors.push(width+': fiscal card stretched as tall as store list');
 if([1640,390].includes(width))await page.screenshot({path:'artifacts/user_business_'+width+'.png',fullPage:true});
 await page.goto('http://127.0.0.1:4173/tests/ui-harness.html?route=facturacion&mode=record&id=new&type=factura&kind=invoice&origin=totus',{waitUntil:'networkidle'});
 const section=page.locator('details.invoice-presentation');
 if(await section.count()!==1){errors.push(width+': missing invoice presentation');continue}
 if(!(await section.getAttribute('open')))await section.locator('summary').first().click();
 const invoice=await page.evaluate(()=>{
  const el=document.querySelector('.invoice-presentation');
  const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
  const selector=el.querySelector('#ivTemplate'),area=el.querySelector('#ivTerms'),caption=selector.closest('label').querySelector('.field-caption');
  const summary=caption.querySelector('.field-help>summary'),svg=summary.querySelector('svg.field-help-icon');
  return {selector:box(selector),area:box(area),caption:box(caption),icon:box(summary),svg:svg?box(svg):null,
    svgVisible:svg&&getComputedStyle(svg).visibility==='visible'&&getComputedStyle(svg).display!=='none',
    svgStructure:!!svg?.querySelector('circle')&&!!svg?.querySelector('path'),
    after:getComputedStyle(summary,'::after').content,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
 });
 if(Math.abs(invoice.selector.width-invoice.area.width)>4)errors.push(width+': template does not align with full-width textarea: '+JSON.stringify(invoice));
 if(!invoice.svgVisible||!invoice.svgStructure||!invoice.svg||invoice.svg.width<19||invoice.svg.height<19||invoice.icon.width<23||invoice.icon.height<23||!['none','normal'].includes(invoice.after))
  errors.push(width+': information SVG not drawn correctly: '+JSON.stringify(invoice));
 if(invoice.icon.x<invoice.caption.x||invoice.icon.right>invoice.caption.right+3)
  errors.push(width+': info icon outside caption');
 if(invoice.scrollWidth>invoice.viewport+3)errors.push(width+': horizontal page overflow');
 await section.locator('.field-help>summary').first().click();
 if(!(await section.locator('.field-help').first().evaluate(e=>e.open)))
  errors.push(width+': info icon does not open help');
 await section.locator('.field-help>summary').first().click();
 if(width>1100){
  await page.locator('#ivTemplate').scrollIntoViewIfNeeded();
  const aside=await page.evaluate(()=>{
   const parent=document.querySelector('.record-layout>.record-side');
   const summary=parent?.querySelector('.sticky-summary');
   if(!summary)return null;
   const rect=summary.getBoundingClientRect(),owner=parent.getBoundingClientRect();
   return {top:rect.top,bottom:rect.bottom,ownerHeight:owner.height,viewHeight:innerHeight,
    mode:getComputedStyle(summary).position};
  });
  if(!aside||aside.mode!=='sticky'||aside.ownerHeight<700||aside.bottom<90||aside.top>900-120)
   errors.push(width+': sidebar summary disappears when scrolling down to template: '+JSON.stringify(aside));
 }
 if([1640,390].includes(width)){
  await section.locator('#ivTemplate').scrollIntoViewIfNeeded();
  await section.locator('.field-help>summary').first().screenshot({path:'artifacts/field_help_icon_'+width+'.png'});
  await page.screenshot({path:'artifacts/user_invoice_'+width+'.png',fullPage:false});
 }
 await page.close();
}
await browser.close();
fs.writeFileSync('artifacts/user_screenshot_checks.json',JSON.stringify({sizes,errors},null,2));
console.log('USER SCREENSHOT REGRESSIONS: 7 widths (320..1920), 2 screenshots replicated, help icon and grid checked. Errors='+errors.length);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
