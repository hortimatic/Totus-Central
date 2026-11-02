alter table public.team_members add column if not exists updated_at timestamptz default now();
create table if not exists public.team_user_audit_log(id bigserial primary key,actor_email text,target_email text,action text,status text,detail text,created_at timestamptz default now());
