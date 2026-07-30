create table if not exists public.generation_daily_usage (
    user_id text not null,
    usage_date date not null default ((now() at time zone 'Asia/Tokyo')::date),
    usage_count integer not null default 0 check (usage_count >= 0),
    updated_at timestamptz not null default now(),
    primary key (user_id, usage_date)
);

comment on table public.generation_daily_usage is
    'Daily successful generation count per Clerk user. Dates use Asia/Tokyo.';

alter table public.generation_daily_usage enable row level security;

revoke all on table public.generation_daily_usage from public, anon, authenticated;
grant select, insert, update on table public.generation_daily_usage to service_role;

create or replace function public.reserve_generation_quota(
    p_user_id text,
    p_daily_limit integer default 3
)
returns table (
    allowed boolean,
    used_count integer,
    remaining_count integer,
    quota_date date
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_quota_date date := (now() at time zone 'Asia/Tokyo')::date;
    v_used_count integer;
begin
    if nullif(btrim(p_user_id), '') is null then
        raise exception 'p_user_id is required';
    end if;
    if p_daily_limit < 1 then
        raise exception 'p_daily_limit must be at least 1';
    end if;

    insert into public.generation_daily_usage (
        user_id,
        usage_date,
        usage_count,
        updated_at
    )
    values (
        p_user_id,
        v_quota_date,
        1,
        now()
    )
    on conflict (user_id, usage_date)
    do update
       set usage_count = public.generation_daily_usage.usage_count + 1,
           updated_at = now()
     where public.generation_daily_usage.usage_count < p_daily_limit
    returning usage_count into v_used_count;

    if v_used_count is null then
        select usage_count
          into v_used_count
          from public.generation_daily_usage
         where user_id = p_user_id
           and usage_date = v_quota_date;

        return query
        select false, coalesce(v_used_count, p_daily_limit), 0, v_quota_date;
        return;
    end if;

    return query
    select true, v_used_count, greatest(p_daily_limit - v_used_count, 0), v_quota_date;
end;
$$;

revoke execute on function public.reserve_generation_quota(text, integer)
    from public, anon, authenticated;
grant execute on function public.reserve_generation_quota(text, integer)
    to service_role;

create or replace function public.release_generation_quota(
    p_user_id text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_quota_date date := (now() at time zone 'Asia/Tokyo')::date;
begin
    if nullif(btrim(p_user_id), '') is null then
        raise exception 'p_user_id is required';
    end if;

    update public.generation_daily_usage
       set usage_count = greatest(usage_count - 1, 0),
           updated_at = now()
     where user_id = p_user_id
       and usage_date = v_quota_date
       and usage_count > 0;
end;
$$;

revoke execute on function public.release_generation_quota(text)
    from public, anon, authenticated;
grant execute on function public.release_generation_quota(text)
    to service_role;
