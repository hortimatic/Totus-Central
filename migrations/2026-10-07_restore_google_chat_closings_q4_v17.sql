-- Totus Central · restauración de cierres confirmados desde Google Chat.
-- Fuente: import_q34_chat_tax.sql (capturas aportadas por Diego).
-- Corrige una sobrescritura posterior del Excel histórico.
-- No reparte tarjeta por caja cuando la captura solo confirma el total de tienda.

alter table public.ops_daily_closings disable trigger ops_guard_closed_closing_tg;

with x(store_code,business_date,opening_cash,cash_sales,card_sales,cash_withdrawals,actual_cash,include_in_income,notes) as (values
 ('HORTIMATIC','2026-09-30'::date,0.00,0.00,390.55,150.00,276.30,false,'Captura Google Chat. Caja vape 149,09 + caja head 127,21. Registro usado para apertura del 01/10; efectivo del día no reconstruido.'),
 ('NEWOLDSMOK','2026-09-30'::date,141.41,39.80,333.31,0.00,181.21,false,'Captura Google Chat. Caja vape 181,21. Septiembre ya está importado por total mensual; este cierre se conserva para continuidad de caja.'),
 ('HORTIMATIC','2026-10-01'::date,276.30,134.95,230.59,50.00,361.25,true,'Google Chat: vape 209,84; head 151,41.'),
 ('HORTIMATIC','2026-10-02'::date,361.25,195.45,293.85,200.00,356.70,true,'Google Chat: vape 205,29; head 151,41.'),
 ('HORTIMATIC','2026-10-03'::date,356.70,77.15,316.04,50.00,383.85,true,'Google Chat: vape 232,44; head 151,41.'),
 ('NEWOLDSMOK','2026-10-01'::date,181.21,103.45,300.55,200.00,84.66,true,'Google Chat: caja vape 84,66.'),
 ('NEWOLDSMOK','2026-10-02'::date,84.66,95.55,321.45,50.00,130.21,true,'Google Chat: caja vape 130,21.'),
 ('NEWOLDSMOK','2026-10-03'::date,130.21,61.00,254.85,0.00,191.21,true,'Google Chat: caja vape 191,21.')
)
update public.ops_daily_closings c
set opening_cash=x.opening_cash,cash_sales=x.cash_sales,card_sales=x.card_sales,
    bizum_sales=0,online_sales=0,other_income=0,
    cash_withdrawals=x.cash_withdrawals,cash_expenses_declared=0,
    cash_extra_in=0,cash_extra_out=0,
    expected_cash=x.actual_cash,actual_cash=x.actual_cash,difference=0,
    reported_total_sales=null,notes=x.notes,status='cerrado',
    source='importacion_excel',legacy_cash_method=true,
    include_in_income=x.include_in_income,updated_at=now()
from x
join public.ops_stores s on s.code=x.store_code
where c.store_id=s.id and c.business_date=x.business_date;

alter table public.ops_daily_closings enable trigger ops_guard_closed_closing_tg;

with x(store_code,business_date,drawer_code,opening_cash,closing_cash) as (values
 ('HORTIMATIC','2026-09-30'::date,'VAPE',0.00,149.09),
 ('HORTIMATIC','2026-09-30'::date,'HEAD',0.00,127.21),
 ('NEWOLDSMOK','2026-09-30'::date,'VAPE',141.41,181.21),
 ('HORTIMATIC','2026-10-01'::date,'VAPE',149.09,209.84),
 ('HORTIMATIC','2026-10-01'::date,'HEAD',127.21,151.41),
 ('HORTIMATIC','2026-10-02'::date,'VAPE',209.84,205.29),
 ('HORTIMATIC','2026-10-02'::date,'HEAD',151.41,151.41),
 ('HORTIMATIC','2026-10-03'::date,'VAPE',205.29,232.44),
 ('HORTIMATIC','2026-10-03'::date,'HEAD',151.41,151.41),
 ('NEWOLDSMOK','2026-10-01'::date,'VAPE',181.21,84.66),
 ('NEWOLDSMOK','2026-10-02'::date,'VAPE',84.66,130.21),
 ('NEWOLDSMOK','2026-10-03'::date,'VAPE',130.21,191.21)
)
insert into public.ops_daily_closing_drawers(
 closing_id,drawer_id,opening_cash,closing_cash,
 card_sales,bizum_sales,online_sales,other_income,
 cash_withdrawals,cash_expenses_declared,cash_extra_in,cash_extra_out,notes
)
select c.id,d.id,x.opening_cash,x.closing_cash,
       null,null,null,null,null,null,0,0,'Importado de captura Google Chat'
from x
join public.ops_stores s on s.code=x.store_code
join public.ops_daily_closings c on c.store_id=s.id and c.business_date=x.business_date
join public.ops_cash_drawers d on d.store_id=s.id and d.code=x.drawer_code
on conflict(closing_id,drawer_id) do update set
 opening_cash=excluded.opening_cash,closing_cash=excluded.closing_cash,
 card_sales=null,bizum_sales=null,online_sales=null,other_income=null,
 cash_withdrawals=null,cash_expenses_declared=null,
 cash_extra_in=0,cash_extra_out=0,notes=excluded.notes;
