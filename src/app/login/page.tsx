"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, ArrowRight, ShieldCheck } from "lucide-react";
import {
  completeClinicSetup,
  signInUser,
  signUpClinicOwner,
  signOutUser,
  type AuthStatus,
} from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

type LoginView = "login" | "register" | "setup";

const authMessages: Record<AuthStatus, string> = {
  success: "",
  invalid_credentials: "E-mail ou senha inválidos. Confira os dados e tente novamente.",
  clinic_setup_required: "Sua conta ainda não está vinculada a uma clínica. Complete o cadastro da clínica.",
  profile_unavailable: "Não foi possível carregar seu perfil. Tente novamente ou contate a administração da clínica.",
  email_confirmation_required: "Conta criada. Confirme seu e-mail e depois entre para concluir o cadastro da clínica.",
  signup_failed: "Não foi possível criar a conta. Verifique o e-mail e tente novamente.",
  setup_failed: "Não foi possível configurar a clínica. Verifique os dados e tente novamente.",
  supabase_not_configured: "O Supabase não está configurado neste ambiente.",
};

export default function LoginPage() {
  const router = useRouter();
  const demoMode = !isSupabaseConfigured();
  const [view, setView] = useState<LoginView>("login");
  const [email, setEmail] = useState(demoMode ? "aline@clinixpro.com.br" : "");
  const [password, setPassword] = useState(demoMode ? "123456" : "");
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicType, setClinicType] = useState<"odontology" | "physiotherapy">("odontology");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const setup = { fullName, clinicName, clinicType, phone };
      const result = view === "setup"
        ? await completeClinicSetup(setup)
        : view === "register"
          ? await signUpClinicOwner(email, password, setup)
          : await signInUser(email, password);

      if (result.user) {
        router.push("/dashboard");
        return;
      }

      if (result.status === "email_confirmation_required") {
        setView("login");
        setMessage(authMessages[result.status]);
        return;
      }

      if (result.status === "clinic_setup_required" || (view === "register" && result.status === "setup_failed")) {
        setView("setup");
        setError(result.status === "setup_failed" ? authMessages.setup_failed : "");
        setMessage(result.status === "setup_failed" ? "Sua conta foi autenticada; conclua a configuração da clínica." : authMessages.clinic_setup_required);
        return;
      }

      if (view === "setup" && result.status === "invalid_credentials") {
        setView("login");
      }

      setError(authMessages[result.status]);
    } catch {
      setError("Não foi possível concluir a solicitação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSetup = async () => {
    await signOutUser();
    setView("login");
    setError("");
    setMessage("");
  };

  const title = view === "register"
    ? "Criar conta e clínica"
    : view === "setup"
      ? "Configurar clínica"
      : "Entrar no sistema";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-[1.2fr_0.8fr]">
        <div className="hidden bg-slate-900 p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300">
                <Building2 size={26} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">SaaS</p>
                <h1 className="text-3xl font-bold">ClinixPro</h1>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <h2 className="max-w-md text-4xl font-semibold leading-tight">
              Gestão inteligente para clínicas odontológicas e fisioterapêuticas.
            </h2>
            <p className="max-w-md text-slate-300">
              Centralize pacientes, agenda, prontuários, financeiro e operações em uma plataforma segura e multiempresa.
            </p>
            <div className="flex items-center gap-2 text-sm text-teal-200">
              <ShieldCheck size={16} />
              Segurança, multi-tenancy e LGPD orientados ao negócio.
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">
              {view === "login" ? "Acesso" : "Cadastro"}
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">{title}</h2>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {view !== "login" ? (
              <>
                <div>
                  <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-slate-700">Nome completo</label>
                  <input
                    id="full-name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    minLength={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="clinic-name" className="mb-2 block text-sm font-medium text-slate-700">Nome da clínica</label>
                  <input
                    id="clinic-name"
                    value={clinicName}
                    onChange={(event) => setClinicName(event.target.value)}
                    required
                    minLength={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="clinic-type" className="mb-2 block text-sm font-medium text-slate-700">Especialidade</label>
                    <select
                      id="clinic-type"
                      value={clinicType}
                      onChange={(event) => setClinicType(event.target.value as "odontology" | "physiotherapy")}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
                    >
                      <option value="odontology">Odontologia</option>
                      <option value="physiotherapy">Fisioterapia</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="clinic-phone" className="mb-2 block text-sm font-medium text-slate-700">Telefone</label>
                    <input
                      id="clinic-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
                    />
                  </div>
                </div>
              </>
            ) : null}

            {view !== "setup" ? (
              <>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
              />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Senha</label>
              <input
                id="password"
                type="password"
                autoComplete={view === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={view === "register" ? 8 : undefined}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-teal-500 focus:bg-white"
              />
                  {view === "register" ? <p className="mt-1 text-xs text-slate-500">Use pelo menos 8 caracteres.</p> : null}
                </div>
              </>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:bg-slate-800"
            >
              {isSubmitting ? "Aguarde..." : view === "login" ? "Entrar" : view === "register" ? "Criar conta" : "Salvar clínica"}
              {!isSubmitting ? <ArrowRight size={18} /> : null}
            </button>
          </form>

          {demoMode ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Demonstração: use <strong>aline@clinixpro.com.br</strong> e qualquer senha.
            </div>
          ) : view === "login" ? (
            <p className="mt-6 text-center text-sm text-slate-600">
              Ainda não tem uma clínica?{" "}
              <button type="button" onClick={() => { setView("register"); setError(""); setMessage(""); }} className="font-medium text-teal-700 hover:text-teal-800">
                Criar conta
              </button>
            </p>
          ) : view === "register" ? (
            <p className="mt-6 text-center text-sm text-slate-600">
              Já tem uma conta?{" "}
              <button type="button" onClick={() => { setView("login"); setError(""); setMessage(""); }} className="font-medium text-teal-700 hover:text-teal-800">
                Entrar
              </button>
            </p>
          ) : (
            <button type="button" onClick={handleCancelSetup} className="mt-6 w-full text-center text-sm font-medium text-slate-600 hover:text-slate-900">
              Sair e voltar ao acesso
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
