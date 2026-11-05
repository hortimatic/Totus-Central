do $$
begin
 if (select count(*) from pg_indexes where schemaname='private' and indexname in ('totus_automations_channel_idx','totus_automations_owner_idx','totus_deliveries_message_idx'))<>3 then
  raise exception 'Missing automation reference indexes';
 end if;
end $$;
