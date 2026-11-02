-- Disposable CI log fixture; no production data.
create table if not exists public.ops_audit_log(id bigint generated always as identity primary key,user_id uuid,user_email text,area text,action text,detail jsonb);
