'use client'
import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import {
  Loader2, CheckCircle2, AlertCircle, Users, MapPin,
  Phone, Mail, MessageSquare, ChevronDown, Star, Heart, X
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'

const cadastroSchema = z.object({
  nome: z.string().min(2, 'Informe seu nome completo'),
  telefone: z.string().min(8, 'Informe um telefone válido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cep: z.string().optional(),
  cidade: z.string().optional(),
  bairro: z.string().optional(),
  assunto: z.string().optional(),
  mensagem: z.string().optional(),
})
type CadastroForm = z.infer<typeof cadastroSchema>

interface Proposta { topicKey: string; topicName: string; content?: string | null }

interface Portal {
  slug: string; titulo: string; subtitulo?: string; descricao?: string
  fotoUrl?: string; corPrimaria: string; totalCadastros: number
  candidate: {
    name: string; position?: string; party?: string; state?: string; city?: string
    story?: string | null
    propostas: Proposta[]
  }
}

// Ícones por tema de proposta
const TOPIC_ICONS: Record<string, string> = {
  saude: '🏥', educacao: '📚', seguranca: '🛡️', economia: '💼',
  infraestrutura: '🏗️', meio_ambiente: '🌿', cultura: '🎭',
  assistencia_social: '🤝', transporte: '🚌', habitacao: '🏠',
  emprego: '💼', agricultura: '🌾', tecnologia: '💻', esporte: '⚽',
  mulher: '♀️', juventude: '🌟', idosos: '❤️', deficiencia: '♿',
}

function getIcon(topicKey: string) {
  return TOPIC_ICONS[topicKey] ?? '✅'
}

// Gera uma cor levemente mais escura para gradiente
function darken(hex: string, amount = 30): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default function PortalPublicoPage() {
  const { slug } = useParams() as { slug: string }
  const [submitted, setSubmitted] = useState(false)
  const [propostaAberta, setPropostaAberta] = useState<Proposta | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const { data: portal, isLoading, error } = useQuery<Portal>({
    queryKey: ['portal-pub', slug],
    queryFn: () => axios.get(`${API_URL}/portal/p/${slug}`).then(r => r.data),
    retry: false,
  })

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroSchema),
  })

  const buscarCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await axios.get(`https://viacep.com.br/ws/${digits}/json/`)
      if (!res.data.erro) {
        setValue('cidade', res.data.localidade ?? '')
        setValue('bairro', res.data.bairro ?? '')
      }
    } catch { /* silencia erro de rede */ } finally {
      setBuscandoCep(false)
    }
  }

  const mutation = useMutation({
    mutationFn: (data: CadastroForm) =>
      axios.post(`${API_URL}/portal/p/${slug}/cadastro`, { ...data, email: data.email || undefined }),
    onSuccess: () => setSubmitted(true),
  })

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

  const cor = portal.corPrimaria
  const corEscura = darken(cor, 40)
  const primeiroNome = portal.candidate.name.split(' ')[0]

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${corEscura} 100%)` }}
      >
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
        <div className="text-white">
          <h2 className="text-3xl font-bold">Obrigado pelo apoio!</h2>
          <p className="mt-2 text-white/80 text-base">Sua participação faz toda a diferença nessa campanha.</p>
          <p className="mt-1 text-white/70 text-sm">Entraremos em contato em breve.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80 bg-white/15 rounded-full px-5 py-2 backdrop-blur-sm">
          <Heart className="w-4 h-4 text-red-300" />
          <span>{portal.totalCadastros + 1} pessoas já apoiam {primeiroNome}</span>
        </div>
      </div>
    )
  }

  const temHistoria = !!portal.candidate.story?.trim()
  const temPropostas = portal.candidate.propostas.length > 0

  return (
    <>
    {/* Modal de proposta */}
    {propostaAberta && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setPropostaAberta(null)}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header do modal */}
          <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: `${cor}30` }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{getIcon(propostaAberta.topicKey)}</span>
              <h3 className="font-bold text-gray-900 text-base">{propostaAberta.topicName}</h3>
            </div>
            <button
              onClick={() => setPropostaAberta(null)}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Faixa de cor */}
          <div className="h-1 shrink-0" style={{ background: `linear-gradient(90deg, ${cor}, ${corEscura})` }} />
          {/* Conteúdo */}
          <div className="p-5 overflow-y-auto">
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
              {propostaAberta.content ?? 'Sem detalhes disponíveis.'}
            </p>
          </div>
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={() => setPropostaAberta(null)}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
              style={{ background: cor }}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${corEscura} 100%)` }}
      >
        {/* Padrão decorativo de fundo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white -translate-x-1/3 translate-y-1/3" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 py-16 text-center">
          {/* Foto do candidato */}
          {portal.fotoUrl ? (
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-white/40 shadow-2xl overflow-hidden">
                  <img
                    src={portal.fotoUrl}
                    alt={portal.candidate.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Badge de partido */}
                {portal.candidate.party && (
                  <div
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap"
                    style={{ background: corEscura }}
                  >
                    {portal.candidate.party}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Avatar com inicial quando não há foto
            <div className="mb-6 flex justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-white/40 shadow-2xl bg-white/20 flex items-center justify-center text-white text-5xl font-bold">
                {portal.candidate.name[0]}
              </div>
            </div>
          )}

          {/* Nome e cargo */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mt-6">
            {portal.titulo}
          </h1>
          {portal.subtitulo && (
            <p className="mt-3 text-lg text-white/85">{portal.subtitulo}</p>
          )}

          {/* Candidatura */}
          <div className="mt-4 flex items-center justify-center flex-wrap gap-2 text-white/75 text-sm">
            {portal.candidate.position && (
              <span className="bg-white/15 rounded-full px-3 py-1">{portal.candidate.position}</span>
            )}
            {portal.candidate.city && (
              <span className="bg-white/15 rounded-full px-3 py-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{portal.candidate.city}
                {portal.candidate.state && ` · ${portal.candidate.state}`}
              </span>
            )}
          </div>

          {/* Contador de apoiadores */}
          {portal.totalCadastros > 0 && (
            <div className="mt-6 inline-flex items-center gap-2 bg-white/20 rounded-full px-5 py-2 text-sm font-medium text-white backdrop-blur-sm">
              <Users className="w-4 h-4" />
              {portal.totalCadastros.toLocaleString('pt-BR')} apoiadores cadastrados
            </div>
          )}

          {/* CTA scroll */}
          <a href="#apoiar" className="mt-8 inline-flex flex-col items-center gap-1 text-white/60 text-xs animate-bounce">
            <span>Quero apoiar</span>
            <ChevronDown className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── DESCRIÇÃO ─────────────────────────────────────────────────────── */}
      {portal.descricao && (
        <section className="bg-white border-b">
          <div className="max-w-3xl mx-auto px-6 py-10 text-center">
            <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">{portal.descricao}</p>
          </div>
        </section>
      )}

      {/* ── HISTÓRIA ──────────────────────────────────────────────────────── */}
      {temHistoria && (
        <section className="bg-gray-50 border-b">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="text-center mb-8">
              <span className="text-2xl">📖</span>
              <h2 className="text-2xl font-bold text-gray-900 mt-2">Quem é {primeiroNome}?</h2>
              <div className="w-12 h-1 rounded-full mx-auto mt-3" style={{ background: cor }} />
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm sm:text-base">
                {portal.candidate.story}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── PROPOSTAS ─────────────────────────────────────────────────────── */}
      {temPropostas && (
        <section className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="text-center mb-8">
              <span className="text-2xl">🗳️</span>
              <h2 className="text-2xl font-bold text-gray-900 mt-2">Nossas Propostas</h2>
              <div className="w-12 h-1 rounded-full mx-auto mt-3" style={{ background: cor }} />
              <p className="text-gray-500 text-sm mt-2">O que {primeiroNome} vai fazer por você</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {portal.candidate.propostas.map(p => (
                <button
                  key={p.topicKey}
                  onClick={() => setPropostaAberta(p)}
                  className="text-left bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:shadow-md hover:border-gray-300 active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="text-3xl mb-3">{getIcon(p.topicKey)}</div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">{p.topicName}</h3>
                  {p.content && (
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-3">{p.content}</p>
                  )}
                  <p className="text-xs font-medium mt-3 group-hover:underline" style={{ color: cor }}>
                    Ver mais →
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FORMULÁRIO ────────────────────────────────────────────────────── */}
      <section id="apoiar" className="bg-gray-50 py-14">
        <div className="max-w-lg mx-auto px-4">

          {/* Chamada */}
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg"
              style={{ background: cor }}
            >
              <Heart className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Faça parte dessa mudança!</h2>
            <p className="text-gray-500 text-sm mt-2">
              Cadastre-se e receba novidades da campanha de {primeiroNome}
            </p>
          </div>

          {/* Card do formulário */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Faixa de cor no topo */}
            <div className="h-2" style={{ background: `linear-gradient(90deg, ${cor}, ${corEscura})` }} />

            <div className="p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Star className="w-5 h-5" style={{ color: cor }} />
                Quero apoiar!
              </h3>

              <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Nome completo *</label>
                  <input
                    {...register('nome')}
                    placeholder="Seu nome"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-shadow"
                    style={{ '--tw-ring-color': cor } as React.CSSProperties}
                  />
                  {errors.nome && <p className="text-xs text-red-500">{errors.nome.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />WhatsApp / Telefone *
                  </label>
                  <input
                    {...register('telefone')}
                    placeholder="(00) 00000-0000"
                    type="tel"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-shadow"
                  />
                  {errors.telefone && <p className="text-xs text-red-500">{errors.telefone.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />Email
                    <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    {...register('email')}
                    placeholder="seu@email.com"
                    type="email"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 transition-shadow"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />CEP
                    <span className="text-gray-400 font-normal">(opcional — preenche cidade e bairro)</span>
                  </label>
                  <div className="relative">
                    <input
                      {...register('cep')}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 pr-10"
                      onChange={e => {
                        // Máscara CEP
                        const v = e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2')
                        e.target.value = v
                        register('cep').onChange(e)
                        buscarCep(v)
                      }}
                    />
                    {buscandoCep && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Cidade</label>
                    <input
                      {...register('cidade')}
                      placeholder="Sua cidade"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Bairro</label>
                    <input
                      {...register('bairro')}
                      placeholder="Seu bairro"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Como posso ajudar?</label>
                  <input
                    {...register('assunto')}
                    placeholder="ex: Voluntário, Doação, Divulgar nas redes..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" />Mensagem
                    <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    {...register('mensagem')}
                    rows={3}
                    placeholder="Deixe uma mensagem de apoio..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 resize-none"
                  />
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
                  className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: `linear-gradient(135deg, ${cor}, ${corEscura})` }}
                >
                  {mutation.isPending
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                    : <><Heart className="w-5 h-5" /> Quero apoiar {primeiroNome}!</>
                  }
                </button>
              </form>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Powered by <span className="font-semibold">SyncroFlow</span>Eleições
          </p>
        </div>
      </section>
    </div>
    </>
  )
}
