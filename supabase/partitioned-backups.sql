-- Private resumable state. Neither users nor the public API can read snapshots.
create table if not exists public.ops_backup_work(
 run_id uuid primary key references public.ops_backup_runs(id) on delete cascade,
 snapshot jsonb not null,
 state jsonb not null,
 updated_at timestamptz not null default now(),
 lease_until timestamptz
);
alter table public.ops_backup_work enable row level security;
revoke all on public.ops_backup_work from public,anon,authenticated;
grant select,insert,update,delete on public.ops_backup_work to service_role;

-- Reuse the already configured server URL and Vault reference; never expose keys.
select cron.schedule('totus-partitioned-backup-resume','* * * * *',
 replace(split_part(command,'FROM public.ops_backup_config c',1),'timeout_milliseconds:=10000','timeout_milliseconds:=120000')
 ||'WHERE EXISTS(select 1 from public.ops_backup_work where lease_until is null or lease_until<now());')
from cron.job where jobname='totus-staging-automatic-backups';
