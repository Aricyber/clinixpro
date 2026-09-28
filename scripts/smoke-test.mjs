import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.CLINIXPRO_TEST_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const routes = [
  "/",
  "/login",
  "/dashboard",
  "/patients",
  "/professionals",
  "/services",
  "/appointments",
  "/medical-records",
  "/finance",
  "/settings",
];

const tenantTables = [
  "clinics",
  "profiles",
  "professionals",
  "patients",
  "services",
  "appointments",
  "medical_records",
  "payments",
  "expenses",
];

async function testRoutes() {
  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    assert.ok(
      response.status >= 200 && response.status < 400,
      `${route} respondeu com HTTP ${response.status}`,
    );
    console.log(`PASS rota ${route} (${response.status})`);
  }
}

async function testAnonymousRls() {
  assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL não está configurada");
  assert.ok(supabaseKey, "A chave pública do Supabase não está configurada");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  for (const table of tenantTables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    assert.ifError(error);
    assert.equal(
      data.length,
      0,
      `RLS expôs dados da tabela ${table} para um usuário anônimo`,
    );
    console.log(`PASS RLS anônimo ${table}`);
  }
}

await testRoutes();
await testAnonymousRls();
console.log("Smoke test concluído com sucesso.");
