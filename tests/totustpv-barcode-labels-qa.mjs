import test from 'node:test';import assert from 'node:assert/strict';
import {barcodeLabels,barcodeSvg,labelSheetHtml,labelPrintDocument,printBarcodeLabels} from '../src/totustpv/barcode-labels.js';
const scope={field:'ean13',shopId:1,targets:[{productId:1,attributeId:2}]};
const row={product_id:1,attribute_id:2,name:'Artículo',variant_name:'Rojo',reference:'REF',code:'4006381333931',symbology:'ean13',modules:'10100011010100100011110101111010110001010101010000101000001010000100111010010000110011011011001100101'};
const value={source:'native-barcode-labels',field:'ean13',shop_id:1,items:[row],skipped:[]};
test('current label projection binds shop, field and exact selected variants and discards native extras',()=>{
 const result=barcodeLabels({...value,secret:'discarded',items:[{...row,private_extra:'discarded'}]},scope);assert.equal(result.items[0].code,row.code);assert.equal(JSON.stringify(result).includes('discarded'),false);
 for(const changed of [{...value,shop_id:2},{...value,field:'upc'},{...value,items:[{...row,attribute_id:0}]},{...value,items:[row,row]},{...value,items:[]},{...value,items:[{...row,modules:'<script>'}]}])assert.throws(()=>barcodeLabels(changed,scope));
});
test('SVG comes only from bounded binary modules with quiet zones and fixed black-on-white geometry',()=>{
 assert.match(barcodeSvg(row.modules),/<svg/);assert.match(barcodeSvg(row.modules),/fill="white"/);assert.match(barcodeSvg(row.modules),/x="11"/);
 for(const bits of ['', '0'.repeat(95),'1'.repeat(4097),'<img src=x>'])assert.throws(()=>barcodeSvg(bits));
});
test('label copies and physical paper are bounded; wide barcodes require a wider format instead of shrinking',()=>{
 const labels=barcodeLabels(value,scope);assert.equal((labelSheetHtml(labels,{copies:3}).match(/<article/g)||[]).length,3);
 const html=labelPrintDocument(labels);assert.match(html,/@page\{size:58mm 50mm;margin:5mm/);assert.match(html,/height:18.3mm/);
 for(const copies of [0,21,1.5,NaN])assert.throws(()=>labelSheetHtml(labels,{copies}));
 const wide={items:[{...labels.items[0],modules:'10'.repeat(380)}]};assert.throws(()=>labelSheetHtml(wide),/más ancha/);assert.throws(()=>labelSheetHtml(wide,{paper:'a4'}),/más ancha/);
 assert.match(labelPrintDocument(wide,{paper:'a4landscape'}),/size:297mm 210mm/);
 const escaped=labelSheetHtml({items:[{...labels.items[0],name:'<script>alert(1)</script>',code:'<img>'}]});assert.equal(escaped.includes('<script>'),false);assert.equal(escaped.includes('<img>'),false);
});
test('changing account or view while print fonts load removes the frame before opening the print dialog',async()=>{
 const oldDocument=globalThis.document,oldTimeout=globalThis.setTimeout;let release,current=true,printed=0,removed=0,appended=0;
 const frame={style:{},setAttribute(){},isConnected:true,remove(){removed++;this.isConnected=false;},contentDocument:{fonts:{ready:new Promise(r=>{release=r;})}},contentWindow:{addEventListener(){},print(){printed++;}}};
 try{
  globalThis.document={createElement:()=>frame,body:{append(){appended++;}}};globalThis.setTimeout=()=>0;
  printBarcodeLabels(barcodeLabels(value,scope),{}, {current:()=>current});assert.equal(appended,1);
  const loading=frame.onload();current=false;release();await loading;assert.equal(printed,0);assert.equal(removed,1);
  printBarcodeLabels(barcodeLabels(value,scope),{}, {current:()=>false});assert.equal(appended,1);
 }finally{globalThis.document=oldDocument;globalThis.setTimeout=oldTimeout;}
});
