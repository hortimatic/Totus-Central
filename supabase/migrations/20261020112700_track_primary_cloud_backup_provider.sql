alter table public.ops_backup_runs add column storage_provider text not null default 'supabase' check (storage_provider in ('supabase','onedrive'));
alter table public.ops_backup_runs add column supabase_parts_retired_at timestamptz;
comment on column public.ops_backup_runs.storage_provider is 'Primary location of a complete verified backup. A small recovery index may remain in Supabase.';