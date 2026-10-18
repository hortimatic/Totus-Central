-- Optional initial configuration; contains no business movements or taxpayer data.
-- Codes are internal Totus identifiers. Leave accountant/AEAT identifiers blank
-- until supplied by the accountant. Never overwrite existing category settings.
insert into public.ops_expense_categories(code,name,aeat_group,manager_code,deductible_default,fixed_asset_default,active,sort_order)
select v.code,v.name,'','',v.deductible,false,true,v.ord from (values
 ('MERCH','Compras de mercaderías',true,10),
 ('RENT','Arrendamientos y cánones',true,20),
 ('PROFESSIONAL','Servicios profesionales',true,30),
 ('UTILITIES','Suministros',true,40),
 ('TRANSPORT','Transportes',true,50),
 ('SERVICES','Otros servicios',true,60),
 ('PAYROLL','Sueldos y salarios',true,70),
 ('SOCIAL','Seguridad Social de empleados',true,80),
 ('RETA','Seguridad Social de autónomos',true,90),
 ('INTERNAL_PERSONAL','Control interno: gastos personales',false,100)
) v(code,name,deductible,ord)
where not exists(select 1 from public.ops_expense_categories c where c.code=v.code);
