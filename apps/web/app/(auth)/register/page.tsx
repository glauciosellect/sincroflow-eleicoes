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

const PLANS = [
  { value: 'CAMPAIGN' as const, label: 'Plano Campanha', desc: 'Para o período eleitoral' },
  { value: 'MANDATE' as const, label: 'Plano Mandato', desc: 'Para após a eleição (ouvidoria)' },
]

// Pix/boleto: pagamento único mensal manual, só disponível no Plano Campanha — o
// Mandato exige cartão (assinatura recorrente automática).
const PAYMENT_METHODS = [
  { value: 'card' as const, label: 'Cartão de crédito', desc: 'Cobrança automática mensal' },
  { value: 'pix' as const, label: 'Pix', desc: 'Pagamento manual, válido por 30 dias' },
  { value: 'boleto' as const, label: 'Boleto', desc: 'Pagamento manual, válido por 30 dias' },
]

export default function RegisterPage() {
  const { toast } = useToast()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<'CAMPAIGN' | 'MANDATE'>('CAMPAIGN')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix' | 'boleto'>('card')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const { register, handleSubmit, watch, control, formState: { errors, isValid } } = useForm<AccountData>({
    resolver: zodResolver(accountSchema),
    mode: 'onChange',
    defaultValues: { acceptedTerms: false },
  })
  const passwordValue = watch('password', '')

  const onSubmitStep1 = async (data: AccountData) => {
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
      setPendingId(res.data.pendingId)
      setStep(2)
    } catch (err: any) {
      toast({ title: 'Erro ao registrar', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleCheckout = async () => {
    if (!pendingId) {
      toast({ title: 'Sessão de cadastro expirada', description: 'Volte ao passo 1 e tente novamente', variant: 'destructive' })
      setStep(1)
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/register/checkout', { pendingId, plan, paymentMethod })
      window.location.href = res.data.url
    } catch (err: any) {
      toast({ title: 'Erro ao iniciar pagamento', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' })
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all',
                s < step ? 'bg-[#009C3B] text-white' :
                s === step ? 'bg-[#002776] text-white' :
                'bg-gray-100 text-gray-400'
              )}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 2 && <div className={cn('flex-1 h-0.5 transition-all', s < step ? 'bg-[#009C3B]' : 'bg-gray-100')} />}
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-400 text-right">
          {step === 1 ? 'Dados do candidato' : 'Pagamento'}
        </div>
      </div>

      {step === 1 && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Cadastre sua campanha</h1>
            <p className="text-gray-400 mt-1 text-sm">Sua conta é criada após a confirmação do pagamento.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmitStep1)} className="space-y-4">
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
              Avançar para pagamento <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-5">
            Já tem conta?{' '}
            <Link href="/login" className="text-[#002776] hover:underline font-medium">Entrar</Link>
          </p>
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Escolha seu plano</h1>
            <p className="text-gray-400 mt-1 text-sm">O pagamento confirma seu cadastro. Sua conta é criada automaticamente após a aprovação.</p>
          </div>

          <div className="space-y-2 mb-6">
            {PLANS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPlan(p.value); if (p.value === 'MANDATE') setPaymentMethod('card') }}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                  plan === p.value ? 'border-[#002776] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className={cn('text-sm font-semibold', plan === p.value ? 'text-[#002776]' : 'text-gray-800')}>{p.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          <Label className="text-sm font-medium text-gray-700">Forma de pagamento</Label>
          <div className="space-y-2 mt-2 mb-6">
            {PAYMENT_METHODS.filter((m) => plan === 'CAMPAIGN' || m.value === 'card').map((m) => (
              <button
                key={m.value}
                onClick={() => setPaymentMethod(m.value)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                  paymentMethod === m.value ? 'border-[#009C3B] bg-green-50' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className={cn('text-sm font-semibold', paymentMethod === m.value ? 'text-[#009C3B]' : 'text-gray-800')}>{m.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
              </button>
            ))}
            {plan === 'MANDATE' && (
              <p className="text-xs text-gray-400 mt-1">O Plano Mandato exige cartão de crédito (cobrança recorrente automática).</p>
            )}
          </div>

          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full text-white"
            style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Ir para pagamento
          </Button>
        </div>
      )}
    </div>
  )
}
