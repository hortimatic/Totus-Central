-- Disposable database only, with current native journal definitions loaded.
do $$declare result jsonb; data jsonb; denied boolean=false;
begin
 update private.totus_api_connections set enabled=true,verified_revision=revision where id='10000000-0000-4000-8000-000000000003';
 data=jsonb_build_object('actor_id','20000000-0000-4000-8000-000000000001','connection_id','10000000-0000-4000-8000-000000000003','revision',4,'store','hortimatic-2','reference','QA-WEBSITE-3','signature',repeat('a',64));
 result=public.totus_prestashop_product_create_journal('claim','30000000-0000-4000-8000-000000000001',data);
 assert result->>'status'='claimed','New website must claim a product operation';
 result=public.totus_prestashop_product_create_journal('complete','30000000-0000-4000-8000-000000000001',data||'{"product_id":701}'::jsonb);
 assert result->>'status'='completed','New website must complete a product operation';
 result=public.totus_prestashop_product_create_journal('lookup','30000000-0000-4000-8000-000000000001',data);
 assert result->>'store'='hortimatic-2' and result->>'product_id'='701','Journal retains the new website identity';
 begin perform public.totus_prestashop_product_create_journal('claim','30000000-0000-4000-8000-000000000002',data||'{"store":"newoldsmok"}');exception when others then denied=true;end;
 assert denied,'Reject a valid connection paired with a different website';
 result=public.totus_directory_operation('claim','30000000-0000-4000-8000-000000000003',data||'{"resource":"suppliers","operation":"update","record_id":7}');
 assert result->>'status'='claimed','A new website can enter the same directory journal';
 result=public.totus_directory_operation('complete','30000000-0000-4000-8000-000000000003',data||'{"resource":"suppliers","operation":"update","record_id":7}');
 assert result->>'status'='completed','A new website can verify a directory modification';
 result=public.totus_prestashop_existing_product_step('claim','30000000-0000-4000-8000-000000000004','finish_publication',data||'{"product_id":701}');
 assert result->>'status'='claimed','A new website can publish an existing product stage';
end $$;
