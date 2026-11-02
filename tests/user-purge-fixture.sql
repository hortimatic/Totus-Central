alter table auth.users add column if not exists deleted_at timestamptz;
create table if not exists public.ops_user_permissions(email text references public.team_members(email),module text);
