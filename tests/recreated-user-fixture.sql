-- Disposable fixture adapters for the production permission entry points.
create or replace function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
create or replace function private.totus_can(m text,a text) returns boolean language sql stable as $$
 select auth.uid() is not null and private.totus_module_can((select email from auth.users where id=auth.uid()),m,a)
$$;
