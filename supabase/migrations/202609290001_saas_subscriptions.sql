alter table public.clinics
  add column if not exists subscription_status text not null default 'TRIALING'
    check (subscription_status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED')),
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column if not exists grace_period_ends_at timestamptz,
  add column if not exists subscription_updated_at timestamptz not null default now();

create table if not exists public.clinic_billing (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  plan_code text not null default 'CLINIXPRO_MONTHLY',
  billing_document text,
  billing_email text,
  asaas_customer_id text unique,
  asaas_subscription_id text unique,
  current_invoice_url text,
  last_payment_id text,
  last_payment_due_date date,
  provisioning_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asaas_webhook_events (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  event_type text not null,
  resource_id text,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSED', 'IGNORED')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.clinic_billing enable row level security;
alter table public.asaas_webhook_events enable row level security;

create function public.guard_clinic_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.subscription_status is distinct from old.subscription_status
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.grace_period_ends_at is distinct from old.grace_period_ends_at
    or new.subscription_updated_at is distinct from old.subscription_updated_at
  ) and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'Subscription fields can only be changed by the billing service';
  end if;

  return new;
end;
$$;

create trigger clinics_guard_subscription_change
  before update on public.clinics
  for each row execute function public.guard_clinic_subscription_change();

revoke all on function public.guard_clinic_subscription_change() from public;

create function public.current_clinic_has_subscription_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      c.subscription_status = 'ACTIVE'
      or (c.subscription_status = 'TRIALING' and c.trial_ends_at >= now())
      or (c.subscription_status = 'PAST_DUE' and c.grace_period_ends_at >= now())
    from public.clinics as c
    where c.id = (select public.current_clinic_id())
  ), false)
$$;

revoke all on function public.current_clinic_has_subscription_access() from public;
grant execute on function public.current_clinic_has_subscription_access() to authenticated;

create policy professionals_require_subscription on public.professionals
  as restrictive for all to authenticated
  using ((select public.current_clinic_has_subscription_access()))
  with check ((select public.current_clinic_has_subscription_access()));
create policy patients_require_subscription on public.patients
  as restrictive for all to authenticated
  using ((select public.current_clinic_has_subscription_access()))
  with check ((select public.current_clinic_has_subscription_access()));
create policy services_require_subscription on public.services
  as restrictive for all to authenticated
  using ((select public.current_clinic_has_subscription_access()))
  with check ((select public.current_clinic_has_subscription_access()));
create policy appointments_require_subscription on public.appointments
  as restrictive for all to authenticated
  using ((select public.current_clinic_has_subscription_access()))
  with check ((select public.current_clinic_has_subscription_access()));
create policy medical_records_require_subscription on public.medical_records
  as restrictive for all to authenticated
  using ((select public.current_clinic_has_subscription_access()))
  with check ((select public.current_clinic_has_subscription_access()));
create policy payments_require_subscription on public.payments
  as restrictive for all to authenticated
  using ((select public.current_clinic_has_subscription_access()))
  with check ((select public.current_clinic_has_subscription_access()));
create policy expenses_require_subscription on public.expenses
  as restrictive for all to authenticated
  using ((select public.current_clinic_has_subscription_access()))
  with check ((select public.current_clinic_has_subscription_access()));

comment on table public.clinic_billing is
  'Dados privados da assinatura SaaS. Sem policies: acesso exclusivo pela service role.';
comment on table public.asaas_webhook_events is
  'Eventos idempotentes do Asaas. Sem policies: acesso exclusivo pela service role.';
