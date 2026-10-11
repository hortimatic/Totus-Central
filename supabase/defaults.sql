-- Datos maestros mínimos de Totus Central. No son datos de prueba.
insert into public.ops_document_templates(
 code,name,style,primary_color,secondary_color,text_color,font_family,logo_width_mm,show_logo,show_payment_details,
 header_text,footer_text,payment_terms_default,bank_details,invoice_title,proforma_title,active,default_invoice,default_proforma,
 logo_position,show_company_email,show_company_phone,notes_default
)
select 'PROF-BASE','Profesional','brand','#17365D','#4472C4','#17202A','helvetica',34,true,true,
'','Gracias por tu confianza.','','','FACTURA','FACTURA PROFORMA',true,true,true,'left',true,true,''
where not exists(select 1 from public.ops_document_templates);
