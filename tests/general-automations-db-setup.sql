-- Extend only the disposable fixture with production's composite keys.
alter table public.ops_user_permissions add primary key(email,module);
alter table public.ops_role_permissions add primary key(role,module);
insert into public.ops_user_permissions values('manager@example.invalid','prestashop',true,true,true,false,false);
