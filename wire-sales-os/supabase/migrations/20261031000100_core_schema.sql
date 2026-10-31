-- WIRE Sales OS — core schema
--
-- Multi-tenant by design: every business table carries `workspace_id`.
-- Child tables reference parents through composite keys (workspace_id, id) so a
-- row can never point at a record that belongs to another workspace, even if
-- someone guesses its UUID. Row Level Security lives in the next migration.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (closed sets that the app logic depends on)
-- ---------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.lead_status as enum ('new', 'qualified', 'disqualified', 'converted');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_type as enum ('contact', 'email', 'call', 'follow_up', 'proposal', 'meeting', 'demo', 'close', 'other');
create type public.campaign_status as enum ('draft', 'active', 'paused', 'completed');
create type public.deal_status as enum ('open', 'won', 'lost');
create type public.audit_status as enum ('pending', 'completed', 'failed');
create type public.proposal_status as enum ('draft', 'sent', 'accepted', 'rejected');
create type public.prospect_status as enum ('new', 'imported', 'dismissed', 'duplicate');
create type public.message_channel as enum ('email', 'whatsapp', 'call', 'linkedin', 'sms');
create type public.message_direction as enum ('outbound', 'inbound');
create type public.message_status as enum ('draft', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  locale text not null default 'es-ES',
  timezone text not null default 'Europe/Madrid',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "users": application profile for each auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Workspace-level configuration (JSON documents validated by the app with Zod).
create table public.settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  scoring jsonb not null default '{}'::jsonb,
  pricing jsonb not null default '{}'::jsonb,
  ai jsonb not null default '{}'::jsonb,
  automation jsonb not null default '{}'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Secrets never readable by clients: RLS enabled with no policies, accessed
-- only with the service role from server code.
create table public.workspace_secrets (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  webhook_secret text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Commercial configuration: pipeline, sectors, services, pricing
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[a-z_]{2,32}$'),
  name text not null,
  position int not null check (position > 0),
  probability int not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  color text,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, key),
  check (not (is_won and is_lost))
);

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
  value_tier text not null default 'medium' check (value_tier in ('high', 'medium', 'low')),
  avg_ticket numeric(12, 2),
  booking_relevant boolean not null default false,
  whatsapp_relevant boolean not null default true,
  -- Multipliers per scoring category: {"website":1,"google":1,"social":1,"business":1}
  score_weights jsonb not null default '{}'::jsonb,
  setup_price_min numeric(12, 2),
  setup_price_max numeric(12, 2),
  monthly_price numeric(12, 2),
  common_problems text[] not null default '{}',
  sales_arguments text[] not null default '{}',
  keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, slug)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
  category text not null default 'other'
    check (category in ('website', 'maintenance', 'seo', 'automation', 'booking', 'chatbot', 'ai', 'integration', 'nfc', 'whatsapp', 'other')),
  description text,
  setup_price numeric(12, 2) not null default 0 check (setup_price >= 0),
  monthly_price numeric(12, 2) not null default 0 check (monthly_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, slug)
);

-- Recommended services per sector (normalized many-to-many).
create table public.sector_services (
  workspace_id uuid not null,
  sector_id uuid not null,
  service_id uuid not null,
  primary key (sector_id, service_id),
  foreign key (workspace_id, sector_id) references public.sectors (workspace_id, id) on delete cascade,
  foreign key (workspace_id, service_id) references public.services (workspace_id, id) on delete cascade
);
create index sector_services_ws_idx on public.sector_services (workspace_id);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  priority int not null default 100,
  -- {"business_potential":["high"],"website_quality":["none","low"],"sector_tier":["high"]}
  conditions jsonb not null default '{}'::jsonb,
  package_name text not null,
  service_id uuid,
  setup_price numeric(12, 2) not null check (setup_price >= 0),
  monthly_price numeric(12, 2) not null default 0 check (monthly_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, service_id) references public.services (workspace_id, id) on delete set null (service_id)
);
create index pricing_rules_ws_idx on public.pricing_rules (workspace_id, priority);

