create table public.ops_onedrive_backups (
 run_id uuid primary key references public.ops_backup_runs(id) on delete cascade,
 source_path text not null,
 folder_path text not null unique,
 archive_sha256 text not null check(archive_sha256 ~ '^[0-9a-f]{64}$'),
 archive_size bigint not null check(archive_size>=0),
 total_files integer not null check(total_files>0),
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.ops_onedrive_backup_files (
 run_id uuid not null references public.ops_onedrive_backups(run_id) on delete cascade,
 source_path text not null,
 item_id text not null,
 size_bytes bigint not null check(size_bytes>=0),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 verified_at timestamptz not null default now(),
 primary key(run_id,source_path)
);
alter table public.ops_onedrive_backups enable row level security;
alter table public.ops_onedrive_backup_files enable row level security;
revoke all on public.ops_onedrive_backups,public.ops_onedrive_backup_files from public,anon,authenticated;
grant select,insert,update,delete on public.ops_onedrive_backups,public.ops_onedrive_backup_files to service_role;
alter table public.ops_onedrive_config add column backup_mirror_lock_until timestamptz,add column backup_mirror_last_attempt timestamptz,add column backup_mirror_last_error text;