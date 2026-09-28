"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, MoreHorizontal, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { appointments as initialAppointments, patients, professionals, services } from "@/lib/mock-data";
import {
  filterAppointments,
  mapAppointmentRow,
  type AppointmentRow,
  type AppointmentStatusFilter,
} from "@/lib/appointments";
import { getCurrentSessionUser } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Appointment } from "@/types";

type AppointmentFormState = {
  patientId: string;
  professionalId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  status: Appointment["status"];
  notes: string;
};

const emptyForm = (): AppointmentFormState => ({
  patientId: patients[0]?.id ?? "",
  professionalId: professionals[0]?.id ?? "",
  serviceId: services[0]?.id ?? "",
  startAt: "2026-09-27T09:00",
  endAt: "2026-09-27T09:45",
  status: "SCHEDULED",
  notes: "",
});

export default function AppointmentsPage() {
  const [records, setRecords] = useState<Appointment[]>(initialAppointments);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [patientOptions, setPatientOptions] = useState(patients);
  const [professionalOptions, setProfessionalOptions] = useState(professionals);
  const [serviceOptions, setServiceOptions] = useState(services);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatusFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AppointmentFormState>(emptyForm());

  useEffect(() => {
    let isMounted = true;

    async function loadAppointments() {
      if (!isSupabaseConfigured() || !supabase) {
        setRecords(initialAppointments);
        setIsLoading(false);
        return;
      }

      try {
        const session = await getCurrentSessionUser();

        if (!session) {
          if (isMounted) {
            setError("Sua sessão expirou. Entre novamente para carregar a agenda.");
            setIsLoading(false);
          }
          return;
        }

        const professionalsQuery = supabase
          .from("professionals")
          .select("id, full_name")
          .eq("clinic_id", session.clinicId)
          .eq("active", true);

        if (session.role === "PROFESSIONAL") {
          professionalsQuery.eq("profile_id", session.id);
        }

        const [appointmentsResult, patientsResult, professionalsResult, servicesResult] = await Promise.all([
          supabase.from("appointments").select("*").eq("clinic_id", session.clinicId).order("start_at", { ascending: true }),
          supabase.from("patients").select("id, full_name").eq("clinic_id", session.clinicId).eq("active", true).order("full_name"),
          professionalsQuery.order("full_name"),
          supabase.from("services").select("id, name").eq("clinic_id", session.clinicId).eq("active", true).order("name"),
        ]);

        if (appointmentsResult.error || patientsResult.error || professionalsResult.error || servicesResult.error) {
          throw appointmentsResult.error ?? patientsResult.error ?? professionalsResult.error ?? servicesResult.error;
        }

        if (isMounted) {
          setClinicId(session.clinicId);
          setRecords((appointmentsResult.data ?? []).map((row) => mapAppointmentRow(row as AppointmentRow)));
          setPatientOptions((patientsResult.data ?? []).map((row) => ({ ...patients[0], id: row.id, fullName: row.full_name, clinicId: session.clinicId })));
          setProfessionalOptions((professionalsResult.data ?? []).map((row) => ({ ...professionals[0], id: row.id, fullName: row.full_name, clinicId: session.clinicId })));
          setServiceOptions((servicesResult.data ?? []).map((row) => ({ ...services[0], id: row.id, name: row.name, clinicId: session.clinicId })));
          setError("");
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar a agenda. Verifique sua conexão e tente novamente.");
          setIsLoading(false);
        }
      }
    }

    loadAppointments();

    return () => {
      isMounted = false;
    };
  }, []);

  const patientMap = useMemo(() => new Map(patientOptions.map((patient) => [patient.id, patient.fullName])), [patientOptions]);
  const professionalMap = useMemo(
    () => new Map(professionalOptions.map((professional) => [professional.id, professional.fullName])),
    [professionalOptions],
  );
  const serviceMap = useMemo(() => new Map(serviceOptions.map((service) => [service.id, service.name])), [serviceOptions]);

  const filteredAppointments = useMemo(
    () => filterAppointments(records, search, statusFilter, patientMap, professionalMap, serviceMap),
    [records, search, statusFilter, patientMap, professionalMap, serviceMap],
  );

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleOpenNew = () => {
    setForm({
      ...emptyForm(),
      patientId: patientOptions[0]?.id ?? "",
      professionalId: professionalOptions[0]?.id ?? "",
      serviceId: serviceOptions[0]?.id ?? "",
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingId(appointment.id);
    setForm({
      patientId: appointment.patientId,
      professionalId: appointment.professionalId,
      serviceId: appointment.serviceId,
      startAt: appointment.startAt.slice(0, 16),
      endAt: appointment.endAt.slice(0, 16),
      status: appointment.status,
      notes: appointment.notes ?? "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (appointmentId: string) => {
    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId)
        .eq("clinic_id", clinicId);

      if (deleteError) {
        setError("Não foi possível excluir a consulta.");
        return;
      }
    }

    setRecords((current) => current.filter((appointment) => appointment.id !== appointmentId));

    if (editingId === appointmentId) {
      resetForm();
    }
  };

  const handleStatusUpdate = async (appointmentId: string) => {
    const appointment = records.find((item) => item.id === appointmentId);

    if (!appointment) {
      return;
    }

    const nextStatus: Appointment["status"] =
      appointment.status === "SCHEDULED"
        ? "CONFIRMED"
        : appointment.status === "CONFIRMED"
          ? "IN_PROGRESS"
          : appointment.status === "IN_PROGRESS"
            ? "COMPLETED"
            : "SCHEDULED";
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { error: updateError } = await supabase
        .from("appointments")
        .update({ status: nextStatus, updated_at: now })
        .eq("id", appointmentId)
        .eq("clinic_id", clinicId);

      if (updateError) {
        setError("Não foi possível atualizar o status da consulta.");
        return;
      }
    }

    setRecords((current) => current.map((appointment) => {
        if (appointment.id !== appointmentId) {
          return appointment;
        }

        return {
          ...appointment,
          status: nextStatus,
          updatedAt: now,
        };
      }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.patientId || !form.professionalId || !form.serviceId || !form.startAt || !form.endAt) {
      return;
    }

    const now = new Date().toISOString();
    const startAt = new Date(form.startAt).toISOString();
    const endAt = new Date(form.endAt).toISOString();

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const appointmentData = {
        clinic_id: clinicId,
        patient_id: form.patientId,
        professional_id: form.professionalId,
        service_id: form.serviceId,
        start_at: startAt,
        end_at: endAt,
        status: form.status,
        notes: form.notes.trim() || null,
        updated_at: now,
      };
      const result = editingId
        ? await supabase.from("appointments").update(appointmentData).eq("id", editingId).eq("clinic_id", clinicId).select("*").single()
        : await supabase.from("appointments").insert(appointmentData).select("*").single();

      if (result.error || !result.data) {
        setError("Não foi possível salvar a consulta. Verifique os horários e suas permissões.");
        return;
      }

      const savedAppointment = mapAppointmentRow(result.data as AppointmentRow);
      setRecords((current) => editingId
        ? current.map((appointment) => appointment.id === editingId ? savedAppointment : appointment)
        : [savedAppointment, ...current]);
      setError("");
      resetForm();
      return;
    }

    if (editingId) {
      setRecords((current) =>
        current.map((appointment) =>
          appointment.id === editingId
            ? {
                ...appointment,
                patientId: form.patientId,
                professionalId: form.professionalId,
                serviceId: form.serviceId,
                startAt,
                endAt,
                status: form.status,
                notes: form.notes,
                updatedAt: now,
              }
            : appointment,
        ),
      );
    } else {
      const newAppointment: Appointment = {
        id: `appointment_${Date.now()}`,
        clinicId: "clinic_001",
        patientId: form.patientId,
        professionalId: form.professionalId,
        serviceId: form.serviceId,
        startAt,
        endAt,
        status: form.status,
        notes: form.notes,
        createdAt: now,
        updatedAt: now,
      };

      setRecords((current) => [newAppointment, ...current]);
    }

    resetForm();
  };

  return (
    <PermissionGate permission="manageAppointments">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Agenda</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Consultas e atendimentos</h1>
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Nova consulta
          </button>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar consulta"
                className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600" htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as AppointmentStatusFilter)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:bg-white"
              >
                <option value="ALL">Todos</option>
                <option value="SCHEDULED">Agendada</option>
                <option value="CONFIRMED">Confirmada</option>
                <option value="IN_PROGRESS">Em andamento</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </div>

            <div className="text-sm text-slate-500">{filteredAppointments.length} registros</div>
          </div>
        </div>

        {isFormOpen ? (
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? "Editar consulta" : "Nova consulta"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Fechar formulário"
              >
                <X size={18} />
              </button>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Paciente</label>
                <select
                  value={form.patientId}
                  onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                >
                  {patientOptions.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.fullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Profissional</label>
                <select
                  value={form.professionalId}
                  onChange={(event) => setForm((current) => ({ ...current, professionalId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                >
                  {professionalOptions.map((professional) => (
                    <option key={professional.id} value={professional.id}>{professional.fullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Serviço</label>
                <select
                  value={form.serviceId}
                  onChange={(event) => setForm((current) => ({ ...current, serviceId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                >
                  {serviceOptions.map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Appointment["status"] }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                >
                  <option value="SCHEDULED">Agendada</option>
                  <option value="CONFIRMED">Confirmada</option>
                  <option value="IN_PROGRESS">Em andamento</option>
                  <option value="COMPLETED">Concluída</option>
                  <option value="CANCELLED">Cancelada</option>
                  <option value="NO_SHOW">No Show</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Início</label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fim</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Save size={16} />
                  {editingId ? "Salvar alterações" : "Salvar consulta"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isLoading ? (
          <div className="card p-6 text-sm text-slate-500">Carregando agenda...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAppointments.length === 0 ? (
              <p className="card p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Nenhuma consulta encontrada.</p>
            ) : null}
            {filteredAppointments.map((appointment) => {
              const patient = patientOptions.find((item) => item.id === appointment.patientId);
              const professional = professionalOptions.find((item) => item.id === appointment.professionalId);
              const service = serviceOptions.find((item) => item.id === appointment.serviceId);

              return (
                <div key={appointment.id} className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CalendarRange size={16} />
                    <span className="text-sm">{new Date(appointment.startAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <span className="badge bg-teal-100 text-teal-700">{appointment.status}</span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p><span className="font-medium text-slate-900">Paciente:</span> {patient?.fullName ?? "Não informado"}</p>
                  <p><span className="font-medium text-slate-900">Profissional:</span> {professional?.fullName ?? "Não informado"}</p>
                  <p><span className="font-medium text-slate-900">Serviço:</span> {service?.name ?? "Não informado"}</p>
                  <p><span className="font-medium text-slate-900">Horário:</span> {new Date(appointment.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>

                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(appointment)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Editar ${patient?.fullName ?? "consulta"}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(appointment.id)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Atualizar status ${patient?.fullName ?? "consulta"}`}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(appointment.id)}
                      className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                      aria-label={`Excluir ${patient?.fullName ?? "consulta"}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PermissionGate>
  );
}
