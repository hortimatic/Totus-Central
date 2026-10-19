
create table if not exists public.ops_onedrive_config(
 id integer primary key check(id=1),
 client_id text not null,
 expected_drive_id text not null,
 connected boolean not null default false,
 drive_id text,
 app_folder_id text,
 app_folder_url text,
 tested_at timestamptz,
 test_sha256 text,
 updated_at timestamptz not null default now()
);
create table if not exists public.ops_onedrive_oauth_states(
 state_hash text primary key,
 administrator_id uuid not null,
 code_verifier text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.ops_onedrive_config enable row level security;
alter table public.ops_onedrive_oauth_states enable row level security;
revoke all on public.ops_onedrive_config,public.ops_onedrive_oauth_states from public,anon,authenticated;
grant select,insert,update,delete on public.ops_onedrive_config,public.ops_onedrive_oauth_states to service_role;
create or replace function public.totus_onedrive_secret(p_action text,p_value text default null)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_name text; v_id uuid; v_secret text;
begin
 if p_action not in ('read_client','write_client','read_tokens','write_tokens') then raise exception 'Acción no válida';end if;
 v_name:=case when p_action in ('read_client','write_client') then 'totus_onedrive_client_secret' else 'totus_onedrive_token_set' end;
 select id,decrypted_secret into v_id,v_secret from vault.decrypted_secrets where name=v_name;
 if p_action like 'read_%' then return v_secret;end if;
 if p_value is null or length(p_value)>32768 then raise exception 'Valor no válido';end if;
 if v_id is null then perform vault.create_secret(p_value,v_name,'TotusCentral OneDrive connection');
 else perform vault.update_secret(v_id,p_value);end if;
 return 'stored';
end $$;
revoke all on function public.totus_onedrive_secret(text,text) from public,anon,authenticated;
grant execute on function public.totus_onedrive_secret(text,text) to service_role;
