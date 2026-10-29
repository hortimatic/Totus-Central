create table public.ops_backup_runs(id uuid primary key,status text,storage_path text,archive_manifest jsonb,error_message text);
create table public.ops_backup_work(run_id uuid primary key references public.ops_backup_runs(id) on delete cascade,state jsonb not null,snapshot jsonb not null);
