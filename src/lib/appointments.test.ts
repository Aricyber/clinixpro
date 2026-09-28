import assert from "node:assert/strict";
import test from "node:test";
import type { Appointment } from "@/types";
import type { AppointmentRow } from "./appointments";

const { filterAppointments, mapAppointmentRow } = await import("./appointments.ts");

test("filterAppointments keeps matches by query and status", () => {
  const appointments = [
    {
      id: "a1",
      patientId: "p1",
      professionalId: "pr1",
      serviceId: "s1",
      status: "SCHEDULED",
      startAt: "2026-09-27T09:00:00.000Z",
      endAt: "2026-09-27T09:45:00.000Z",
      clinicId: "clinic_001",
      createdAt: "2026-09-27T09:00:00.000Z",
      updatedAt: "2026-09-27T09:00:00.000Z",
    },
    {
      id: "a2",
      patientId: "p2",
      professionalId: "pr2",
      serviceId: "s2",
      status: "CONFIRMED",
      startAt: "2026-09-27T11:00:00.000Z",
      endAt: "2026-09-27T11:45:00.000Z",
      clinicId: "clinic_001",
      createdAt: "2026-09-27T09:00:00.000Z",
      updatedAt: "2026-09-27T09:00:00.000Z",
    },
  ] as unknown as Appointment[];

  const patientMap = new Map([
    ["p1", "Bruno Costa"],
    ["p2", "Larissa Meireles"],
  ]);
  const professionalMap = new Map([
    ["pr1", "Dr. Rafael Almeida"],
    ["pr2", "Dra. Carla Souza"],
  ]);
  const serviceMap = new Map([
    ["s1", "Consulta odontológica"],
    ["s2", "Avaliação fisioterapêutica"],
  ]);

  const matched = filterAppointments(appointments, "bruno", "ALL", patientMap, professionalMap, serviceMap);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, "a1");

  const byStatus = filterAppointments(appointments, "", "CONFIRMED", patientMap, professionalMap, serviceMap);
  assert.equal(byStatus.length, 1);
  assert.equal(byStatus[0].id, "a2");
});

test("mapAppointmentRow converts a Supabase row into the appointment model", () => {
  const row = {
    id: "a1",
    clinic_id: "clinic_001",
    patient_id: "patient_1",
    professional_id: "professional_1",
    service_id: "service_1",
    start_at: "2026-09-27T09:00:00.000Z",
    end_at: "2026-09-27T09:45:00.000Z",
    status: "CONFIRMED",
    notes: "Anotações do atendimento",
    created_at: "2026-09-20T10:00:00.000Z",
    updated_at: "2026-09-20T10:00:00.000Z",
  };

  const appointment = mapAppointmentRow(row as AppointmentRow);

  assert.equal(appointment.id, "a1");
  assert.equal(appointment.patientId, "patient_1");
  assert.equal(appointment.status, "CONFIRMED");
  assert.equal(appointment.notes, "Anotações do atendimento");
});
