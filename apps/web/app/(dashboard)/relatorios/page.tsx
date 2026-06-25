'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Users, MessageSquare, FileWarning, Activity, Construction } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

const periodOptions = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
]

const channelIcon: Record<string, string> = { WHATSAPP: '📱', INSTAGRAM: '📸', FACEBOOK: '📘', TELEGRAM: '✈️', EMAIL: '📧' }
const REQUEST_STATUS_LABELS: Record<string, string> = { RECEIVED: 'Recebido', ANALYZING: 'Em análise', FORWARDED: 'Encaminhado', RESOLVED: 'Resolvido' }

// Relatórios ainda não implementados (exigem infra adicional — NLP de temas,
// geolocalização, análise de sentimento): seção 4.9 da spec, itens 2, 3, 5, 6, 7.
const PENDING_REPORTS = [
  'Temas Mais Perguntados',
  'Mapa de Solicitações por Região',
  'Sentimento dos Eleitores',
  'Perguntas Sem Resposta (Gaps de Conteúdo)',
  'Horários de Pico',
]

export default function RelatoriosPage() {
  const [period, setPeriod] = useState(7)
  const end = new Date().toISOString()
  const start = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()
  const prevEnd = start
  const prevStart = new Date(Date.now() - 2 * period * 24 * 60 * 60 * 1000).toISOString()

  const { data: overview, isLoading: l1 } = useQuery({
    queryKey: ['report-overview', period],
    queryFn: () => api.get('/analytics/overview', { params: { start, end } }).then(r => r.data),
  })

  const { data: prevOverview } = useQuery({
    queryKey: ['report-overview-prev', period],
    queryFn: () => api.get('/analytics/overview', { params: { start: prevStart, end: prevEnd } }).then(r => r.data),
  })

  const { data: byChannel, isLoading: l2 } = useQuery({
    queryKey: ['report-by-channel', period],
    queryFn: () => api.get('/analytics/by-channel', { params: { start, end } }).then(r => r.data),
  })

  const { data: topContacts, isLoading: l3 } = useQuery({
    queryKey: ['report-top-contacts'],
    queryFn: () => api.get('/analytics/top-contacts').then(r => r.data),
  })

  const { data: timeline, isLoading: l4 } = useQuery({
    queryKey: ['report-timeline', period],
    queryFn: () => api.get('/analytics/timeline', { params: { start, end } }).then(r => r.data),
  })

  const { data: requestsStatus, isLoading: l5 } = useQuery({
    queryKey: ['report-requests-status'],
    queryFn: () => api.get('/analytics/requests-status').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Use estes dados para definir sua agenda de rua — vá onde os eleitores estão pedindo.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {periodOptions.map((o) => (
            <button key={o.days} onClick={() => setPeriod(o.days)} className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all', period === o.days ? 'bg-white text-[#002776] shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

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
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5 text-gray-700"><span>{channelIcon[c.type] || '📡'}</span>{c.name}</span>
                      <span className="text-xs font-semibold text-gray-600">{c.count} conv.</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-[#002776]" style={{ width: `${Math.max(4, (c.count / Math.max(1, ...byChannel.map((x: any) => x.count))) * 100)}%` }} />
                    </div>
                  </div>
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
                  <div key={key} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900">{requestsStatus?.[key] ?? 0}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Relatório 8: Eleitores Mais Engajados */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Eleitores Mais Engajados (Top 20)</CardTitle></CardHeader>
        <CardContent>
          {l3 ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : (!topContacts || topContacts.length === 0) ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum dado ainda</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {topContacts.map((c: any, i: number) => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                    {(c.name || c.phone)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name || c.phone}</div>
                    <div className="text-xs text-gray-400">{c.totalInteractions} interações</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relatórios pendentes — transparência sobre o que ainda falta */}
      <Card className="border-dashed">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Construction className="w-4 h-4" />
            <span className="text-sm font-semibold">Em desenvolvimento</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PENDING_REPORTS.map((r) => (
              <span key={r} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">{r}</span>
            ))}
          </div>
        </CardContent>
      </Card>
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
