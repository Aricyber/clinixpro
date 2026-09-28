export type Role = "OWNER" | "ADMIN" | "RECEPTIONIST" | "PROFESSIONAL";
export type ClinicType = "odontology" | "physiotherapy";
export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type PaymentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
export type PaymentMethod = "PIX" | "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "TRANSFER";

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  clinicType: ClinicType;
  phone: string;
  email: string;
  document?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  clinicId: string;
  clinicName: string;
  clinicType: ClinicType;
  name: string;
  email: string;
  role: Role;
}

export interface Patient {
  id: string;
  clinicId: string;
  fullName: string;
  birthDate: string;
  cpf?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address: string;
  emergencyContact?: string;
  notes?: string;
  status: "active" | "archived";
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Professional {
  id: string;
  clinicId: string;
  fullName: string;
  specialty: string;
  professionalRegister?: string;
  registerType?: string;
  phone: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  clinicId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalRecord {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string;
  title: string;
  evolution: string;
  procedure: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  amount: number;
  discount: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  clinicId: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: string;
}
