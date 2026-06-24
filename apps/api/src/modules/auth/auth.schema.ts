import { z } from 'zod'

const strongPassword = z.string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128)
  .refine(p => /[A-Z]/.test(p), 'Deve conter ao menos uma letra maiúscula')
  .refine(p => /[0-9]/.test(p), 'Deve conter ao menos um número')

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
  candidateNumber: z.string().max(20).optional(),
  email: z.string().email(),
  whatsapp: z.string().min(10).max(20),
  password: strongPassword,
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso e a Política de Privacidade' }) }),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().optional(),
})

export const refreshSchema = z.object({
  refreshToken: z.string(),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: strongPassword,
})

export const verify2FASchema = z.object({
  totpCode: z.string().length(6),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
