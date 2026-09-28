"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, DollarSign, CalendarCheck2, Users, ArrowUpRight, ArrowDownRight, ReceiptText, WalletCards } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { clinic as demoClinic, patients as initialPatients, professionals as initialProfessionals, services as initialServices, appointments as initialAppointments } from "@/lib/mock-data";
import { getCurrentSessionUser } from "@/lib/auth";
import { calculateDashboardSummary } from "@/lib/dashboard";
import { mapExpenseRow, mapPaymentRow, type ExpenseRow, type PaymentRow } from "@/lib/finance";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Appointment, Expense, Patient, Payment, Professional, Service, SessionUser } from "@/types";

type DashboardAppointmentRow = {
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

type DashboardPatientRow = {
  id: string;
  clinic_id: string;
  full_name: string;
  birth_date: string | null;
  cpf: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  notes: string | null;
  status: Patient["status"];
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type DashboardProfessionalRow = {
  id: string;
  clinic_id: string;
  full_name: string;
  specialty: string;
  professional_register: string | null;
  register_type: string | null;
  phone: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type DashboardServiceRow = {
  id: string;
  clinic_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number | string;
  category: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function mapPatient(row: DashboardPatientRow): Patient {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    fullName: row.full_name,
    birthDate: row.birth_date ?? "",
    cpf: row.cpf ?? undefined,
    phone: row.phone,
    whatsapp: row.whatsapp ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? "",
    emergencyContact: row.emergency_contact ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapProfessional(row: DashboardProfessionalRow): Professional {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    fullName: row.full_name,
    specialty: row.specialty,
    professionalRegister: row.professional_register ?? undefined,
    registerType: row.register_type ?? undefined,
    phone: row.phone,
    email: row.email,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapService(row: DashboardServiceRow): Service {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    price: Number(row.price),
    category: row.category,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAppointment(row: DashboardAppointmentRow): Appointment {
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

export default function DashboardPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [professionals, setProfessionals] = useState<Professional[]>(initialProfessionals);
  const [services, setServices] = useState<Service[]>(initialServices);
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!isSupabaseConfigured() || !supabase) {
        setIsLoading(false);
        return;
      }

      try {
        const currentSession = await getCurrentSessionUser();

        if (!currentSession) {
          if (isMounted) {
            setError("Sua sessão expirou. Entre novamente para carregar o dashboard.");
            setIsLoading(false);
          }
          return;
        }

        const [patientsResult, professionalsResult, servicesResult, appointmentsResult, paymentsResult, expensesResult] = await Promise.all([
          supabase.from("patients").select("*").eq("clinic_id", currentSession.clinicId),
          supabase.from("professionals").select("*").eq("clinic_id", currentSession.clinicId),
          supabase.from("services").select("*").eq("clinic_id", currentSession.clinicId),
          supabase.from("appointments").select("*").eq("clinic_id", currentSession.clinicId).order("start_at", { ascending: true }),
          supabase.from("payments").select("*").eq("clinic_id", currentSession.clinicId),
          supabase.from("expenses").select("*").eq("clinic_id", currentSession.clinicId),
        ]);

        if (patientsResult.error || professionalsResult.error || servicesResult.error || appointmentsResult.error || paymentsResult.error || expensesResult.error) {
          throw patientsResult.error ?? professionalsResult.error ?? servicesResult.error ?? appointmentsResult.error ?? paymentsResult.error ?? expensesResult.error;
        }

        if (isMounted) {
          setSession(currentSession);
          setPatients((patientsResult.data ?? []).map((row) => mapPatient(row as DashboardPatientRow)));
          setProfessionals((professionalsResult.data ?? []).map((row) => mapProfessional(row as DashboardProfessionalRow)));
          setServices((servicesResult.data ?? []).map((row) => mapService(row as DashboardServiceRow)));
          setAppointments((appointmentsResult.data ?? []).map((row) => mapAppointment(row as DashboardAppointmentRow)));
          setPayments((paymentsResult.data ?? []).map((row) => mapPaymentRow(row as PaymentRow)));
          setExpenses((expensesResult.data ?? []).map((row) => mapExpenseRow(row as ExpenseRow)));
          setError("");
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar o dashboard. Verifique sua conexão e tente novamente.");
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = calculateDashboardSummary({ patients, appointments, services, payments: payments ?? undefined, expenses });
  const upcoming = summary.upcomingAppointments;
  const patientMap = useMemo(() => new Map(patients.map((patient) => [patient.id, patient.fullName])), [patients]);

  const stats = [
    {
      label: "Consultas hoje",
      value: String(summary.appointmentsToday),
      change: "+12%",
      trend: "up" as const,
      icon: <CalendarCheck2 size={18} />,
    },
    {
      label: "Pacientes ativos",
      value: String(summary.activePatients),
      change: "+8%",
      trend: "up" as const,
      icon: <Users size={18} />,
    },
    {
      label: "Faturamento pago",
      value: `R$ ${summary.paidRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "Recebido",
      trend: "up" as const,
      icon: <DollarSign size={18} />,
    },
    {
      label: "Pendências",
      value: `R$ ${summary.pendingRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "A receber",
      trend: "down" as const,
      icon: <Activity size={18} />,
    },
    {
      label: "Despesas",
      value: `R$ ${summary.totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "Não canceladas",
      trend: "down" as const,
      icon: <ReceiptText size={18} />,
    },
    {
      label: "Receita líquida",
      value: `R$ ${summary.netRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: "Pago - despesas",
      trend: summary.netRevenue >= 0 ? "up" as const : "down" as const,
      icon: <WalletCards size={18} />,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Visão geral da clínica</h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {session?.clinicName ?? demoClinic.name} · {(session?.clinicType ?? demoClinic.clinicType) === "odontology" ? "Odontologia" : "Fisioterapia"}
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="card p-5 text-sm text-slate-500">Carregando dados da clínica...</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            trend={stat.trend}
            icon={stat.icon}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Próximos atendimentos</h2>
            <span className="text-sm text-slate-500">Hoje</span>
          </div>
          <div className="space-y-3">
            {!isLoading && upcoming.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum atendimento futuro encontrado.</p>
            ) : null}
            {upcoming.map((appointment) => {
              const patientName = patientMap.get(appointment.patientId);

              return (
                <div key={appointment.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{patientName ?? "Paciente"}</p>
                    <p className="text-sm text-slate-500">{new Date(appointment.startAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-teal-100 px-2 py-1 font-medium text-teal-700">{appointment.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-semibold text-slate-900">Resumo rápido</h2>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-sm text-slate-500">Pacientes</p>
                <p className="text-xl font-bold text-slate-900">{patients.length}</p>
              </div>
              <ArrowUpRight className="text-emerald-600" size={18} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-sm text-slate-500">Profissionais</p>
                <p className="text-xl font-bold text-slate-900">{professionals.length}</p>
              </div>
              <ArrowUpRight className="text-emerald-600" size={18} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-sm text-slate-500">Serviços</p>
                <p className="text-xl font-bold text-slate-900">{services.length}</p>
              </div>
              <ArrowDownRight className="text-rose-600" size={18} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
