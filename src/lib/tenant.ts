import type { ClinicType, SessionUser } from "@/types";

export type TenantAccessContext = Pick<SessionUser, "clinicId" | "role">;

export function normalizeClinicSlug(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "clinica";
}

export function canAccessClinic(user: TenantAccessContext | null | undefined, clinicId: string) {
  if (!user || !clinicId) {
    return false;
  }

  if (user.clinicId !== clinicId) {
    return false;
  }

  return ["OWNER", "ADMIN", "RECEPTIONIST", "PROFESSIONAL"].includes(user.role);
}

export function getClinicTypeLabel(type: ClinicType) {
  return type === "odontology" ? "Odontologia" : "Fisioterapia";
}
