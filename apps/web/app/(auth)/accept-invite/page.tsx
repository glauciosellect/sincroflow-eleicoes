'use client'
import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import Link from 'next/link'

const schema = z.object({
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .refine(p => /[A-Z]/.test(p), 'Deve conter ao menos uma letra maiúscula')
    .refine(p => /[0-9]/.test(p), 'Deve conter ao menos um número'),
})

type FormData = z.infer<typeof schema>

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const token = searchParams.get('token')
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <XCircle className="w-14 h-14 text-red-500" />
        <h2 className="text-xl font-bold text-gray-900">Convite inválido</h2>
        <p className="text-gray-500 text-sm max-w-xs">O link do convite está incompleto ou expirou.</p>
        <Link href="/login"><Button variant="outline">Ir para o login</Button></Link>
      </div>
    )
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/invite/accept', { token, password: data.password })
      const { user, candidate, role, accessToken, refreshToken } = res.data
      setAuth(user, candidate ?? null, accessToken, refreshToken, role)
      toast({ title: 'Convite aceito!', description: 'Bem-vindo à equipe da campanha.' })
      // Agente de Campo vai direto para o painel de desempenho
      router.push(role === 'AGENTE_CAMPO' ? '/meu-desempenho' : '/dashboard')
    } catch (err: any) {
      toast({ title: 'Erro ao aceitar convite', description: err.response?.data?.error || 'Convite inválido ou já utilizado', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-gray-900">Você foi convidado!</h2>
        <p className="text-gray-500 text-sm mt-1">Defina sua senha para acessar a campanha.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="password">Crie sua senha</Label>
          <Input id="password" type="password" placeholder="Mínimo 8 caracteres" className="mt-1" {...register('password')} />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full text-white" style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Aceitar convite e entrar
        </Button>
      </form>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl border border-gray-200 p-10 w-full max-w-sm shadow-sm">
        <div className="flex justify-center mb-6">
          <span className="text-2xl font-bold text-[#002776]">SyncroFlowEleições</span>
        </div>
        <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-[#002776] mx-auto" />}>
          <AcceptInviteContent />
        </Suspense>
      </div>
    </div>
  )
}