-- ---------------------------------------------------------------------------
-- CRM core: companies, contacts, leads
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  legal_name text,
  sector_id uuid,
  subsector text,
  city text,
  province text,
  country text not null default 'ES',
  address text,
  postal_code text,
  phone text,
  phone_normalized text,
  email text,
  website text,
  domain text,
  instagram_url text,
  instagram_followers int check (instagram_followers >= 0),
  instagram_last_post_at date,
  facebook_url text,
  linkedin_url text,
  google_maps_url text,
  google_place_id text,
  google_rating numeric(2, 1) check (google_rating between 0 and 5),
  google_reviews_count int check (google_reviews_count >= 0),
  google_last_review_at date,
  employees_estimate int check (employees_estimate >= 0),
  description text,
  services_offered text[] not null default '{}',
  opening_hours text,
  growth_signals text[] not null default '{}',
  tags text[] not null default '{}',
  -- Normalized "name|city" key used for de-duplication (computed by the app).
  name_key text,
  is_customer boolean not null default false,
  -- Cached from the latest completed website audit (see trigger below).
  website_score int check (website_score between 0 and 100),
  website_audited_at timestamptz,
  website_top_issue text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, sector_id) references public.sectors (workspace_id, id) on delete set null (sector_id)
);
create index companies_ws_created_idx on public.companies (workspace_id, created_at desc);
create index companies_ws_domain_idx on public.companies (workspace_id, domain) where domain is not null;
create index companies_ws_phone_idx on public.companies (workspace_id, phone_normalized) where phone_normalized is not null;
create index companies_ws_email_idx on public.companies (workspace_id, lower(email)) where email is not null;
create index companies_ws_name_key_idx on public.companies (workspace_id, name_key) where name_key is not null;
create index companies_ws_sector_idx on public.companies (workspace_id, sector_id);
create index companies_ws_city_idx on public.companies (workspace_id, city);
create index companies_name_trgm_idx on public.companies using gin (name extensions.gin_trgm_ops);
create unique index companies_ws_place_idx on public.companies (workspace_id, google_place_id) where google_place_id is not null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid,
  full_name text not null check (char_length(full_name) between 1 and 160),
  role text,
  email text,
  phone text,
  phone_normalized text,
  whatsapp text,
  linkedin_url text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade
);
create index contacts_ws_company_idx on public.contacts (workspace_id, company_id);
create index contacts_ws_email_idx on public.contacts (workspace_id, lower(email)) where email is not null;
create index contacts_name_trgm_idx on public.contacts using gin (full_name extensions.gin_trgm_ops);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null,
  primary_contact_id uuid,
  owner_id uuid references public.profiles (id) on delete set null,
  status public.lead_status not null default 'new',
  source text not null default 'manual'
    check (source in ('manual', 'csv', 'api', 'google_places', 'scraper', 'enrichment', 'referral', 'inbound')),
  source_ref text,
  score int not null default 0 check (score between 0 and 100),
  priority text not null default 'cold' check (priority in ('hot', 'warm', 'cold')),
  score_updated_at timestamptz,
  contact_status text not null default 'not_contacted'
    check (contact_status in ('not_contacted', 'contacted', 'replied', 'meeting', 'unresponsive', 'do_not_contact')),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  disqualified_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, company_id),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, primary_contact_id) references public.contacts (workspace_id, id) on delete set null (primary_contact_id)
);
create index leads_ws_score_idx on public.leads (workspace_id, score desc);
create index leads_ws_status_idx on public.leads (workspace_id, status);
create index leads_ws_created_idx on public.leads (workspace_id, created_at desc);
create index leads_ws_followup_idx on public.leads (workspace_id, next_follow_up_at) where next_follow_up_at is not null;

create table public.lead_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  lead_id uuid not null,
  score int not null check (score between 0 and 100),
  priority text not null check (priority in ('hot', 'warm', 'cold')),
  breakdown jsonb not null default '[]'::jsonb,
  inputs jsonb not null default '{}'::jsonb,
  engine_version text not null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete cascade
);
create index lead_scores_lead_idx on public.lead_scores (lead_id, created_at desc);

create table public.website_audits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  url text not null,
  final_url text,
  status public.audit_status not null default 'pending',
  http_status int,
  error text,
  error_kind text check (error_kind in ('invalid_url', 'dns', 'blocked', 'timeout', 'network', 'too_large', 'http')),
  response_time_ms int,
  page_bytes int,
  overall_score int check (overall_score between 0 and 100),
  performance_score int check (performance_score between 0 and 100),
  seo_score int check (seo_score between 0 and 100),
  ux_score int check (ux_score between 0 and 100),
  conversion_score int check (conversion_score between 0 and 100),
  mobile_score int check (mobile_score between 0 and 100),
  checks jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  signals jsonb not null default '{}'::jsonb,
  tech jsonb not null default '{}'::jsonb,
  lighthouse boolean not null default false,
  engine_version text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade
);
create index website_audits_company_idx on public.website_audits (company_id, created_at desc);

