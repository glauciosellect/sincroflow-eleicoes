'use client'
import { useState, useEffect, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/store/auth.store'
import api from '@/lib/api'
import { Loader2, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
  totpCode: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [needs2FA, setNeeds2FA] = useState(false)

  const paymentStatus = searchParams.get('payment')

  useEffect(() => {
    if (paymentStatus === 'cancelled') {
      toast({ title: 'Pagamento cancelado', description: 'Você pode tentar novamente quando quiser.', variant: 'destructive' })
    }
  }, [paymentStatus, toast])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', data)
      const { user, candidate, role, accessToken, refreshToken } = res.data
      setAuth(user, candidate, accessToken, refreshToken, role)
      router.push('/dashboard')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Erro ao fazer login'
      if (msg.includes('2FA') || msg.includes('obrigatório')) setNeeds2FA(true)
      toast({ title: 'Erro', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Entrar na sua conta</h1>
        <p className="text-gray-500 mt-2">Bem-vindo de volta ao SyncroFlowEleições</p>
      </div>

      {paymentStatus === 'success' && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Pagamento confirmado! Sua conta já está ativa — entre com o e-mail e senha que você cadastrou.</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="seu@email.com" className="mt-1" {...register('email')} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/forgot-password" className="text-xs text-[#002776] hover:underline">Esqueci minha senha</Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" className="mt-1" {...register('password')} />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        {needs2FA && (
          <div>
            <Label htmlFor="totpCode">Código de autenticação (2FA)</Label>
            <Input id="totpCode" placeholder="000000" maxLength={6} className="mt-1" {...register('totpCode')} />
          </div>
        )}
        <Button type="submit" className="w-full text-white hover:opacity-90" style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Entrar
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        Não tem conta?{' '}
        <Link href="/register" className="text-[#002776] hover:underline font-medium">Cadastre-se</Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
