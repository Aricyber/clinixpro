"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Power, Save, Search, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { services as initialServices } from "@/lib/mock-data";
import { getCurrentSessionUser } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Service } from "@/types";

type ServiceFormState = {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  category: string;
  active: boolean;
};

type ServiceRow = {
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

function mapService(row: ServiceRow): Service {
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

const emptyForm = (): ServiceFormState => ({
  name: "",
  description: "",
  durationMinutes: 30,
  price: 0,
  category: "",
  active: true,
});

export default function ServicesPage() {
  const [records, setRecords] = useState<Service[]>(initialServices);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadServices() {
      if (!isSupabaseConfigured() || !supabase) {
        setRecords(initialServices);
        setIsLoading(false);
        return;
      }

      try {
        const session = await getCurrentSessionUser();

        if (!session) {
          if (isMounted) {
            setError("Sua sessão expirou. Entre novamente para carregar os serviços.");
            setIsLoading(false);
          }
          return;
        }

        const { data, error: queryError } = await supabase
          .from("services")
          .select("*")
          .eq("clinic_id", session.clinicId)
          .order("name", { ascending: true });

        if (queryError) {
          throw queryError;
        }

        if (isMounted) {
          setClinicId(session.clinicId);
          setRecords((data ?? []).map((row) => mapService(row as unknown as ServiceRow)));
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar os serviços. Verifique sua conexão e tente novamente.");
          setIsLoading(false);
        }
      }
    }

    loadServices();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return records;
    }

    return records.filter((service) =>
      [service.name, service.category, service.description]
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

  const handleEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      price: service.price,
      category: service.category,
      active: service.active,
    });
    setIsFormOpen(true);
  };

  const handleToggleActive = async (serviceId: string) => {
    const service = records.find((record) => record.id === serviceId);

    if (!service) {
      return;
    }

    const active = !service.active;
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { data, error: updateError } = await supabase
        .from("services")
        .update({ active, updated_at: now })
        .eq("id", serviceId)
        .eq("clinic_id", clinicId)
        .select("*")
        .single();

      if (updateError || !data) {
        setError("Não foi possível atualizar o status do serviço.");
        return;
      }

      setRecords((current) => current.map((record) => record.id === serviceId ? mapService(data as unknown as ServiceRow) : record));
      setError("");
      return;
    }

    setRecords((current) =>
      current.map((service) =>
        service.id === serviceId ? { ...service, active, updatedAt: now } : service,
      ),
    );
  };

  const handleDelete = (serviceId: string) => {
    setRecords((current) => current.filter((service) => service.id !== serviceId));

    if (editingId === serviceId) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedCategory = form.category.trim();

    if (!trimmedName || !trimmedCategory || form.durationMinutes < 15 || form.price < 0) {
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

        const serviceData = {
          name: trimmedName,
          description: form.description.trim(),
          duration_minutes: form.durationMinutes,
          price: Number(form.price),
          category: trimmedCategory,
          active: form.active,
          updated_at: now,
        };

        const result = editingId
          ? await supabase
              .from("services")
              .update(serviceData)
              .eq("id", editingId)
              .eq("clinic_id", clinicId)
              .select("*")
              .single()
          : await supabase
              .from("services")
              .insert({ ...serviceData, clinic_id: clinicId })
              .select("*")
              .single();

        if (result.error || !result.data) {
          setError("Não foi possível salvar o serviço. Verifique os dados e suas permissões.");
          return;
        }

        const savedService = mapService(result.data as unknown as ServiceRow);
        setRecords((current) => editingId
          ? current.map((service) => service.id === editingId ? savedService : service)
          : [savedService, ...current]);
        resetForm();
        return;
      }

      if (editingId) {
        setRecords((current) =>
          current.map((service) =>
            service.id === editingId
              ? {
                  ...service,
                  name: trimmedName,
                  description: form.description,
                  durationMinutes: form.durationMinutes,
                  price: Number(form.price),
                  category: trimmedCategory,
                  active: form.active,
                  updatedAt: now,
                }
              : service,
          ),
        );
      } else {
        const newService: Service = {
          id: `service_${Date.now()}`,
          clinicId: "clinic_001",
          name: trimmedName,
          description: form.description,
          durationMinutes: form.durationMinutes,
          price: Number(form.price),
          category: trimmedCategory,
          active: form.active,
          createdAt: now,
          updatedAt: now,
        };

        setRecords((current) => [newService, ...current]);
      }

      resetForm();
    } catch {
      setError("Não foi possível salvar o serviço. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PermissionGate permission="manageServices">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Serviços</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Catálogo da clínica</h1>
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Novo serviço
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
                placeholder="Buscar serviço"
                className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="text-sm text-slate-500">{filteredServices.length} registros</div>
          </div>
        </div>

        {isFormOpen ? (
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? "Editar serviço" : "Novo serviço"}
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Nome do serviço</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Categoria</label>
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Duração (min)</label>
                <input
                  type="number"
                  min={15}
                  step={5}
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      durationMinutes: Number(event.target.value || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Preço</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value || 0) }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-700">Status</span>
                  <span className={form.active ? "badge bg-emerald-100 text-emerald-700" : "badge bg-slate-200 text-slate-700"}>
                    {form.active ? "Ativo" : "Inativo"}
                  </span>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                    className="sr-only"
                  />
                </label>
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
                  {isSaving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar serviço"}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            <p className="card p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Carregando serviços...</p>
          ) : filteredServices.length === 0 ? (
            <p className="card p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">Nenhum serviço encontrado.</p>
          ) : filteredServices.map((service) => (
            <div key={service.id} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{service.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{service.category}</p>
                </div>
                <span className={service.active ? "badge bg-emerald-100 text-emerald-700" : "badge bg-slate-200 text-slate-700"}>
                  {service.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">{service.description}</p>

              <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
                <span>{service.durationMinutes} min</span>
                <span className="text-lg font-bold text-slate-900">R$ {service.price.toFixed(2)}</span>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(service)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label={`Editar ${service.name}`}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(service.id)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label={service.active ? `Inativar ${service.name}` : `Reativar ${service.name}`}
                >
                  <Power size={16} />
                </button>
                {!isSupabaseConfigured() ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(service.id)}
                    className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                    aria-label={`Excluir ${service.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PermissionGate>
  );
}
