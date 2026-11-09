-- Disposable fixture only.
reset role;
\ir ../supabase/review_patches/073_product_edit_recovery.sql
set role service_role;
do $$declare i uuid:='edededed-eded-4ded-8ded-edededededed';d jsonb:='{"actor_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","connection_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":2,"signature":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","evidence_fingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}';r jsonb;begin
 perform public.totus_prestashop_product_edit('claim',i,d);perform public.totus_prestashop_product_edit('uncertain',i,d);
 begin perform public.totus_prestashop_product_edit('recover_claim',i,d);raise exception 'Recent uncertain accepted';exception when others then if sqlerrm='Recent uncertain accepted' then raise;end if;end;
 update private.totus_prestashop_product_edits set updated_at=clock_timestamp()-interval '3 minutes' where request_id=i;
 begin perform public.totus_prestashop_product_edit('recover_claim',i,d||'{"actor_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}');raise exception 'Wrong actor accepted';exception when others then if sqlerrm='Wrong actor accepted' then raise;end if;end;
 begin perform public.totus_prestashop_product_edit('recover_claim',i,d||'{"signature":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}');raise exception 'Changed intent accepted';exception when others then if sqlerrm='Changed intent accepted' then raise;end if;end;
 r=public.totus_prestashop_product_edit('recover_claim',i,d);if r->>'status'<>'claimed' then raise exception 'Recovery was not claimed %',r;end if;
 r=public.totus_prestashop_product_edit('recover_claim',i,d);if r->>'status'<>'pending' then raise exception 'Duplicate recovery claimed %',r;end if;
 if (select jsonb_array_length(recovery_history) from private.totus_prestashop_product_edits where request_id=i)<>1 then raise exception 'Recovery history incorrect';end if;
 perform public.totus_prestashop_product_edit('complete',i,d);
 r=public.totus_prestashop_product_edit('recover_claim',i,d);if r->>'status'<>'completed' then raise exception 'Completed intent reactivated';end if;
end$$;
reset role;
do $$begin if has_function_privilege('authenticated','public.totus_prestashop_product_edit(text,uuid,jsonb)','execute') or has_function_privilege('anon','public.totus_prestashop_product_edit(text,uuid,jsonb)','execute') then raise exception 'Recovery exposed beyond the existing service';end if;end$$;
