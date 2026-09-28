"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { patients as initialPatients } from "@/lib/mock-data";
import { getCurrentSessionUser } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Patient } from "@/types";

type PatientFormState = {
  fullName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  email: string;
  address: string;
  emergencyContact: string;
  notes: string;
  status: "active" | "archived";
  active: boolean;
};

type PatientRow = {
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
  status: "active" | "archived";
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapPatient(row: PatientRow): Patient {
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

const emptyForm = (): PatientFormState => ({
  fullName: "",
  birthDate: "",
  cpf: "",
  phone: "",
  email: "",
  address: "",
  emergencyContact: "",
  notes: "",
  status: "active",
  active: true,
});

export default function PatientsPage() {
  const [records, setRecords] = useState<Patient[]>(initialPatients);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PatientFormState>(emptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPatients() {
      if (!isSupabaseConfigured() || !supabase) {
        setRecords(initialPatients);
        setIsLoading(false);
        return;
      }

      try {
        const session = await getCurrentSessionUser();

        if (!session) {
          if (isMounted) {
            setError("Sua sessão expirou. Entre novamente para carregar os pacientes.");
            setIsLoading(false);
          }
          return;
        }

        const { data, error: queryError } = await supabase
          .from("patients")
          .select("*")
          .eq("clinic_id", session.clinicId)
          .order("created_at", { ascending: false });

        if (queryError) {
          throw queryError;
        }

        if (isMounted) {
          setClinicId(session.clinicId);
          setRecords((data ?? []).map((row) => mapPatient(row as unknown as PatientRow)));
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar os pacientes. Verifique sua conexão e tente novamente.");
          setIsLoading(false);
        }
      }
    }

    loadPatients();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return records;
    }

    return records.filter((patient) =>
      [patient.fullName, patient.phone, patient.email ?? "", patient.cpf ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, search]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleOpenNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (patient: Patient) => {
    setEditingId(patient.id);
    setForm({
      fullName: patient.fullName,
      birthDate: patient.birthDate,
      cpf: patient.cpf ?? "",
      phone: patient.phone,
      email: patient.email ?? "",
      address: patient.address,
      emergencyContact: patient.emergencyContact ?? "",
      notes: patient.notes ?? "",
      status: patient.status,
      active: patient.active,
    });
    setIsFormOpen(true);
  };

  const handleToggleActive = async (patientId: string) => {
    const patient = records.find((record) => record.id === patientId);

    if (!patient) {
      return;
    }

    const active = !patient.active;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { data, error: updateError } = await supabase
        .from("patients")
        .update({
          active,
          status: active ? "active" : "archived",
          deleted_at: active ? null : now,
          updated_at: now,
        })
        .eq("id", patientId)
        .eq("clinic_id", clinicId)
        .select("*")
        .single();

      if (updateError || !data) {
        setError("Não foi possível atualizar o status do paciente.");
        return;
      }

      setRecords((current) => current.map((record) => record.id === patientId ? mapPatient(data as unknown as PatientRow) : record));
      setError("");
      return;
    }

    setRecords((current) =>
      current.map((patient) => {
        if (patient.id !== patientId) {
          return patient;
        }

        return {
          ...patient,
          active,
          status: active ? "active" : "archived",
          updatedAt: now,
          deletedAt: active ? null : now,
        };
      }),
    );
  };

  const handleDelete = (patientId: string) => {
    setRecords((current) => current.filter((patient) => patient.id !== patientId));

    if (editingId === patientId) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedFullName = form.fullName.trim();
    const trimmedPhone = form.phone.trim();

    if (!trimmedFullName || !trimmedPhone) {
      return;
    }

    const now = new Date().toISOString();
    setIsSaving(true);
    setError("");

    try {
      if (isSupabaseConfigured() && supabase) {
        if (!clinicId) {
          setError("Não foi possível identificar a clínica atual.");
          return;
        }

        const patientData = {
          full_name: trimmedFullName,
          birth_date: form.birthDate || null,
          cpf: form.cpf.trim() || null,
          phone: trimmedPhone,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          emergency_contact: form.emergencyContact.trim() || null,
          notes: form.notes.trim() || null,
          status: form.status,
          active: form.status === "active",
          deleted_at: form.status === "archived" ? now : null,
          updated_at: now,
        };

        const result = editingId
          ? await supabase
              .from("patients")
              .update(patientData)
              .eq("id", editingId)
              .eq("clinic_id", clinicId)
              .select("*")
              .single()
          : await supabase
              .from("patients")
              .insert({ ...patientData, clinic_id: clinicId })
              .select("*")
              .single();

        if (result.error || !result.data) {
          setError("Não foi possível salvar o paciente. Verifique os dados e suas permissões.");
          return;
        }

        const savedPatient = mapPatient(result.data as unknown as PatientRow);
        setRecords((current) => editingId
          ? current.map((patient) => patient.id === editingId ? savedPatient : patient)
          : [savedPatient, ...current]);
        resetForm();
        return;
      }

      if (editingId) {
        setRecords((current) =>
          current.map((patient) =>
            patient.id === editingId
              ? {
                  ...patient,
                  fullName: trimmedFullName,
                  birthDate: form.birthDate,
                  cpf: form.cpf || undefined,
                  phone: trimmedPhone,
                  email: form.email || undefined,
                  address: form.address,
                  emergencyContact: form.emergencyContact || undefined,
                  notes: form.notes || undefined,
                  active: form.active,
                  status: form.status,
                  updatedAt: now,
                }
              : patient,
          ),
        );
      } else {
        const newPatient: Patient = {
          id: `patient_${Date.now()}`,
          clinicId: "clinic_001",
          fullName: trimmedFullName,
          birthDate: form.birthDate,
          cpf: form.cpf || undefined,
          phone: trimmedPhone,
          email: form.email || undefined,
          address: form.address,
          emergencyContact: form.emergencyContact || undefined,
          notes: form.notes || undefined,
          status: form.status,
          active: form.active,
          createdAt: now,
          updatedAt: now,
          deletedAt: form.status === "archived" ? now : null,
        };

        setRecords((current) => [newPatient, ...current]);
      }

      resetForm();
    } catch {
      setError("Não foi possível salvar o paciente. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PermissionGate permission="managePatients">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Pacientes</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Cadastro e acompanhamento</h1>
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Novo paciente
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
                placeholder="Buscar paciente"
                className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="text-sm text-slate-500">{filteredPatients.length} registros</div>
          </div>
        </div>

        {isFormOpen ? (
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? "Editar paciente" : "Novo paciente"}
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
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome completo</label>
                <input
                  value={form.fullName}
                  onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Data de nascimento</label>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">CPF</label>
                <input
                  value={form.cpf}
                  onChange={(event) => setForm((current) => ({ ...current, cpf: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as "active" | "archived";
                    setForm((current) => ({
                      ...current,
                      status: nextStatus,
                      active: nextStatus === "active",
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                >
                  <option value="active">Ativo</option>
                  <option value="archived">Arquivado</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Endereço</label>
                <input
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Contato de emergência</label>
                <input
                  value={form.emergencyContact}
                  onChange={(event) => setForm((current) => ({ ...current, emergencyContact: event.target.value }))}
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
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Save size={16} />
                  {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar paciente"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Última atualização</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Carregando pacientes...</td></tr>
                ) : filteredPatients.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Nenhum paciente encontrado.</td></tr>
                ) : filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/60">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-slate-900">{patient.fullName}</p>
                        <p className="text-xs text-slate-500">{patient.email ?? "Sem e-mail"}</p>
                      </div>
                    </td>
                    <td className="table-cell">{patient.phone}</td>
                    <td className="table-cell">
                      <span className={patient.active ? "badge bg-emerald-100 text-emerald-700" : "badge bg-slate-200 text-slate-700"}>
                        {patient.active ? "Ativo" : "Arquivado"}
                      </span>
                    </td>
                    <td className="table-cell">{new Date(patient.updatedAt).toLocaleDateString("pt-BR")}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(patient)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label={`Editar ${patient.fullName}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(patient.id)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label={patient.active ? `Arquivar ${patient.fullName}` : `Reativar ${patient.fullName}`}
                        >
                          {patient.active ? <Archive size={16} /> : <RotateCcw size={16} />}
                        </button>
                        {!isSupabaseConfigured() ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(patient.id)}
                            className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                            aria-label={`Excluir ${patient.fullName}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
