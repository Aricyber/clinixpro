create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  clinic_type text not null check (clinic_type in ('odontology', 'physiotherapy')),
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  full_name text not null,
  email text not null,
  role text not null check (role in ('OWNER', 'ADMIN', 'RECEPTIONIST', 'PROFESSIONAL')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id)
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  profile_id uuid unique,
  full_name text not null,
  specialty text not null,
  professional_register text,
  register_type text,
  phone text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, profile_id) references public.profiles(clinic_id, id) on delete set null (profile_id)
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  birth_date date,
  cpf text,
  phone text not null,
  whatsapp text,
  email text,
  address text,
  emergency_contact text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (clinic_id, id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text not null default '',
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(12, 2) not null check (price >= 0),
  category text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'SCHEDULED' check (
    status in ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  check (end_at > start_at),
  foreign key (clinic_id, patient_id) references public.patients(clinic_id, id) on delete restrict,
  foreign key (clinic_id, professional_id) references public.professionals(clinic_id, id) on delete restrict,
  foreign key (clinic_id, service_id) references public.services(clinic_id, id) on delete restrict
);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  professional_id uuid not null,
  appointment_id uuid,
  title text not null,
  evolution text not null default '',
  procedure text not null default '',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients(clinic_id, id) on delete restrict,
  foreign key (clinic_id, professional_id) references public.professionals(clinic_id, id) on delete restrict,
  foreign key (clinic_id, appointment_id) references public.appointments(clinic_id, id) on delete set null (appointment_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null,
  appointment_id uuid,
  amount numeric(12, 2) not null check (amount >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  final_amount numeric(12, 2) not null check (final_amount >= 0 and final_amount = amount - discount),
  payment_method text not null check (
    payment_method in ('PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER')
  ),
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
  due_date timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients(clinic_id, id) on delete restrict,
  foreign key (clinic_id, appointment_id) references public.appointments(clinic_id, id) on delete set null (appointment_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  description text not null,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  due_date timestamptz not null,
  paid_at timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id)
);

create index appointments_clinic_start_at_idx on public.appointments (clinic_id, start_at);
create index appointments_clinic_professional_idx on public.appointments (clinic_id, professional_id);
create index medical_records_clinic_patient_idx on public.medical_records (clinic_id, patient_id, created_at desc);
create index payments_clinic_status_due_date_idx on public.payments (clinic_id, status, due_date);

create function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.clinic_id
  from public.profiles as p
  where p.id = (select auth.uid())
  limit 1
$$;

create function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
  limit 1
$$;

create function public.create_clinic_for_current_user(
  p_name text,
  p_slug text,
  p_clinic_type text,
  p_phone text,
  p_email text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_clinic_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.profiles where id = current_user_id) then
    raise exception 'User already belongs to a clinic';
  end if;

  if nullif(trim(p_name), '') is null or nullif(trim(p_full_name), '') is null then
    raise exception 'Clinic and owner names are required';
  end if;

  insert into public.clinics (name, slug, clinic_type, phone, email)
  values (trim(p_name), lower(trim(p_slug)), p_clinic_type, nullif(trim(p_phone), ''), nullif(trim(p_email), ''))
  returning id into new_clinic_id;

  insert into public.profiles (id, clinic_id, full_name, email, role)
  values (
    current_user_id,
    new_clinic_id,
    trim(p_full_name),
    coalesce((select u.email from auth.users as u where u.id = current_user_id), ''),
    'OWNER'
  );

  return new_clinic_id;
end;
$$;

create function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'Profile clinic cannot be changed';
  end if;

  if new.role is distinct from old.role
    and coalesce((select public.current_user_role()), '') <> 'OWNER' then
    raise exception 'Only clinic owners can change user roles';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

revoke all on function public.current_clinic_id() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.create_clinic_for_current_user(text, text, text, text, text, text) from public;
revoke all on function public.guard_profile_role_change() from public;
grant execute on function public.current_clinic_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.create_clinic_for_current_user(text, text, text, text, text, text) to authenticated;

alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.patients enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

create policy clinics_read_own on public.clinics
  for select to authenticated
  using (id = (select public.current_clinic_id()));
create policy clinics_update_admin on public.clinics
  for update to authenticated
  using (id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'))
  with check (id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));

create policy profiles_read_clinic on public.profiles
  for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));

create policy professionals_read_clinic on public.professionals
  for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy professionals_manage_admin on public.professionals
  for all to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));

create policy patients_read_clinical_scope on public.patients
  for select to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST')
      or exists (
        select 1
        from public.appointments as a
        join public.professionals as pr on pr.id = a.professional_id and pr.clinic_id = a.clinic_id
        where a.clinic_id = patients.clinic_id
          and a.patient_id = patients.id
          and pr.profile_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.medical_records as mr
        join public.professionals as pr on pr.id = mr.professional_id and pr.clinic_id = mr.clinic_id
        where mr.clinic_id = patients.clinic_id
          and mr.patient_id = patients.id
          and pr.profile_id = (select auth.uid())
      )
    )
  );
create policy patients_manage_front_desk on public.patients
  for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST'));
create policy patients_update_front_desk on public.patients
  for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST'))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST'));

create policy services_read_clinic on public.services
  for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy services_manage_admin on public.services
  for all to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));

create policy appointments_read_clinic on public.appointments
  for select to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = appointments.professional_id
          and pr.clinic_id = appointments.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  );
create policy appointments_insert_front_desk_or_self on public.appointments
  for insert to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = appointments.professional_id
          and pr.clinic_id = appointments.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  );
create policy appointments_update_front_desk_or_self on public.appointments
  for update to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = appointments.professional_id
          and pr.clinic_id = appointments.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = appointments.professional_id
          and pr.clinic_id = appointments.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  );
create policy appointments_delete_admin on public.appointments
  for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));

create policy medical_records_read_scope on public.medical_records
  for select to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = medical_records.professional_id
          and pr.clinic_id = medical_records.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  );
create policy medical_records_insert_scope on public.medical_records
  for insert to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = medical_records.professional_id
          and pr.clinic_id = medical_records.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  );
create policy medical_records_update_scope on public.medical_records
  for update to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = medical_records.professional_id
          and pr.clinic_id = medical_records.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (
      (select public.current_user_role()) in ('OWNER', 'ADMIN')
      or exists (
        select 1 from public.professionals as pr
        where pr.id = medical_records.professional_id
          and pr.clinic_id = medical_records.clinic_id
          and pr.profile_id = (select auth.uid())
      )
    )
  );

create policy payments_read_finance on public.payments
  for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST'));
create policy payments_insert_finance on public.payments
  for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST'));
create policy payments_update_finance on public.payments
  for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST'))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN', 'RECEPTIONIST'));

create policy expenses_read_admin on public.expenses
  for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));
create policy expenses_manage_admin on public.expenses
  for all to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.current_user_role()) in ('OWNER', 'ADMIN'));