-- Keep the company's cached website score in sync with its latest audit.
create or replace function public.sync_company_website_score()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    update public.companies
       set website_score = new.overall_score,
           website_audited_at = new.created_at,
           website_top_issue = new.opportunities -> 0 ->> 'title'
     where id = new.company_id
       and (website_audited_at is null or website_audited_at <= new.created_at);
  end if;
  return new;
end;
$$;

create trigger website_audits_sync_company
after insert or update of status on public.website_audits
for each row execute function public.sync_company_website_score();

-- ---------------------------------------------------------------------------
-- Outreach: templates, campaigns, messages
-- ---------------------------------------------------------------------------
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'cold_outreach'
    check (category in ('cold_outreach', 'follow_up', 'proposal', 'meeting', 'reactivation', 'other')),
  channel public.message_channel not null default 'email',
  variant text check (variant in ('direct', 'professional', 'high_ticket', 'follow_up')),
  subject text,
  body text not null,
  sector_id uuid,
  is_archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, sector_id) references public.sectors (workspace_id, id) on delete set null (sector_id)
);
create index email_templates_ws_idx on public.email_templates (workspace_id, category);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  target_sector_id uuid,
  target_location text,
  website_requirement text not null default 'any'
    check (website_requirement in ('any', 'missing', 'weak', 'missing_or_weak')),
  channel public.message_channel not null default 'email',
  status public.campaign_status not null default 'draft',
  template_id uuid,
  start_date date,
  end_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, target_sector_id) references public.sectors (workspace_id, id) on delete set null (target_sector_id),
  foreign key (workspace_id, template_id) references public.email_templates (workspace_id, id) on delete set null (template_id)
);
create index campaigns_ws_idx on public.campaigns (workspace_id, status);

create table public.campaign_leads (
  workspace_id uuid not null,
  campaign_id uuid not null,
  lead_id uuid not null,
  added_at timestamptz not null default now(),
  contacted_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  meeting_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  primary key (campaign_id, lead_id),
  foreign key (workspace_id, campaign_id) references public.campaigns (workspace_id, id) on delete cascade,
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete cascade
);
create index campaign_leads_lead_idx on public.campaign_leads (lead_id);
create index campaign_leads_ws_idx on public.campaign_leads (workspace_id);

-- ---------------------------------------------------------------------------
-- Deals and pipeline
-- ---------------------------------------------------------------------------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  lead_id uuid,
  contact_id uuid,
  campaign_id uuid,
  service_id uuid,
  owner_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  stage_id uuid not null,
  status public.deal_status not null default 'open',
  setup_value numeric(12, 2) not null default 0 check (setup_value >= 0),
  monthly_value numeric(12, 2) not null default 0 check (monthly_value >= 0),
  -- First-year contract value: setup + 12 months of recurring revenue.
  value numeric(14, 2) generated always as (setup_value + monthly_value * 12) stored,
  probability int check (probability between 0 and 100),
  expected_close_date date,
  next_action text,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  max_stage_position int not null default 0,
  sort_order double precision not null default 0,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete set null (lead_id),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete set null (contact_id),
  foreign key (workspace_id, campaign_id) references public.campaigns (workspace_id, id) on delete set null (campaign_id),
  foreign key (workspace_id, service_id) references public.services (workspace_id, id) on delete set null (service_id),
  foreign key (workspace_id, stage_id) references public.pipeline_stages (workspace_id, id) on delete restrict
);
create index deals_ws_stage_idx on public.deals (workspace_id, stage_id, sort_order);
create index deals_ws_status_idx on public.deals (workspace_id, status);
create index deals_lead_idx on public.deals (lead_id);
create index deals_company_idx on public.deals (company_id);
create index deals_ws_won_idx on public.deals (workspace_id, won_at) where status = 'won';

create table public.deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  deal_id uuid not null,
  from_stage_id uuid,
  to_stage_id uuid not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  foreign key (workspace_id, deal_id) references public.deals (workspace_id, id) on delete cascade
);
create index deal_stage_history_deal_idx on public.deal_stage_history (deal_id, changed_at);
create index deal_stage_history_ws_idx on public.deal_stage_history (workspace_id, changed_at);

