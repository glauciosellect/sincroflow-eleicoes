'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import { Loader2, CheckCircle2, AlertCircle, Users, MapPin, Phone, Mail, MessageSquare } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'

const cadastroSchema = z.object({
  nome: z.string().min(2, 'Informe seu nome completo'),
  telefone: z.string().min(8, 'Informe um telefone válido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cidade: z.string().optional(),
  bairro: z.string().optional(),
  assunto: z.string().optional(),
  mensagem: z.string().optional(),
})
type CadastroForm = z.infer<typeof cadastroSchema>

interface Portal {
  slug: string; titulo: string; subtitulo?: string; descricao?: string
  fotoUrl?: string; corPrimaria: string; totalCadastros: number
  candidate: { name: string; position?: string; party?: string; state?: string; city?: string }
}

export default function PortalPublicoPage() {
  const { slug } = useParams() as { slug: string }
  const [submitted, setSubmitted] = useState(false)

  const { data: portal, isLoading, error } = useQuery<Portal>({
    queryKey: ['portal-pub', slug],
    queryFn: () => axios.get(`${API_URL}/portal/p/${slug}`).then(r => r.data),
    retry: false,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
  })

  const mutation = useMutation({
    mutationFn: (data: CadastroForm) =>
      axios.post(`${API_URL}/portal/p/${slug}/cadastro`, { ...data, email: data.email || undefined }),
    onSuccess: () => setSubmitted(true),
  })

  const cor = portal?.corPrimaria ?? '#002776'

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !portal) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300" />
        <h1 className="text-xl font-semibold text-gray-700">Portal não encontrado</h1>
        <p className="text-gray-500 text-sm">Este link pode ter expirado ou estar incorreto.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center" style={{ background: `linear-gradient(135deg, ${cor}15 0%, white 60%)` }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: cor }}>
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cadastro realizado!</h2>
          <p className="text-gray-500 mt-2 text-sm">Obrigado pelo seu apoio. Entraremos em contato em breve.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4" />
          <span>{portal.totalCadastros + 1} pessoas já apoiam {portal.candidate.name.split(' ')[0]}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="py-10 px-6 text-center text-white" style={{ background: `linear-gradient(135deg, ${cor} 0%, ${cor}cc 100%)` }}>
        {portal.fotoUrl && (
          <img src={portal.fotoUrl} alt={portal.candidate.name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4 border-4 border-white/30 shadow-lg" />
        )}
        <h1 className="text-2xl font-bold leading-tight">{portal.titulo}</h1>
        {portal.subtitulo && <p className="mt-2 text-base opacity-90">{portal.subtitulo}</p>}
        <div className="flex items-center justify-center gap-1.5 mt-3 text-sm opacity-80">
          {portal.candidate.position && <span>{portal.candidate.position}</span>}
          {portal.candidate.party && <><span>·</span><span>{portal.candidate.party}</span></>}
          {portal.candidate.state && <><span>·</span><span>{portal.candidate.state}</span></>}
        </div>
        {portal.totalCadastros > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <Users className="w-4 h-4" />
            {portal.totalCadastros} apoiadores cadastrados
          </div>
        )}
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto px-4 py-8">
        {portal.descricao && (
          <div className="mb-6 p-4 bg-white rounded-xl border text-sm text-gray-700 leading-relaxed shadow-sm">
            {portal.descricao}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Quero apoiar!</h2>

          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                Nome completo *
              </label>
              <input
                {...register('nome')}
                placeholder="Seu nome"
                className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-shadow"
                style={{ '--tw-ring-color': cor } as React.CSSProperties}
              />
              {errors.nome && <p className="text-xs text-red-500">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />WhatsApp / Telefone *
              </label>
              <input {...register('telefone')} placeholder="(00) 00000-0000" type="tel" className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2" />
              {errors.telefone && <p className="text-xs text-red-500">{errors.telefone.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />Email <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input {...register('email')} placeholder="seu@email.com" type="email" className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />Cidade
                </label>
                <input {...register('cidade')} placeholder="Sua cidade" className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Bairro</label>
                <input {...register('bairro')} placeholder="Seu bairro" className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Assunto / Como posso ajudar?</label>
              <input {...register('assunto')} placeholder="ex: Voluntário, Doação, Evento..." className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2" />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />Mensagem <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea {...register('mensagem')} rows={3} placeholder="Deixe sua mensagem de apoio..." className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 resize-none" />
            </div>

            {mutation.isError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Ocorreu um erro. Tente novamente.
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: cor }}
            >
              {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {mutation.isPending ? 'Enviando...' : 'Quero apoiar!'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by <span className="font-medium">SyncroFlow</span>
        </p>
      </div>
    </div>
  )
}
