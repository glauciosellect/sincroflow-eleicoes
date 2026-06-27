'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Users, MessageSquare, FileWarning, Activity, MessageCircleQuestion, HelpCircle, Clock3, Download, CalendarRange, Smile, Meh, Frown, MapPin } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

const periodOptions = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
]

const channelIcon: Record<string, string> = { WHATSAPP: '📱', INSTAGRAM: '📸', FACEBOOK: '📘', TELEGRAM: '✈️', EMAIL: '📧' }
const REQUEST_STATUS_LABELS: Record<string, string> = { RECEIVED: 'Recebido', ANALYZING: 'Em análise', FORWARDED: 'Encaminhado', RESOLVED: 'Resolvido' }

const SENTIMENT_CONFIG = {
  POSITIVE: { label: 'Positivo', icon: Smile, color: 'text-green-600', bg: 'bg-green-50' },
  NEUTRAL: { label: 'Neutro', icon: Meh, color: 'text-gray-500', bg: 'bg-gray-50' },
  NEGATIVE: { label: 'Negativo', icon: Frown, color: 'text-red-600', bg: 'bg-red-50' },
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState(7)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null)
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<{ key: string; name: string } | null>(null)

  // Calculado uma vez por mudança de período/customRange (useMemo), não a cada
  // render — sem isso, "new Date()" mudava a cada milissegundo e a queryKey do
  // React Query nunca se estabilizava, gerando uma chamada nova infinitamente.
  const { start, end } = useMemo(() => ({
    end: customRange ? new Date(customRange.end).toISOString() : new Date().toISOString(),
    start: customRange ? new Date(customRange.start).toISOString() : new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString(),
  }), [period, customRange])

  // Um único endpoint consolidado no backend (Promise.all lá dentro) em vez de ~9
  // requisições HTTP separadas — cada uma era rápida isoladamente, mas a soma das
  // chamadas simultâneas deixava a tela perceptivelmente lenta para carregar.
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({
    queryKey: ['report-dashboard', start, end],
    queryFn: () => api.get('/analytics/dashboard', { params: { start, end } }).then(r => r.data),
  })

  const overview = dashboard?.overview?.current
  const prevOverview = dashboard?.overview?.previous
  const byChannel = dashboard?.byChannel
  const topContacts = dashboard?.topContacts
  const timeline = dashboard?.timeline
  const requestsStatus = dashboard?.requestsStatus
  const topTopics = dashboard?.topTopics
  const contentGaps = dashboard?.contentGaps
  const peakHours = dashboard?.peakHours
  const sentiment = dashboard?.sentiment
  const byRegion = dashboard?.byRegion
  const l1 = loadingDashboard, l2 = loadingDashboard, l3 = loadingDashboard, l4 = loadingDashboard,
    l5 = loadingDashboard, l6 = loadingDashboard, l7 = loadingDashboard, l8 = loadingDashboard,
    l9 = loadingDashboard, l10 = loadingDashboard

  const { data: topicContacts, isLoading: l11 } = useQuery({
    queryKey: ['report-topic-contacts', selectedTopic?.key, start, end],
    queryFn: () => api.get(`/analytics/top-topics/${selectedTopic!.key}/contacts`, { params: { start, end } }).then(r => r.data),
    enabled: !!selectedTopic,
  })

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const res = await api.get('/analytics/export-pdf', { params: { start, end }, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'relatorio-campanha.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Use estes dados para definir sua agenda de rua — vá onde os eleitores estão pedindo.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {periodOptions.map((o) => (
              <button key={o.days} onClick={() => { setPeriod(o.days); setCustomRange(null) }} className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all', !customRange && period === o.days ? 'bg-white text-[#002776] shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {o.label}
              </button>
            ))}
            <button onClick={() => setShowCustomRange(s => !s)} className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1', customRange ? 'bg-white text-[#002776] shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <CalendarRange className="w-3.5 h-3.5" />
              {customRange ? `${new Date(customRange.start).toLocaleDateString('pt-BR')} – ${new Date(customRange.end).toLocaleDateString('pt-BR')}` : 'Período'}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Baixar PDF
          </Button>
        </div>
      </div>

      {showCustomRange && (
        <div className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">De</label>
            <Input type="date" className="h-8 text-sm" id="report-custom-start" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Até</label>
            <Input type="date" className="h-8 text-sm" id="report-custom-end" />
          </div>
          <Button
            size="sm"
            onClick={() => {
              const startVal = (document.getElementById('report-custom-start') as HTMLInputElement)?.value
              const endVal = (document.getElementById('report-custom-end') as HTMLInputElement)?.value
              if (startVal && endVal) { setCustomRange({ start: startVal, end: endVal }); setShowCustomRange(false) }
            }}
          >
            Aplicar
          </Button>
        </div>
      )}

      {/* Relatório 1: Visão Geral da Semana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between"><MessageSquare className="w-5 h-5 text-[#002776]" /><Trend value={overview?.conversations} prev={prevOverview?.conversations} /></div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{l1 ? '—' : overview?.conversations ?? 0}</div>
          <div className="text-xs text-gray-400 mt-0.5">Conversas</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between"><Users className="w-5 h-5 text-[#009C3B]" /><Trend value={overview?.newContacts} prev={prevOverview?.newContacts} /></div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{l1 ? '—' : overview?.newContacts ?? 0}</div>
          <div className="text-xs text-gray-400 mt-0.5">Novos eleitores</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between"><FileWarning className="w-5 h-5 text-amber-600" /><Trend value={overview?.requests} prev={prevOverview?.requests} /></div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{l1 ? '—' : overview?.requests ?? 0}</div>
          <div className="text-xs text-gray-400 mt-0.5">Solicitações</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between"><Activity className="w-5 h-5 text-purple-600" /></div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{l1 ? '—' : `${overview?.resolutionRate ?? 0}%`}</div>
          <div className="text-xs text-gray-400 mt-0.5">Taxa de resolução</div>
        </CardContent></Card>
      </div>

      {/* Relatório 9: Evolução */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Evolução de Conversas</CardTitle></CardHeader>
        <CardContent>
          {l4 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline || []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradTimeline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#002776" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#002776" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [v, 'Conversas']} labelFormatter={v => `Dia ${v}`} />
                <Area type="monotone" dataKey="count" stroke="#002776" strokeWidth={2} fill="url(#gradTimeline)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relatório 4: Volume por Canal */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Volume por Canal</CardTitle></CardHeader>
          <CardContent>
            {l2 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (!byChannel || byChannel.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm">Sem dados no período</div>
            ) : (
              <div className="space-y-3">
                {byChannel.map((c: any, i: number) => (
                  <Link key={i} href={`/chat?channelId=${c.channelId}`} className="block hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5 text-gray-700"><span>{channelIcon[c.type] || '📡'}</span>{c.name}</span>
                      <span className="text-xs font-semibold text-gray-600">{c.count} conv.</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#002776]" style={{ width: `${Math.max(4, (c.count / Math.max(1, ...byChannel.map((x: any) => x.count))) * 100)}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relatório 10: Status das Solicitações */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Status das Solicitações</CardTitle></CardHeader>
          <CardContent>
            {l5 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(REQUEST_STATUS_LABELS).map(([key, label]) => (
                  <Link key={key} href={`/solicitacoes?status=${key}`} className="bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="text-2xl font-bold text-gray-900">{requestsStatus?.[key] ?? 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relatório 2: Temas Mais Perguntados */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><MessageCircleQuestion className="w-4 h-4 text-[#002776]" />Temas Mais Perguntados</CardTitle></CardHeader>
          <CardContent>
            {l6 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (!topTopics || topTopics.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm">Sem dados no período</div>
            ) : (
              <div className="space-y-3">
                {topTopics.map((t: any) => (
                  <button key={t.topicKey} onClick={() => setSelectedTopic({ key: t.topicKey, name: t.topicName })} className="w-full text-left hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{t.topicName}</span>
                      <span className="text-xs font-semibold text-gray-600">{t.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#009C3B]" style={{ width: `${Math.max(4, (t.count / Math.max(1, ...topTopics.map((x: any) => x.count))) * 100)}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Relatório 6: Perguntas Sem Resposta (Gaps de Conteúdo) */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><HelpCircle className="w-4 h-4 text-amber-600" />Perguntas Sem Resposta</CardTitle></CardHeader>
          <CardContent>
            {l7 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (!contentGaps?.byTopic || contentGaps.byTopic.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhum gap de conteúdo no período 🎉</div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 mb-2">Eleitores perguntaram sobre temas que você ainda não cadastrou conteúdo:</p>
                {contentGaps.byTopic.map((t: any) => (
                  <div key={t.topicKey || 'sem-tema'} className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-amber-800">{t.topicName}</span>
                    <span className="text-xs font-semibold text-amber-700">{t.count}x</span>
                  </div>
                ))}
                {contentGaps.examples?.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1.5">Conversas recentes — clique para responder:</p>
                    {contentGaps.examples.map((ex: any) => (
                      <Link key={ex.id} href={`/chat?conversationId=${ex.conversationId}`} className="block text-xs text-[#002776] hover:underline truncate py-0.5">
                        → {ex.content}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Relatório 7: Horários de Pico */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Clock3 className="w-4 h-4 text-purple-600" />Horários de Pico</CardTitle></CardHeader>
        <CardContent>
          {l8 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={peakHours || []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h) => `${h}h`} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [v, 'Mensagens']} labelFormatter={(h) => `${h}h às ${h + 1}h`} />
                <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Relatório 8: Eleitores Mais Engajados */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Eleitores Mais Engajados (Top 20)</CardTitle></CardHeader>
        <CardContent>
          {l3 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (!topContacts || topContacts.length === 0) ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum dado ainda</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topContacts.map((c: any, i: number) => (
                <Link key={c.id} href={`/contacts?search=${encodeURIComponent(c.phone || c.name || '')}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                    {(c.name || c.phone)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name || c.phone}</div>
                    <div className="text-xs text-gray-400">{c.totalInteractions} interações</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relatório 5: Sentimento dos Eleitores */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Sentimento dos Eleitores</CardTitle></CardHeader>
          <CardContent>
            {l9 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(SENTIMENT_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <div key={key} className={cn('rounded-xl p-3 text-center', cfg.bg)}>
                      <Icon className={cn('w-6 h-6 mx-auto mb-1', cfg.color)} />
                      <div className={cn('text-xl font-bold', cfg.color)}>{sentiment?.[key] ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{cfg.label}</div>
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-3">Classificado automaticamente pela IA com base no tom das mensagens dos eleitores.</p>
          </CardContent>
        </Card>

        {/* Relatório 3: Solicitações por Região */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-[#002776]" />Solicitações por Região</CardTitle></CardHeader>
          <CardContent>
            {l10 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (!byRegion?.byRegion || byRegion.byRegion.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhum bairro identificado ainda</div>
            ) : (
              <div className="space-y-3">
                {byRegion.byRegion.map((r: any) => (
                  <div key={r.neighborhood}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700">{r.neighborhood}</span>
                      <span className="text-xs font-semibold text-gray-600">{r.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#002776]" style={{ width: `${Math.max(4, (r.count / Math.max(1, ...byRegion.byRegion.map((x: any) => x.count))) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {byRegion.withoutRegion > 0 && (
                  <p className="text-xs text-gray-400 pt-1">+{byRegion.withoutRegion} solicitação(ões) sem bairro identificado</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTopic} onOpenChange={(open) => !open && setSelectedTopic(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eleitores que perguntaram sobre {selectedTopic?.name}</DialogTitle></DialogHeader>
          {l11 ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : !topicContacts || topicContacts.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum eleitor encontrado</div>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {topicContacts.map((c: any) => (
                <Link
                  key={c.conversationId}
                  href={`/chat?conversationId=${c.conversationId}`}
                  onClick={() => setSelectedTopic(null)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                    {(c.name || c.phone || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name || c.phone || 'Sem nome'}</div>
                    {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Trend({ value, prev }: { value?: number; prev?: number }) {
  if (value === undefined || prev === undefined || prev === 0) return null
  const diff = value - prev
  const pct = Math.round(Math.abs(diff / prev) * 100)
  if (diff === 0) return null
  return <span className={cn('text-xs font-medium', diff > 0 ? 'text-green-600' : 'text-red-500')}>{diff > 0 ? '+' : '-'}{pct}%</span>
}
