import assert from "node:assert/strict";
import test from "node:test";

const {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canManageProfessionals,
  canManageServices,
  canManageExpenses,
} = await import("./permissions.ts");

test("owner can manage professionals and services", () => {
  assert.equal(hasPermission("OWNER", "manageProfessionals"), true);
  assert.equal(hasPermission("OWNER", "manageServices"), true);
  assert.equal(canManageProfessionals("OWNER"), true);
  assert.equal(canManageServices("OWNER"), true);
});

test("receptionist cannot manage settings", () => {
  assert.equal(hasPermission("RECEPTIONIST", "manageSettings"), false);
  assert.equal(canManageProfessionals("RECEPTIONIST"), false);
  assert.equal(canManageExpenses("RECEPTIONIST"), false);
});

test("only owners and admins can manage expenses", () => {
  assert.equal(canManageExpenses("OWNER"), true);
  assert.equal(canManageExpenses("ADMIN"), true);
  assert.equal(canManageExpenses("PROFESSIONAL"), false);
});

test("a professional can access the medical record related permissions but not settings", () => {
  assert.equal(hasAnyPermission("PROFESSIONAL", ["manageAppointments", "accessMedicalRecords"]), true);
  assert.equal(
    hasAllPermissions("PROFESSIONAL", ["manageAppointments", "accessMedicalRecords"]),
    true,
  );
  assert.equal(hasPermission("PROFESSIONAL", "manageSettings"), false);
});
