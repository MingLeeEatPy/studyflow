create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  endpoint text not null,
  endpoint_hash text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists public.timer_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  session_id text not null,
  interval_id text not null,
  revision integer not null check (revision >= 0),
  kind text not null check (kind in ('focus', 'break', 'meditation')),
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'processing', 'cancelled', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  lease_until timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id, interval_id, revision)
);

create index if not exists timer_reminders_status_due_idx on public.timer_reminders (status, due_at);
create index if not exists timer_reminders_user_device_idx on public.timer_reminders (user_id, device_id);

alter table public.push_subscriptions enable row level security;
alter table public.timer_reminders enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete using (auth.uid() = user_id);

drop policy if exists timer_reminders_select_own on public.timer_reminders;
create policy timer_reminders_select_own on public.timer_reminders for select using (auth.uid() = user_id);
drop policy if exists timer_reminders_insert_own on public.timer_reminders;
create policy timer_reminders_insert_own on public.timer_reminders for insert with check (auth.uid() = user_id);
drop policy if exists timer_reminders_update_own on public.timer_reminders;
create policy timer_reminders_update_own on public.timer_reminders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists timer_reminders_delete_own on public.timer_reminders;
create policy timer_reminders_delete_own on public.timer_reminders for delete using (auth.uid() = user_id);

create or replace function public.claim_due_timer_reminders(batch_size integer default 100)
returns table (
  reminder_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  interval_id text,
  revision integer,
  kind text,
  due_at timestamptz,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select r.id
    from public.timer_reminders r
    where r.due_at <= now()
      and (r.status = 'scheduled' or (r.status = 'processing' and r.lease_until < now()))
      and r.attempt_count < 3
      and exists (
        select 1 from public.push_subscriptions s
        where s.user_id = r.user_id and s.device_id = r.device_id and s.revoked_at is null
      )
    order by r.due_at
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  ), updated as (
    update public.timer_reminders r
    set status = 'processing', lease_until = now() + interval '2 minutes', attempt_count = r.attempt_count + 1, updated_at = now()
    from claimed
    where r.id = claimed.id
    returning r.*
  )
  select updated.id, subscriptions.id, subscriptions.endpoint, subscriptions.p256dh, subscriptions.auth,
    updated.interval_id, updated.revision, updated.kind, updated.due_at, updated.attempt_count
  from updated
  join public.push_subscriptions subscriptions
    on subscriptions.user_id = updated.user_id and subscriptions.device_id = updated.device_id
  where subscriptions.revoked_at is null;
end;
$$;

revoke all on function public.claim_due_timer_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_due_timer_reminders(integer) to service_role;
