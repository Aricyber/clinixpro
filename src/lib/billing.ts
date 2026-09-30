import type { SessionUser, SubscriptionStatus } from "@/types";

export const CLINIXPRO_MONTHLY_PRICE = 99.9;
export const CLINIXPRO_TRIAL_DAYS = 14;
export const CLINIXPRO_GRACE_DAYS = 10;

export function hasSubscriptionAccess(
  subscription: Pick<SessionUser, "subscriptionStatus" | "trialEndsAt" | "gracePeriodEndsAt">,
  referenceDate = new Date(),
) {
  if (subscription.subscriptionStatus === "ACTIVE") {
    return true;
  }

  if (subscription.subscriptionStatus === "TRIALING") {
    return Boolean(subscription.trialEndsAt && new Date(subscription.trialEndsAt) >= referenceDate);
  }

  if (subscription.subscriptionStatus === "PAST_DUE") {
    return Boolean(subscription.gracePeriodEndsAt && new Date(subscription.gracePeriodEndsAt) >= referenceDate);
  }

  return false;
}

export function effectiveSubscriptionStatus(
  subscription: Pick<SessionUser, "subscriptionStatus" | "trialEndsAt" | "gracePeriodEndsAt">,
  referenceDate = new Date(),
): SubscriptionStatus {
  if (subscription.subscriptionStatus === "TRIALING" && !hasSubscriptionAccess(subscription, referenceDate)) {
    return "SUSPENDED";
  }

  if (subscription.subscriptionStatus === "PAST_DUE" && !hasSubscriptionAccess(subscription, referenceDate)) {
    return "SUSPENDED";
  }

  return subscription.subscriptionStatus;
}

export function addDaysToDate(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function toAsaasDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function subscriptionStatusFromAsaasEvent(event: string): SubscriptionStatus | null {
  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    return "ACTIVE";
  }

  if (event === "PAYMENT_OVERDUE") {
    return "PAST_DUE";
  }

  if (
    event === "PAYMENT_REFUNDED"
    || event === "PAYMENT_DELETED"
    || event === "PAYMENT_CHARGEBACK_REQUESTED"
    || event === "SUBSCRIPTION_INACTIVATED"
    || event === "SUBSCRIPTION_DELETED"
  ) {
    return "CANCELLED";
  }

  return null;
}
