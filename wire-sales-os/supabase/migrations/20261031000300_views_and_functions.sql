-- WIRE Sales OS — read models (views) and analytics functions.
--
-- Views use security_invoker so the caller's RLS applies to every underlying
-- table. Functions are SECURITY INVOKER for the same reason; they also filter
-- by workspace explicitly so the planner can use the (workspace_id, …) indexes.

-- ---------------------------------------------------------------------------
-- Lead list read model: everything the lead table and filters need, one row per lead.
-- ---------------------------------------------------------------------------
create view public.lead_overview
with (security_invoker = true) as
select
  l.id,
  l.workspace_id,
  l.company_id,
  l.primary_contact_id,
  l.owner_id,
  l.status,
  l.source,
  l.score,
  l.priority,
  l.score_updated_at,
  l.contact_status,
  l.last_contacted_at,
  l.next_follow_up_at,
  l.created_at,
  l.updated_at,
  c.name as company_name,
  c.legal_name,
  c.sector_id,
  s.name as sector_name,
  s.value_tier as sector_tier,
  c.subsector,
  c.city,
  c.province,
  c.country,
  c.phone,
  c.email,
  c.website,
  c.domain,
  c.google_rating,
  c.google_reviews_count,
  c.instagram_url,
  c.employees_estimate,
  c.website_score,
  c.website_audited_at,
  c.website_top_issue,
  c.is_customer,
  case
    when c.website is null or c.website = '' then 'missing'
    when c.website_score is null then 'unknown'
    when c.website_score < 50 then 'weak'
    else 'good'
  end as website_state,
  pc.full_name as contact_name,
  pc.role as contact_role,
  pc.email as contact_email,
  pc.phone as contact_phone,
  d.id as deal_id,
  d.stage_id,
  ps.key as stage_key,
  ps.name as stage_name,
  d.value as deal_value,
  coalesce(
    (select array_agg(cl.campaign_id) from public.campaign_leads cl where cl.lead_id = l.id),
    '{}'::uuid[]
  ) as campaign_ids
from public.leads l
join public.companies c on c.id = l.company_id
left join public.sectors s on s.id = c.sector_id
left join public.contacts pc on pc.id = l.primary_contact_id
left join lateral (
  select dd.id, dd.stage_id, dd.value
  from public.deals dd
  where dd.lead_id = l.id
  order by (dd.status = 'open') desc, dd.created_at desc
  limit 1
) d on true
left join public.pipeline_stages ps on ps.id = d.stage_id;

-- ---------------------------------------------------------------------------
-- Pipeline read model.
-- ---------------------------------------------------------------------------
create view public.deal_overview
with (security_invoker = true) as
select
  d.id,
  d.workspace_id,
  d.company_id,
  d.lead_id,
  d.contact_id,
  d.campaign_id,
  d.service_id,
  d.owner_id,
  d.title,
  d.stage_id,
  d.status,
  d.setup_value,
  d.monthly_value,
  d.value,
  d.probability,
  round(d.value * coalesce(d.probability, 0) / 100.0, 2) as weighted_value,
  d.expected_close_date,
  d.next_action,
  d.next_action_at,
  d.last_contact_at,
  d.max_stage_position,
  d.sort_order,
  d.won_at,
  d.lost_at,
  d.lost_reason,
  d.created_at,
  d.updated_at,
  c.name as company_name,
  c.city,
  c.website,
  sec.name as sector_name,
  ct.full_name as contact_name,
  ps.key as stage_key,
  ps.name as stage_name,
  ps.position as stage_position,
  l.score as lead_score,
  l.priority as lead_priority,
  sv.name as service_name
from public.deals d
join public.companies c on c.id = d.company_id
join public.pipeline_stages ps on ps.id = d.stage_id
left join public.sectors sec on sec.id = c.sector_id
left join public.contacts ct on ct.id = d.contact_id
left join public.leads l on l.id = d.lead_id
left join public.services sv on sv.id = d.service_id;

-- ---------------------------------------------------------------------------
-- Campaign read model with outreach metrics.
-- ---------------------------------------------------------------------------
create view public.campaign_overview
with (security_invoker = true) as
select
  c.id,
  c.workspace_id,
  c.name,
  c.description,
  c.target_sector_id,
  s.name as target_sector_name,
  c.target_location,
  c.website_requirement,
  c.channel,
  c.status,
  c.template_id,
  c.start_date,
  c.end_date,
  c.created_at,
  c.updated_at,
  coalesce(st.leads, 0) as leads,
  coalesce(st.contacted, 0) as contacted,
  coalesce(st.delivered, 0) as delivered,
  coalesce(st.opened, 0) as opened,
  coalesce(st.replied, 0) as replied,
  coalesce(st.meetings, 0) as meetings,
  coalesce(st.won, 0) as won,
  coalesce(rv.revenue, 0) as revenue
