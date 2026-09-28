import type { Expense, Payment } from "@/types";

export type PaymentRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string | null;
  amount: number | string;
  discount: number | string;
  final_amount: number | string;
  payment_method: Payment["paymentMethod"];
  status: Payment["status"];
  due_date: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseRow = {
  id: string;
  clinic_id: string;
  description: string;
  category: string;
  amount: number | string;
  due_date: string;
  paid_at: string | null;
  status: Expense["status"];
  created_at: string;
  updated_at: string;
};

export function mapPaymentRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id ?? undefined,
    amount: Number(row.amount),
    discount: Number(row.discount),
    finalAmount: Number(row.final_amount),
    paymentMethod: row.payment_method,
    status: row.status,
    dueDate: row.due_date,
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapExpenseRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    dueDate: row.due_date,
    paidAt: row.paid_at ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function calculatePaymentFinalAmount(amount: number, discount: number) {
  return Math.max(0, amount - discount);
}

export function calculateFinanceTotals(
  payments: readonly Payment[],
  expenses: readonly Expense[],
) {
  const paid = payments
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + payment.finalAmount, 0);
  const pending = payments
    .filter((payment) => payment.status === "PENDING")
    .reduce((sum, payment) => sum + payment.finalAmount, 0);
  const overdue = payments
    .filter((payment) => payment.status === "OVERDUE")
    .reduce((sum, payment) => sum + payment.finalAmount, 0);
  const expensesTotal = expenses
    .filter((expense) => expense.status !== "CANCELLED")
    .reduce((sum, expense) => sum + expense.amount, 0);

  return {
    paid,
    pending,
    overdue,
    expensesTotal,
    netRevenue: paid - expensesTotal,
  };
}
