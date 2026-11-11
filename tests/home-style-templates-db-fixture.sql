-- Disposable PostgreSQL fixture extensions. No real users or production DB.
alter table public.profiles add column if not exists full_name text;
update public.profiles set full_name=case when email='qa-one@example.invalid' then 'Cuenta QA Uno' else 'Cuenta QA Dos' end;
create or replace function private.totus_can(p_module text,p_action text)
returns boolean language sql stable as $$
 select auth.uid() is not null and p_module='inicio'
 and p_action in ('view','edit')
 and (p_action<>'edit' or coalesce(current_setting('totus.qa_no_edit',true),'')<>'yes')
$$;

