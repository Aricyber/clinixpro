"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { SubscriptionStatus } from "@/types";

type BillingStatus = {
  status: SubscriptionStatus;
  storedStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  price: number;
  invoiceUrl: string | null;
  hasSubscription: boolean;
  canManage: boolean;
};

const statusLabels: Record<SubscriptionStatus, string> = {
  TRIALING: "Período gratuito",
  ACTIVE: "Assinatura ativa",
  PAST_DUE: "Pagamento atrasado",
  SUSPENDED: "Acesso suspenso",
  CANCELLED: "Assinatura cancelada",
};

async function accessToken() {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [document, setDocument] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadBilling = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setBilling({ status: "ACTIVE", storedStatus: "ACTIVE", trialEndsAt: null, gracePeriodEndsAt: null, price: 99.9, invoiceUrl: null, hasSubscription: true, canManage: true });
      setIsLoading(false);
      return;
    }

    const token = await accessToken();
    if (!token) {
      setError("Sua sessão expirou. Entre novamente.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/billing/subscription", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json() as BillingStatus & { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível consultar a assinatura.");
      }
      setBilling(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível consultar a assinatura.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBilling();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBilling]);

  const handleSubscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const token = await accessToken();
      if (!token) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }
      const response = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ document }),
      });
      const result = await response.json() as BillingStatus & { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível criar a assinatura.");
      }
      setBilling(result);
      if (result.invoiceUrl) {
        window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar a assinatura.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="card p-6 text-sm text-slate-500">Carregando assinatura...</div>;
  }

  const isActive = billing?.status === "ACTIVE";
  const isTrial = billing?.status === "TRIALING";
  const deadline = isTrial ? billing?.trialEndsAt : billing?.gracePeriodEndsAt;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Assinatura</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Plano ClinixPro</h1>
        <p className="mt-2 text-slate-600">O acesso de toda a clínica é controlado automaticamente pelo pagamento.</p>
      </div>

      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-teal-700">Plano mensal</p>
              <p className="mt-2 text-4xl font-bold text-slate-900">R$ {(billing?.price ?? 99.9).toFixed(2).replace(".", ",")}</p>
              <p className="text-sm text-slate-500">por clínica / mês</p>
            </div>
            <CreditCard className="text-teal-700" size={28} />
          </div>

          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {["Agenda, pacientes e prontuários", "Financeiro e relatórios", "Profissionais e recepção", "14 dias de teste gratuito", "10 dias de tolerância após o vencimento"].map((item) => (
              <li key={item} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" />{item}</li>
            ))}
          </ul>

          {!billing?.hasSubscription && billing?.canManage ? (
            <form onSubmit={handleSubscribe} className="mt-7 space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                CPF ou CNPJ do responsável
                <input
                  value={document}
                  onChange={(event) => setDocument(event.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="Somente números"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white"
                />
              </label>
              <button disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {isSubmitting ? "Criando assinatura..." : "Ativar assinatura no Asaas"}
              </button>
            </form>
          ) : null}

          {billing?.invoiceUrl && !isActive ? (
            <a href={billing.invoiceUrl} target="_blank" rel="noreferrer" className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800">
              <ExternalLink size={18} /> Pagar ou regularizar no Asaas
            </a>
          ) : null}

          {!billing?.canManage && !isActive ? (
            <p className="mt-7 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Peça ao proprietário da clínica para regularizar a assinatura.</p>
          ) : null}
        </section>

        <aside className="card p-6">
          <p className="text-sm text-slate-500">Situação atual</p>
          <p className={`mt-2 text-xl font-semibold ${isActive || isTrial ? "text-emerald-700" : "text-rose-700"}`}>
            {billing ? statusLabels[billing.status] : "Indisponível"}
          </p>
          {deadline ? <p className="mt-3 text-sm text-slate-600">Prazo: {new Date(deadline).toLocaleDateString("pt-BR")}</p> : null}
          <button type="button" onClick={() => { setIsLoading(true); loadBilling(); }} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800">
            <RefreshCw size={15} /> Já paguei, verificar novamente
          </button>
        </aside>
      </div>
    </div>
  );
}
