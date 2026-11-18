begin;

insert into public.lead_sources (key, label, sort_order)
values ('builder_discovery', 'Builder Discovery', 95) on conflict (key) do nothing;

create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('scheduled', 'manual', 'import')),
  status text not null default 'running' check (status in ('running','success','partial','failed','manual_required')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  sources jsonb not null default '[]'
);
create unique index if not exists discovery_one_running
on public.discovery_runs ((true)) where status = 'running';

create table if not exists public.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  provenance jsonb not null default '{}',
  categories text[] not null default '{}',
  state text not null default 'new' check (state in ('new','research','ready','crm','archived')),
  crm_id uuid references public.leads(id) on delete set null,
  notes text,
  outreach text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists discovery_recent on public.discovery_candidates (last_seen desc, id);

create table if not exists public.discovery_history (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references public.discovery_candidates(id),
  run_id uuid references public.discovery_runs(id),
  actor uuid references auth.users(id) on delete set null,
  kind text not null,
  detail jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists discovery_history_candidate on public.discovery_history (candidate_id, id desc);

alter table public.discovery_runs enable row level security;
alter table public.discovery_candidates enable row level security;
alter table public.discovery_history enable row level security;
revoke all on public.discovery_runs, public.discovery_candidates, public.discovery_history from anon, authenticated;
grant select on public.discovery_runs, public.discovery_candidates, public.discovery_history to authenticated;
grant usage, select on sequence public.discovery_history_id_seq to service_role;
grant all on public.discovery_runs, public.discovery_candidates, public.discovery_history to service_role;
drop policy if exists discovery_team_read on public.discovery_runs;
drop policy if exists discovery_team_read on public.discovery_candidates;
drop policy if exists discovery_team_read on public.discovery_history;
create policy discovery_team_read on public.discovery_runs for select to authenticated using (true);
create policy discovery_team_read on public.discovery_candidates for select to authenticated using (true);
create policy discovery_team_read on public.discovery_history for select to authenticated using (true);

create or replace function public.discovery_name(s text) returns text
language sql immutable set search_path = '' as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(s,'')), '[^a-z0-9]+', ' ', 'g'),
    '( (incorporated|inc|llc|l l c|corp|corporation|ltd|co))+ *$', ''))
$$;
create or replace function public.discovery_phone(s text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(coalesce(s,''), '[^0-9]', '', 'g'), '^1([0-9]{10})$', '\1')
$$;
create or replace function public.discovery_domain(s text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(trim(coalesce(s,''))), '^(https?://)?(www\.)?([^/:?#]+).*$','\3')
$$;

-- Shared names alone are review signals. Shared switchboards/domains alone may be affiliates.
create or replace function public.discovery_match(a jsonb, b jsonb) returns integer
language sql immutable set search_path = '' as $$
  with signals as (
    select public.discovery_name(a->>'name') as an, public.discovery_name(b->>'name') as bn,
           public.discovery_phone(a->>'phone') as ap, public.discovery_phone(b->>'phone') as bp,
           a->>'verifiedDomain' as ad, b->>'verifiedDomain' as bd,
           public.discovery_name(a->>'address') as aa, public.discovery_name(b->>'address') as ba,
           a->>'listing' as al, b->>'listing' as bl
  )
  select case
    when al is not null and al = bl then 3
    when ad <> '' and bd <> '' and ad <> bd and (an = bn or (length(ap)=10 and ap=bp)) then 1
    when an <> '' and an = bn and
      ((length(ap)=10 and ap=bp) or (ad <> '' and ad=bd) or (aa <> '' and aa=ba)) then 3
    when ad <> '' and ad=bd and length(ap)=10 and ap=bp and aa <> '' and aa=ba then 2
    when (an <> '' and an=bn) or (length(ap)=10 and ap=bp)
      or (ad <> '' and ad=bd) or (aa <> '' and aa=ba) then 1
    else 0 end from signals
$$;

create or replace function public.discovery_start(p_trigger text) returns uuid
language plpgsql set search_path = '' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(38142003);
  update public.discovery_runs set status='failed', ended_at=now(),
    sources=jsonb_build_array(jsonb_build_object('status','error','name','Worker','error','Worker lease expired'))
    where status='running' and started_at < now() - interval '6 minutes';
  if p_trigger='scheduled' and exists (
    select 1 from public.discovery_runs where trigger='scheduled'
    and started_at >= date_bin(interval '6 hours',now(), timestamptz '2000-01-01')) then
    return null;
  end if;
  insert into public.discovery_runs(trigger) values(p_trigger)
    on conflict do nothing returning id into result;
  return result;
end $$;

