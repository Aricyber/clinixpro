import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const {
  addDaysToDate,
  effectiveSubscriptionStatus,
  hasSubscriptionAccess,
  subscriptionStatusFromAsaasEvent,
} = await import("./billing.ts");

test("trial access ends after the trial deadline", () => {
  const subscription = {
    subscriptionStatus: "TRIALING" as const,
    trialEndsAt: "2026-10-13T23:59:59.000Z",
  };

  assert.equal(hasSubscriptionAccess(subscription, new Date("2026-10-13T12:00:00.000Z")), true);
  assert.equal(hasSubscriptionAccess(subscription, new Date("2026-10-14T00:00:00.000Z")), false);
  assert.equal(effectiveSubscriptionStatus(subscription, new Date("2026-10-14T00:00:00.000Z")), "SUSPENDED");
});

test("overdue access remains available for exactly the configured grace deadline", () => {
  const subscription = {
    subscriptionStatus: "PAST_DUE" as const,
    gracePeriodEndsAt: "2026-10-20T23:59:59.999Z",
  };

  assert.equal(hasSubscriptionAccess(subscription, new Date("2026-10-20T23:59:59.999Z")), true);
  assert.equal(hasSubscriptionAccess(subscription, new Date("2026-10-21T00:00:00.000Z")), false);
});

test("Asaas payment events activate, delay or cancel access", () => {
  assert.equal(subscriptionStatusFromAsaasEvent("PAYMENT_RECEIVED"), "ACTIVE");
  assert.equal(subscriptionStatusFromAsaasEvent("PAYMENT_CONFIRMED"), "ACTIVE");
  assert.equal(subscriptionStatusFromAsaasEvent("PAYMENT_OVERDUE"), "PAST_DUE");
  assert.equal(subscriptionStatusFromAsaasEvent("PAYMENT_REFUNDED"), "CANCELLED");
  assert.equal(subscriptionStatusFromAsaasEvent("PAYMENT_CREATED"), null);
});

test("ten-day tolerance is calculated from the payment due date", () => {
  assert.equal(addDaysToDate(new Date("2026-10-10T23:59:59.999Z"), 10).toISOString(), "2026-10-20T23:59:59.999Z");
});

test("database migration enforces subscription access and protects billing state", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/202609290001_saas_subscriptions.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /create policy patients_require_subscription[\s\S]*?as restrictive/i);
  assert.match(migration, /create trigger clinics_guard_subscription_change/i);
  assert.match(migration, /auth\.jwt\(\) ->> 'role'[\s\S]*?service_role/i);
});
