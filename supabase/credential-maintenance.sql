-- Administrative metadata only. Existing RLS and service-role access stay in force.
alter table public.ops_onedrive_config add column if not exists credential_expires_at date;