-- Derive status, probability and funnel progress from the stage.
create or replace function public.deals_apply_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  s public.pipeline_stages%rowtype;
begin
  select * into s from public.pipeline_stages
   where id = new.stage_id and workspace_id = new.workspace_id;
  if not found then
    raise exception 'Stage % does not belong to workspace', new.stage_id using errcode = '23503';
  end if;

  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    new.status := case when s.is_won then 'won'::public.deal_status
                       when s.is_lost then 'lost'::public.deal_status
                       else 'open'::public.deal_status end;
    if s.is_won then
      new.won_at := coalesce(new.won_at, now());
      new.lost_at := null;
    elsif s.is_lost then
      new.lost_at := coalesce(new.lost_at, now());
      new.won_at := null;
    else
      new.won_at := null;
      new.lost_at := null;
    end if;
    -- Lost deals keep the furthest stage they reached (for funnel analytics).
    if not s.is_lost then
      new.max_stage_position := greatest(coalesce(new.max_stage_position, 0), s.position);
    end if;
    -- Stage default probability unless the caller set one explicitly.
    if tg_op = 'INSERT' then
      new.probability := coalesce(new.probability, s.probability);
    elsif new.probability is not distinct from old.probability then
      new.probability := s.probability;
    end if;
  end if;
  return new;
end;
$$;

create trigger deals_apply_stage
before insert or update of stage_id on public.deals
for each row execute function public.deals_apply_stage();

create or replace function public.deals_record_stage_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    insert into public.deal_stage_history (workspace_id, deal_id, from_stage_id, to_stage_id, changed_by)
    values (new.workspace_id, new.id, case when tg_op = 'UPDATE' then old.stage_id end, new.stage_id, auth.uid());
  end if;
  return null;
end;
$$;

create trigger deals_record_stage_history
after insert or update of stage_id on public.deals
for each row execute function public.deals_record_stage_history();

-- ---------------------------------------------------------------------------
-- Work: activities (timeline), tasks, messages, proposals, documents
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid,
  lead_id uuid,
  deal_id uuid,
  contact_id uuid,
  type text not null check (type ~ '^[a-z_]{3,40}$'),
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete set null (lead_id),
  foreign key (workspace_id, deal_id) references public.deals (workspace_id, id) on delete set null (deal_id),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete set null (contact_id)
);
create index activities_ws_occurred_idx on public.activities (workspace_id, occurred_at desc);
create index activities_company_idx on public.activities (company_id, occurred_at desc);
create index activities_ws_type_idx on public.activities (workspace_id, type, occurred_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  type public.task_type not null default 'other',
  priority public.task_priority not null default 'medium',
  status public.task_status not null default 'todo',
  due_at timestamptz,
  completed_at timestamptz,
  company_id uuid,
  lead_id uuid,
  deal_id uuid,
  contact_id uuid,
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete set null (lead_id),
  foreign key (workspace_id, deal_id) references public.deals (workspace_id, id) on delete set null (deal_id),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete set null (contact_id)
);
create index tasks_ws_status_due_idx on public.tasks (workspace_id, status, due_at);
create index tasks_company_idx on public.tasks (company_id);
create index tasks_assignee_idx on public.tasks (assignee_id, status);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  company_id uuid,
  lead_id uuid,
  kind text not null check (kind ~ '^[a-z_]{3,40}$'),
  provider text not null,
  model text not null,
  prompt jsonb not null,
  response text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  status text not null default 'success' check (status in ('success', 'error')),
  error text,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete set null (company_id),
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete set null (lead_id)
);
create index ai_generations_ws_idx on public.ai_generations (workspace_id, created_at desc);
create index ai_generations_company_idx on public.ai_generations (company_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  lead_id uuid,
  contact_id uuid,
  campaign_id uuid,
  template_id uuid,
  ai_generation_id uuid,
  channel public.message_channel not null,
  direction public.message_direction not null default 'outbound',
  status public.message_status not null default 'draft',
  variant text,
  subject text,
  body text not null,
  to_address text,
  provider text,
  provider_message_id text,
  generated_by text not null default 'manual' check (generated_by in ('rules', 'ai', 'template', 'manual')),
  sent_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete set null (lead_id),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete set null (contact_id),
  foreign key (workspace_id, campaign_id) references public.campaigns (workspace_id, id) on delete set null (campaign_id),
  foreign key (workspace_id, template_id) references public.email_templates (workspace_id, id) on delete set null (template_id),
  foreign key (workspace_id, ai_generation_id) references public.ai_generations (workspace_id, id) on delete set null (ai_generation_id)
);
create index messages_company_idx on public.messages (company_id, created_at desc);
create index messages_ws_status_idx on public.messages (workspace_id, status, sent_at desc);
create unique index messages_provider_idx on public.messages (provider, provider_message_id) where provider_message_id is not null;

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  lead_id uuid,
  deal_id uuid,
  title text not null,
  status public.proposal_status not null default 'draft',
  -- Structured sections so the same content can render as HTML or PDF.
  content jsonb not null default '{}'::jsonb,
  setup_total numeric(12, 2) not null default 0,
  monthly_total numeric(12, 2) not null default 0,
  valid_until date,
  generated_by text not null default 'rules' check (generated_by in ('rules', 'ai', 'manual')),
  sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade,
  foreign key (workspace_id, lead_id) references public.leads (workspace_id, id) on delete set null (lead_id),
  foreign key (workspace_id, deal_id) references public.deals (workspace_id, id) on delete set null (deal_id)
);
create index proposals_company_idx on public.proposals (company_id, created_at desc);
create index proposals_ws_status_idx on public.proposals (workspace_id, status);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  company_id uuid not null,
  name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete cascade
);
create index documents_company_idx on public.documents (company_id);

