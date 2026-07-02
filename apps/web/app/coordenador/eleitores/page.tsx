'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { Search, Plus, X, Phone, MapPin, Loader2, ChevronLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'
const STORAGE_KEY = 'coord_token'
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null }

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  telefone: z.string().min(8, 'Telefone obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cidade: z.string().optional(),
  bairro: z.string().optional(),
  assunto: z.string().optional(),
  mensagem: z.string().optional(),
})
type Form = z.infer<typeof schema>

const ASSUNTOS = ['Saúde', 'Educação', 'Segurança', 'Infraestrutura', 'Emprego', 'Outro']

export default function CoordenadorEleitoresPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [eleitores, setEleitores] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(searchParams.get('novo') === '1')
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  const fetchEleitores = async (p = 1, s = '') => {
    const token = getToken()
    if (!token) { router.push('/coordenador/login'); return }
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/coordenador/eleitores`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: p, search: s || undefined },
      })
      setEleitores(res.data.items)
      setTotal(res.data.total)
      setPages(res.data.pages)
    } catch {
      router.push('/coordenador/login')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEleitores(page, search) }, [page])

  const handleSearch = (v: string) => { setSearch(v); setPage(1); fetchEleitores(1, v) }

  const onSubmit = async (data: Form) => {
    setFormError('')
    const token = getToken()
    try {
      await axios.post(`${API_URL}/coordenador/eleitores`, { ...data, email: data.email || undefined }, { headers: { Authorization: `Bearer ${token}` } })
      setSuccess(true)
      reset()
      setTimeout(() => { setSuccess(false); setShowForm(false); fetchEleitores(1, search) }, 2000)
    } catch (e: any) {
      setFormError(e.response?.data?.error ?? 'Erro ao cadastrar')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#002776] text-white px-4 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <a href="/coordenador" className="p-1.5 rounded-lg bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="font-bold text-lg">Eleitores</h1>
            <p className="text-xs opacity-70">{total} cadastros</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full bg-white border rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#002776]"
          />
        </div>

        {/* Form de cadastro */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Novo eleitor</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <p className="font-medium text-gray-800">Cadastrado com sucesso!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <input {...register('nome')} placeholder="Nome completo *" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                {errors.nome && <p className="text-xs text-red-500">{errors.nome.message}</p>}

                <input {...register('telefone')} type="tel" placeholder="WhatsApp / Telefone *" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                {errors.telefone && <p className="text-xs text-red-500">{errors.telefone.message}</p>}

                <input {...register('email')} type="email" placeholder="Email (opcional)" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />

                <div className="grid grid-cols-2 gap-2">
                  <input {...register('cidade')} placeholder="Cidade" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  <input {...register('bairro')} placeholder="Bairro" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>

                <select {...register('assunto')} className="w-full border rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                  <option value="">Assunto (opcional)</option>
                  {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <textarea {...register('mensagem')} rows={2} placeholder="Mensagem (opcional)" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none" />

                {formError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />{formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl text-white font-semibold bg-[#002776] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Salvando...' : 'Cadastrar eleitor'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : eleitores.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">Nenhum eleitor encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {eleitores.map(e => (
              <div key={e.id} className="bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="font-bold text-gray-600">{e.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{e.nome}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{e.telefone}</span>
                    {(e.cidade || e.bairro) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[e.bairro, e.cidade].filter(Boolean).join(', ')}</span>}
                  </div>
                  {e.assunto && <span className="text-xs text-blue-600 font-medium">{e.assunto}</span>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(e.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex justify-center gap-3 pt-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">Anterior</button>
            <span className="px-4 py-2 text-sm text-gray-600">{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">Próximo</button>
          </div>
        )}
      </div>

      {/* FAB */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#002776] text-white shadow-lg flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
