"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { getCurrentSessionUser } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { clinic as demoClinic } from "@/lib/mock-data";
import type { Clinic, SessionUser } from "@/types";

type ClinicSettingsState = Pick<Clinic, "name" | "clinicType" | "phone" | "email">;

export default function SettingsPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [clinicProfile, setClinicProfile] = useState<ClinicSettingsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadClinicSettings() {
      const currentSession = await getCurrentSessionUser();

      if (!isMounted) {
        return;
      }

      setSession(currentSession);

      if (!currentSession) {
        setClinicProfile(null);
        setIsLoading(false);
        return;
      }

      if (!isSupabaseConfigured() || !supabase) {
        setClinicProfile({
          name: demoClinic.name,
          clinicType: demoClinic.clinicType,
          phone: demoClinic.phone,
          email: demoClinic.email,
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("clinics")
        .select("name, clinic_type, phone, email")
        .eq("id", currentSession.clinicId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setClinicProfile({
          name: currentSession.clinicName,
          clinicType: currentSession.clinicType,
          phone: "",
          email: currentSession.email,
        });
        setIsLoading(false);
        return;
      }

      setClinicProfile({
        name: data.name,
        clinicType: data.clinic_type,
        phone: data.phone ?? "",
        email: data.email ?? currentSession.email,
      });
      setIsLoading(false);
    }

    loadClinicSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const settings = useMemo(() => {
    const value = clinicProfile ?? {
      name: session?.clinicName ?? demoClinic.name,
      clinicType: session?.clinicType ?? demoClinic.clinicType,
      phone: demoClinic.phone,
      email: session?.email ?? demoClinic.email,
    };

    return [
      { label: "Nome da clínica", value: value.name },
      { label: "Tipo de clínica", value: value.clinicType === "odontology" ? "Odontologia" : "Fisioterapia" },
      { label: "Telefone", value: value.phone || "Não informado" },
      { label: "E-mail", value: value.email || "Não informado" },
    ];
  }, [clinicProfile, session]);

  return (
    <PermissionGate permission="manageSettings">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Configurações</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Perfil e permissões da clínica</h1>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-teal-100 p-2 text-teal-700">
                <Building2 size={18} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Dados gerais</h2>
            </div>

            {isLoading ? (
              <div className="mt-5 text-sm text-slate-500">Carregando dados da clínica...</div>
            ) : (
              <div className="mt-5 space-y-4">
                {settings.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                <ShieldCheck size={18} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Permissões</h2>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-xl bg-slate-50 p-3">OWNER · Acesso completo</div>
              <div className="rounded-xl bg-slate-50 p-3">ADMIN · Gestão geral</div>
              <div className="rounded-xl bg-slate-50 p-3">RECEPTIONIST · Agenda e pacientes</div>
              <div className="rounded-xl bg-slate-50 p-3">PROFESSIONAL · Prontuários e agenda própria</div>
            </div>
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
