-- Additive indexes for automation ownership, channel and delivered-message references.
-- No changes to permissions, rows, schedules or enabled rules.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create index if not exists totus_automations_channel_idx on private.totus_prestashop_automations(channel_id);
create index if not exists totus_automations_owner_idx on private.totus_prestashop_automations(owner_id);
create index if not exists totus_deliveries_message_idx on private.totus_prestashop_deliveries(message_id);
commit;
