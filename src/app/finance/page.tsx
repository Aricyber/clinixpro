"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { appointments, patients, services } from "@/lib/mock-data";
import { getCurrentSessionUser } from "@/lib/auth";
import { calculateFinanceTotals, calculatePaymentFinalAmount, mapExpenseRow, mapPaymentRow, type ExpenseRow, type PaymentRow } from "@/lib/finance";
import { canManageExpenses } from "@/lib/permissions";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Expense, Payment } from "@/types";

type PaymentFormState = {
  patientId: string;
  amount: number;
  discount: number;
  paymentMethod: Payment["paymentMethod"];
  dueDate: string;
};

type PaymentPatientOption = { id: string; fullName: string };

type ExpenseFormState = {
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: Expense["status"];
};

const emptyPaymentForm = (): PaymentFormState => ({
  patientId: patients[0]?.id ?? "",
  amount: 0,
  discount: 0,
  paymentMethod: "PIX",
  dueDate: new Date().toISOString().slice(0, 10),
});

const emptyExpenseForm = (): ExpenseFormState => ({
  description: "",
  category: "",
  amount: 0,
  dueDate: new Date().toISOString().slice(0, 10),
  status: "PENDING",
});

const initialPayments: Payment[] = [
  {
    id: "pay_1",
    clinicId: "clinic_001",
    patientId: "patient_1",
    appointmentId: "appointment_1",
    amount: 180,
    discount: 0,
    finalAmount: 180,
    paymentMethod: "PIX",
    status: "PENDING",
    dueDate: "2026-09-28T00:00:00.000Z",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  },
  {
    id: "pay_2",
    clinicId: "clinic_001",
    patientId: "patient_2",
    appointmentId: "appointment_2",
    amount: 260,
    discount: 20,
    finalAmount: 240,
    paymentMethod: "CREDIT_CARD",
    status: "PAID",
    dueDate: "2026-09-27T00:00:00.000Z",
    paidAt: "2026-09-26T08:00:00.000Z",
    createdAt: "2026-09-26T08:00:00.000Z",
    updatedAt: "2026-09-26T08:00:00.000Z",
  },
  {
    id: "pay_3",
    clinicId: "clinic_001",
    patientId: "patient_3",
    appointmentId: undefined,
    amount: 350,
    discount: 0,
    finalAmount: 350,
    paymentMethod: "CASH",
    status: "OVERDUE",
    dueDate: "2026-09-20T00:00:00.000Z",
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
  },
];