-- ---------------------------------------------------------------------------
-- Lead discovery and imports
-- ---------------------------------------------------------------------------
create table public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  source text not null,
  query jsonb not null,
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  total int not null default 0,
  high_priority int not null default 0,
  medium_priority int not null default 0,
  low_priority int not null default 0,
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create index discovery_runs_ws_idx on public.discovery_runs (workspace_id, created_at desc);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  run_id uuid not null,
  source text not null,
  external_id text,
  name text not null,
  sector_id uuid,
  city text,
  province text,
  address text,
  phone text,
  website text,
  domain text,
  google_maps_url text,
  google_rating numeric(2, 1),
  google_reviews_count int,
  raw jsonb not null default '{}'::jsonb,
  score int not null default 0,
  priority text not null default 'cold' check (priority in ('hot', 'warm', 'cold')),
  breakdown jsonb not null default '[]'::jsonb,
  biggest_opportunity text,
  recommended_action text,
  status public.prospect_status not null default 'new',
  duplicate_of_company_id uuid,
  company_id uuid,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, run_id) references public.discovery_runs (workspace_id, id) on delete cascade,
  foreign key (workspace_id, sector_id) references public.sectors (workspace_id, id) on delete set null (sector_id),
  foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete set null (company_id),
  foreign key (workspace_id, duplicate_of_company_id) references public.companies (workspace_id, id) on delete set null (duplicate_of_company_id)
);
create index prospects_run_idx on public.prospects (run_id, score desc);
create index prospects_ws_status_idx on public.prospects (workspace_id, status);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  filename text,
  total int not null default 0,
  created_count int not null default 0,
  duplicate_count int not null default 0,
  invalid_count int not null default 0,
  mapping jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index import_jobs_ws_idx on public.import_jobs (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Productivity & platform
-- ---------------------------------------------------------------------------
create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity text not null check (entity in ('leads', 'companies', 'contacts', 'tasks')),
  name text not null check (char_length(name) between 1 and 80),
  filters jsonb not null default '{}'::jsonb,
  is_shared boolean not null default true,
  created_at timestamptz not null default now()
);
create index saved_filters_ws_idx on public.saved_filters (workspace_id, entity);

-- Outbox for automation (n8n, Zapier, custom webhooks).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null check (type ~ '^[a-z]+\.[a-z_]+$'),
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  attempts int not null default 0,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index events_ws_created_idx on public.events (workspace_id, created_at desc);
create index events_pending_idx on public.events (created_at) where delivered_at is null;

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index api_keys_ws_idx on public.api_keys (workspace_id);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'workspaces', 'profiles', 'settings', 'workspace_secrets', 'sectors', 'services', 'pricing_rules',
    'companies', 'contacts', 'leads', 'email_templates', 'campaigns', 'deals', 'tasks',
    'messages', 'proposals'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;
