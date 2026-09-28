import type { ClinicType, Role, SessionUser } from "@/types";
import { sessionUser as demoSessionUser } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { normalizeClinicSlug } from "@/lib/tenant";

const SESSION_KEY = "clinixpro-session";

export type AuthStatus =
  | "success"
  | "invalid_credentials"
  | "clinic_setup_required"
  | "profile_unavailable"
  | "email_confirmation_required"
  | "signup_failed"
  | "setup_failed"
  | "supabase_not_configured";

export type AuthResult = {
  user: SessionUser | null;
  status: AuthStatus;
};

export type ClinicSetupInput = {
  fullName: string;
  clinicName: string;
  clinicType: ClinicType;
  phone: string;
};

type SupabaseProfile = {
  id: string;
  clinic_id: string;
  full_name: string;
  email: string;
  role: Role;
  clinics: {
    name: string;
    clinic_type: ClinicType;
  } | null;
};

const roles: Role[] = ["OWNER", "ADMIN", "RECEPTIONIST", "PROFESSIONAL"];
const clinicTypes: ClinicType[] = ["odontology", "physiotherapy"];

export function readStoredSession(): SessionUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(SESSION_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SessionUser;
  } catch {
    return null;
  }
}

export function saveStoredSession(user: SessionUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
}

export function getDefaultSessionUser(): SessionUser {
  return demoSessionUser;
}

async function getSupabaseProfile(userId: string): Promise<AuthResult> {
  if (!supabase) {
    return { user: null, status: "supabase_not_configured" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, clinic_id, full_name, email, role, clinics(name, clinic_type)")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { user: null, status: "profile_unavailable" };
  }

  if (!data) {
    return { user: null, status: "clinic_setup_required" };
  }

  const profile = data as unknown as SupabaseProfile;
  const clinic = profile.clinics;

  if (!clinic || !roles.includes(profile.role) || !clinicTypes.includes(clinic.clinic_type)) {
    return { user: null, status: "profile_unavailable" };
  }

  const user: SessionUser = {
    id: profile.id,
    clinicId: profile.clinic_id,
    clinicName: clinic.name,
    clinicType: clinic.clinic_type,
    name: profile.full_name,
    email: profile.email,
    role: profile.role,
  };

  saveStoredSession(user);
  return { user, status: "success" };
}

function createClinicSlug(name: string) {
  const slug = normalizeClinicSlug(name);
  return `${slug}-${Date.now().toString().slice(-6)}`;
}

async function provisionClinic(input: ClinicSetupInput): Promise<AuthResult> {
  if (!supabase) {
    return { user: null, status: "supabase_not_configured" };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { user: null, status: "invalid_credentials" };
  }

  const { error } = await supabase.rpc("create_clinic_for_current_user", {
    p_name: input.clinicName.trim(),
    p_slug: createClinicSlug(input.clinicName),
    p_clinic_type: input.clinicType,
    p_phone: input.phone.trim() || null,
    p_email: authData.user.email ?? "",
    p_full_name: input.fullName.trim(),
  });

  if (error) {
    return { user: null, status: "setup_failed" };
  }

  return getSupabaseProfile(authData.user.id);
}

export async function signInUser(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) {
    return { user: null, status: "invalid_credentials" };
  }

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return { user: null, status: "invalid_credentials" };
    }

    return getSupabaseProfile(data.user.id);
  }

  const user = getDefaultSessionUser();

  if (email.toLowerCase() !== user.email.toLowerCase()) {
    return { user: null, status: "invalid_credentials" };
  }

  saveStoredSession(user);
  return { user, status: "success" };
}

export async function signUpClinicOwner(
  email: string,
  password: string,
  input: ClinicSetupInput,
): Promise<AuthResult> {
  if (!supabase || !isSupabaseConfigured()) {
    return { user: null, status: "supabase_not_configured" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: input.fullName.trim() },
    },
  });

  if (error || !data.user) {
    return { user: null, status: "signup_failed" };
  }

  if (!data.session) {
    return { user: null, status: "email_confirmation_required" };
  }

  return provisionClinic(input);
}

export async function completeClinicSetup(input: ClinicSetupInput): Promise<AuthResult> {
  return provisionClinic(input);
}

export async function signOutUser() {
  if (isSupabaseConfigured() && supabase) {
    await supabase.auth.signOut();
  }

  clearStoredSession();
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      clearStoredSession();
      return null;
    }

    const result = await getSupabaseProfile(data.user.id);

    if (!result.user) {
      clearStoredSession();
      return null;
    }

    return result.user;
  }

  return readStoredSession();
}
