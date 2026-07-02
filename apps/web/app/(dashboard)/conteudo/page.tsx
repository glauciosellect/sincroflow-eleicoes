'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import {
  Sparkles, Copy, CheckCircle2, RefreshCw, Trash2, Archive,
  Loader2, ChevronLeft, ChevronRight, Hash, Clock, Send,
  Instagram, Facebook, Linkedin, MessageSquare, Twitter, Video
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

// ─── Constantes ──────────────────────────────────────────────────────────────

const TEMAS = [
  { id: 'saude', label: 'Saúde', icon: '🏥' },
  { id: 'educacao', label: 'Educação', icon: '📚' },
  { id: 'seguranca', label: 'Segurança', icon: '🛡️' },
  { id: 'infraestrutura', label: 'Infraestrutura', icon: '🏗️' },
  { id: 'meio_ambiente', label: 'Meio Ambiente', icon: '🌿' },
  { id: 'emprego', label: 'Emprego', icon: '💼' },
  { id: 'cultura', label: 'Cultura', icon: '🎭' },
  { id: 'esporte', label: 'Esporte', icon: '⚽' },
  { id: 'transporte', label: 'Transporte', icon: '🚌' },
  { id: 'assistencia_social', label: 'Assistência Social', icon: '🤝' },
  { id: 'tecnologia', label: 'Tecnologia', icon: '💡' },
  { id: 'juventude', label: 'Juventude', icon: '🧑' },
  { id: 'terceira_idade', label: 'Terceira Idade', icon: '👴' },
  { id: 'mulheres', label: 'Mulheres', icon: '♀️' },
  { id: 'lgbtqia', label: 'LGBTQIA+', icon: '🏳️‍🌈' },
  { id: 'personalizado', label: 'Personalizado', icon: '✏️' },
]

const PLATAFORMAS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500', limite: 2200 },
  { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600', limite: 63206 },
  { id: 'tiktok', label: 'TikTok', icon: Video, color: 'text-gray-900', limite: 2200 },
  { id: 'telegram', label: 'Telegram', icon: MessageSquare, color: 'text-sky-500', limite: 4096 },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700', limite: 3000 },
  { id: 'x', label: 'X (Twitter)', icon: Twitter, color: 'text-gray-800', limite: 280 },
]

