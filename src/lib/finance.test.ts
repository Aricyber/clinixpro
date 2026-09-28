import assert from "node:assert/strict";
import test from "node:test";
import type { Expense, Payment } from "@/types";

const {
  calculateFinanceTotals,
  calculatePaymentFinalAmount,
  mapExpenseRow,
  mapPaymentRow,
} = await import("./finance.ts");

test("maps payment and expense rows from snake_case", () => {
  const payment = mapPaymentRow({
    id: "pay-1",
    clinic_id: "clinic-1",
    patient_id: "patient-1",
    appointment_id: null,
    amount: "200.00",
    discount: "20.00",
    final_amount: "180.00",
    payment_method: "PIX",
    status: "PAID",
    due_date: "2026-09-27T00:00:00.000Z",
    paid_at: "2026-09-27T12:00:00.000Z",
    created_at: "2026-09-27T10:00:00.000Z",
    updated_at: "2026-09-27T12:00:00.000Z",
  });
  const expense = mapExpenseRow({
    id: "expense-1",
    clinic_id: "clinic-1",
    description: "Aluguel",
    category: "Estrutura",
    amount: "80.00",
    due_date: "2026-09-27T00:00:00.000Z",
    paid_at: null,
    status: "PENDING",
    created_at: "2026-09-27T10:00:00.000Z",
    updated_at: "2026-09-27T10:00:00.000Z",
  });

  assert.equal(payment.clinicId, "clinic-1");
  assert.equal(payment.finalAmount, 180);
  assert.equal(expense.clinicId, "clinic-1");
  assert.equal(expense.amount, 80);
});

test("calculates payments, expenses and net revenue", () => {
  const payments = [
    { status: "PAID", finalAmount: 300 },
    { status: "PENDING", finalAmount: 150 },
    { status: "OVERDUE", finalAmount: 50 },
    { status: "CANCELLED", finalAmount: 1000 },
  ] as unknown as Payment[];
  const expenses = [
    { status: "PAID", amount: 90 },
    { status: "PENDING", amount: 10 },
    { status: "CANCELLED", amount: 500 },
  ] as unknown as Expense[];

  assert.deepEqual(calculateFinanceTotals(payments, expenses), {
    paid: 300,
    pending: 150,
    overdue: 50,
    expensesTotal: 100,
    netRevenue: 200,
  });
  assert.equal(calculatePaymentFinalAmount(200, 20), 180);
});
