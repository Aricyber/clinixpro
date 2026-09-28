"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { patients, professionals } from "@/lib/mock-data";
import { getCurrentSessionUser } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { MedicalRecord } from "@/types";

type MedicalRecordRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  title: string;
  evolution: string;
  procedure: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapMedicalRecord(row: MedicalRecordRow): MedicalRecord {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    appointmentId: row.appointment_id ?? undefined,
    title: row.title,
    evolution: row.evolution,
    procedure: row.procedure,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type RecordFormState = {
  patientId: string;
  professionalId: string;
  title: string;
  procedure: string;
  evolution: string;
  notes: string;
};

const initialRecords: MedicalRecord[] = [
  {
    id: "mr_1",
    clinicId: "clinic_001",
    patientId: "patient_1",
    professionalId: "professional_1",
    title: "Avaliação inicial",
    evolution: "Paciente apresentou melhora na higiene e tolerância ao tratamento.",
    procedure: "Limpeza e revisão",
    notes: "Retorno em 30 dias.",
    createdAt: "2026-09-26T10:00:00.000Z",
    updatedAt: "2026-09-26T10:00:00.000Z",
  },
  {
    id: "mr_2",
    clinicId: "clinic_001",
    patientId: "patient_2",
    professionalId: "professional_2",
    title: "Evolução da sessão",
    evolution: "Movimento aumentado após a mobilização articular.",
    procedure: "Reabilitação funcional",
    notes: "Sessão bem tolerada.",
    createdAt: "2026-09-25T14:00:00.000Z",
    updatedAt: "2026-09-25T14:00:00.000Z",
  },
];

const emptyForm = (): RecordFormState => ({
  patientId: patients[0]?.id ?? "",
  professionalId: professionals[0]?.id ?? "",
  title: "",
  procedure: "",
  evolution: "",
  notes: "",
});

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>(initialRecords);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [patientOptions, setPatientOptions] = useState(patients);
  const [professionalOptions, setProfessionalOptions] = useState(professionals);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecordFormState>(emptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadMedicalRecords() {
      if (!isSupabaseConfigured() || !supabase) {
        setIsLoading(false);
        return;
      }

      try {
        const session = await getCurrentSessionUser();

        if (!session) {
          if (isMounted) {
            setError("Sua sessão expirou. Entre novamente para carregar os prontuários.");
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

        const [recordsResult, patientsResult, professionalsResult] = await Promise.all([
          supabase.from("medical_records").select("*").eq("clinic_id", session.clinicId).order("updated_at", { ascending: false }),
          supabase.from("patients").select("id, full_name").eq("clinic_id", session.clinicId).order("full_name"),
          professionalsQuery.order("full_name"),
        ]);

        if (recordsResult.error || patientsResult.error || professionalsResult.error) {
          throw recordsResult.error ?? patientsResult.error ?? professionalsResult.error;
        }

        if (isMounted) {
          setClinicId(session.clinicId);
          setRecords((recordsResult.data ?? []).map((row) => mapMedicalRecord(row as MedicalRecordRow)));
          setPatientOptions((patientsResult.data ?? []).map((row) => ({ ...patients[0], id: row.id, fullName: row.full_name, clinicId: session.clinicId })));
          setProfessionalOptions((professionalsResult.data ?? []).map((row) => ({ ...professionals[0], id: row.id, fullName: row.full_name, clinicId: session.clinicId })));
          setError("");
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar os prontuários. Verifique sua conexão e tente novamente.");
          setIsLoading(false);
        }
      }
    }

    loadMedicalRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return records;
    }

    return records.filter((record) => {
      const patient = patientOptions.find((item) => item.id === record.patientId);
      const professional = professionalOptions.find((item) => item.id === record.professionalId);

      return [patient?.fullName, professional?.fullName, record.title, record.procedure]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [records, search, patientOptions, professionalOptions]);

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
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (record: MedicalRecord) => {
    setEditingId(record.id);
    setForm({
      patientId: record.patientId,
      professionalId: record.professionalId,
      title: record.title,
      procedure: record.procedure,
      evolution: record.evolution,
      notes: record.notes ?? "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = (recordId: string) => {
    if (isSupabaseConfigured() && supabase) {
      setError("Prontuários não podem ser excluídos para preservar o histórico clínico.");
      return;
    }

    setRecords((current) => current.filter((record) => record.id !== recordId));

    if (editingId === recordId) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.patientId || !form.professionalId || !form.title.trim()) {
      return;
    }

    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const recordData = {
        clinic_id: clinicId,
        patient_id: form.patientId,
        professional_id: form.professionalId,
        title: form.title.trim(),
        procedure: form.procedure.trim(),
        evolution: form.evolution.trim(),
        notes: form.notes.trim() || null,
        updated_at: now,
      };
      const result = editingId
        ? await supabase.from("medical_records").update(recordData).eq("id", editingId).eq("clinic_id", clinicId).select("*").single()
        : await supabase.from("medical_records").insert(recordData).select("*").single();

      if (result.error || !result.data) {
        setError("Não foi possível salvar o prontuário. Verifique suas permissões.");
        return;
      }

      const savedRecord = mapMedicalRecord(result.data as MedicalRecordRow);
      setRecords((current) => editingId
        ? current.map((record) => record.id === editingId ? savedRecord : record)
        : [savedRecord, ...current]);
      setError("");
      resetForm();
      return;
    }

    if (editingId) {
      setRecords((current) =>
        current.map((record) =>
          record.id === editingId
            ? {
                ...record,
                patientId: form.patientId,
                professionalId: form.professionalId,
                title: form.title,
                procedure: form.procedure,
                evolution: form.evolution,
                notes: form.notes || undefined,
                updatedAt: now,
              }
            : record,
        ),
      );
    } else {
      const newRecord: MedicalRecord = {
        id: `mr_${Date.now()}`,
        clinicId: "clinic_001",
        patientId: form.patientId,
        professionalId: form.professionalId,
        title: form.title,
        procedure: form.procedure,
        evolution: form.evolution,
        notes: form.notes || undefined,
        createdAt: now,
        updatedAt: now,
      };

      setRecords((current) => [newRecord, ...current]);
    }

    resetForm();
  };

  return (
    <PermissionGate permission="accessMedicalRecords">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Prontuários</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Histórico clínico</h1>
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Novo registro
          </button>
        </div>

        <div className="card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={16} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar prontuário"
                className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="text-sm text-slate-500">{filteredRecords.length} registros</div>
          </div>
        </div>

        {isFormOpen ? (
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? "Editar registro" : "Novo registro"}
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

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Título</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Procedimento</label>
                <input
                  value={form.procedure}
                  onChange={(event) => setForm((current) => ({ ...current, procedure: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Evolução</label>
                <textarea
                  value={form.evolution}
                  onChange={(event) => setForm((current) => ({ ...current, evolution: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={3}
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
                  {editingId ? "Salvar alterações" : "Salvar registro"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {isLoading ? <div className="card p-5 text-sm text-slate-500">Carregando prontuários...</div> : null}

        <div className="grid gap-4">
          {!isLoading && filteredRecords.length === 0 ? (
            <p className="card p-8 text-center text-sm text-slate-500">Nenhum prontuário encontrado.</p>
          ) : null}
          {!isLoading && filteredRecords.map((record) => {
            const patient = patientOptions.find((item) => item.id === record.patientId);
            const professional = professionalOptions.find((item) => item.id === record.professionalId);

            return (
              <div key={record.id} className="card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-teal-100 p-2 text-teal-700">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{record.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {patient?.fullName ?? "Paciente"} · {professional?.fullName ?? "Profissional"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      {new Date(record.updatedAt).toLocaleDateString("pt-BR")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEdit(record)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                      aria-label={`Editar ${record.title}`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(record.id)}
                      className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                      aria-label={`Excluir ${record.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Procedimento:</span> {record.procedure || "Não informado"}
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  <span className="font-medium text-slate-900">Evolução:</span> {record.evolution || "Sem evolução registrada."}
                </div>
                {record.notes ? (
                  <div className="mt-3 text-sm text-slate-600">
                    <span className="font-medium text-slate-900">Observações:</span> {record.notes}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </PermissionGate>
  );
}
