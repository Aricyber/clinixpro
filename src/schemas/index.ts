import { z } from "zod";

export const patientSchema = z.object({
  fullName: z.string().min(2, "Nome completo é obrigatório."),
  birthDate: z.string().min(1, "Data de nascimento é obrigatória."),
  cpf: z.string().optional().or(z.literal("")),
  phone: z.string().min(8, "Telefone inválido."),
  whatsapp: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  address: z.string().min(5, "Endereço é obrigatório."),
  emergencyContact: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Paciente é obrigatório."),
  professionalId: z.string().min(1, "Profissional é obrigatório."),
  serviceId: z.string().min(1, "Serviço é obrigatório."),
  startAt: z.string().min(1, "Data e horário são obrigatórios."),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(2, "Nome do serviço é obrigatório."),
  description: z.string().min(3, "Descrição é obrigatória."),
  durationMinutes: z.coerce.number().min(15, "Duração mínima de 15 minutos."),
  price: z.coerce.number().min(0, "Preço deve ser maior ou igual a zero."),
  category: z.string().min(2, "Categoria é obrigatória."),
});

export const clinicSettingsSchema = z.object({
  name: z.string().min(2, "Nome da clínica é obrigatório."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().min(8, "Telefone inválido."),
  clinicType: z.enum(["odontology", "physiotherapy"]),
});
