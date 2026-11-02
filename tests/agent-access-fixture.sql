alter table vault.secrets add column if not exists created_at timestamptz default now();
