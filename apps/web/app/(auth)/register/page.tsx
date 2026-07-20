'use client'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Loader2, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const accountSchema = z.object({
  name: z.string().min(2, 'Nome muito curto'),
  cpf: z.string().refine(c => /^\d{11}$/.test(c.replace(/\D/g, '')), 'CPF inválido — digite os 11 números'),
  candidateNumber: z.string().optional(),
  email: z.string().email('Email inválido'),
  whatsapp: z.string().refine(p => /^\d{10,11}$/.test(p.replace(/\s|-/g, '')), 'Número inválido — ex: 11 99999-9999'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .refine(p => /[A-Z]/.test(p), 'Deve conter ao menos uma letra maiúscula')
    .refine(p => /[0-9]/.test(p), 'Deve conter ao menos um número'),
  confirmPassword: z.string(),
  acceptedTerms: z.boolean().refine(v => v === true, 'É necessário aceitar os Termos de Uso e a Política de Privacidade'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type AccountData = z.infer<typeof accountSchema>

function RegisterForm() {
  const { toast } = useToast()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, control, formState: { errors, isValid } } = useForm<AccountData>({
    resolver: zodResolver(accountSchema),
    mode: 'onChange',
    defaultValues: { acceptedTerms: false },
  })
  const passwordValue = watch('password', '')

  const onSubmit = async (data: AccountData) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/register', {
        name: data.name,
        cpf: data.cpf.replace(/\D/g, ''),
        candidateNumber: data.candidateNumber || undefined,
        email: data.email,
        whatsapp: '+55' + data.whatsapp.replace(/\s|-/g, ''),
        password: data.password,
        acceptedTerms: true,
      })
      const { user, candidate, role, accessToken, refreshToken } = res.data
      setAuth(user, candidate ?? null, accessToken, refreshToken, role)
      window.location.href = '/dashboard'
    } catch (err: any) {
      toast({ title: 'Erro ao registrar', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cadastre sua campanha</h1>
        <p className="text-gray-400 mt-1 text-sm">Comece a usar o sistema imediatamente. A ativação do plano é feita depois, em Configurações → Financeiro.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
            <div>
              <Label htmlFor="name">Nome completo *</Label>
              <Input id="name" placeholder="Seu nome completo" className="mt-1" {...register('name')} />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="cpf">CPF *</Label>
              <Input id="cpf" placeholder="000.000.000-00" className="mt-1" {...register('cpf')} />
              {errors.cpf && <p className="text-red-500 text-xs mt-1">{errors.cpf.message}</p>}
            </div>
            <div>
              <Label htmlFor="candidateNumber">Número do candidato (opcional)</Label>
              <Input id="candidateNumber" placeholder="Ex: 12345" className="mt-1" {...register('candidateNumber')} />
            </div>
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" placeholder="voce@email.com" className="mt-1" {...register('email')} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <div className="flex mt-1">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground select-none shrink-0">
                  +55
                </span>
                <Input id="whatsapp" type="tel" placeholder="11 99999-9999" className="rounded-l-none" {...register('whatsapp')} />
              </div>
              {errors.whatsapp && <p className="text-red-500 text-xs mt-1">{errors.whatsapp.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Senha *</Label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" className="mt-1" {...register('password')} />
              {passwordValue && (
                <div className="mt-2 space-y-1">
                  <div className={cn('flex items-center gap-1.5 text-xs', passwordValue.length >= 8 ? 'text-[#009C3B]' : 'text-gray-400')}>
                    <div className={cn('w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0', passwordValue.length >= 8 ? 'bg-[#009C3B]' : 'bg-gray-200')}>
                      {passwordValue.length >= 8 && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    Mínimo 8 caracteres
                  </div>
                  <div className={cn('flex items-center gap-1.5 text-xs', /[A-Z]/.test(passwordValue) ? 'text-[#009C3B]' : 'text-gray-400')}>
                    <div className={cn('w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0', /[A-Z]/.test(passwordValue) ? 'bg-[#009C3B]' : 'bg-gray-200')}>
                      {/[A-Z]/.test(passwordValue) && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    Ao menos uma letra maiúscula
                  </div>
                  <div className={cn('flex items-center gap-1.5 text-xs', /[0-9]/.test(passwordValue) ? 'text-[#009C3B]' : 'text-gray-400')}>
                    <div className={cn('w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0', /[0-9]/.test(passwordValue) ? 'bg-[#009C3B]' : 'bg-gray-200')}>
                      {/[0-9]/.test(passwordValue) && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    Ao menos um número
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar senha *</Label>
              <Input id="confirmPassword" type="password" placeholder="Repita a senha" className="mt-1" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <div className="flex items-start gap-2 pt-2">
              <Controller
                name="acceptedTerms"
                control={control}
                render={({ field }) => (
                  <Checkbox id="acceptedTerms" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="acceptedTerms" className="text-sm font-normal leading-snug text-gray-600">
                Li e aceito os <Link href="/termos" target="_blank" className="text-[#002776] underline">Termos de Uso</Link> e a{' '}
                <Link href="/privacidade" target="_blank" className="text-[#002776] underline">Política de Privacidade</Link>
              </Label>
            </div>
            {errors.acceptedTerms && <p className="text-red-500 text-xs">{errors.acceptedTerms.message}</p>}

            <Button
              type="submit"
              className="w-full text-white mt-2"
              style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
              disabled={!isValid || loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar minha conta <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
      </form>

      <p className="text-center text-sm text-gray-400 mt-5">
        Já tem conta?{' '}
        <Link href="/login" className="text-[#002776] hover:underline font-medium">Entrar</Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return <RegisterForm />
}
