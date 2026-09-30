const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_URL = "https://api.asaas.com/v3";

type AsaasErrorBody = { errors?: Array<{ description?: string }> };

export type AsaasSubscriptionPayment = {
  id: string;
  status: string;
  dueDate: string;
  invoiceUrl?: string;
  subscription?: string;
};

export class AsaasApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
  }
}

function config() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  const baseUrl = process.env.ASAAS_API_URL?.trim()
    || (process.env.ASAAS_ENVIRONMENT === "production" ? PRODUCTION_URL : SANDBOX_URL);

  if (!apiKey) {
    throw new AsaasApiError("A integração com o Asaas ainda não foi configurada.", 503);
  }

  return { apiKey, baseUrl };
}

async function requestAsaas<T>(path: string, init: RequestInit = {}) {
  const { apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "ClinixPro/1.0 (Next.js)",
      access_token: apiKey,
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    let message = "O Asaas recusou a operação.";
    try {
      const body = await response.json() as AsaasErrorBody;
      message = body.errors?.map((item) => item.description).filter(Boolean).join(" ") || message;
    } catch {
      // Preserve the safe fallback when the response is not JSON.
    }
    throw new AsaasApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export function createAsaasCustomer(input: {
  name: string;
  cpfCnpj: string;
  email: string;
  mobilePhone?: string;
  externalReference: string;
}) {
  return requestAsaas<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createAsaasSubscription(input: {
  customer: string;
  nextDueDate: string;
  externalReference: string;
  value: number;
}) {
  return requestAsaas<{ id: string; status: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      billingType: "UNDEFINED",
      cycle: "MONTHLY",
      description: "Assinatura mensal ClinixPro",
    }),
  });
}

export function listAsaasSubscriptionPayments(subscriptionId: string) {
  return requestAsaas<{ data: AsaasSubscriptionPayment[] }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
  );
}