export default function FinancePage() {
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [patientOptions, setPatientOptions] = useState<PaymentPatientOption[]>(patients.map((patient) => ({ id: patient.id, fullName: patient.fullName })));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormState>(emptyPaymentForm());
  const [expenseAccess, setExpenseAccess] = useState(false);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(emptyExpenseForm());

  useEffect(() => {
    let isMounted = true;

    async function loadPayments() {
      if (!isSupabaseConfigured() || !supabase) {
        setExpenseAccess(true);
        setIsLoading(false);
        return;
      }

      try {
        const session = await getCurrentSessionUser();

        if (!session) {
          if (isMounted) {
            setError("Sua sessão expirou. Entre novamente para carregar o financeiro.");
            setIsLoading(false);
          }
          return;
        }

        const [paymentsResult, patientsResult] = await Promise.all([
          supabase.from("payments").select("*").eq("clinic_id", session.clinicId).order("due_date", { ascending: true }),
          supabase.from("patients").select("id, full_name").eq("clinic_id", session.clinicId).order("full_name"),
        ]);

        if (paymentsResult.error || patientsResult.error) {
          throw paymentsResult.error ?? patientsResult.error;
        }

        const hasExpenseAccess = canManageExpenses(session.role);
        const expensesResult = hasExpenseAccess
          ? await supabase.from("expenses").select("*").eq("clinic_id", session.clinicId).order("due_date", { ascending: true })
          : { data: [], error: null };

        if (expensesResult.error) {
          throw expensesResult.error;
        }

        if (isMounted) {
          setClinicId(session.clinicId);
          setPayments((paymentsResult.data ?? []).map((row) => mapPaymentRow(row as PaymentRow)));
          setPatientOptions((patientsResult.data ?? []).map((row) => ({ id: row.id, fullName: row.full_name })));
          setExpenses((expensesResult.data ?? []).map((row) => mapExpenseRow(row as ExpenseRow)));
          setExpenseAccess(hasExpenseAccess);
          setError("");
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar os pagamentos. Verifique sua conexão e tente novamente.");
          setIsLoading(false);
        }
      }
    }

    loadPayments();

    return () => {
      isMounted = false;
    };
  }, []);

  const totals = useMemo(() => calculateFinanceTotals(payments, expenses), [payments, expenses]);

  const handleMarkPaid = async (paymentId: string) => {
    const now = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { data, error: updateError } = await supabase
        .from("payments")
        .update({ status: "PAID", paid_at: now, updated_at: now })
        .eq("id", paymentId)
        .eq("clinic_id", clinicId)
        .select("*")
        .single();

      if (updateError || !data) {
        setError("Não foi possível atualizar o pagamento.");
        return;
      }

      setPayments((current) => current.map((payment) => payment.id === paymentId ? mapPaymentRow(data as PaymentRow) : payment));
      setError("");
      return;
    }

    setPayments((current) =>
      current.map((payment) => {
        if (payment.id !== paymentId) {
          return payment;
        }

        return {
          ...payment,
          status: "PAID",
          paidAt: now,
          updatedAt: now,
        };
      }),
    );
  };

  const handleOpenNew = () => {
    setForm({ ...emptyPaymentForm(), patientId: patientOptions[0]?.id ?? "" });
    setIsFormOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.patientId || form.amount <= 0 || form.discount < 0 || form.discount > form.amount || !form.dueDate) {
      setError("Informe paciente, valor, desconto válido e vencimento.");
      return;
    }

    const now = new Date().toISOString();
    const paymentData = {
      clinic_id: clinicId ?? "clinic_001",
      patient_id: form.patientId,
      appointment_id: null,
      amount: form.amount,
      discount: form.discount,
      final_amount: calculatePaymentFinalAmount(form.amount, form.discount),
      payment_method: form.paymentMethod,
      status: "PENDING" as const,
      due_date: new Date(`${form.dueDate}T00:00:00`).toISOString(),
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { data, error: insertError } = await supabase
        .from("payments")
        .insert(paymentData)
        .select("*")
        .single();

      if (insertError || !data) {
        setError("Não foi possível criar o pagamento. Verifique os dados e suas permissões.");
        return;
      }

      setPayments((current) => [mapPaymentRow(data as PaymentRow), ...current]);
    } else {
      setPayments((current) => [{
        id: `payment_${Date.now()}`,
        clinicId: "clinic_001",
        patientId: form.patientId,
        amount: form.amount,
        discount: form.discount,
        finalAmount: calculatePaymentFinalAmount(form.amount, form.discount),
        paymentMethod: form.paymentMethod,
        status: "PENDING",
        dueDate: paymentData.due_date,
        createdAt: now,
        updatedAt: now,
      }, ...current]);
    }

    setForm(emptyPaymentForm());
    setIsFormOpen(false);
    setError("");
  };

  const closeExpenseForm = () => {
    setExpenseForm(emptyExpenseForm());
    setEditingExpenseId(null);
    setIsExpenseFormOpen(false);
  };

  const handleOpenExpense = (expense?: Expense) => {
    if (!expenseAccess) {
      setError("Apenas proprietários e administradores podem gerenciar despesas.");
      return;
    }

    setEditingExpenseId(expense?.id ?? null);
    setExpenseForm(expense ? {
      description: expense.description,
      category: expense.category,
      amount: expense.amount,
      dueDate: expense.dueDate.slice(0, 10),
      status: expense.status,
    } : emptyExpenseForm());
    setIsExpenseFormOpen(true);
  };

  const handleExpenseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!expenseAccess || !expenseForm.description.trim() || !expenseForm.category.trim() || expenseForm.amount <= 0 || !expenseForm.dueDate) {
      setError("Informe descrição, categoria, valor e vencimento válidos para a despesa.");
      return;
    }

    const now = new Date().toISOString();
    const expenseData = {
      description: expenseForm.description.trim(),
      category: expenseForm.category.trim(),
      amount: expenseForm.amount,
      due_date: new Date(`${expenseForm.dueDate}T00:00:00`).toISOString(),
      status: expenseForm.status,
      paid_at: expenseForm.status === "PAID" ? now : null,
      updated_at: now,
    };

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const result = editingExpenseId
        ? await supabase.from("expenses").update(expenseData).eq("id", editingExpenseId).eq("clinic_id", clinicId).select("*").single()
        : await supabase.from("expenses").insert({ ...expenseData, clinic_id: clinicId }).select("*").single();

      if (result.error || !result.data) {
        setError("Não foi possível salvar a despesa. Verifique os dados e suas permissões.");
        return;
      }

      const savedExpense = mapExpenseRow(result.data as ExpenseRow);
      setExpenses((current) => editingExpenseId
        ? current.map((expense) => expense.id === editingExpenseId ? savedExpense : expense)
        : [savedExpense, ...current]);
    } else if (editingExpenseId) {
      setExpenses((current) => current.map((expense) => expense.id === editingExpenseId ? {
        ...expense,
        description: expenseData.description,
        category: expenseData.category,
        amount: expenseData.amount,
        dueDate: expenseData.due_date,
        status: expenseData.status,
        paidAt: expenseData.paid_at ?? undefined,
        updatedAt: now,
      } : expense));
    } else {
      setExpenses((current) => [{
        id: `expense_${Date.now()}`,
        clinicId: "clinic_001",
        description: expenseData.description,
        category: expenseData.category,
        amount: expenseData.amount,
        dueDate: expenseData.due_date,
        status: expenseData.status,
        paidAt: expenseData.paid_at ?? undefined,
        createdAt: now,
        updatedAt: now,
      }, ...current]);
    }

    setError("");
    closeExpenseForm();
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!expenseAccess || !window.confirm("Excluir esta despesa? Esta ação não pode ser desfeita.")) {
      return;
    }

    if (isSupabaseConfigured() && supabase) {
      if (!clinicId) {
        setError("Não foi possível identificar a clínica atual.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId)
        .eq("clinic_id", clinicId);

      if (deleteError) {
        setError("Não foi possível excluir a despesa. Verifique suas permissões.");
        return;
      }
    }

    setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    if (editingExpenseId === expenseId) {
      closeExpenseForm();
    }
    setError("");
  };

  const financeCards = [
    { id: "f1", label: "Receitas", value: `R$ ${totals.paid.toFixed(2).replace(".", ",")}`, status: "positive" },
    { id: "f2", label: "Pendentes", value: `R$ ${totals.pending.toFixed(2).replace(".", ",")}`, status: "negative" },
    { id: "f3", label: "Despesas", value: `R$ ${totals.expensesTotal.toFixed(2).replace(".", ",")}`, status: "negative" },
    { id: "f4", label: "Receita líquida", value: `R$ ${totals.netRevenue.toFixed(2).replace(".", ",")}`, status: totals.netRevenue >= 0 ? "positive" : "negative" },
  ];

  return (
    <PermissionGate permission="manageFinance">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-700">Financeiro</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Receitas, despesas e pagamentos</h1>
        </div>

        {error ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {financeCards.map((item) => (
            <div key={item.id} className="card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{item.label}</p>
                <CreditCard className="text-teal-700" size={18} />
              </div>
              <p className="mt-5 text-3xl font-bold text-slate-900">{item.value}</p>
              <p className={item.status === "positive" ? "mt-2 text-sm text-emerald-600" : "mt-2 text-sm text-rose-600"}>
                {item.status === "positive" ? "Positivo" : "Focos de atenção"}
              </p>
            </div>
          ))}
        </div>

        {isFormOpen ? (
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Novo pagamento</h2>
              <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar formulário">
                <X size={18} />
              </button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <label className="text-sm font-medium text-slate-700">
                Paciente
                <select value={form.patientId} onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white">
                  {patientOptions.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Forma de pagamento
                <select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value as Payment["paymentMethod"] }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white">
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="DEBIT_CARD">Cartão de débito</option>
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                  <option value="TRANSFER">Transferência</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Valor
                <input type="number" min={0.01} step={0.01} value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Desconto
                <input type="number" min={0} step={0.01} value={form.discount} onChange={(event) => setForm((current) => ({ ...current, discount: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Vencimento
                <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white" />
              </label>
              <div className="flex items-end justify-end">
                <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"><Save size={16} />Salvar pagamento</button>
              </div>
            </form>
          </div>
        ) : null}

        {isExpenseFormOpen ? (
          <div className="card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">{editingExpenseId ? "Editar despesa" : "Nova despesa"}</h2>
              <button type="button" onClick={closeExpenseForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar formulário de despesa">
                <X size={18} />
              </button>
            </div>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleExpenseSubmit}>
              <label className="text-sm font-medium text-slate-700">
                Descrição
                <input required value={expenseForm.description} onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Categoria
                <input required value={expenseForm.category} onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Valor
                <input required type="number" min={0.01} step={0.01} value={expenseForm.amount} onChange={(event) => setExpenseForm((current) => ({ ...current, amount: Number(event.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Vencimento
                <input required type="date" value={expenseForm.dueDate} onChange={(event) => setExpenseForm((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white" />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Status
                <select value={expenseForm.status} onChange={(event) => setExpenseForm((current) => ({ ...current, status: event.target.value as Expense["status"] }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-normal outline-none focus:border-teal-500 focus:bg-white">
                  <option value="PENDING">Pendente</option>
                  <option value="PAID">Paga</option>
                  <option value="OVERDUE">Vencida</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </label>
              <div className="flex items-end justify-end gap-2">
                <button type="button" onClick={closeExpenseForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"><Save size={16} />Salvar despesa</button>
              </div>
            </form>
          </div>
        ) : null}

        {isLoading ? <div className="card p-5 text-sm text-slate-500">Carregando pagamentos...</div> : null}

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Pagamentos pendentes</h2>
            <button
              type="button"
              onClick={handleOpenNew}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus size={16} />
              Novo pagamento
            </button>
          </div>
          <div className="divide-y divide-slate-200">
            {!isLoading && payments.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-500">Nenhum pagamento cadastrado.</p>
            ) : null}
            {!isLoading && payments.map((entry) => {
              const patient = patientOptions.find((item) => item.id === entry.patientId) ?? patients.find((item) => item.id === entry.patientId);
              const appointment = appointments.find((item) => item.id === entry.appointmentId);
              const service = services.find((item) => item.id === appointment?.serviceId);

              return (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-slate-600">
                  <div>
                    <p className="font-medium text-slate-900">{patient?.fullName ?? "Paciente"}</p>
                    <p>
                      {service?.name ?? "Serviço geral"} · R$ {entry.finalAmount.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={
                      entry.status === "PAID"
                        ? "badge bg-emerald-100 text-emerald-700"
                        : entry.status === "OVERDUE"
                          ? "badge bg-rose-100 text-rose-700"
                          : "badge bg-amber-100 text-amber-700"
                    }>
                      {entry.status}
                    </span>
                    {entry.status !== "PAID" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(entry.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <Check size={12} />
                        Pago
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Despesas da clínica</h2>
            {expenseAccess ? (
              <button type="button" onClick={() => handleOpenExpense()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                <Plus size={16} />
                Nova despesa
              </button>
            ) : null}
          </div>
          <div className="divide-y divide-slate-200">
            {!isLoading && !expenseAccess ? (
              <p className="px-5 py-5 text-sm text-slate-500">Despesas são visíveis apenas para proprietários e administradores.</p>
            ) : null}
            {!isLoading && expenseAccess && expenses.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-500">Nenhuma despesa cadastrada.</p>
            ) : null}
            {!isLoading && expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{expense.description}</p>
                  <p className="text-slate-500">{expense.category} · Vencimento {new Date(expense.dueDate).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                  <p className="font-semibold text-slate-900">R$ {expense.amount.toFixed(2).replace(".", ",")}</p>
                  <span className={expense.status === "PAID" ? "badge bg-emerald-100 text-emerald-700" : "badge bg-amber-100 text-amber-700"}>{expense.status}</span>
                  </div>
                  {expenseAccess ? (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleOpenExpense(expense)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={`Editar ${expense.description}`}><Pencil size={16} /></button>
                      <button type="button" onClick={() => handleDeleteExpense(expense.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700" aria-label={`Excluir ${expense.description}`}><Trash2 size={16} /></button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
