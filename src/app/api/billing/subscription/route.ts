import { z } from "zod";
import { AsaasApiError, createAsaasCustomer, createAsaasSubscription, listAsaasSubscriptionPayments } from "@/lib/asaas-server";
import { CLINIXPRO_MONTHLY_PRICE, effectiveSubscriptionStatus, toAsaasDate } from "@/lib/billing";
import { authenticateRequest, createAdminSupabase } from "@/lib/server-auth";
import type { SessionUser, SubscriptionStatus } from "@/types";

export const runtime = "nodejs";

const subscribeSchema = z.object({
  document: z.string().transform((value) => value.replace(/\D/g, "")).refine(
    (value) => value.length === 11 || value.length === 14,
    "Informe um CPF ou CNPJ válido.",
  ),
});

type ClinicBillingRow = {
  clinic_id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  current_invoice_url: string | null;
};

type ClinicRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
};

function publicStatus(clinic: ClinicRow, billing: ClinicBillingRow | null, role: string) {
  const sessionShape: Pick<SessionUser, "subscriptionStatus" | "trialEndsAt" | "gracePeriodEndsAt"> = {
    subscriptionStatus: clinic.subscription_status,
    trialEndsAt: clinic.trial_ends_at ?? undefined,
    gracePeriodEndsAt: clinic.grace_period_ends_at ?? undefined,
  };

  return {
    status: effectiveSubscriptionStatus(sessionShape),
    storedStatus: clinic.subscription_status,
    trialEndsAt: clinic.trial_ends_at,
    gracePeriodEndsAt: clinic.grace_period_ends_at,
    price: CLINIXPRO_MONTHLY_PRICE,
    invoiceUrl: billing?.current_invoice_url ?? null,
    hasSubscription: Boolean(billing?.asaas_subscription_id),
    canManage: role === "OWNER",
  };
}

async function loadBilling(request: Request) {
  const authenticated = await authenticateRequest(request);
  const admin = createAdminSupabase();

  if (!authenticated || !admin) {
    return null;
  }

  const [{ data: clinic }, { data: billing }] = await Promise.all([
    admin.from("clinics").select("id, name, phone, email, subscription_status, trial_ends_at, grace_period_ends_at").eq("id", authenticated.profile.clinic_id).single(),
    admin.from("clinic_billing").select("clinic_id, asaas_customer_id, asaas_subscription_id, current_invoice_url").eq("clinic_id", authenticated.profile.clinic_id).maybeSingle(),
  ]);

  if (!clinic) {
    return null;
  }

  return {
    admin,
    profile: authenticated.profile,
    clinic: clinic as ClinicRow,
    billing: billing as ClinicBillingRow | null,
  };
}

async function refreshInvoiceUrl(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  billing: ClinicBillingRow,
) {
  if (!billing.asaas_subscription_id) {
    return billing.current_invoice_url;
  }

  try {
    const result = await listAsaasSubscriptionPayments(billing.asaas_subscription_id);
    const payable = result.data
      .filter((payment) => payment.status === "PENDING" || payment.status === "OVERDUE")
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];

    if (payable?.invoiceUrl && payable.invoiceUrl !== billing.current_invoice_url) {
      await admin.from("clinic_billing").update({
        current_invoice_url: payable.invoiceUrl,
        last_payment_id: payable.id,
        last_payment_due_date: payable.dueDate,
        updated_at: new Date().toISOString(),
      }).eq("clinic_id", billing.clinic_id);
      return payable.invoiceUrl;
    }
  } catch {
    // Return the last known URL if Asaas is temporarily unavailable.
  }

  return billing.current_invoice_url;
}

export async function GET(request: Request) {
  const context = await loadBilling(request);

  if (!context) {
    return Response.json({ error: "Sessão inválida ou faturamento não configurado." }, { status: 401 });
  }

  if (context.billing?.asaas_subscription_id) {
    context.billing.current_invoice_url = await refreshInvoiceUrl(context.admin, context.billing);
  }

  return Response.json(publicStatus(context.clinic, context.billing, context.profile.role));
}

export async function POST(request: Request) {
  const context = await loadBilling(request);

  if (!context) {
    return Response.json({ error: "Sessão inválida ou faturamento não configurado." }, { status: 401 });
  }

  if (context.profile.role !== "OWNER") {
    return Response.json({ error: "Somente o proprietário pode contratar ou regularizar a assinatura." }, { status: 403 });
  }

  if (context.billing?.asaas_subscription_id) {
    context.billing.current_invoice_url = await refreshInvoiceUrl(context.admin, context.billing);
    return Response.json(publicStatus(context.clinic, context.billing, context.profile.role));
  }

  const parsed = subscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Documento inválido." }, { status: 400 });
  }

  try {
    let customerId = context.billing?.asaas_customer_id ?? null;

    if (!customerId) {
      const customer = await createAsaasCustomer({
        name: context.clinic.name,
        cpfCnpj: parsed.data.document,
        email: context.profile.email || context.clinic.email || "",
        mobilePhone: context.clinic.phone?.replace(/\D/g, "") || undefined,
        externalReference: context.clinic.id,
      });
      customerId = customer.id;
    }

    await context.admin.from("clinic_billing").upsert({
      clinic_id: context.clinic.id,
      billing_document: parsed.data.document,
      billing_email: context.profile.email || context.clinic.email,
      asaas_customer_id: customerId,
      provisioning_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const now = new Date();
    const trialEnd = context.clinic.trial_ends_at ? new Date(context.clinic.trial_ends_at) : now;
    const nextDueDate = trialEnd > now ? trialEnd : now;
    const subscription = await createAsaasSubscription({
      customer: customerId,
      nextDueDate: toAsaasDate(nextDueDate),
      externalReference: context.clinic.id,
      value: CLINIXPRO_MONTHLY_PRICE,
    });
    const payments = await listAsaasSubscriptionPayments(subscription.id);
    const firstPayment = payments.data.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

    const { data: savedBilling, error: billingError } = await context.admin
      .from("clinic_billing")
      .update({
        asaas_subscription_id: subscription.id,
        current_invoice_url: firstPayment?.invoiceUrl ?? null,
        last_payment_id: firstPayment?.id ?? null,
        last_payment_due_date: firstPayment?.dueDate ?? null,
        provisioning_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("clinic_id", context.clinic.id)
      .select("clinic_id, asaas_customer_id, asaas_subscription_id, current_invoice_url")
      .single();

    if (billingError || !savedBilling) {
      throw new Error("A assinatura foi criada no Asaas, mas não foi vinculada ao ClinixPro.");
    }

    return Response.json(publicStatus(context.clinic, savedBilling as ClinicBillingRow, context.profile.role), { status: 201 });
  } catch (error) {
    const message = error instanceof AsaasApiError
      ? error.message
      : "Não foi possível criar a assinatura no Asaas.";
    const status = error instanceof AsaasApiError ? error.status : 502;
    return Response.json({ error: message }, { status });
  }
}
