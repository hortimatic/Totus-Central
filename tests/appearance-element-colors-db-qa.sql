-- Disposable PostgreSQL only. The real validator from patch 061 is loaded before patch 074.
do $colors_test$
declare rejected boolean;
begin
 perform private.totus_validate_appearance('interfaz','{"text":"#172033","card":"#ffffff","headingText":"#13579b","labelText":"#fedcba","topbarBackground":"#112233","topbarText":"#eeeeee","inputBackground":"#fafafa","inputText":"#123456","tableHeadBackground":"#abcdef","tableHeadText":"#123456","tableRowBackground":"#ededed","secondaryButtonBackground":"#f0f0f0","secondaryButtonText":"#101010","noteBackground":"#ccddff","noteText":"#141414","filterBackground":"#ffffff","modalBackground":"#fefefe"}'::jsonb);
 perform private.totus_validate_appearance('login','{"loginTextColor":"#ffffff","loginCardColor":"#000000"}'::jsonb);
 rejected=false;
 begin perform private.totus_validate_appearance('interfaz','{"headingText":"red; background:url(javascript:alert(1))"}'::jsonb);
 exception when others then rejected=true; end;
 if not rejected then raise exception 'Malformed hex color accepted';end if;
 rejected=false;
 begin perform private.totus_validate_appearance('interfaz','{"unknownDangerousSetting":"#ffffff"}'::jsonb);
 exception when others then rejected=true; end;
 if not rejected then raise exception 'Unknown appearance key accepted';end if;
 rejected=false;
 begin perform private.totus_validate_appearance('interfaz','{"sidebarWidth":999}'::jsonb);
 exception when others then rejected=true; end;
 if not rejected then raise exception 'Legacy range validation was altered';end if;
 if has_function_privilege('anon','private.totus_validate_appearance(text,jsonb)','execute')
 or has_function_privilege('authenticated','private.totus_validate_appearance(text,jsonb)','execute')
 then raise exception 'Validator privileges widened';end if;
 raise notice 'PASS: 15 text/box color fields, malformed and unknown rejection, legacy validation, shared Login and privilege boundary';
end
$colors_test$;
