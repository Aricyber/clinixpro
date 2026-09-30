import { createClient } from "@supabase/supabase-js";
import type { Role } from "@/types";

export type AuthenticatedProfile = {
  id: string;
  clinic_id: string;
  email: string;
  role: Role;
};

function supabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function createAdminSupabase() {
  const { url, serviceRoleKey } = supabaseConfig();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticateRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const { url, publicKey } = supabaseConfig();

  if (!accessToken || !url || !publicKey) {
    return null;
  }

  const supabase = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, clinic_id, email, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  return { supabase, profile: profile as AuthenticatedProfile };
}
