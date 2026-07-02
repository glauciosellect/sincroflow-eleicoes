'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { Loader2, Lock, Mail, AlertCircle } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'
const STORAGE_KEY = 'coord_token'

const schema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
})
type Form = z.infer<typeof schema>

export default function CoordenadorLoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setError('')
    try {
      const res = await axios.post(`${API_URL}/coordenador/auth/login`, data)
      localStorage.setItem(STORAGE_KEY, res.data.token)
      localStorage.setItem('coord_info', JSON.stringify(res.data.coordenador))
      router.push('/coordenador')
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Erro ao fazer login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#002776] flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Área do Coordenador</h1>
          <p className="text-gray-500 text-sm mt-1">SyncroFlow Eleições</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />E-mail
              </label>
              <input {...register('email')} type="email" placeholder="seu@email.com" className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />Senha
              </label>
              <input {...register('senha')} type="password" placeholder="••••••" className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              {errors.senha && <p className="text-xs text-red-500">{errors.senha.message}</p>}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl text-white font-semibold bg-[#002776] hover:bg-[#001f5e] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">Powered by SyncroFlow Eleições</p>
      </div>
    </div>
  )
}
