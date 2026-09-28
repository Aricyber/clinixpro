import assert from "node:assert/strict";
import test from "node:test";
import type { Appointment, Expense, Patient, Payment, Service } from "@/types";

const { calculateDashboardSummary } = await import("./dashboard.ts");

test("dashboard summary totals active patients and revenue accurately", () => {
  const patients = [
    { id: "p1", active: true },
    { id: "p2", active: true },
    { id: "p3", active: false },
  ] as unknown as Patient[];

  const appointments = [
    { id: "a1", status: "CONFIRMED", serviceId: "s1", startAt: "2026-09-27T09:00:00.000Z" },
    { id: "a2", status: "SCHEDULED", serviceId: "s2", startAt: "2026-09-27T11:00:00.000Z" },
    { id: "a3", status: "COMPLETED", serviceId: "s3", startAt: "2026-09-27T15:00:00.000Z" },
  ] as unknown as Appointment[];

  const services = [
    { id: "s1", price: 180 },
    { id: "s2", price: 260 },
    { id: "s3", price: 320 },
  ] as unknown as Service[];

  const summary = calculateDashboardSummary({
    patients,
    appointments,
    services,
    referenceDate: new Date("2026-09-27T08:00:00.000Z"),
  });

  assert.equal(summary.activePatients, 2);
  assert.equal(summary.totalAppointments, 3);
  assert.equal(summary.totalRevenue, 760);
  assert.equal(summary.pendingRevenue, 260);
  assert.equal(summary.upcomingAppointments.length, 3);
});

test("dashboard summary reports day, week, paid, pending, expenses and net revenue", () => {
  const summary = calculateDashboardSummary({
    patients: [{ active: true }] as unknown as Patient[],
    appointments: [
      { id: "today", startAt: "2026-09-23T14:00:00.000Z", status: "CONFIRMED", serviceId: "s1" },
      { id: "week", startAt: "2026-09-25T14:00:00.000Z", status: "SCHEDULED", serviceId: "s1" },
      { id: "cancelled", startAt: "2026-09-26T14:00:00.000Z", status: "CANCELLED", serviceId: "s1" },
    ] as unknown as Appointment[],
    services: [{ id: "s1", price: 100 }] as unknown as Service[],
    payments: [
      { status: "PAID", finalAmount: 500 },
      { status: "PENDING", finalAmount: 120 },
      { status: "OVERDUE", finalAmount: 30 },
      { status: "CANCELLED", finalAmount: 900 },
    ] as unknown as Payment[],
    expenses: [
      { status: "PAID", amount: 80 },
      { status: "PENDING", amount: 20 },
      { status: "CANCELLED", amount: 400 },
    ] as unknown as Expense[],
    referenceDate: new Date("2026-09-23T12:00:00.000Z"),
  });

  assert.equal(summary.appointmentsToday, 1);
  assert.equal(summary.appointmentsThisWeek, 3);
  assert.equal(summary.paidRevenue, 500);
  assert.equal(summary.pendingRevenue, 150);
  assert.equal(summary.totalExpenses, 100);
  assert.equal(summary.netRevenue, 400);
  assert.deepEqual(summary.upcomingAppointments.map((appointment) => appointment.id), ["today", "week"]);
});