from public.campaigns c
left join public.sectors s on s.id = c.target_sector_id
left join lateral (
  select
    count(*)::int as leads,
    count(cl.contacted_at)::int as contacted,
    count(cl.delivered_at)::int as delivered,
    count(cl.opened_at)::int as opened,
    count(cl.replied_at)::int as replied,
    count(cl.meeting_at)::int as meetings,
    count(cl.won_at)::int as won
  from public.campaign_leads cl
  where cl.campaign_id = c.id
) st on true
left join lateral (
  select sum(d.value) as revenue
  from public.deals d
  where d.campaign_id = c.id and d.status = 'won'
) rv on true;

-- ---------------------------------------------------------------------------
-- Funnel: how far each lead (created in range) has progressed.
-- Progress = furthest of lead status, contact status and any deal's max stage.
-- ---------------------------------------------------------------------------
create or replace function public.lead_funnel(
  p_workspace_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (key text, name text, "position" int, count int)
language sql
stable
security invoker
set search_path = ''
as $$
  with stages as (
    select ps.key, ps.name, ps.position, ps.is_lost
    from public.pipeline_stages ps
    where ps.workspace_id = p_workspace_id
  ),
  pos as (
    select
      (select s.position from stages s where s.key = 'qualified') as qualified,
      (select s.position from stages s where s.key = 'contacted') as contacted,
      (select s.position from stages s where s.key = 'replied') as replied,
      (select s.position from stages s where s.key = 'meeting') as meeting
  ),
  progress as (
    select greatest(
      1,
      case when l.status in ('qualified', 'converted') then pos.qualified end,
      case l.contact_status
        when 'contacted' then pos.contacted
        when 'unresponsive' then pos.contacted
        when 'replied' then pos.replied
        when 'meeting' then pos.meeting
      end,
      (select max(d.max_stage_position) from public.deals d where d.lead_id = l.id)
    ) as reached
    from public.leads l, pos
    where l.workspace_id = p_workspace_id
      and l.created_at >= coalesce(p_from, '-infinity'::timestamptz)
      and l.created_at < coalesce(p_to, 'infinity'::timestamptz)
  )
  select s.key, s.name, s.position, (select count(*)::int from progress p where p.reached >= s.position)
  from stages s
  where not s.is_lost
  order by s.position;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard KPIs in a single round-trip.
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_metrics(
  p_workspace_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select * from public.lead_funnel(p_workspace_id, p_from, p_to)
  ),
  won as (
    select d.* from public.deals d
    where d.workspace_id = p_workspace_id and d.status = 'won'
      and d.won_at >= coalesce(p_from, '-infinity'::timestamptz)
      and d.won_at < coalesce(p_to, 'infinity'::timestamptz)
  ),
  lost as (
    select count(*)::int as n from public.deals d
    where d.workspace_id = p_workspace_id and d.status = 'lost'
      and d.lost_at >= coalesce(p_from, '-infinity'::timestamptz)
      and d.lost_at < coalesce(p_to, 'infinity'::timestamptz)
  ),
  open_deals as (
    select coalesce(sum(d.value), 0) as value,
           coalesce(sum(d.value * coalesce(d.probability, 0) / 100.0), 0) as weighted,
           count(*)::int as n
    from public.deals d
    where d.workspace_id = p_workspace_id and d.status = 'open'
  ),
  recurring as (
    select coalesce(sum(d.monthly_value), 0) as mrr
    from public.deals d
    where d.workspace_id = p_workspace_id and d.status = 'won'
  ),
  leads_found as (
    select coalesce((select f.count from f order by f.position limit 1), 0) as n
  )
  select jsonb_build_object(
    'leads_found', (select n from leads_found),
    'leads_qualified', coalesce((select f.count from f where f.key = 'qualified'), 0),
    'leads_contacted', coalesce((select f.count from f where f.key = 'contacted'), 0),
    'replies', coalesce((select f.count from f where f.key = 'replied'), 0),
    'meetings', coalesce((select f.count from f where f.key = 'meeting'), 0),
    'proposals', coalesce((select f.count from f where f.key = 'proposal'), 0),
    'won', (select count(*)::int from won),
    'lost', (select n from lost),
    'open_deals', (select n from open_deals),
    'pipeline_value', (select round(value, 2) from open_deals),
    'weighted_pipeline', (select round(weighted, 2) from open_deals),
    'closed_revenue', (select coalesce(round(sum(value), 2), 0) from won),
    'one_time_revenue', (select coalesce(round(sum(setup_value), 2), 0) from won),
    'new_mrr', (select coalesce(round(sum(monthly_value), 2), 0) from won),
    'mrr', (select round(mrr, 2) from recurring),
    'avg_deal_size', (select coalesce(round(avg(value), 2), 0) from won),
    'conversion_rate', case when (select n from leads_found) > 0
      then round((select count(distinct lead_id) from won where lead_id is not null)::numeric * 100 / (select n from leads_found), 1)
      else 0 end,
    'win_rate', case when (select count(*) from won) + (select n from lost) > 0
      then round((select count(*) from won)::numeric * 100 / ((select count(*) from won) + (select n from lost)), 1)
      else 0 end,
    'funnel', coalesce((select jsonb_agg(jsonb_build_object('key', f.key, 'name', f.name, 'count', f.count) order by f.position) from f), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Analytics: revenue breakdowns and daily performance.
-- ---------------------------------------------------------------------------
create or replace function public.get_analytics(
  p_workspace_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with won as (
    select d.*, c.city, sec.name as sector_name, sv.name as service_name, cp.name as campaign_name
    from public.deals d
    join public.companies c on c.id = d.company_id
    left join public.sectors sec on sec.id = c.sector_id
    left join public.services sv on sv.id = d.service_id
    left join public.campaigns cp on cp.id = d.campaign_id
    where d.workspace_id = p_workspace_id and d.status = 'won'
      and d.won_at >= p_from and d.won_at < p_to
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day')::date as day
  ),
  acts as (
    select date_trunc('day', a.occurred_at)::date as day, a.type
    from public.activities a
    where a.workspace_id = p_workspace_id and a.occurred_at >= p_from and a.occurred_at < p_to
      and a.type in ('email_sent', 'whatsapp_sent', 'call_logged', 'reply_received', 'meeting_scheduled', 'proposal_sent', 'deal_won')
  ),
  series as (
    select d.day,
      count(*) filter (where a.type in ('email_sent', 'whatsapp_sent', 'call_logged'))::int as contacts,
      count(*) filter (where a.type = 'reply_received')::int as replies,
      count(*) filter (where a.type = 'meeting_scheduled')::int as meetings,
      count(*) filter (where a.type = 'proposal_sent')::int as proposals,
      count(*) filter (where a.type = 'deal_won')::int as sales
    from days d
    left join acts a on a.day = d.day
    group by d.day
  ),
  closed as (
    select
      count(*) filter (where d.status = 'won')::int as won,
      count(*) filter (where d.status = 'lost')::int as lost
    from public.deals d
    where d.workspace_id = p_workspace_id
      and coalesce(d.won_at, d.lost_at) >= p_from and coalesce(d.won_at, d.lost_at) < p_to
  ),
  mrr as (
    select coalesce(sum(d.monthly_value), 0) as v
    from public.deals d where d.workspace_id = p_workspace_id and d.status = 'won'
  )
  select jsonb_build_object(
    'funnel', coalesce((
      select jsonb_agg(jsonb_build_object('key', f.key, 'name', f.name, 'count', f.count) order by f.position)
      from public.lead_funnel(p_workspace_id, p_from, p_to) f
    ), '[]'::jsonb),
    'revenue_by_sector', coalesce((
      select jsonb_agg(x order by (x ->> 'revenue')::numeric desc) from (
        select jsonb_build_object('label', coalesce(sector_name, 'Unassigned'), 'revenue', sum(value), 'mrr', sum(monthly_value), 'deals', count(*)) as x
        from won group by coalesce(sector_name, 'Unassigned')
      ) t), '[]'::jsonb),
    'revenue_by_campaign', coalesce((
      select jsonb_agg(x order by (x ->> 'revenue')::numeric desc) from (
        select jsonb_build_object('label', coalesce(campaign_name, 'No campaign'), 'revenue', sum(value), 'mrr', sum(monthly_value), 'deals', count(*)) as x
        from won group by coalesce(campaign_name, 'No campaign')
      ) t), '[]'::jsonb),
    'revenue_by_city', coalesce((
      select jsonb_agg(x order by (x ->> 'revenue')::numeric desc) from (
        select jsonb_build_object('label', coalesce(city, 'Unknown'), 'revenue', sum(value), 'mrr', sum(monthly_value), 'deals', count(*)) as x
        from won group by coalesce(city, 'Unknown')
      ) t), '[]'::jsonb),
    'revenue_by_service', coalesce((
      select jsonb_agg(x order by (x ->> 'revenue')::numeric desc) from (
        select jsonb_build_object('label', coalesce(service_name, 'Custom'), 'revenue', sum(value), 'mrr', sum(monthly_value), 'deals', count(*)) as x
        from won group by coalesce(service_name, 'Custom')
      ) t), '[]'::jsonb),
    'closed_revenue', (select coalesce(sum(value), 0) from won),
    'one_time_revenue', (select coalesce(sum(setup_value), 0) from won),
    'avg_deal_size', (select coalesce(round(avg(value), 2), 0) from won),
    'deals_won', (select won from closed),
    'deals_lost', (select lost from closed),
    'win_rate', (select case when won + lost > 0 then round(won::numeric * 100 / (won + lost), 1) else 0 end from closed),
    'mrr', (select v from mrr),
    'arr', (select v * 12 from mrr),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', s.day, 'contacts', s.contacts, 'replies', s.replies,
        'meetings', s.meetings, 'proposals', s.proposals, 'sales', s.sales) order by s.day)
      from series s), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Global search across the main entities (command palette).
-- ---------------------------------------------------------------------------
create or replace function public.global_search(p_workspace_id uuid, p_query text, p_limit int default 5)
returns table (kind text, id uuid, title text, subtitle text, href text)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
           trim(p_query) as raw
  )
  (
    select 'company'::text, c.id, c.name, concat_ws(' · ', c.city, s.name, l.score::text || '/100'), '/companies/' || c.id
    from public.companies c
    left join public.sectors s on s.id = c.sector_id
    left join public.leads l on l.company_id = c.id
    cross join q
    where c.workspace_id = p_workspace_id
      and (c.name ilike q.pattern or c.domain ilike q.pattern or c.email ilike q.pattern or c.city ilike q.pattern)
    order by extensions.similarity(c.name, q.raw) desc, c.name
    limit p_limit
  )
  union all
  (
    select 'contact', ct.id, ct.full_name, concat_ws(' · ', ct.role, co.name),
           case when ct.company_id is not null then '/companies/' || ct.company_id else '/contacts' end
    from public.contacts ct
    left join public.companies co on co.id = ct.company_id
    cross join q
    where ct.workspace_id = p_workspace_id
      and (ct.full_name ilike q.pattern or ct.email ilike q.pattern or ct.phone ilike q.pattern)
    order by extensions.similarity(ct.full_name, q.raw) desc
    limit p_limit
  )
  union all
  (
    select 'campaign', cp.id, cp.name, cp.status::text, '/campaigns/' || cp.id
    from public.campaigns cp cross join q
    where cp.workspace_id = p_workspace_id and cp.name ilike q.pattern
    limit p_limit
  )
  union all
  (
    select 'task', t.id, t.title, concat_ws(' · ', t.status::text, to_char(t.due_at, 'YYYY-MM-DD')), '/tasks?task=' || t.id
    from public.tasks t cross join q
    where t.workspace_id = p_workspace_id and t.title ilike q.pattern
    order by t.due_at nulls last
    limit p_limit
  )
  union all
  (
    select 'template', et.id, et.name, et.category, '/templates?template=' || et.id
    from public.email_templates et cross join q
    where et.workspace_id = p_workspace_id and et.name ilike q.pattern and not et.is_archived
    limit p_limit
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants for the new objects (anon gets nothing).
-- ---------------------------------------------------------------------------
revoke all on public.lead_overview, public.deal_overview, public.campaign_overview from anon;
grant select on public.lead_overview, public.deal_overview, public.campaign_overview to authenticated, service_role;

revoke all on function public.lead_funnel(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_dashboard_metrics(uuid, timestamptz, timestamptz) from public;
revoke all on function public.get_analytics(uuid, timestamptz, timestamptz) from public;
revoke all on function public.global_search(uuid, text, int) from public;
grant execute on function public.lead_funnel(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.get_dashboard_metrics(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.get_analytics(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.global_search(uuid, text, int) to authenticated, service_role;
revoke execute on all functions in schema public from anon;
