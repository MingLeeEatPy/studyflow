create table if not exists public.sync_entities (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, entity_type, entity_id)
);

create index if not exists sync_entities_user_updated_idx
  on public.sync_entities (user_id, updated_at);

alter table public.sync_entities enable row level security;

drop policy if exists sync_entities_select_own on public.sync_entities;
create policy sync_entities_select_own on public.sync_entities for select using (auth.uid() = user_id);
drop policy if exists sync_entities_insert_own on public.sync_entities;
create policy sync_entities_insert_own on public.sync_entities for insert with check (auth.uid() = user_id);
drop policy if exists sync_entities_update_own on public.sync_entities;
create policy sync_entities_update_own on public.sync_entities for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists sync_entities_delete_own on public.sync_entities;
create policy sync_entities_delete_own on public.sync_entities for delete using (auth.uid() = user_id);
