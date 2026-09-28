"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Power, Save, Search, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { professionals as initialProfessionals } from "@/lib/mock-data";
import { getCurrentSessionUser } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Professional } from "@/types";

type ProfessionalFormState = {
  fullName: string;
  specialty: string;
  professionalRegister: string;
  registerType: string;
  phone: string;
  email: string;
  active: boolean;
};

type ProfessionalRow = {
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

function mapProfessional(row: ProfessionalRow): Professional {
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

const emptyForm = (): ProfessionalFormState => ({
  fullName: "",
  specialty: "",
  professionalRegister: "",
  registerType: "CRO",
  phone: "",
  email: "",
  active: true,
});

export default function ProfessionalsPage() {
  const [records, setRecords] = useState<Professional[]>(initialProfessionals);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfessionalFormState>(emptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProfessionals() {
      if (!isSupabaseConfigured() || !supabase) {
        setRecords(initialProfessionals);
        setIsLoading(false);
        return;
      }

      try {
        const session = await getCurrentSessionUser();

        if (!session) {
          if (isMounted) {
            setError("Sua sessão expirou. Entre novamente para carregar os profissionais.");
            setIsLoading(false);
          }
          return;
        }

        const { data, error: queryError } = await supabase
          .from("professionals")
          .select("*")
          .eq("clinic_id", session.clinicId)
          .order("full_name", { ascending: true });

        if (queryError) {
          throw queryError;
        }

        if (isMounted) {
          setClinicId(session.clinicId);
          setRecords((data ?? []).map((row) => mapProfessional(row as unknown as ProfessionalRow)));
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar os profissionais. Verifique sua conexão e tente novamente.");
          setIsLoading(false);
        }
      }
    }

    loadProfessionals();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProfessionals = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return records;
    }

    return records.filter((professional) =>
      [professional.fullName, professional.specialty, professional.email ?? "", professional.phone]
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

  const handleEdit = (professional: Professional) => {
    setEditingId(professional.id);
    setForm({
      fullName: professional.fullName,
      specialty: professional.specialty,
      professionalRegister: professional.professionalRegister ?? "",
      registerType: professional.registerType ?? "CRO",
      phone: professional.phone,
      email: professional.email,
      active: professional.active,
    });
    setIsFormOpen(true);
  };

  const handleToggleActive = async (professionalId: string) => {
    const professional = records.find((record) => record.id === professionalId);

    if (!professional) {
      return;
    }

    const active = !professional.active;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { data, error: updateError } = await supabase
        .from("professionals")
        .update({ active, updated_at: now })
        .eq("id", professionalId)
        .eq("clinic_id", clinicId)
        .select("*")
        .single();

      if (updateError || !data) {
        setError("Não foi possível atualizar o status do profissional.");
        return;
      }

      setRecords((current) => current.map((record) => record.id === professionalId ? mapProfessional(data as unknown as ProfessionalRow) : record));
      setError("");
      return;
    }

    setRecords((current) =>
      current.map((professional) =>
        professional.id === professionalId
          ? { ...professional, active, updatedAt: now }
          : professional,
      ),
    );
  };

  const handleDelete = (professionalId: string) => {
    setRecords((current) => current.filter((professional) => professional.id !== professionalId));

    if (editingId === professionalId) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = form.fullName.trim();
    const trimmedPhone = form.phone.trim();

    if (!trimmedName || !trimmedPhone) {
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

        const professionalData = {
          full_name: trimmedName,
          specialty: form.specialty.trim(),
          professional_register: form.professionalRegister.trim() || null,
          register_type: form.registerType.trim() || null,
          phone: trimmedPhone,
          email: form.email.trim(),
          active: form.active,
          updated_at: now,
        };

        const result = editingId
          ? await supabase
              .from("professionals")
              .update(professionalData)
              .eq("id", editingId)
              .eq("clinic_id", clinicId)
              .select("*")
              .single()
          : await supabase
              .from("professionals")
              .insert({ ...professionalData, clinic_id: clinicId })
              .select("*")
              .single();

        if (result.error || !result.data) {
          setError("Não foi possível salvar o profissional. Verifique os dados e suas permissões.");
          return;
        }

        const savedProfessional = mapProfessional(result.data as unknown as ProfessionalRow);
        setRecords((current) => editingId
          ? current.map((professional) => professional.id === editingId ? savedProfessional : professional)
          : [savedProfessional, ...current]);
        resetForm();
        return;
      }

      if (editingId) {
        setRecords((current) =>
          current.map((professional) =>
            professional.id === editingId
              ? {
                  ...professional,
                  fullName: trimmedName,
                  specialty: form.specialty,
                  professionalRegister: form.professionalRegister || undefined,
                  registerType: form.registerType || undefined,
                  phone: trimmedPhone,
                  email: form.email,
                  active: form.active,
                  updatedAt: now,
                }
              : professional,
          ),
        );
      } else {
        const newProfessional: Professional = {
          id: `professional_${Date.now()}`,
          clinicId: "clinic_001",
          fullName: trimmedName,
          specialty: form.specialty,
          professionalRegister: form.professionalRegister || undefined,
          registerType: form.registerType || undefined,
          phone: trimmedPhone,
          email: form.email,
          active: form.active,
          createdAt: now,
          updatedAt: now,
        };

        setRecords((current) => [newProfessional, ...current]);
      }

      resetForm();
    } catch {
      setError("Não foi possível salvar o profissional. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PermissionGate permission="manageProfessionals">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Profissionais</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Equipe clínica</h1>
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Novo profissional
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
                placeholder="Buscar profissional"
                className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="text-sm text-slate-500">{filteredProfessionals.length} registros</div>
          </div>
        </div>

        {isFormOpen ? (
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? "Editar profissional" : "Novo profissional"}
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Especialidade</label>
                <input
                  value={form.specialty}
                  onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de registro</label>
                <select
                  value={form.registerType}
                  onChange={(event) => setForm((current) => ({ ...current, registerType: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                >
                  <option value="CRO">CRO</option>
                  <option value="CREFITO">CREFITO</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="OUTRO">OUTRO</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Registro profissional</label>
                <input
                  value={form.professionalRegister}
                  onChange={(event) => setForm((current) => ({ ...current, professionalRegister: event.target.value }))}
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
                  required
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
                  {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar profissional"}
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
                  <th className="px-4 py-3 font-medium">Especialidade</th>
                  <th className="px-4 py-3 font-medium">Registro</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Carregando profissionais...</td></tr>
                ) : filteredProfessionals.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Nenhum profissional encontrado.</td></tr>
                ) : filteredProfessionals.map((professional) => (
                  <tr key={professional.id} className="hover:bg-slate-50/60">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-slate-900">{professional.fullName}</p>
                        <p className="text-xs text-slate-500">{professional.email}</p>
                      </div>
                    </td>
                    <td className="table-cell">{professional.specialty}</td>
                    <td className="table-cell">{professional.professionalRegister ?? "N/D"}</td>
                    <td className="table-cell">
                      <span className={professional.active ? "badge bg-emerald-100 text-emerald-700" : "badge bg-slate-200 text-slate-700"}>
                        {professional.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(professional)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label={`Editar ${professional.fullName}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(professional.id)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          aria-label={professional.active ? `Inativar ${professional.fullName}` : `Reativar ${professional.fullName}`}
                        >
                          <Power size={16} />
                        </button>
                        {!isSupabaseConfigured() ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(professional.id)}
                            className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                            aria-label={`Excluir ${professional.fullName}`}
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
