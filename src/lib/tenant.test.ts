import assert from "node:assert/strict";
import test from "node:test";

const { normalizeClinicSlug, canAccessClinic } = await import("./tenant.ts");

test("normalizeClinicSlug produces a stable slug", () => {
  assert.equal(normalizeClinicSlug("Clínica & Dental"), "clinica-dental");
  assert.equal(normalizeClinicSlug("   "), "clinica");
});

test("canAccessClinic checks tenant ownership and profile role", () => {
  assert.equal(canAccessClinic({ clinicId: "clinic-1", role: "OWNER" }, "clinic-1"), true);
  assert.equal(canAccessClinic({ clinicId: "clinic-1", role: "RECEPTIONIST" }, "clinic-2"), false);
  assert.equal(canAccessClinic({ clinicId: "clinic-1", role: "PROFESSIONAL" }, "clinic-1"), true);
});