const TONS = [
  { id: 'proximo', label: 'Próximo', desc: 'Acessível, coloquial, humanizado' },
  { id: 'formal', label: 'Formal', desc: 'Institucional, respeitoso, técnico' },
  { id: 'emotivo', label: 'Emotivo', desc: 'Inspirador, tocante, apelo à emoção' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  agendado: { label: 'Agendado', color: 'bg-amber-100 text-amber-700' },
  enviado: { label: 'Enviado', color: 'bg-green-100 text-green-700' },
  arquivado: { label: 'Arquivado', color: 'bg-slate-100 text-slate-600' },
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConteudoPage() {
  const [tab, setTab] = useState<'criar' | 'historico'>('criar')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [tema, setTema] = useState('')
  const [temaCustomizado, setTemaCustomizado] = useState('')
  const [plataforma, setPlataforma] = useState('')
  const [tom, setTom] = useState('proximo')
  const [resultado, setResultado] = useState<{ id: string; texto: string; hashtags: string[]; plataforma: string } | null>(null)
  const [textoEditado, setTextoEditado] = useState('')
  const [copiedTexto, setCopiedTexto] = useState(false)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const { toast } = useToast()
  const qc = useQueryClient()

  const limite = PLATAFORMAS.find(p => p.id === plataforma)?.limite ?? 2200

  const gerarMutation = useMutation({
    mutationFn: () => api.post('/conteudo/gerar', { tema, temaCustomizado: tema === 'personalizado' ? temaCustomizado : undefined, plataforma, tom }).then(r => r.data),
    onSuccess: (data) => {
      setResultado(data)
      setTextoEditado(data.texto)
      qc.invalidateQueries({ queryKey: ['conteudo'] })
    },
    onError: () => toast({ title: 'Erro ao gerar', description: 'Tente novamente em alguns instantes.', variant: 'destructive' }),
  })

  const regenerarMutation = useMutation({
    mutationFn: (id: string) => api.post(`/conteudo/${id}/regenerar`).then(r => r.data),
    onSuccess: (data) => { setResultado(data); setTextoEditado(data.texto) },
    onError: () => toast({ title: 'Erro ao regenerar', variant: 'destructive' }),
  })

  const salvarMutation = useMutation({
    mutationFn: ({ id, textoGerado }: { id: string; textoGerado: string }) => api.patch(`/conteudo/${id}`, { textoGerado }),
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
    setCopiedTexto(true)
    setTimeout(() => setCopiedTexto(false), 2000)
  }

  const copiarHash = (h: string) => {
    navigator.clipboard.writeText(h)
    setCopiedHash(h)
    setTimeout(() => setCopiedHash(null), 1500)
  }

  const resetCriador = () => { setStep(1); setTema(''); setPlataforma(''); setTom('proximo'); setResultado(null); setTextoEditado('') }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Criação de Conteúdo com IA</h1>
          <p className="text-sm text-gray-500 mt-1">Gere posts ilimitados para todas as redes sociais.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ key: 'criar', label: 'Criar post' }, { key: 'historico', label: 'Histórico' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#002776] text-[#002776]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB CRIAR ── */}
      {tab === 'criar' && (
        <div className="space-y-6">
          {!resultado ? (
            <>
              {/* Step indicators */}
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
                    {s < 3 && <div className={`h-0.5 w-8 transition-colors ${step > s ? 'bg-[#002776]' : 'bg-gray-100'}`} />}
                  </div>
                ))}
                <span className="ml-2 text-sm text-gray-500">{step === 1 ? 'Tema' : step === 2 ? 'Plataforma' : 'Tom'}</span>
              </div>

              {/* Passo 1 — Tema */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="font-semibold text-gray-900">Escolha o tema</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TEMAS.map(t => (
                      <button key={t.id} onClick={() => setTema(t.id)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all text-left ${tema === t.id ? 'border-[#002776] bg-[#002776]/5 text-[#002776]' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                        <span className="text-lg">{t.icon}</span>
                        <p className="mt-1 text-xs leading-tight">{t.label}</p>
                      </button>
                    ))}
                  </div>
                  {tema === 'personalizado' && (
                    <input value={temaCustomizado} onChange={e => setTemaCustomizado(e.target.value)}
                      placeholder="Descreva o tema personalizado..." maxLength={200}
                      className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  )}
                  <Button onClick={() => setStep(2)} disabled={!tema || (tema === 'personalizado' && !temaCustomizado)}
                    className="bg-[#002776] hover:bg-[#001f5e]">Próximo →</Button>
                </div>
              )}

              {/* Passo 2 — Plataforma */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep(1)} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
                    <h2 className="font-semibold text-gray-900">Escolha a plataforma</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {PLATAFORMAS.map(p => {
                      const Icon = p.icon
                      return (
                        <button key={p.id} onClick={() => setPlataforma(p.id)}
                          className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${plataforma === p.id ? 'border-[#002776] bg-[#002776]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          <Icon className={`w-5 h-5 ${p.color}`} />
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-800">{p.label}</p>
                            <p className="text-xs text-gray-400">{p.limite.toLocaleString()} chars</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <Button onClick={() => setStep(3)} disabled={!plataforma} className="bg-[#002776] hover:bg-[#001f5e]">Próximo →</Button>
                </div>
              )}

              {/* Passo 3 — Tom + Gerar */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep(2)} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
                    <h2 className="font-semibold text-gray-900">Tom da comunicação</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {TONS.map(t => (
                      <button key={t.id} onClick={() => setTom(t.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${tom === t.id ? 'border-[#002776] bg-[#002776]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                        <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                        <p className="text-xs text-gray-400 mt-1">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                  <Button onClick={() => gerarMutation.mutate()} disabled={gerarMutation.isPending}
                    className="w-full bg-[#002776] hover:bg-[#001f5e] gap-2 py-3">
                    {gerarMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando com IA...</> : <><Sparkles className="w-4 h-4" />Gerar conteúdo</>}
                  </Button>
                </div>
              )}
            </>
          ) : (
            /* Resultado */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Post gerado</h2>
                <button onClick={resetCriador} className="text-sm text-[#002776] hover:underline">← Criar novo</button>
              </div>

              <Card>
                <CardContent className="pt-4 space-y-3">
                  {/* Plataforma badge */}
                  <div className="flex items-center gap-2">
                    {(() => { const p = PLATAFORMAS.find(x => x.id === resultado.plataforma); const Icon = p?.icon; return Icon ? <Icon className={`w-4 h-4 ${p?.color}`} /> : null })()}
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{PLATAFORMAS.find(p => p.id === resultado.plataforma)?.label}</span>
                    <span className={`ml-auto text-xs font-mono ${textoEditado.length > limite ? 'text-red-500' : 'text-gray-400'}`}>
                      {textoEditado.length}/{limite}
                    </span>
                  </div>

                  {/* Textarea editável */}
                  <textarea
                    value={textoEditado}
                    onChange={e => setTextoEditado(e.target.value)}
                    rows={10}
                    className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none font-sans leading-relaxed"
                  />

                  {/* Hashtags */}
                  {resultado.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {resultado.hashtags.map(h => (
                        <button key={h} onClick={() => copiarHash(h)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors">
                          {copiedHash === h ? <CheckCircle2 className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
                          {h}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex flex-wrap gap-2 pt-1">
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
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
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
                const tema = TEMAS.find(t => t.id === item.tema)
                return (
                  <Card key={item.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {Icon && <Icon className={`w-4 h-4 ${plat?.color}`} />}
                            <span className="text-xs font-medium text-gray-500">{plat?.label}</span>
                            {tema && <span className="text-xs text-gray-500">{tema.icon} {tema.label}</span>}
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[item.status]?.color}`}>
                              {STATUS_CONFIG[item.status]?.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{item.textoGerado}</p>
                          {item.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.hashtags.slice(0, 4).map((h: string) => (
                                <span key={h} className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{h}</span>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-400">{formatDate(item.createdAt)}</p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => { navigator.clipboard.writeText(item.textoGerado); toast({ title: 'Copiado!' }) }}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Copiar">
                            <Copy className="w-4 h-4" />
                          </button>
                          {item.status !== 'enviado' && item.status !== 'arquivado' && (
                            <button onClick={() => arquivarMutation.mutate(item.id)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Arquivar">
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          {item.status !== 'enviado' && (
                            <button onClick={() => { if (confirm('Remover este conteúdo?')) deletarMutation.mutate(item.id) }}
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
