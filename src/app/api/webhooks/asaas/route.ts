import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { addDaysToDate, CLINIXPRO_GRACE_DAYS, subscriptionStatusFromAsaasEvent } from "@/lib/billing";
import { createAdminSupabase } from "@/lib/server-auth";

export const runtime = "nodejs";

const webhookSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  dateCreated: z.string().optional(),
  payment: z.object({
    id: z.string().min(1),
    subscription: z.string().nullish(),
    status: z.string().optional(),
    dueDate: z.string().nullish(),
    invoiceUrl: z.string().nullish(),
  }).passthrough().nullish(),
  subscription: z.object({
    id: z.string().min(1),
    status: z.string().optional(),
  }).passthrough().nullish(),
}).passthrough();

function tokensMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? "";
  const receivedToken = request.headers.get("asaas-access-token") ?? "";

  if (!expectedToken || !receivedToken || !tokensMatch(receivedToken, expectedToken)) {
    return Response.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const parsed = webhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Evento inválido." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return Response.json({ error: "Supabase administrativo não configurado." }, { status: 503 });
  }

  const webhook = parsed.data;
  const subscriptionId = webhook.payment?.subscription ?? webhook.subscription?.id ?? null;
  const resourceId = webhook.payment?.id ?? webhook.subscription?.id ?? null;
  const { error: insertError } = await admin.from("asaas_webhook_events").insert({
    event_id: webhook.id,
    event_type: webhook.event,
    resource_id: resourceId,
    payload: webhook,
    status: "PENDING",
  });

  if (insertError?.code === "23505") {
    const { data: existing } = await admin
      .from("asaas_webhook_events")
      .select("status")
      .eq("event_id", webhook.id)
      .maybeSingle();

    if (existing?.status === "PROCESSED" || existing?.status === "IGNORED") {
      return Response.json({ received: true });
    }
  } else if (insertError) {
    return Response.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  }

  if (!subscriptionId) {
    await admin.from("asaas_webhook_events").update({
      status: "IGNORED",
      processed_at: new Date().toISOString(),
    }).eq("event_id", webhook.id);
    return Response.json({ received: true });
  }

  const { data: billing, error: billingLookupError } = await admin
    .from("clinic_billing")
    .select("clinic_id")
    .eq("asaas_subscription_id", subscriptionId)
    .maybeSingle();

  if (billingLookupError) {
    return Response.json({ error: "Falha ao localizar a assinatura." }, { status: 500 });
  }

  if (!billing) {
    await admin.from("asaas_webhook_events").update({
      status: "IGNORED",
      processed_at: new Date().toISOString(),
    }).eq("event_id", webhook.id);
    return Response.json({ received: true });
  }

  const now = new Date().toISOString();
  const billingUpdate: Record<string, string | null> = { updated_at: now };

  if (webhook.payment) {
    billingUpdate.last_payment_id = webhook.payment.id;
    billingUpdate.last_payment_due_date = webhook.payment.dueDate ?? null;
    if (webhook.payment.invoiceUrl) {
      billingUpdate.current_invoice_url = webhook.payment.invoiceUrl;
    }
  }

  const { error: billingUpdateError } = await admin
    .from("clinic_billing")
    .update(billingUpdate)
    .eq("clinic_id", billing.clinic_id);

  if (billingUpdateError) {
    return Response.json({ error: "Falha ao atualizar o faturamento." }, { status: 500 });
  }

  const nextStatus = subscriptionStatusFromAsaasEvent(webhook.event);
  if (nextStatus) {
    const clinicUpdate: Record<string, string | null> = {
      subscription_status: nextStatus,
      subscription_updated_at: now,
      grace_period_ends_at: null,
    };

    if (nextStatus === "PAST_DUE") {
      const dueDate = webhook.payment?.dueDate
        ? new Date(`${webhook.payment.dueDate}T23:59:59.999Z`)
        : new Date();
      clinicUpdate.grace_period_ends_at = addDaysToDate(dueDate, CLINIXPRO_GRACE_DAYS).toISOString();
    }

    const { error: clinicUpdateError } = await admin
      .from("clinics")
      .update(clinicUpdate)
      .eq("id", billing.clinic_id);

    if (clinicUpdateError) {
      return Response.json({ error: "Falha ao atualizar o acesso da clínica." }, { status: 500 });
    }
  }

  const { error: eventUpdateError } = await admin.from("asaas_webhook_events").update({
    status: "PROCESSED",
    processed_at: now,
  }).eq("event_id", webhook.id);

  if (eventUpdateError) {
    return Response.json({ error: "Falha ao concluir o evento." }, { status: 500 });
  }

  return Response.json({ received: true });
}
