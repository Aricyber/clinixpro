import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/202609260001_initial_schema.sql", import.meta.url),
  "utf8",
);

test("tenant tables have RLS enabled and clinic-scoped policies", () => {
  for (const table of [
    "clinics",
    "profiles",
    "professionals",
    "patients",
    "services",
    "appointments",
    "medical_records",
    "payments",
    "expenses",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }

  assert.match(migration, /clinic_id = \(select public\.current_clinic_id\(\)\)/i);
});

test("professional appointment and medical-record policies require the linked profile", () => {
  const profileScope = /pr\.profile_id = \(select auth\.uid\(\)\)/gi;
  assert.ok((migration.match(profileScope) ?? []).length >= 6);
  assert.match(migration, /create policy appointments_read_clinic[\s\S]*?pr\.id = appointments\.professional_id/i);
  assert.match(migration, /create policy medical_records_read_scope[\s\S]*?pr\.id = medical_records\.professional_id/i);
  assert.doesNotMatch(migration, /create policy medical_records_delete/i);
});

test("expense access is restricted to owners and admins", () => {
  assert.match(
    migration,
    /create policy expenses_manage_admin[\s\S]*?current_user_role\(\)[\s\S]*?in \('OWNER', 'ADMIN'\)/i,
  );
  assert.doesNotMatch(
    migration,
    /create policy expenses_[\s\S]*?current_user_role\(\)[\s\S]*?'RECEPTIONIST'/i,
  );
});
