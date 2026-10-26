export function templateExample(template,type='factura',date=''){
 const id='__template_preview__';
 return {row:{id,status:'borrador',document_type:type,invoice_kind:'invoice',display_number:'EJEMPLO-0001',issue_date:date,customer_name:'Cliente de ejemplo',customer_tax_id:'12345678Z',customer_address:'Dirección del cliente',customer_email:'cliente@ejemplo.es',concept:'Vista previa de plantilla',payment_method:'transferencia',paid_status:'pendiente',paid_amount:0,base_amount:100,vat_amount:21,total_amount:121,terms_text:template.payment_terms_default||'',footer_text:template.footer_text||''},lines:[{id:'__preview_line__',invoice_id:id,sort_order:10,description:'Ejemplo de concepto o producto',quantity:2,unit_price_base:50,discount_pct:0,vat_rate:21,total_amount:121}]};
}
