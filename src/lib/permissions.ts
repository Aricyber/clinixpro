import type { Role } from "@/types";

export const ROLE_PERMISSIONS = {
  OWNER: [
    "manageClinic",
    "managePatients",
    "manageProfessionals",
    "manageServices",
    "manageAppointments",
    "accessMedicalRecords",
    "manageFinance",
    "manageExpenses",
    "manageSettings",
  ],
  ADMIN: [
    "manageClinic",
    "managePatients",
    "manageProfessionals",
    "manageServices",
    "manageAppointments",
    "accessMedicalRecords",
    "manageFinance",
    "manageExpenses",
    "manageSettings",
  ],
  RECEPTIONIST: [
    "managePatients",
    "manageAppointments",
    "manageFinance",
  ],
  PROFESSIONAL: [
    "manageAppointments",
    "accessMedicalRecords",
  ],
} as const satisfies Record<Role, readonly string[]>;

export function canManageClinic(role: Role) {
  return hasPermission(role, "manageClinic");
}

export function canManagePatients(role: Role) {
  return hasPermission(role, "managePatients");
}

export function canManageProfessionals(role: Role) {
  return hasPermission(role, "manageProfessionals");
}

export function canManageServices(role: Role) {
  return hasPermission(role, "manageServices");
}

export function canManageAppointments(role: Role) {
  return hasPermission(role, "manageAppointments");
}

export function canAccessMedicalRecords(role: Role) {
  return hasPermission(role, "accessMedicalRecords");
}

export function canManageFinance(role: Role) {
  return hasPermission(role, "manageFinance");
}

export function canManageExpenses(role: Role) {
  return hasPermission(role, "manageExpenses");
}

export function canManageSettings(role: Role) {
  return hasPermission(role, "manageSettings");
}

export function hasPermission(role: Role, permission: string) {
  const permissions: readonly string[] = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

export function hasAnyPermission(role: Role, permissions: readonly string[]) {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(role: Role, permissions: readonly string[]) {
  return permissions.every((permission) => hasPermission(role, permission));
}

