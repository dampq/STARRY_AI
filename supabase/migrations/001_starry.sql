-- Apply to a Supabase project as the database owner. Service-role credentials stay backend-only.
begin;
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '' check(length(display_name)<=80), avatar_url text, created_at timestamptz not null default now());
create table public.stories (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, title text not null check(length(title) between 1 and 120),theme text not null,genre text not null,mood text not null,setting text not null default '',preferences jsonb not null,status text not null default 'active' check(status in ('active','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index stories_owner_updated on public.stories(user_id,updated_at desc);
create table public.story_branches (id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories on delete cascade,parent_branch_id uuid references public.story_branches on delete set null,fork_scene_id uuid,name text not null,current_scene_id uuid,created_at timestamptz not null default now());
create index branches_story on public.story_branches(story_id);
create table public.story_scenes (id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories on delete cascade,branch_id uuid not null references public.story_branches on delete cascade,parent_scene_id uuid references public.story_scenes on delete cascade,scene_number integer not null check(scene_number>0),title text not null,narrative text not null,choices jsonb not null,state_snapshot jsonb not null,recap text not null,story_finished boolean not null default false,created_at timestamptz not null default now(),unique(branch_id,scene_number));
create index scenes_story on public.story_scenes(story_id);
create index scenes_parent on public.story_scenes(parent_scene_id);
create table public.story_choices (id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories on delete cascade,branch_id uuid not null references public.story_branches on delete cascade,scene_id uuid not null references public.story_scenes on delete cascade,choice_id text,choice_text text not null,custom_action boolean not null,consequence_summary text not null,created_at timestamptz not null default now(),unique(branch_id,scene_id));
create table public.story_characters (id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories on delete cascade,branch_id uuid not null references public.story_branches on delete cascade,character_key text not null,name text not null,personality text not null,background text not null,status text not null,relationships jsonb not null default '[]',metadata jsonb not null default '{}',unique(branch_id,character_key));
create table public.story_events (id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories on delete cascade,branch_id uuid not null references public.story_branches on delete cascade,scene_id uuid references public.story_scenes on delete cascade,event_key text not null,event_type text not null default 'discovery',description text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now(),unique(branch_id,event_key));
create table public.story_state (id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories on delete cascade,branch_id uuid not null unique references public.story_branches on delete cascade,current_scene_id uuid references public.story_scenes on delete cascade,state jsonb not null,updated_at timestamptz not null default now());
create table public.story_summaries (id uuid primary key default gen_random_uuid(),story_id uuid not null references public.stories on delete cascade,branch_id uuid not null references public.story_branches on delete cascade,through_scene_id uuid not null references public.story_scenes on delete cascade,summary text not null,created_at timestamptz not null default now(),unique(branch_id,through_scene_id));
create table public.story_bookmarks (id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,story_id uuid not null references public.stories on delete cascade,scene_id uuid not null references public.story_scenes on delete cascade,created_at timestamptz not null default now(),unique(user_id,scene_id));
create table public.generation_requests (id uuid primary key, user_id uuid not null references auth.users on delete cascade,story_id uuid not null references public.stories on delete cascade,branch_id uuid not null references public.story_branches on delete cascade,base_scene_id uuid,action_hash text not null,attempts integer not null default 1,token uuid not null default gen_random_uuid(),status text not null check(status in ('running','failed','done')),scene_id uuid references public.story_scenes on delete cascade,updated_at timestamptz not null default now());
create index generation_branch on public.generation_requests(branch_id,status,updated_at);
create index generation_usage on public.generation_requests(user_id,updated_at);

alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.stories enable row level security;
create policy own_story on public.stories for select to authenticated using(user_id=auth.uid());
-- All story mutations go through the verified backend, with narrow RPCs.
alter table public.story_bookmarks enable row level security;
create policy own_bookmarks on public.story_bookmarks for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.stories s where s.id=story_id and s.user_id=auth.uid()));
do $$ declare t text; begin
 foreach t in array array['story_branches','story_scenes','story_choices','story_characters','story_events','story_state','story_summaries','generation_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_read on public.%I for select to authenticated using (exists(select 1 from public.stories s where s.id=story_id and s.user_id=auth.uid()))',t);
 end loop;
end $$;
grant select on all tables in schema public to authenticated;
grant select,insert,update,delete on public.profiles to authenticated;
grant all on all tables in schema public to service_role;

create function public.create_adventure(p_user_id uuid,p_config jsonb,p_state jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; bid uuid; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 if (select count(*) from stories where user_id=p_user_id)>=500 then raise exception 'Story limit reached (500). Export and remove an old story first.' using errcode='P0001';end if;
 insert into stories(user_id,title,theme,genre,mood,setting,preferences) values(p_user_id,coalesce(nullif(p_config->>'title',''),'Untitled constellation'),p_config->>'theme',p_config->>'genre',p_config->>'mood',p_config->>'setting',p_config) returning id into sid;
 insert into story_branches(story_id,name) values(sid,'Original journey') returning id into bid;
 insert into story_state(story_id,branch_id,state) values(sid,bid,p_state);
 return jsonb_build_object('id',sid,'branchId',bid);
end $$;
create function public.reserve_generation(p_user_id uuid,p_story_id uuid,p_branch_id uuid,p_base_scene_id uuid,p_request_id uuid,p_action_hash text,p_limit integer) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b story_branches; r generation_requests; begin
 -- Serialize per-user quota as well as per-branch generation across server instances.
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 if not exists(select 1 from stories where id=p_story_id and user_id=p_user_id and status='active') then raise exception 'Story not found' using errcode='P0002'; end if;
 select * into b from story_branches where id=p_branch_id and story_id=p_story_id for update;
 if not found then raise exception 'Branch not found' using errcode='P0002'; end if;
 select * into r from generation_requests where id=p_request_id;
 if found then
  if r.user_id<>p_user_id or r.story_id<>p_story_id or r.branch_id<>p_branch_id or r.base_scene_id is distinct from p_base_scene_id or r.action_hash<>p_action_hash then raise exception 'Idempotency key reused for a different action' using errcode='P0001'; end if;
  if r.status='done' then return jsonb_build_object('sceneId',r.scene_id,'replayed',true); end if;
 end if;
 if b.current_scene_id is distinct from p_base_scene_id then raise exception 'Chapter changed; reload before continuing' using errcode='P0001'; end if;
 if exists(select 1 from generation_requests where branch_id=p_branch_id and status='running' and updated_at>now()-interval '10 minutes') then raise exception 'This branch is already generating a chapter' using errcode='P0001'; end if;
 if (select coalesce(sum(attempts),0) from generation_requests where user_id=p_user_id and updated_at>now()-interval '1 hour')>=p_limit then raise exception 'Hourly generation limit reached' using errcode='P0001'; end if;
 update generation_requests set status='failed' where branch_id=p_branch_id and status='running';
 insert into generation_requests(id,user_id,story_id,branch_id,base_scene_id,action_hash,status) values(p_request_id,p_user_id,p_story_id,p_branch_id,p_base_scene_id,p_action_hash,'running') on conflict(id) do update set status='running',token=gen_random_uuid(),attempts=case when generation_requests.updated_at<now()-interval '1 hour' then 1 else generation_requests.attempts+1 end,updated_at=now() returning * into r;
 return jsonb_build_object('token',r.token,'replayed',false);
end $$;
create function public.commit_generation(p_user_id uuid,p_request_id uuid,p_token uuid,p_proposal jsonb,p_state jsonb,p_action text,p_choice_id text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r generation_requests; b story_branches; sid uuid; n integer; c jsonb; e jsonb; begin
 select * into r from generation_requests where id=p_request_id and user_id=p_user_id;
 if not found then raise exception 'Request not found' using errcode='P0002'; end if;
 select * into b from story_branches where id=r.branch_id for update;
 select * into r from generation_requests where id=p_request_id for update;
 if r.status='done' then return r.scene_id; end if;
 if r.status<>'running' or r.token<>p_token or r.updated_at<now()-interval '10 minutes' or b.current_scene_id is distinct from r.base_scene_id then raise exception 'Generation expired or chapter changed' using errcode='P0001'; end if;
 if not exists(select 1 from stories where id=r.story_id and user_id=p_user_id and status='active') then raise exception 'Story not found' using errcode='P0002'; end if;
 select coalesce((select scene_number from story_scenes where id=r.base_scene_id),0)+1 into n;
 if n>200 then raise exception 'Chapter limit reached' using errcode='P0001'; end if;
 insert into story_scenes(story_id,branch_id,parent_scene_id,scene_number,title,narrative,choices,state_snapshot,recap,story_finished) values(r.story_id,r.branch_id,r.base_scene_id,n,p_proposal->>'scene_title',p_proposal->>'narrative',p_proposal->'choices',p_state,p_proposal->>'recap',(p_proposal->>'story_finished')::boolean) returning id into sid;
 if r.base_scene_id is not null then insert into story_choices(story_id,branch_id,scene_id,choice_id,choice_text,custom_action,consequence_summary) values(r.story_id,r.branch_id,r.base_scene_id,p_choice_id,p_action,p_choice_id is null,p_proposal->>'consequence_summary');end if;
 update story_branches set current_scene_id=sid where id=r.branch_id;
 update story_state set current_scene_id=sid,state=p_state,updated_at=now() where branch_id=r.branch_id;
 for c in select value from jsonb_array_elements(p_state->'characters') loop
  insert into story_characters(story_id,branch_id,character_key,name,personality,background,status,relationships,metadata) values(r.story_id,r.branch_id,c->>'id',c->>'name',c->>'personality',c->>'background',c->>'status',p_state->'relationships',jsonb_build_object('location',c->>'location')) on conflict(branch_id,character_key) do update set personality=excluded.personality,background=excluded.background,status=excluded.status,relationships=excluded.relationships,metadata=excluded.metadata;
 end loop;
 for e in select value from jsonb_array_elements(p_proposal->'new_events') loop
  insert into story_events(story_id,branch_id,scene_id,event_key,description,metadata) values(r.story_id,r.branch_id,sid,e->>'id',e->>'description',jsonb_build_object('entities',e->'entities'));
 end loop;
 insert into story_summaries(story_id,branch_id,through_scene_id,summary) values(r.story_id,r.branch_id,sid,p_proposal->>'recap');
 update stories set updated_at=now(),title=case when n=1 and title='Untitled constellation' then left(p_proposal->>'scene_title',120) else title end where id=r.story_id;
 update generation_requests set status='done',scene_id=sid,updated_at=now() where id=r.id;
 return sid;
end $$;
create function public.fail_generation(p_user_id uuid,p_request_id uuid,p_token uuid) returns void language sql security definer set search_path=public,pg_temp as $$
 update generation_requests set status='failed',updated_at=now() where id=p_request_id and user_id=p_user_id and token=p_token and status='running';
$$;
create function public.fork_adventure(p_user_id uuid,p_story_id uuid,p_scene_id uuid,p_name text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s story_scenes; bid uuid; c jsonb; e jsonb; begin
 if not exists(select 1 from stories where id=p_story_id and user_id=p_user_id and status='active') then raise exception 'Story not found' using errcode='P0002';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_story_id::text,1));
 if (select count(*) from story_branches where story_id=p_story_id)>=25 then raise exception 'Branch limit reached (25).' using errcode='P0001';end if;
 select * into s from story_scenes where id=p_scene_id and story_id=p_story_id;
 if not found then raise exception 'Scene not found' using errcode='P0002';end if;
 insert into story_branches(story_id,parent_branch_id,fork_scene_id,current_scene_id,name) values(p_story_id,s.branch_id,s.id,s.id,p_name) returning id into bid;
 insert into story_state(story_id,branch_id,current_scene_id,state) values(p_story_id,bid,s.id,s.state_snapshot);
 for c in select value from jsonb_array_elements(s.state_snapshot->'characters') loop
  insert into story_characters(story_id,branch_id,character_key,name,personality,background,status,relationships,metadata) values(p_story_id,bid,c->>'id',c->>'name',c->>'personality',c->>'background',c->>'status',s.state_snapshot->'relationships',jsonb_build_object('location',c->>'location'));
 end loop;
 for e in select value from jsonb_array_elements(s.state_snapshot->'facts') loop
  insert into story_events(story_id,branch_id,scene_id,event_key,description,metadata) values(p_story_id,bid,s.id,e->>'id',e->>'description',jsonb_build_object('entities',e->'entities','inherited',true));
 end loop;
 return bid;
end $$;
-- Never let end-user JWTs call canonical state mutation functions.
revoke execute on function public.create_adventure(uuid,jsonb,jsonb),public.reserve_generation(uuid,uuid,uuid,uuid,uuid,text,integer),public.commit_generation(uuid,uuid,uuid,jsonb,jsonb,text,text),public.fail_generation(uuid,uuid,uuid),public.fork_adventure(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_adventure(uuid,jsonb,jsonb),public.reserve_generation(uuid,uuid,uuid,uuid,uuid,text,integer),public.commit_generation(uuid,uuid,uuid,jsonb,jsonb,text,text),public.fail_generation(uuid,uuid,uuid),public.fork_adventure(uuid,uuid,uuid,text) to service_role;
commit;
