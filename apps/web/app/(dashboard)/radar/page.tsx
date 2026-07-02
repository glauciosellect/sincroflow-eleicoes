'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Radar, Bell, Settings, FileText, Plus, X, Loader2, Trash2,
  Eye, EyeOff, ToggleLeft, ToggleRight, ExternalLink, Wand2,
  TrendingUp, TrendingDown, Minus, RefreshCw
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

const radarSchema = z.object({
  tipo: z.enum(['adversario', 'proprio', 'tema', 'palavra_chave']),
  nome: z.string().min(2).max(200),
  rssUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  twitterQuery: z.string().max(500).optional(),
  plataformas: z.array(z.string()).default([]),
})
type RadarForm = z.infer<typeof radarSchema>

const SENTIMENTO_CONFIG = {
  positivo: { label: 'Positivo', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  negativo: { label: 'Negativo', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
  neutro: { label: 'Neutro', icon: Minus, color: 'text-gray-500', bg: 'bg-gray-50' },
}

const TIPO_LABEL = { adversario: 'Adversário', proprio: 'Próprio nome', tema: 'Tema', palavra_chave: 'Palavra-chave' }
const PLATAFORMAS_OPT = ['google_alerts', 'twitter', 'instagram']

export default function RadarPage() {
  const [tab, setTab] = useState<'alertas' | 'monitorar' | 'resumos'>('alertas')
  const [showForm, setShowForm] = useState(false)
  const [lidoFilter, setLidoFilter] = useState<string>('')
  const [sentFilter, setSentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [contraNarrId, setContraNarrId] = useState<string | null>(null)
  const [contraNarr, setContraNarr] = useState<any>(null)
  const { toast } = useToast()
  const qc = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, watch, setValue } = useForm<RadarForm>({
    resolver: zodResolver(radarSchema),
    defaultValues: { tipo: 'adversario', plataformas: [] },
  })
  const plataformasSel = watch('plataformas') ?? []

  const { data: radares = [], isLoading: radarLoading } = useQuery({
    queryKey: ['radar'],
    queryFn: () => api.get('/radar').then(r => r.data),
    enabled: tab === 'monitorar',
  })

  const { data: resultados } = useQuery({
    queryKey: ['radar-resultados', page, lidoFilter, sentFilter],
    queryFn: () => api.get('/radar/resultados', { params: { page, lido: lidoFilter || undefined, sentimento: sentFilter || undefined } }).then(r => r.data),
    enabled: tab === 'alertas',
  })

  const { data: resumos = [] } = useQuery({
    queryKey: ['radar-resumos'],
    queryFn: () => api.get('/radar/resumos').then(r => r.data),
    enabled: tab === 'resumos',
  })

  const createMutation = useMutation({
    mutationFn: (data: RadarForm) => api.post('/radar', { ...data, rssUrl: data.rssUrl || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['radar'] }); toast({ title: 'Monitoramento criado!' }); reset(); setShowForm(false) },
    onError: (e: any) => toast({ title: 'Erro', description: e.response?.data?.error, variant: 'destructive' }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => api.patch(`/radar/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['radar'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/radar/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['radar'] }); toast({ title: 'Removido' }) },
  })

  const coletarMutation = useMutation({
    mutationFn: (id: string) => api.post(`/radar/${id}/coletar`).then(r => r.data),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['radar-resultados'] }); toast({ title: `${data.coletados} novos itens coletados` }) },
    onError: () => toast({ title: 'Erro ao coletar', variant: 'destructive' }),
  })

  const lidoMutation = useMutation({
    mutationFn: ({ id, lido }: { id: string; lido: boolean }) => api.patch(`/radar/resultados/${id}/lido`, { lido }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['radar-resultados'] }),
  })

  const contraMutation = useMutation({
    mutationFn: (resultadoId: string) => api.post('/radar/contra-narrativa', { resultadoId }).then(r => r.data),
    onSuccess: (data) => setContraNarr(data),
    onError: () => toast({ title: 'Erro ao gerar contra-narrativa', variant: 'destructive' }),
  })

  const togglePlataforma = (p: string) => {
    const curr = plataformasSel ?? []
    setValue('plataformas', curr.includes(p) ? curr.filter(x => x !== p) : [...curr, p])
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radar Político</h1>
          <p className="text-sm text-gray-500 mt-1">Monitore adversários, seu nome e pautas em tempo real.</p>
        </div>
        {resultados?.naoLidos > 0 && (
          <Badge className="bg-red-500 text-white gap-1.5"><Bell className="w-3.5 h-3.5" />{resultados.naoLidos} não lidos</Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ key: 'alertas', label: 'Alertas', icon: Bell }, { key: 'monitorar', label: 'Monitoramentos', icon: Settings }, { key: 'resumos', label: 'Resumos', icon: FileText }].map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#002776] text-[#002776]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      {/* ── ALERTAS ── */}
      {tab === 'alertas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[{ v: '', label: 'Todos' }, { v: 'false', label: 'Não lidos' }, { v: 'true', label: 'Lidos' }].map(f => (
              <button key={f.v} onClick={() => { setLidoFilter(f.v); setPage(1) }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${lidoFilter === f.v ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f.label}
              </button>
            ))}
            <div className="border-l mx-1" />
            {['', 'negativo', 'positivo', 'neutro'].map(s => (
              <button key={s} onClick={() => { setSentFilter(s); setPage(1) }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sentFilter === s ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === '' ? 'Todos sentimentos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {!resultados ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : resultados.items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Radar className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>Nenhum alerta encontrado.</p>
              <p className="text-sm mt-1">Configure monitoramentos na aba "Monitoramentos".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resultados.items.map((r: any) => {
                const sent = SENTIMENTO_CONFIG[r.sentimento as keyof typeof SENTIMENTO_CONFIG] ?? SENTIMENTO_CONFIG.neutro
                const SentIcon = sent.icon
                return (
                  <Card key={r.id} className={!r.lido ? 'border-l-4 border-l-[#002776]' : ''}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${sent.bg}`}>
                          <SentIcon className={`w-4 h-4 ${sent.color}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-800">{r.radar?.nome}</span>
                            <Badge variant="secondary" className="text-xs py-0">{TIPO_LABEL[r.radar?.tipo as keyof typeof TIPO_LABEL] ?? r.radar?.tipo}</Badge>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sent.bg} ${sent.color}`}>{sent.label}</span>
                            <span className="ml-auto text-xs text-gray-400">Relevância: {r.relevancia}/100</span>
                          </div>
                          {r.titulo && <p className="text-sm font-medium text-gray-900 line-clamp-1">{r.titulo}</p>}
                          <p className="text-sm text-gray-600 line-clamp-3">{r.texto}</p>
                          <div className="flex items-center gap-3 pt-1">
                            {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#002776] flex items-center gap-1 hover:underline"><ExternalLink className="w-3 h-3" />Ver fonte</a>}
                            <span className="text-xs text-gray-400">{formatDate(r.coletadoEm)}</span>
                            <button onClick={() => lidoMutation.mutate({ id: r.id, lido: !r.lido })} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                              {r.lido ? <><EyeOff className="w-3 h-3" />Marcar não lido</> : <><Eye className="w-3 h-3" />Marcar lido</>}
                            </button>
                            <button onClick={() => { setContraNarrId(r.id); setContraNarr(null); contraMutation.mutate(r.id) }}
                              className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
                              <Wand2 className="w-3 h-3" />Contra-narrativa
                            </button>
                          </div>
                          {contraNarrId === r.id && (
                            <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              {contraMutation.isPending ? (
                                <div className="flex items-center gap-2 text-sm text-purple-700"><Loader2 className="w-4 h-4 animate-spin" />Gerando com IA...</div>
                              ) : contraNarr ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-purple-700">Sugestão de resposta ({contraNarr.tom})</p>
                                  <p className="text-sm text-gray-800">{contraNarr.contranarativa}</p>
                                  {contraNarr.racional && <p className="text-xs text-gray-500 italic">{contraNarr.racional}</p>}
                                  <button onClick={() => { navigator.clipboard.writeText(contraNarr.contranarativa); toast({ title: 'Copiado!' }) }}
                                    className="text-xs text-purple-600 hover:underline">Copiar sugestão</button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {resultados && resultados.pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Anterior</Button>
              <span className="text-sm text-gray-600">{page} / {resultados.pages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= resultados.pages}>Próximo</Button>
            </div>
          )}
        </div>
      )}

      {/* ── MONITORAMENTOS ── */}
      {tab === 'monitorar' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(s => !s)} className="bg-[#002776] hover:bg-[#001f5e] gap-2">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancelar' : 'Novo monitoramento'}
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardContent className="pt-4">
                <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Tipo</label>
                      <select {...register('tipo')} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                        {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Nome / Termo *</label>
                      <Input {...register('nome')} placeholder="Ex: João Adversário, saúde pública" />
                      {errors.nome && <p className="text-xs text-red-500">{errors.nome.message}</p>}
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-sm font-medium text-gray-700">URL do Google Alerts RSS</label>
                      <Input {...register('rssUrl')} placeholder="https://www.google.com/alerts/feeds/..." />
                      {errors.rssUrl && <p className="text-xs text-red-500">{errors.rssUrl.message}</p>}
                      <p className="text-xs text-gray-400">Configure em <span className="font-mono">google.com/alerts</span> → entregar em RSS → copie o link do feed</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-sm font-medium text-gray-700">Query Twitter/X (opcional)</label>
                      <Input {...register('twitterQuery')} placeholder='Ex: "João Silva" OR #joaosilva' />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Plataformas a monitorar</label>
                    <div className="flex gap-2">
                      {PLATAFORMAS_OPT.map(p => (
                        <button type="button" key={p} onClick={() => togglePlataforma(p)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${plataformasSel.includes(p) ? 'bg-[#002776] text-white border-[#002776]' : 'border-gray-200 text-gray-600'}`}>
                          {p.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" disabled={isSubmitting || createMutation.isPending} className="bg-[#002776] hover:bg-[#001f5e] gap-2">
                    {(isSubmitting || createMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                    Criar monitoramento
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {radarLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : radares.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Radar className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>Nenhum monitoramento configurado.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {radares.map((r: any) => (
                <Card key={r.id} className={!r.ativo ? 'opacity-60' : ''}>
                  <CardContent className="pt-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{r.nome}</span>
                        <Badge variant="secondary" className="text-xs">{TIPO_LABEL[r.tipo as keyof typeof TIPO_LABEL]}</Badge>
                        {r._count?.resultados > 0 && <span className="text-xs text-gray-400">{r._count.resultados} itens</span>}
                      </div>
                      {r.rssUrl && <p className="text-xs text-gray-400 mt-0.5 truncate">RSS: {r.rssUrl}</p>}
                      {r.ultimaColeta && <p className="text-xs text-gray-400">Última coleta: {formatDate(r.ultimaColeta)}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => coletarMutation.mutate(r.id)} disabled={coletarMutation.isPending} title="Coletar agora"
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                        <RefreshCw className={`w-4 h-4 ${coletarMutation.isPending ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={() => toggleMutation.mutate({ id: r.id, ativo: !r.ativo })} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
                        {r.ativo ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => { if (confirm('Remover monitoramento?')) deleteMutation.mutate(r.id) }}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RESUMOS ── */}
      {tab === 'resumos' && (
        <div className="space-y-3">
          {resumos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p>Nenhum resumo gerado ainda.</p>
              <p className="text-sm mt-1">Resumos diários e semanais serão gerados automaticamente.</p>
            </div>
          ) : (
            resumos.map((r: any) => (
              <Card key={r.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{r.tipo === 'diario' ? 'Diário' : 'Semanal'}</Badge>
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-4">{r.resumoTexto}</p>
                  {r.sugestaoAcao && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-xs font-semibold text-purple-700 mb-1">Sugestão de ação</p>
                      <p className="text-sm text-gray-800">{r.sugestaoAcao}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