create or replace function public.discovery_crm_matches(candidate jsonb)
returns table(id uuid, strength integer)
language sql stable set search_path = '' as $$
  select l.id, m.strength from public.leads l
  cross join lateral (select public.discovery_match(candidate, jsonb_build_object(
    'name',l.company_name,'phone',l.phone,'verifiedDomain',public.discovery_domain(l.website),
    'address',l.location)) as strength) m
  where m.strength > 0
$$;

create or replace function public.discovery_ingest(p_run uuid, p_rows jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  row_data jsonb; fields jsonb; source jsonb; match_ids uuid[]; weak boolean;
  c public.discovery_candidates; crm_ids uuid[]; merged jsonb; prov jsonb;
  added integer := 0; matched integer := 0; flagged integer := 0;
begin
  perform pg_advisory_xact_lock(38142004);
  perform 1 from public.discovery_runs where id=p_run and status='running' for update;
  if not found then raise exception 'Discovery run expired'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    fields := row_data->'data';
    source := row_data->'source';
    select array_agg(id) filter (where strength=3), coalesce(bool_or(strength>0),false)
      into match_ids, weak
      from (select id, public.discovery_match(data,fields) strength from public.discovery_candidates) m;
    if cardinality(match_ids)=1 then
      select * into c from public.discovery_candidates where id=match_ids[1] for update;
      matched := matched + 1;
    else
      if fields->>'region' = 'outside' then continue; end if;
      weak := weak or exists (select 1 from public.discovery_crm_matches(fields));
      select array_agg(id) into crm_ids from public.discovery_crm_matches(fields) where strength=3;
      insert into public.discovery_candidates(data,state,crm_id)
      values ('{}', case when cardinality(crm_ids)=1 then 'crm' when weak then 'research' else 'new' end,
              case when cardinality(crm_ids)=1 then crm_ids[1] end) returning * into c;
      added := added + 1;
      if weak then flagged := flagged + 1; end if;
    end if;
    -- Keep the candidate identity from its first listing. Corroboration can
    -- contribute other fields without relabeling the directory company.
    if source->>'name' = 'User-supplied NEFBA seed' and c.data <> '{}' then
      if not exists (select 1 from public.discovery_history where candidate_id=c.id and kind='observation'
        and detail->'source'->>'name'='User-supplied NEFBA seed') then
        insert into public.discovery_history(candidate_id,run_id,kind,detail) values(c.id,p_run,'observation',row_data);
      end if;
      continue;
    end if;
    if fields ? 'phone' and not fields ? 'phoneConfirmed' and c.data->>'phoneConfirmed'='true' then
      fields := fields - 'phone';
    end if;
    if fields ? 'website' and not fields ? 'verifiedDomain' and c.data ? 'verifiedDomain' then
      fields := fields - 'website';
    end if;
    if fields ? 'construction' and not fields ? 'constructionDate' then
      c.data := c.data - 'constructionDate';
      c.provenance := c.provenance - 'constructionDate';
    end if;
    if fields ? 'region' and not fields ? 'distance' then
      c.data := c.data - 'distance' - 'geoMethod';
      c.provenance := c.provenance - 'distance' - 'geoMethod';
    end if;
    merged := c.data || fields ||
      case when c.data ? 'listing' and not fields ? 'listing' then
        coalesce((select jsonb_object_agg(key,value) from jsonb_each(c.data)
          where key in ('name','listing')), '{}'::jsonb)
      else '{}'::jsonb end;
    select coalesce(jsonb_object_agg(key,source),'{}') into prov from jsonb_each(fields)
      where merged->key=fields->key;
    update public.discovery_candidates set data=merged, provenance=c.provenance || prov,
      state=case when c.state in ('new','ready') and (
        merged->>'region' in ('outside','uncertain') or merged->>'classification' in ('non-builder','developer','uncertain'))
        then 'research' else c.state end,
      categories=array(select distinct value from unnest(c.categories || array[row_data->>'category']) v(value)
        where value is not null order by value), last_seen=now()
      where id=c.id;
    if merged <> c.data or (row_data->>'category' is not null and not (row_data->>'category'=any(c.categories)))
      or not exists (select 1 from public.discovery_history where candidate_id=c.id and kind='observation'
        and detail->'source'->>'url'=source->>'url') then
      insert into public.discovery_history(candidate_id,run_id,kind,detail) values(c.id,p_run,'observation',row_data);
    end if;
  end loop;
  return jsonb_build_object('added',added,'matched',matched,'flagged',flagged);
end $$;

create or replace function public.discovery_review(p_id uuid,p_action text,p_notes text default null,p_outreach text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.discovery_candidates; target uuid; crm_ids uuid[]; duplicate boolean;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_action is null or p_action not in ('research','ready','archive','reopen','notes','approve','approve_distinct') then
    raise exception 'Invalid review action';
  end if;
  if p_action in ('approve','approve_distinct') then lock table public.leads in share row exclusive mode; end if;
  select * into strict c from public.discovery_candidates where id=p_id for update;
  if p_action in ('ready','approve','approve_distinct') and c.crm_id is null and
    (length(public.discovery_phone(c.data->>'phone')) <> 10 or c.data->>'classification' is distinct from 'builder'
      or c.data->>'region' is distinct from 'qualified' or c.data->>'phoneConfirmed' is distinct from 'true') then
    raise exception 'Review requires a confirmed regional builder and public phone';
  end if;
  if p_action in ('approve','approve_distinct') then
    if c.crm_id is not null then return c.crm_id; end if;
    if c.state not in ('new','ready','research') then raise exception 'Reopen this candidate before approval'; end if;
    select array_agg(id) filter (where strength=3), coalesce(bool_or(strength>0),false)
      into crm_ids,duplicate from public.discovery_crm_matches(c.data);
    if cardinality(crm_ids)=1 then
      target := crm_ids[1];
    elsif coalesce(cardinality(crm_ids),0)>1 or (duplicate and p_action='approve') then
      raise exception 'Possible CRM duplicate. Compare the CRM records before approving as a distinct company.';
    else
      insert into public.leads(company_name,contact_name,job_title,phone,email,website,location,source)
      values(c.data->>'name',c.data->>'contact',c.data->>'role',c.data->>'phone',c.data->>'email',
             c.data->>'website',concat_ws(', ', c.data->>'address',c.data->>'city',c.data->>'state'),'builder_discovery')
      returning id into target;
    end if;
    update public.discovery_candidates set state='crm',crm_id=target where id=p_id;
  elsif p_action='notes' then
    update public.discovery_candidates set notes=left(p_notes,5000),outreach=left(p_outreach,200) where id=p_id;
  elsif c.crm_id is null then
    update public.discovery_candidates set state=case p_action when 'archive' then 'archived'
      when 'reopen' then 'new' else p_action end where id=p_id;
  else
    raise exception 'Candidate is linked to a CRM lead';
  end if;
  insert into public.discovery_history(candidate_id,actor,kind,detail)
  values (p_id,auth.uid(),'review',jsonb_strip_nulls(jsonb_build_object(
    'action',p_action,'crm_id',target,'notes',p_notes,'outreach',p_outreach)));
  return target;
end $$;

revoke execute on function public.discovery_start(text), public.discovery_ingest(uuid,jsonb),
  public.discovery_review(uuid,text,text,text), public.discovery_crm_matches(jsonb) from public, anon, authenticated;
grant execute on function public.discovery_start(text), public.discovery_ingest(uuid,jsonb) to service_role;
grant execute on function public.discovery_review(uuid,text,text,text), public.discovery_crm_matches(jsonb) to authenticated, service_role;

create or replace function public.discovery_counts() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'states',(select coalesce(jsonb_object_agg(state,n),'{}') from
      (select state,count(*) n from public.discovery_candidates group by state) s),
    'categories',(select coalesce(jsonb_object_agg(category,n),'{}') from
      (select unnest(categories) category,count(*) n from public.discovery_candidates group by 1) s),
    'sources',(select coalesce(jsonb_object_agg(source,n),'{}') from
      (select detail->'source'->>'name' source,count(distinct candidate_id) n from public.discovery_history
        where kind='observation' and detail->'source'->>'name' is not null group by 1) s))
$$;
revoke execute on function public.discovery_counts() from public, anon;
grant execute on function public.discovery_counts() to authenticated;
create or replace function public.discovery_ranked(p_state text,p_offset integer,p_latest boolean default false)
returns setof public.discovery_candidates
language sql stable set search_path = '' as $$
  select c.* from public.discovery_candidates c where state=p_state
  order by
    case when p_latest then first_seen end desc nulls last,
    (
      case when data->>'region'='qualified' then 30 else 0 end +
      case when data ? 'sizeEvidence' then 10 else 0 end +
      case when data ? 'scope' then 25 else 0 end +
      case when data ? 'construction' and data->>'constructionDate' between
        to_char(current_date - 365,'YYYY-MM-DD') and to_char(current_date,'YYYY-MM-DD') then 25 else 0 end +
      case when data->>'phoneConfirmed'='true' or (data ? 'contact' and data ? 'role') then 10 else 0 end
    ) desc,
    first_seen desc, id
  limit 25 offset greatest(0,least(p_offset,250000))
$$;
revoke execute on function public.discovery_ranked(text,integer,boolean) from public, anon;
grant execute on function public.discovery_ranked(text,integer,boolean) to authenticated;
commit;
