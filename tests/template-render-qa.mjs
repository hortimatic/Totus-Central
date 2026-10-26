import assert from 'node:assert/strict';
import {templateExample} from '../src/template-preview.js';
import {invoicePreview} from '../src/pages/main.js';
import {state} from '../src/state.js';
state.data.settings={business_name:'Titular QA',business_email:'private@example.invalid',business_phone:'910000000'};
const tpl={style:'compact',font_family:'courier',logo_position:'center',logo_width_mm:24,primary_color:'#112233',secondary_color:'#bb4422',text_color:'#225533',notes_default:'PRIVATE_NOTE',header_text:'Cabecera\nOtra línea',footer_text:'Pie',bank_details:'Banco QA',show_company_email:false,show_company_phone:false};
for(const type of ['factura','proforma']){
 const ex=templateExample(tpl,type,'2026-10-26');assert.equal(ex.row.document_type,type);assert.equal(ex.lines.length,1);
 const html=invoicePreview(ex.row,'https://example.invalid/logo.png',{template:tpl,lines:ex.lines,actions:false});
 assert(html.includes('invoice-logo-center'));assert(html.includes('width:24mm'));assert(html.includes('Courier New'));
 assert(!html.includes('PRIVATE_NOTE'));assert(!html.includes('private@example.invalid'));assert(!html.includes('910000000'));assert(!html.includes('invoice-print'));
}
const ex=templateExample(tpl,'factura','2026-10-26');
const frozen=invoicePreview({...ex.row,status:'emitida',template_snapshot:{...tpl,primary_color:'#abcdef',show_logo:false}},'https://example.invalid/logo.png',{template:{...tpl,primary_color:'#000000'},lines:ex.lines,actions:false});
assert(frozen.includes('--invoice-primary:#abcdef'));assert(!frozen.includes('<img'));
console.log('TEMPLATE RENDER QA: all document types, logo dimensions and alignment, fonts, private notes, hidden fields and frozen design precedence');
