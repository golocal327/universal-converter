-- WIRE Sales OS — security: membership helpers, RLS and grants.
--
-- Model: a user can only read or write rows of workspaces they belong to.
-- Configuration tables (pipeline, sectors, services, pricing, settings) are
-- readable by every member but writable only by owners/admins.

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so policies don't recurse into RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profiles are created automatically for every new auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Workspace creation: atomic (workspace + owner membership + settings +
-- default pipeline). Clients cannot insert into workspaces directly.
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.workspace_members where user_id = v_user and role = 'owner') >= 5 then
    raise exception 'Workspace limit reached' using errcode = '54000';
  end if;

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.workspaces (name, slug, created_by)
  values (trim(p_name), p_slug, v_user)
  returning id into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace, v_user, 'owner');

  insert into public.settings (workspace_id) values (v_workspace);

  insert into public.pipeline_stages (workspace_id, key, name, position, probability, is_won, is_lost, color)
  values
    (v_workspace, 'new',         'New',         1,   5, false, false, 'slate'),
    (v_workspace, 'qualified',   'Qualified',   2,  10, false, false, 'sky'),
    (v_workspace, 'contacted',   'Contacted',   3,  15, false, false, 'blue'),
    (v_workspace, 'replied',     'Replied',     4,  25, false, false, 'indigo'),
    (v_workspace, 'meeting',     'Meeting',     5,  40, false, false, 'amber'),
    (v_workspace, 'proposal',    'Proposal',    6,  60, false, false, 'orange'),
    (v_workspace, 'negotiation', 'Negotiation', 7,  80, false, false, 'rose'),
    (v_workspace, 'won',         'Won',         8, 100, true,  false, 'emerald'),
    (v_workspace, 'lost',        'Lost',        9,   0, false, true,  'zinc');

  return v_workspace;
end;
$$;

revoke all on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Durable rate limiting (works across serverless instances).
-- The key is always scoped to the calling user, so it cannot be spoofed.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_now timestamptz := now();
  v_count int;
begin
  if auth.uid() is null then
    return false;
  end if;
  v_key := auth.uid()::text || ':' || left(p_bucket, 64);

  insert into public.rate_limits as r (key, window_start, count)
  values (v_key, v_now, 1)
  on conflict (key) do update
    set count = case when r.window_start < v_now - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < v_now - make_interval(secs => p_window_seconds) then v_now else r.window_start end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Same limiter for server-side callers that are not end users (public API keys).
create or replace function public.check_rate_limit_key(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_count int;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values ('key:' || left(p_key, 96), v_now, 1)
  on conflict (key) do update
    set count = case when r.window_start < v_now - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
        window_start = case when r.window_start < v_now - make_interval(secs => p_window_seconds) then v_now else r.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
revoke all on function public.check_rate_limit_key(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;
grant execute on function public.check_rate_limit_key(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_secrets enable row level security; -- no policies: service role only
alter table public.rate_limits enable row level security;       -- no policies: definer functions only

create policy workspaces_select on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_update on public.workspaces
  for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1 from public.workspace_members mine
      join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy members_select on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy members_admin_write on public.workspace_members
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- Member-writable business tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'contacts', 'leads', 'lead_scores', 'website_audits', 'email_templates',
    'campaigns', 'campaign_leads', 'deals', 'deal_stage_history', 'activities', 'tasks',
    'ai_generations', 'messages', 'proposals', 'documents', 'discovery_runs', 'prospects',
    'import_jobs', 'events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_workspace_member(workspace_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_delete', t);
  end loop;
end;
$$;

-- History and AI logs are append-only for members (no edits that rewrite the audit trail).
drop policy deal_stage_history_update on public.deal_stage_history;
drop policy deal_stage_history_delete on public.deal_stage_history;
drop policy ai_generations_update on public.ai_generations;
drop policy lead_scores_update on public.lead_scores;

-- Admin-writable configuration tables.
do $$
declare
  t text;
begin
  foreach t in array array['settings', 'pipeline_stages', 'sectors', 'services', 'sector_services', 'pricing_rules', 'api_keys'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))',
      t || '_admin_write', t);
  end loop;
end;
$$;

-- API key hashes are not secret-equivalent, but only admins need to see them.
drop policy api_keys_select on public.api_keys;
create policy api_keys_select on public.api_keys
  for select to authenticated using (public.is_workspace_admin(workspace_id));

-- Saved filters: shared ones are visible to the workspace, private ones to their owner.
alter table public.saved_filters enable row level security;
create policy saved_filters_select on public.saved_filters
  for select to authenticated
  using (public.is_workspace_member(workspace_id) and (is_shared or user_id = auth.uid()));
create policy saved_filters_insert on public.saved_filters
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy saved_filters_modify on public.saved_filters
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy saved_filters_delete on public.saved_filters
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants: explicit and minimal. The anon role gets nothing in this schema.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke all on public.workspace_secrets from authenticated;
revoke all on public.rate_limits from authenticated;
-- Workspaces are created only through create_workspace().
revoke insert, delete on public.workspaces from authenticated;
-- Supabase's default privileges grant EXECUTE on new functions to anon; the
-- API surface of this app is authenticated-only.
revoke execute on all functions in schema public from anon;
