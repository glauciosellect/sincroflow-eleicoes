'use client'
import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/store/auth.store'
import {
  Sparkles, Copy, CheckCircle2, RefreshCw, Trash2, Archive,
  Loader2, ChevronLeft, ChevronRight, Hash, Clock,
  Instagram, Facebook, MessageSquare, Twitter, Video,
  X, Wand2, Mic, FileText, Download, ChevronDown, ChevronUp
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const CreativeEditor = dynamic(() => import('@/components/editor/CreativeEditor'), { ssr: false })

// ─── Constantes ──────────────────────────────────────────────────────────────

const TEMAS = [
  { id: 'saude',           label: 'Saúde',              icon: '🏥', slogan: 'Saúde de qualidade para todos!' },
  { id: 'educacao',        label: 'Educação',            icon: '📚', slogan: 'Educação transforma vidas!' },
  { id: 'seguranca',       label: 'Segurança',           icon: '🛡️', slogan: 'Mais segurança, mais paz!' },
  { id: 'infraestrutura',  label: 'Infraestrutura',      icon: '🏗️', slogan: 'Obras que fazem a diferença!' },
  { id: 'meio_ambiente',   label: 'Meio Ambiente',       icon: '🌿', slogan: 'Pelo futuro do nosso planeta!' },
  { id: 'emprego',         label: 'Emprego',             icon: '💼', slogan: 'Mais empregos, mais dignidade!' },
  { id: 'cultura',         label: 'Cultura',             icon: '🎭', slogan: 'Cultura que une o povo!' },
  { id: 'esporte',         label: 'Esporte',             icon: '⚽', slogan: 'Esporte e saúde para todos!' },
  { id: 'transporte',      label: 'Transporte',          icon: '🚌', slogan: 'Mobilidade urbana de qualidade!' },
  { id: 'assistencia_social', label: 'Assistência Social', icon: '🤝', slogan: 'Cuidando de quem mais precisa!' },
  { id: 'tecnologia',      label: 'Tecnologia',          icon: '💡', slogan: 'Inovação a serviço do povo!' },
  { id: 'juventude',       label: 'Juventude',           icon: '🧑', slogan: 'O futuro é dos jovens!' },
  { id: 'terceira_idade',  label: 'Terceira Idade',      icon: '👴', slogan: 'Respeito e dignidade para os idosos!' },
  { id: 'mulheres',        label: 'Mulheres',            icon: '♀️', slogan: 'Força e respeito para as mulheres!' },
  { id: 'lgbtqia',         label: 'LGBTQIA+',            icon: '🏳️‍🌈', slogan: 'Igualdade e respeito para todos!' },
  { id: 'personalizado',   label: 'Personalizado',       icon: '✏️', slogan: 'Sua voz, nossa força!' },
]

const PLATAFORMAS = [
  { id: 'instagram',  label: 'Instagram',  icon: Instagram,    color: 'text-pink-500',    limite: 2200,  desc: '2.200 chars' },
  { id: 'facebook',   label: 'Facebook',   icon: Facebook,     color: 'text-blue-600',    limite: 63206, desc: '63.206 chars' },
  { id: 'tiktok',     label: 'TikTok',     icon: Video,        color: 'text-gray-900',    limite: 2200,  desc: '2.200 chars' },
  { id: 'telegram',   label: 'Telegram',   icon: MessageSquare,color: 'text-sky-500',     limite: 4096,  desc: '4.096 chars' },
  { id: 'x',          label: 'X (Twitter)',icon: Twitter,      color: 'text-gray-800',    limite: 280,   desc: '280 chars' },
  { id: 'discurso',   label: 'Discurso',   icon: Mic,          color: 'text-amber-600',   limite: 99999, desc: 'Palanque · PDF' },
]

const TONS = [
  { id: 'proximo',  label: 'Próximo',  desc: 'Acessível, coloquial, humanizado' },
  { id: 'formal',   label: 'Formal',   desc: 'Institucional, respeitoso, técnico' },
  { id: 'emotivo',  label: 'Emotivo',  desc: 'Inspirador, tocante, apelo à emoção' },
]

const DURACOES = [
  { id: '10', label: '10 min',  desc: '~1.300 palavras' },
  { id: '15', label: '15 min',  desc: '~2.000 palavras' },
  { id: '20', label: '20 min',  desc: '~2.600 palavras' },
  { id: '30', label: '30 min',  desc: '~3.900 palavras' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho:  { label: 'Rascunho',  color: 'bg-gray-100 text-gray-700' },
  agendado:  { label: 'Agendado',  color: 'bg-amber-100 text-amber-700' },
  enviado:   { label: 'Enviado',   color: 'bg-green-100 text-green-700' },
  arquivado: { label: 'Arquivado', color: 'bg-slate-100 text-slate-600' },
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Secao { nome: string; texto: string; dica: string }
interface Discurso {
  id: string; titulo: string; duracao_estimada: string
  secoes: Secao[]; resumo_executivo: string; textoCompleto: string
}

// ─── Exportação PDF do discurso ───────────────────────────────────────────────

function exportDiscursoPDF(discurso: Discurso, candidateName: string) {
  const style = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.7; padding: 0 24px; }
    h1 { font-size: 24px; color: #002776; border-bottom: 3px solid #FFDF00; padding-bottom: 12px; margin-bottom: 8px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
    .resumo { background: #f0f4ff; border-left: 4px solid #002776; padding: 16px 20px; margin: 24px 0; border-radius: 4px; font-style: italic; }
    .secao { margin: 28px 0; page-break-inside: avoid; }
    .secao-titulo { font-size: 18px; font-weight: bold; color: #002776; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    .secao-texto { font-size: 15px; white-space: pre-wrap; }
    .dica { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 10px 14px; margin-top: 12px; font-size: 12px; color: #92400e; }
    .dica::before { content: '🎤 Dica de oratória: '; font-weight: bold; }
    @media print {
      body { margin: 20px auto; }
      .dica { background: #fff8dc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .resumo { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .secao-titulo { color: #002776 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `
  const sections = discurso.secoes.map(s => `
    <div class="secao">
      <div class="secao-titulo">${s.nome}</div>
      <div class="secao-texto">${s.texto.replace(/\n/g, '<br>')}</div>
      ${s.dica ? `<div class="dica">${s.dica}</div>` : ''}
    </div>
  `).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${discurso.titulo}</title><style>${style}</style></head><body>
    <h1>${discurso.titulo}</h1>
    <div class="meta">Candidato: <strong>${candidateName}</strong> &nbsp;|&nbsp; Duração estimada: <strong>${discurso.duracao_estimada}</strong></div>
    <div class="resumo"><strong>Frases-chave para memorizar:</strong><br>${discurso.resumo_executivo}</div>
    ${sections}
  </body></html>`

  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 500)
}

function discursoFromHistorico(item: any): Discurso {
  // Reconstrói o objeto Discurso a partir do textoGerado salvo (formato ## Seção\n\ntexto)
  const secoes: Secao[] = item.textoGerado
    .split('\n\n---\n\n')
    .map((bloco: string) => {
      const linhas = bloco.split('\n\n')
      const nome = (linhas[0] ?? '').replace(/^## /, '').trim()
      const texto = linhas.slice(1).join('\n\n').trim()
      return { nome, texto, dica: '' }
    })
    .filter((s: Secao) => s.nome && s.texto)
  return {
    id: item.id,
    titulo: item.temaCustomizado || item.tema,
    duracao_estimada: '—',
    secoes,
    resumo_executivo: '',
    textoCompleto: item.textoGerado,
  }
}

// ─── Componente ResultadoDiscurso ─────────────────────────────────────────────

function ResultadoDiscurso({ discurso, candidateName, onNovo }: {
  discurso: Discurso; candidateName: string; onNovo: () => void
}) {
  const [aberta, setAberta] = useState<number | null>(0)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const copiar = () => {
    navigator.clipboard.writeText(discurso.textoCompleto)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Mic className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">{discurso.titulo}</h2>
            <p className="text-xs text-gray-400">{discurso.duracao_estimada} · {discurso.secoes.length} seções</p>
          </div>
        </div>
        <button onClick={onNovo} className="text-sm text-[#002776] hover:underline">← Criar novo</button>
      </div>

      {/* Frases-chave */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">⭐ Frases-chave para memorizar</p>
        <p className="text-sm text-amber-900 italic leading-relaxed">{discurso.resumo_executivo}</p>
      </div>

      {/* Seções acordeão */}
      <div className="space-y-2">
        {discurso.secoes.map((s, i) => (
          <div key={i} className={`rounded-xl border-2 transition-all ${aberta === i ? 'border-[#002776] shadow-sm' : 'border-gray-200'}`}>
            <button
              onClick={() => setAberta(aberta === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#002776] text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="font-semibold text-gray-900 text-sm">{s.nome}</span>
              </div>
              {aberta === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {aberta === i && (
              <div className="px-4 pb-4 space-y-3">
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 font-serif">
                  {s.texto}
                </div>
                {s.dica && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <Mic className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800"><strong>Oratória:</strong> {s.dica}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={copiar} className="gap-2">
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copiado!' : 'Copiar texto'}
        </Button>
        <Button size="sm" onClick={() => exportDiscursoPDF(discurso, candidateName)}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold">
          <Download className="w-4 h-4" />
          Exportar PDF
        </Button>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConteudoPage() {
  const { candidate } = useAuthStore()
  const [tab, setTab] = useState<'criar' | 'historico'>('criar')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [tema, setTema] = useState('')
  const [temasSelecionados, setTemasSelecionados] = useState<string[]>([]) // multi para discurso
  const [temaCustomizado, setTemaCustomizado] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [tom, setTom] = useState('emotivo')
  const [duracao, setDuracao] = useState('15')
  const [resultado, setResultado] = useState<{ id: string; texto: string; hashtags: string[]; plataforma: string } | null>(null)
  const [discurso, setDiscurso] = useState<Discurso | null>(null)
  const [textoEditado, setTextoEditado] = useState('')
  const [copiedTexto, setCopiedTexto] = useState(false)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [santinhoOpen, setSantinhoOpen] = useState(false)
  const { toast } = useToast()
  const qc = useQueryClient()

  const isDiscurso = plataforma === 'discurso'
  const limite = PLATAFORMAS.find(p => p.id === plataforma)?.limite ?? 2200
  const temaAtual = TEMAS.find(t => t.id === tema)

  // Toggle tema para discurso (múltiplo) ou simples para post
  const toggleTema = (id: string) => {
    if (isDiscurso) {
      setTemasSelecionados(prev =>
        prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 6 ? [...prev, id] : prev
      )
    } else {
      setTema(id)
    }
  }

  const temaValido = isDiscurso
    ? temasSelecionados.length > 0
    : (tema && (tema !== 'personalizado' || temaCustomizado))

  const gerarMutation = useMutation({
    mutationFn: () => api.post('/conteudo/gerar', {
      tema,
      temaCustomizado: tema === 'personalizado' ? temaCustomizado : undefined,
      plataforma,
      tom,
    }).then(r => r.data),
    onSuccess: (data) => {
      setResultado(data); setTextoEditado(data.texto)
      qc.invalidateQueries({ queryKey: ['conteudo'] })
    },
    onError: () => toast({ title: 'Erro ao gerar', variant: 'destructive' }),
  })

  const gerarDiscursoMutation = useMutation({
    mutationFn: () => api.post('/conteudo/discurso', {
      temas: temasSelecionados,
      duracao,
      tom,
    }, { timeout: 120000 }).then(r => r.data),
    onSuccess: (data: Discurso) => {
      setDiscurso(data)
      qc.invalidateQueries({ queryKey: ['conteudo'] })
    },
    onError: (err: any) => {
      console.error('[discurso] erro completo:', err)
      console.error('[discurso] response:', err?.response?.status, err?.response?.data)
      const status = err?.response?.status
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || ''
      let desc = msg || 'Erro desconhecido.'
      if (status === 504 || status === 502 || err?.code === 'ECONNABORTED') {
        desc = 'A IA demorou mais que o esperado. Tente com menos temas ou duração menor.'
      }
      toast({ title: 'Erro ao gerar discurso', description: desc, variant: 'destructive' })
    },
  })

  const regenerarMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conteudo/${id}/regenerar`).then(r => r.data),
    onSuccess: (data) => { setResultado(data); setTextoEditado(data.texto) },
    onError: () => toast({ title: 'Erro ao regenerar', variant: 'destructive' }),
  })

  const salvarMutation = useMutation({
    mutationFn: ({ id, textoGerado }: { id: string; textoGerado: string }) =>
      api.patch(`/conteudo/${id}`, { textoGerado }),
    onSuccess: () => { toast({ title: 'Rascunho salvo!' }); qc.invalidateQueries({ queryKey: ['conteudo'] }) },
  })

  const arquivarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/conteudo/${id}`, { status: 'arquivado' }),
    onSuccess: () => { toast({ title: 'Arquivado' }); qc.invalidateQueries({ queryKey: ['conteudo'] }) },
  })

  const deletarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/conteudo/${id}`),
    onSuccess: () => { toast({ title: 'Removido' }); qc.invalidateQueries({ queryKey: ['conteudo'] }) },
  })

  const { data: historico } = useQuery({
    queryKey: ['conteudo', page, statusFilter],
    queryFn: () => api.get('/conteudo', { params: { page, status: statusFilter || undefined } }).then(r => r.data),
    enabled: tab === 'historico',
  })

  const copiarTexto = () => {
    navigator.clipboard.writeText(textoEditado)
    setCopiedTexto(true); setTimeout(() => setCopiedTexto(false), 2000)
  }
  const copiarHash = (h: string) => {
    navigator.clipboard.writeText(h)
    setCopiedHash(h); setTimeout(() => setCopiedHash(null), 1500)
  }

  const resetCriador = () => {
    setStep(1); setTema(''); setTemasSelecionados([]); setPlataforma('')
    setTom('emotivo'); setDuracao('15'); setResultado(null)
    setDiscurso(null); setTextoEditado(''); setSantinhoOpen(false)
  }

  const handleExportSantinho = async (dataUrl: string, filename: string) => {
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const form = new FormData()
      form.append('file', blob, filename)
      form.append('name', `Santinho ${temaAtual?.label ?? ''} — ${candidate?.name ?? ''}`)
      form.append('type', 'post')
      form.append('platform', 'all')
      await api.post('/creatives', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast({ title: '✅ Santinho salvo na biblioteca!' })
    } catch {
      toast({ title: 'Santinho criado!', description: 'Download iniciado.' })
    }
    const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Criação de Conteúdo com IA</h1>
        <p className="text-sm text-gray-500 mt-1">Gere posts, discursos e criativos para sua campanha.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ key: 'criar', label: 'Criar conteúdo' }, { key: 'historico', label: 'Histórico' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#002776] text-[#002776]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB CRIAR ── */}
      {tab === 'criar' && (
        <div className="space-y-6">
          {!resultado && !discurso ? (
            <>
              {/* Steps */}
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
                    {s < 3 && <div className={`h-0.5 w-8 transition-colors ${step > s ? 'bg-[#002776]' : 'bg-gray-100'}`} />}
                  </div>
                ))}
                <span className="ml-2 text-sm text-gray-500">
                  {step === 1 ? 'Tema' : step === 2 ? 'Plataforma' : isDiscurso ? 'Duração e tom' : 'Tom'}
                </span>
              </div>

              {/* Passo 1 — Tema */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">
                      {isDiscurso ? 'Escolha os temas (pode marcar vários)' : 'Escolha o tema'}
                    </h2>
                    {isDiscurso && temasSelecionados.length > 0 && (
                      <span className="text-xs bg-[#002776] text-white px-2 py-1 rounded-full font-bold">
                        {temasSelecionados.length} selecionado{temasSelecionados.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TEMAS.map(t => {
                      const ativo = isDiscurso ? temasSelecionados.includes(t.id) : tema === t.id
                      return (
                        <button key={t.id} onClick={() => toggleTema(t.id)}
                          className={`p-3 rounded-xl border text-sm font-medium transition-all text-left relative ${ativo ? 'border-[#002776] bg-[#002776]/5 text-[#002776]' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                          {isDiscurso && ativo && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#002776] flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <span className="text-lg">{t.icon}</span>
                          <p className="mt-1 text-xs leading-tight">{t.label}</p>
                        </button>
                      )
                    })}
                  </div>
                  {!isDiscurso && tema === 'personalizado' && (
                    <input value={temaCustomizado} onChange={e => setTemaCustomizado(e.target.value)}
                      placeholder="Descreva o tema..." maxLength={200}
                      className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  )}
                  <Button onClick={() => setStep(2)} disabled={!temaValido}
                    className="bg-[#002776] hover:bg-[#001f5e]">Próximo →</Button>
                </div>
              )}

              {/* Passo 2 — Plataforma */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep(1)} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
                    <h2 className="font-semibold text-gray-900">Onde será publicado?</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {PLATAFORMAS.map(p => {
                      const Icon = p.icon
                      const isDiscursoOpt = p.id === 'discurso'
                      return (
                        <button key={p.id} onClick={() => {
                          setPlataforma(p.id)
                          if (isDiscursoOpt) {
                            // Migra tema single-select para multi-select ao escolher Discurso
                            if (tema && temasSelecionados.length === 0) setTemasSelecionados([tema])
                          } else {
                            setTemasSelecionados([])
                          }
                        }}
                          className={`p-4 rounded-xl border flex items-center gap-3 transition-all text-left ${plataforma === p.id ? (isDiscursoOpt ? 'border-amber-500 bg-amber-50' : 'border-[#002776] bg-[#002776]/5') : 'border-gray-200 hover:border-gray-300'} ${isDiscursoOpt ? 'col-span-2 sm:col-span-1' : ''}`}>
                          <Icon className={`w-5 h-5 shrink-0 ${p.color}`} />
                          <div>
                            <p className="text-sm font-bold text-gray-800">{p.label}</p>
                            <p className="text-xs text-gray-400">{p.desc}</p>
                            {isDiscursoOpt && <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Exporta PDF para impressão</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {/* Se mudou para discurso, acompanha temas selecionados */}
                  {isDiscurso && temasSelecionados.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⬅ Volte ao passo 1 para selecionar os temas do discurso (pode escolher mais de um)
                    </p>
                  )}
                  <Button onClick={() => setStep(3)} disabled={!plataforma || (isDiscurso && temasSelecionados.length === 0)}
                    className="bg-[#002776] hover:bg-[#001f5e]">Próximo →</Button>
                </div>
              )}

              {/* Passo 3 — Tom (+ Duração se discurso) */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep(2)} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
                    <h2 className="font-semibold text-gray-900">
                      {isDiscurso ? 'Duração e tom do discurso' : 'Tom da comunicação'}
                    </h2>
                  </div>

                  {/* Duração — só para discurso */}
                  {isDiscurso && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Duração do discurso</p>
                      <div className="grid grid-cols-4 gap-2">
                        {DURACOES.map(d => (
                          <button key={d.id} onClick={() => setDuracao(d.id)}
                            className={`p-3 rounded-xl border text-center transition-all ${duracao === d.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <p className="text-sm font-bold text-gray-900">{d.label}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{d.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tom */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Tom da comunicação</p>
                    <div className="grid grid-cols-3 gap-3">
                      {TONS.map(t => (
                        <button key={t.id} onClick={() => setTom(t.id)}
                          className={`p-4 rounded-xl border text-left transition-all ${tom === t.id ? (isDiscurso ? 'border-amber-500 bg-amber-50' : 'border-[#002776] bg-[#002776]/5') : 'border-gray-200 hover:border-gray-300'}`}>
                          <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                          <p className="text-xs text-gray-400 mt-1">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resumo discurso */}
                  {isDiscurso && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                      <p className="font-semibold text-amber-800 mb-1">📋 Resumo do discurso a ser gerado:</p>
                      <p className="text-amber-700">
                        <strong>Temas:</strong> {temasSelecionados.map(t => TEMAS.find(x => x.id === t)?.label).join(', ')}
                      </p>
                      <p className="text-amber-700"><strong>Duração:</strong> {duracao} minutos</p>
                      <p className="text-amber-700"><strong>A IA vai buscar</strong> suas propostas cadastradas sobre esses temas.</p>
                    </div>
                  )}

                  <Button
                    onClick={() => isDiscurso ? gerarDiscursoMutation.mutate() : gerarMutation.mutate()}
                    disabled={isDiscurso ? gerarDiscursoMutation.isPending : gerarMutation.isPending}
                    className={`w-full gap-2 py-3 font-bold ${isDiscurso ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-[#002776] hover:bg-[#001f5e] text-white'}`}>
                    {(isDiscurso ? gerarDiscursoMutation.isPending : gerarMutation.isPending)
                      ? <><Loader2 className="w-4 h-4 animate-spin" />{isDiscurso ? 'Escrevendo discurso...' : 'Gerando com IA...'}</>
                      : isDiscurso
                        ? <><Mic className="w-4 h-4" />Gerar discurso de palanque</>
                        : <><Sparkles className="w-4 h-4" />Gerar conteúdo</>}
                  </Button>
                  {isDiscurso && gerarDiscursoMutation.isPending && (
                    <p className="text-xs text-gray-400 text-center">Isso pode levar 20-30 segundos — a IA está escrevendo um discurso completo com suas propostas...</p>
                  )}
                </div>
              )}
            </>
          ) : discurso ? (
            /* ── Resultado: Discurso ── */
            <ResultadoDiscurso
              discurso={discurso}
              candidateName={candidate?.name ?? ''}
              onNovo={resetCriador}
            />
          ) : resultado ? (
            /* ── Resultado: Post ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Post gerado</h2>
                <button onClick={resetCriador} className="text-sm text-[#002776] hover:underline">← Criar novo</button>
              </div>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    {(() => { const p = PLATAFORMAS.find(x => x.id === resultado.plataforma); const Icon = p?.icon; return Icon ? <Icon className={`w-4 h-4 ${p?.color}`} /> : null })()}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {PLATAFORMAS.find(p => p.id === resultado.plataforma)?.label}
                    </span>
                    {temaAtual && <span className="text-xs text-gray-400">{temaAtual.icon} {temaAtual.label}</span>}
                    <span className={`ml-auto text-xs font-mono ${textoEditado.length > limite ? 'text-red-500' : 'text-gray-400'}`}>
                      {textoEditado.length}/{limite}
                    </span>
                  </div>

                  <textarea value={textoEditado} onChange={e => setTextoEditado(e.target.value)}
                    rows={6} className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-y font-sans leading-relaxed" />

                  {resultado.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {resultado.hashtags.map(h => (
                        <button key={h} onClick={() => copiarHash(h)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors">
                          {copiedHash === h ? <CheckCircle2 className="w-3 h-3" /> : <Hash className="w-3 h-3" />}{h}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1 items-center">
                    <Button variant="outline" size="sm" onClick={copiarTexto} className="gap-2">
                      {copiedTexto ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      {copiedTexto ? 'Copiado!' : 'Copiar texto'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => regenerarMutation.mutate(resultado.id)} disabled={regenerarMutation.isPending} className="gap-2">
                      {regenerarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Regenerar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => salvarMutation.mutate({ id: resultado.id, textoGerado: textoEditado })} disabled={salvarMutation.isPending} className="gap-2">
                      {salvarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      Salvar rascunho
                    </Button>
                    <Button size="sm" onClick={() => setSantinhoOpen(v => !v)}
                      className="gap-2 ml-auto bg-gradient-to-r from-[#002776] to-[#009C3B] hover:opacity-90 text-white font-bold shadow-md">
                      <Wand2 className="w-4 h-4" />
                      {santinhoOpen ? 'Fechar editor' : '✦ Criar Santinho'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {santinhoOpen && (
                <div className="rounded-2xl border-2 border-[#002776] bg-white p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#002776] to-[#009C3B] flex items-center justify-center">
                        <Wand2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Editor de Santinho</p>
                        <p className="text-xs text-gray-500">Tema: {temaAtual?.icon} {temaAtual?.label}</p>
                      </div>
                    </div>
                    <button onClick={() => setSantinhoOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <CreativeEditor
                    name={candidate?.name ?? ''}
                    number={candidate?.candidateNumber ?? ''}
                    position={candidate?.position ?? ''}
                    party={candidate?.party ?? ''}
                    photo={candidate?.photoUrl ?? null}
                    city={candidate?.city ?? ''}
                    state={candidate?.state ?? ''}
                    slogan={temaAtual?.slogan ?? 'Sua voz, nossa força!'}
                    onExport={handleExportSantinho}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── TAB HISTÓRICO ── */}
      {tab === 'historico' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['', 'rascunho', 'agendado', 'enviado', 'arquivado'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === '' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>

          {!historico ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : historico.items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p>Nenhum conteúdo encontrado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.items.map((item: any) => {
                const plat = PLATAFORMAS.find(p => p.id === item.plataforma)
                const Icon = plat?.icon
                const t = TEMAS.find(t => t.id === item.tema)
                const isDiscItem = item.plataforma === 'discurso'
                return (
                  <Card key={item.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {Icon && <Icon className={`w-4 h-4 ${plat?.color}`} />}
                            <span className={`text-xs font-bold ${isDiscItem ? 'text-amber-600' : 'text-gray-500'}`}>
                              {isDiscItem ? '🎤 Discurso' : plat?.label}
                            </span>
                            {t && <span className="text-xs text-gray-400">{t.icon} {item.temaCustomizado || t.label}</span>}
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[item.status]?.color}`}>
                              {STATUS_CONFIG[item.status]?.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{item.textoGerado}</p>
                          <p className="text-xs text-gray-400">{formatDate(item.createdAt)}</p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {isDiscItem ? (
                            <button
                              onClick={() => { setDiscurso(discursoFromHistorico(item)); setTab('criar') }}
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-600" title="Abrir discurso">
                              <FileText className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => { navigator.clipboard.writeText(item.textoGerado); toast({ title: 'Copiado!' }) }}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Copiar">
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {item.status !== 'enviado' && item.status !== 'arquivado' && (
                            <button onClick={() => arquivarMutation.mutate(item.id)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Arquivar">
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          {item.status !== 'enviado' && (
                            <button onClick={() => { if (confirm('Remover?')) deletarMutation.mutate(item.id) }}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Remover">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {historico && historico.pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm text-gray-600">{page} / {historico.pages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= historico.pages}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
