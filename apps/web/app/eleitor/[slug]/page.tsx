'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import axios from 'axios'
import {
  Loader2, CheckCircle2, AlertCircle, Users, MapPin,
  Phone, Mail, MessageSquare, Heart, X, ExternalLink
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
interface TrajetoriaItem { ano: string; descricao: string }
interface DepoimentoItem { texto: string; autor: string }

interface Portal {
  slug: string; titulo: string; subtitulo?: string; descricao?: string
  fotoUrl?: string; fotoSobre?: string; fotoFundo?: string
  corPrimaria: string; corDestaque: string; corTexto?: string; totalCadastros: number
  numero?: string; instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string
  trajetoria: TrajetoriaItem[]; depoimentos: DepoimentoItem[]
  candidate: {
    name: string; position?: string; party?: string; state?: string; city?: string
    story?: string | null
    propostas: Proposta[]
  }
}

const TOPIC_ICONS: Record<string, string> = {
  saude: '🏥', educacao: '📚', seguranca: '🛡️', economia: '💼',
  infraestrutura: '🏗️', meio_ambiente: '🌿', cultura: '🎭',
  assistencia_social: '🤝', transporte: '🚌', habitacao: '🏠',
  emprego: '💼', agricultura: '🌾', tecnologia: '💻', esporte: '⚽',
  mulher: '♀️', juventude: '🌟', idosos: '❤️', deficiencia: '♿',
}
function getIcon(k: string) { return TOPIC_ICONS[k] ?? '✅' }

function darken(hex: string, amount = 30): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0xff) - amount)
  const b = Math.max(0, (num & 0xff) - amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function withAlpha(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 0xff
  const g = (num >> 8) & 0xff
  const b = num & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}

export default function PortalPublicoPage() {
  const { slug } = useParams() as { slug: string }
  const [submitted, setSubmitted] = useState(false)
  const [propostaAberta, setPropostaAberta] = useState<Proposta | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
    } catch { } finally { setBuscandoCep(false) }
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
  const dest = portal.corDestaque
  const destEscuro = darken(dest, 30)
  const corTexto = portal.corTexto || '#FFFFFF'
  // Overlay escurecido sobre a foto de fundo (quando houver) para manter o texto legível
  // independente da cor de texto escolhida — sem isso, fotos claras deixariam o texto ilegível.
  const heroBackground = portal.fotoFundo
    ? `linear-gradient(135deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.35) 100%), url(${portal.fotoFundo})`
    : `linear-gradient(135deg, ${cor} 0%, ${corEscura} 100%)`
  const primeiroNome = portal.candidate.name.split(' ')[0]
  const temHistoria = !!portal.candidate.story?.trim()
  const temPropostas = portal.candidate.propostas.length > 0
  const temTrajetoria = portal.trajetoria?.length > 0
  const temDepoimentos = portal.depoimentos?.length > 0

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

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#1A1A1A', background: '#F7F8FA' }}>

      {/* ─── Modal de proposta ─── */}
      {propostaAberta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPropostaAberta(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getIcon(propostaAberta.topicKey)}</span>
                <h3 className="font-bold text-gray-900 text-base">{propostaAberta.topicName}</h3>
              </div>
              <button onClick={() => setPropostaAberta(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-1 shrink-0" style={{ background: `linear-gradient(90deg, ${dest}, ${destEscuro})` }} />
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{propostaAberta.content ?? 'Sem detalhes disponíveis.'}</p>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button onClick={() => setPropostaAberta(null)} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: dest }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 18, color: cor }}>
            {portal.numero && (
              <span style={{ background: cor, color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 14 }}>{portal.numero}</span>
            )}
            {primeiroNome}
          </div>
          <nav style={{ display: 'flex', gap: 24 }} className="hidden-mobile">
            {temHistoria && <a href="#sobre" style={{ color: '#475569', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Sobre</a>}
            {temPropostas && <a href="#propostas" style={{ color: '#475569', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Propostas</a>}
            {temTrajetoria && <a href="#trajetoria" style={{ color: '#475569', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Trajetória</a>}
            <a href="#apoiar" style={{ color: '#475569', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>Contato</a>
          </nav>
          <a
            href="#apoiar"
            style={{ background: dest, color: '#fff', padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            Quero apoiar
          </a>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section style={{ background: heroBackground, backgroundSize: 'cover', backgroundPosition: 'center', color: corTexto, padding: '90px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Círculos decorativos */}
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1140, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 48, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: withAlpha(corTexto, .15), border: `1px solid ${withAlpha(corTexto, .25)}`, borderRadius: 50, padding: '6px 16px', fontSize: 12, fontWeight: 700, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {portal.candidate.position && <span>{portal.candidate.position}</span>}
              {portal.candidate.party && <><span style={{ opacity: .5 }}>·</span><span>{portal.candidate.party}</span></>}
              {portal.candidate.city && <><span style={{ opacity: .5 }}>·</span><span>{portal.candidate.city}{portal.candidate.state ? `/${portal.candidate.state}` : ''}</span></>}
            </div>
            <h1 style={{ fontSize: 'clamp(32px,4vw,52px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 18 }}>{portal.titulo}</h1>
            {portal.subtitulo && (
              <p style={{ fontSize: 18, color: withAlpha(corTexto, .85), lineHeight: 1.65, marginBottom: 28, maxWidth: 500 }}>{portal.subtitulo}</p>
            )}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
              <a href="#apoiar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: dest, color: '#fff', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 50, textDecoration: 'none', boxShadow: `0 6px 20px ${dest}66` }}>
                Quero ser voluntário
              </a>
              {temPropostas && (
                <a href="#propostas" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: withAlpha(corTexto, .12), color: corTexto, fontWeight: 600, fontSize: 16, padding: '14px 28px', borderRadius: 50, border: `1.5px solid ${withAlpha(corTexto, .3)}`, textDecoration: 'none' }}>
                  Ver propostas
                </a>
              )}
            </div>
            {portal.totalCadastros > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: withAlpha(corTexto, .1), borderRadius: 50, padding: '8px 18px', fontSize: 13, fontWeight: 500 }}>
                <Users size={14} />
                {portal.totalCadastros.toLocaleString('pt-BR')} apoiadores cadastrados
              </div>
            )}
          </div>

          {/* Foto */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 380, aspectRatio: '4/5', borderRadius: 16, overflow: 'hidden', border: `6px solid ${withAlpha(corTexto, .15)}`, background: withAlpha(corTexto, .1) }}>
              {portal.fotoUrl ? (
                <img src={portal.fotoUrl} alt={portal.candidate.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, fontWeight: 900, color: withAlpha(corTexto, .6) }}>
                  {portal.candidate.name[0]}
                </div>
              )}
            </div>
            {/* Número circular */}
            {portal.numero && (
              <div style={{ position: 'absolute', bottom: -18, right: 10, width: 100, height: 100, borderRadius: '50%', background: dest, border: '4px solid #fff', boxShadow: '0 10px 28px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{portal.numero}</span>
                <span style={{ fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>VOTE</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── DESCRIÇÃO ─── */}
      {portal.descricao && (
        <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{portal.descricao}</p>
          </div>
        </section>
      )}

      {/* ─── SOBRE (história) ─── */}
      {temHistoria && (
        <section id="sobre" style={{ background: '#F7F8FA', borderBottom: '1px solid #e2e8f0', padding: '80px 24px' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto', display: 'grid', gridTemplateColumns: '.8fr 1.2fr', gap: 48, alignItems: 'start' }}>
            {/* Foto lateral — usa fotoSobre se disponível, senão fotoUrl */}
            <div style={{ borderRadius: 14, overflow: 'hidden', background: '#e2e8f0', aspectRatio: '1/1' }}>
              {(portal.fotoSobre || portal.fotoUrl)
                ? <img src={portal.fotoSobre ?? portal.fotoUrl} alt={portal.candidate.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, color: '#9aa0aa' }}>{portal.candidate.name[0]}</div>
              }
            </div>
            <div>
              <span style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: 12, fontWeight: 700, color: dest }}>Quem é</span>
              <h2 style={{ fontSize: 32, fontWeight: 900, margin: '8px 0 18px', color: darken(cor, 20) }}>{portal.candidate.name}</h2>
              {(portal.candidate.story ?? '').split('\n\n').filter(Boolean).map((p, i) => (
                <p key={i} style={{ color: '#475569', marginBottom: 14, fontSize: 16, lineHeight: 1.75 }}>{p}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── PROPOSTAS ─── */}
      {temPropostas && (
        <section id="propostas" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '80px 24px' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: 12, fontWeight: 700, color: dest }}>Plataforma</span>
              <h2 style={{ fontSize: 32, fontWeight: 900, margin: '8px 0 8px', color: darken(cor, 20) }}>Propostas para uma cidade mais justa</h2>
              <p style={{ color: '#5B6472', fontSize: 16 }}>O que {primeiroNome} vai fazer por você</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 }}>
              {portal.candidate.propostas.map(p => (
                <button
                  key={p.topicKey}
                  onClick={() => setPropostaAberta(p)}
                  style={{ textAlign: 'left', background: '#F7F8FA', borderRadius: 14, padding: 28, borderTop: `4px solid ${dest}`, border: `1px solid #e2e8f0`, borderTopColor: dest, cursor: 'pointer', transition: 'transform .2s, box-shadow .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
                >
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{getIcon(p.topicKey)}</div>
                  <h3 style={{ fontSize: 19, marginBottom: 8, color: darken(cor, 20), fontWeight: 800 }}>{p.topicName}</h3>
                  {p.content && <p style={{ color: '#5B6472', fontSize: 14, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.content}</p>}
                  <p style={{ fontSize: 12, fontWeight: 700, marginTop: 12, color: dest }}>Ver mais →</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── TRAJETÓRIA ─── */}
      {temTrajetoria && (
        <section id="trajetoria" style={{ background: '#F7F8FA', borderBottom: '1px solid #e2e8f0', padding: '80px 24px' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: 12, fontWeight: 700, color: dest }}>Trajetória</span>
              <h2 style={{ fontSize: 32, fontWeight: 900, margin: '8px 0', color: darken(cor, 20) }}>Uma história de compromisso</h2>
            </div>
            <div style={{ maxWidth: 760, margin: '0 auto', borderLeft: `3px solid ${dest}`, paddingLeft: 28 }}>
              {portal.trajetoria.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 32, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -35, top: 4, width: 14, height: 14, borderRadius: '50%', background: dest }} />
                  <div style={{ fontWeight: 800, color: cor, fontSize: 18 }}>{item.ano}</div>
                  <p style={{ color: '#5B6472', marginTop: 4, fontSize: 15, lineHeight: 1.6 }}>{item.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── DEPOIMENTOS ─── */}
      {temDepoimentos && (
        <section style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '80px 24px' }}>
          <div style={{ maxWidth: 1140, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: 12, fontWeight: 700, color: dest }}>Apoio</span>
              <h2 style={{ fontSize: 32, fontWeight: 900, margin: '8px 0', color: darken(cor, 20) }}>Quem confia em {primeiroNome}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
              {portal.depoimentos.map((dep, idx) => (
                <div key={idx} style={{ background: '#F7F8FA', borderRadius: 14, padding: 28, border: '1px solid #e2e8f0' }}>
                  <p style={{ fontStyle: 'italic', color: '#1A1A1A', marginBottom: 14, lineHeight: 1.65 }}>"{dep.texto}"</p>
                  <p style={{ fontWeight: 700, color: darken(cor, 20), fontSize: 14 }}>{dep.autor}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── FORMULÁRIO DE APOIO ─── */}
      <section id="apoiar" style={{ background: '#F7F8FA', padding: '80px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', marginBottom: 36 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: 12, fontWeight: 700, color: dest }}>Participe</span>
          <h2 style={{ fontSize: 32, fontWeight: 900, margin: '8px 0 8px', color: darken(cor, 20) }}>Toda ajuda faz a diferença</h2>
          <p style={{ color: '#5B6472', fontSize: 16 }}>Leva menos de 1 minuto: conte como você quer ajudar essa campanha a vencer.</p>
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 20, boxShadow: '0 10px 34px rgba(0,0,0,.09)', overflow: 'hidden' }}>
          {/* Barra de cor */}
          <div style={{ height: 6, background: `linear-gradient(90deg, ${cor}, ${dest})` }} />

          <div style={{ padding: '32px' }}>
            <form onSubmit={handleSubmit(d => mutation.mutate(d))} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Nome completo *</label>
                <input {...register('nome')} placeholder="Seu nome" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                {errors.nome && <p style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{errors.nome.message}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>WhatsApp / Telefone *</label>
                <input {...register('telefone')} placeholder="(00) 00000-0000" type="tel" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                {errors.telefone && <p style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{errors.telefone.message}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional)</span></label>
                <input {...register('email')} placeholder="seu@email.com" type="email" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>CEP <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(preenche cidade e bairro)</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register('cep')}
                    placeholder="00000-000"
                    maxLength={9}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', paddingRight: buscandoCep ? 40 : 14, boxSizing: 'border-box' }}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2')
                      e.target.value = v
                      register('cep').onChange(e)
                      buscarCep(v)
                    }}
                  />
                  {buscandoCep && <Loader2 style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Cidade</label>
                  <input {...register('cidade')} placeholder="Sua cidade" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Bairro</label>
                  <input {...register('bairro')} placeholder="Seu bairro" style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Como posso ajudar?</label>
                <input {...register('assunto')} placeholder="ex: Voluntário, Doação, Divulgar nas redes..." style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Mensagem <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional)</span></label>
                <textarea {...register('mensagem')} rows={3} placeholder="Deixe uma mensagem de apoio..." style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              </div>

              {mutation.isError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px' }}>
                  <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                  Ocorreu um erro. Tente novamente.
                </div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', color: '#fff', fontWeight: 700, fontSize: 16, cursor: mutation.isPending ? 'not-allowed' : 'pointer', background: `linear-gradient(135deg, ${cor}, ${dest})`, opacity: mutation.isPending ? .7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 6px 20px ${cor}55` }}
              >
                {mutation.isPending
                  ? <><Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} /> Enviando...</>
                  : <><Heart style={{ width: 20, height: 20 }} /> Quero apoiar {primeiroNome}!</>
                }
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section style={{ background: darken(cor, 40), color: '#fff', textAlign: 'center', padding: '80px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 14 }}>Faça parte dessa campanha</h2>
          <p style={{ color: 'rgba(255,255,255,.85)', marginBottom: 32, fontSize: 17, lineHeight: 1.65 }}>
            Junte-se a {portal.candidate.name} e ajude a fazer a diferença nas eleições de 2026.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#apoiar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: dest, color: '#fff', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 50, textDecoration: 'none', boxShadow: `0 6px 20px ${dest}66` }}>
              <Heart size={18} />Quero apoiar
            </a>
            {portal.whatsapp && (
              <a
                href={`https://wa.me/${portal.whatsapp.replace(/\D/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)', color: '#fff', fontWeight: 600, fontSize: 16, padding: '14px 28px', borderRadius: 50, border: '1.5px solid rgba(255,255,255,.3)', textDecoration: 'none' }}
              >
                💬 Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: '#0e0e0f', color: '#c9ccd1', padding: '48px 24px 24px', fontSize: 14 }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 32, marginBottom: 32 }}>
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
                {portal.candidate.name}{portal.numero ? ` — ${portal.numero}` : ''}
              </p>
              {portal.subtitulo && <p style={{ color: '#a7abb3', maxWidth: 340, fontSize: 13, lineHeight: 1.6 }}>{portal.subtitulo}</p>}
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Redes</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {portal.instagram && <a href={portal.instagram.startsWith('http') ? portal.instagram : `https://instagram.com/${portal.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#c9ccd1', textDecoration: 'none', fontSize: 13 }}>Instagram</a>}
                {portal.facebook && <a href={portal.facebook.startsWith('http') ? portal.facebook : `https://${portal.facebook}`} target="_blank" rel="noopener noreferrer" style={{ color: '#c9ccd1', textDecoration: 'none', fontSize: 13 }}>Facebook</a>}
                {portal.tiktok && <a href={portal.tiktok.startsWith('http') ? portal.tiktok : `https://tiktok.com/${portal.tiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#c9ccd1', textDecoration: 'none', fontSize: 13 }}>TikTok</a>}
              </div>
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Contato</p>
              {portal.whatsapp && (
                <a href={`https://wa.me/${portal.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#c9ccd1', textDecoration: 'none', fontSize: 13, display: 'block', marginBottom: 8 }}>
                  💬 WhatsApp
                </a>
              )}
              {portal.candidate.city && (
                <p style={{ color: '#a7abb3', fontSize: 13 }}>
                  {portal.candidate.city}{portal.candidate.state ? `, ${portal.candidate.state}` : ''}
                </p>
              )}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 20, fontSize: 12, color: '#8b909a', lineHeight: 1.7 }}>
            Conteúdo de propaganda eleitoral. Candidato(a) {portal.candidate.name}{portal.numero ? `, número ${portal.numero}` : ''}{portal.candidate.party ? `, ${portal.candidate.party}` : ''}.
            Este material segue as normas do TSE para propaganda eleitoral na internet (Lei 9.504/97 e resoluções vigentes).
            <br />
            <span style={{ opacity: .6 }}>Powered by <strong style={{ color: '#fff' }}>SyncroFlow</strong>Eleições</span>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 860px) {
          .hidden-mobile { display: none !important; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
