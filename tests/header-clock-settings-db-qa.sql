do $$declare rejected boolean;begin
 perform private.totus_validate_appearance('interfaz','{"clockFontSize":16,"clockLayout":"inline","clockSeconds":"hide","clockDate":"show","clockFormat":"12","clockAction":"tasks","calendarDensity":"compact"}'::jsonb);
 rejected=false;begin perform private.totus_validate_appearance('interfaz','{"clockFontSize":60}'::jsonb);exception when others then rejected=true;end;if not rejected then raise exception 'Invalid clock size accepted';end if;
 rejected=false;begin perform private.totus_validate_appearance('interfaz','{"clockAction":"sql"}'::jsonb);exception when others then rejected=true;end;if not rejected then raise exception 'Invalid clock action accepted';end if;
end $$;
