import type { Appointment, Expense, Patient, Payment, Service } from "@/types";

export type DashboardSummaryInput = {
  patients: readonly Patient[];
  appointments: readonly Appointment[];
  services: readonly Service[];
  payments?: readonly Payment[];
  expenses?: readonly Expense[];
  referenceDate?: Date;
};

export function calculateDashboardSummary({ patients, appointments, services, payments, expenses, referenceDate = new Date() }: DashboardSummaryInput) {
  const servicePriceMap = new Map(services.map((service) => [service.id, service.price]));
  const referenceDay = new Date(referenceDate);
  referenceDay.setHours(0, 0, 0, 0);
  const weekStart = new Date(referenceDay);
  const dayOfWeek = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const appointmentsToday = appointments.filter((appointment) => {
    const date = new Date(appointment.startAt);
    return date >= referenceDay && date < new Date(referenceDay.getTime() + 86400000);
  }).length;
  const appointmentsThisWeek = appointments.filter((appointment) => {
    const date = new Date(appointment.startAt);
    return date >= weekStart && date < weekEnd;
  }).length;

  const activePatients = patients.filter((patient) => patient.active).length;
  const paidRevenue = payments
    ? payments.filter((payment) => payment.status === "PAID").reduce((sum, payment) => sum + payment.finalAmount, 0)
    : appointments.reduce((sum, appointment) => {
        const price = servicePriceMap.get(appointment.serviceId) ?? 0;
        return appointment.status === "CANCELLED" || appointment.status === "NO_SHOW" ? sum : sum + price;
      }, 0);

  const pendingRevenue = payments
    ? payments.filter((payment) => payment.status === "PENDING" || payment.status === "OVERDUE").reduce((sum, payment) => sum + payment.finalAmount, 0)
    : appointments.reduce((sum, appointment) => {
        const price = servicePriceMap.get(appointment.serviceId) ?? 0;
        return appointment.status === "SCHEDULED" || appointment.status === "IN_PROGRESS" ? sum + price : sum;
      }, 0);
  const totalExpenses = expenses?.filter((expense) => expense.status !== "CANCELLED").reduce((sum, expense) => sum + expense.amount, 0) ?? 0;

  const upcomingAppointments = appointments
    .filter((appointment) => {
      const start = new Date(appointment.startAt);
      return start >= referenceDate && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW";
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 5);

  return {
    activePatients,
    totalAppointments: appointments.length,
    appointmentsToday,
    appointmentsThisWeek,
    paidRevenue,
    totalRevenue: paidRevenue,
    pendingRevenue,
    totalExpenses,
    netRevenue: paidRevenue - totalExpenses,
    upcomingAppointments,
  };
}
