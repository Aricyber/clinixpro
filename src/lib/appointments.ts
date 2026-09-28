import type { Appointment } from "@/types";

export type AppointmentStatusFilter = "ALL" | Appointment["status"];

export type AppointmentRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  status: Appointment["status"];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapAppointmentRow(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    serviceId: row.service_id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function filterAppointments(
  appointments: readonly Appointment[],
  query: string,
  status: AppointmentStatusFilter,
  patientMap?: Map<string, string>,
  professionalMap?: Map<string, string>,
  serviceMap?: Map<string, string>,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return appointments.filter((appointment) => {
    const matchesStatus = status === "ALL" || appointment.status === status;

    if (!matchesStatus) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const patientName = patientMap?.get(appointment.patientId) ?? "";
    const professionalName = professionalMap?.get(appointment.professionalId) ?? "";
    const serviceName = serviceMap?.get(appointment.serviceId) ?? "";

    const haystack = [
      patientName,
      professionalName,
      serviceName,
      appointment.status,
      new Date(appointment.startAt).toLocaleDateString("pt-BR"),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
