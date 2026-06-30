'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bot, Users, MessageSquare, AlertTriangle,
  Plug, ShieldAlert, ShieldCheck, Activity, FileWarning,
  ArrowUpRight, ArrowDownRight, Minus, Wifi, WifiOff,
  ThumbsUp, HelpCircle, ThumbsDown, ClipboardList,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

const periodOptions = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
]

const channelIcon: Record<string, string> = {
  WHATSAPP: '📱', INSTAGRAM: '📸', FACEBOOK: '📘', TELEGRAM: '✈️', EMAIL: '📧',
}

const statusLabel: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Com agente', color: 'bg-green-100 text-green-700' },
  URGENT: { label: 'Urgente', color: 'bg-red-100 text-red-700' },
  CLOSED: { label: 'Encerrada', color: 'bg-gray-100 text-gray-500' },
}

function Trend({ value, prev }: { value: number; prev?: number }) {
  if (prev === undefined || prev === 0) return null
  const diff = value - prev
  const pct = Math.round(Math.abs(diff / prev) * 100)
  if (diff > 0) return <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium"><ArrowUpRight className="w-3 h-3" />{pct}%</span>
  if (diff < 0) return <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium"><ArrowDownRight className="w-3 h-3" />{pct}%</span>
  return <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus className="w-3 h-3" />0%</span>
}

function KPICard({ title, value, icon: Icon, sub, prevValue, href, accent, loading }: {
  title: string; value: string | number; icon: any; sub?: string
  prevValue?: number; href?: string; accent?: string; loading?: boolean
}) {
  const content = (
    <Card className={cn('transition-all hover:shadow-md', href && 'cursor-pointer', accent && 'border-l-4')} style={accent ? { borderLeftColor: accent } : {}}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
            <div className="mt-1.5 flex items-end gap-2">
              {loading ? <div className="h-8 w-16 bg-gray-100 animate-pulse rounded" /> : <span className="text-3xl font-bold text-gray-900">{value ?? '—'}</span>}
              {!loading && prevValue !== undefined && <Trend value={Number(value)} prev={prevValue} />}
            </div>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent ? `${accent}15` : '#EFF6FF' }}>
            <Icon className="w-5 h-5" style={{ color: accent || '#002776' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export default function DashboardPage() {
  const { candidate } = useAuthStore()
  const [period, setPeriod] = useState(30)
  const STALE = 5 * 60 * 1000

  const end = new Date().toISOString()
  const start = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString()
  const prevEnd = start
  const prevStart = new Date(Date.now() - 2 * period * 24 * 60 * 60 * 1000).toISOString()

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics-overview', period],
    queryFn: () => api.get('/analytics/overview', { params: { start, end } }).then(r => r.data),
    staleTime: STALE,
  })

  const { data: prevOverview } = useQuery({
    queryKey: ['analytics-overview-prev', period],
    queryFn: () => api.get('/analytics/overview', { params: { start: prevStart, end: prevEnd } }).then(r => r.data),
    staleTime: STALE,
  })

  const { data: timeline } = useQuery({
    queryKey: ['analytics-timeline', period],
    queryFn: () => api.get('/analytics/timeline', { params: { start, end } }).then(r => r.data),
    staleTime: STALE,
  })

  const { data: byChannel } = useQuery({
    queryKey: ['analytics-by-channel', period],
    queryFn: () => api.get('/analytics/by-channel', { params: { start, end } }).then(r => r.data),
    staleTime: STALE,
  })

  const { data: topContacts } = useQuery({
    queryKey: ['analytics-top-contacts'],
    queryFn: () => api.get('/analytics/top-contacts').then(r => r.data),
    staleTime: STALE,
  })

  const { data: realtime, isLoading: loadingRealtime } = useQuery({
    queryKey: ['analytics-realtime'],
    queryFn: () => api.get('/analytics/realtime').then(r => r.data),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts-dashboard'],
    queryFn: () => api.get('/alerts').then(r => r.data),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })

  const { data: surveySummary } = useQuery({
    queryKey: ['survey-summary'],
    queryFn: () => api.get('/surveys/vote/summary').then(r => r.data),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const compliance = realtime?.compliance
  const activeChannels = (realtime?.channels || []).filter((c: any) => c.isActive)
  const inactiveChannels = (realtime?.channels || []).filter((c: any) => !c.isActive)
  const isAgentActive = candidate?.status === 'ACTIVE'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral da sua campanha</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-gray-400 mr-3">Ao vivo</span>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {periodOptions.map((o) => (
              <button key={o.days} onClick={() => setPeriod(o.days)}
                className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all', period === o.days ? 'bg-white text-[#002776] shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status do agente (destaque, topo) */}
      <div className={cn('rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 border-2',
        compliance?.mustBeDeactivated ? 'bg-red-50 border-red-200' : isAgentActive ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200')}>
        <div className="flex items-center gap-3">
          {compliance?.mustBeDeactivated ? <ShieldAlert className="w-6 h-6 text-red-600" /> : isAgentActive ? <ShieldCheck className="w-6 h-6 text-green-600" /> : <AlertTriangle className="w-6 h-6 text-amber-600" />}
          <div>
            <div className="font-bold text-gray-900">
              {compliance?.mustBeDeactivated ? 'DESATIVADO-TSE' : isAgentActive ? 'ATIVO' : 'PAUSADO'}
            </div>
            {compliance?.round && !compliance.mustBeDeactivated && (
              <div className="text-xs text-gray-500">Desativação automática em {compliance.daysUntilDeactivation} dia(s) — conformidade TSE</div>
            )}
          </div>
        </div>
        <Link href="/agents" className="text-xs font-semibold text-[#002776] hover:underline">Gerenciar assistente →</Link>
      </div>

      {/* Status em tempo real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #002776, #00509e)' }}>
          <div className="flex items-center justify-between mb-2"><MessageSquare className="w-5 h-5 opacity-80" /><span className="text-xs opacity-60">Agora</span></div>
          <div className="text-3xl font-bold">{loadingRealtime ? '—' : (realtime?.openConversations ?? 0)}</div>
          <div className="text-xs opacity-70 mt-1">Conversas abertas</div>
        </div>
        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #B91C1C, #DC2626)' }}>
          <div className="flex items-center justify-between mb-2"><AlertTriangle className="w-5 h-5 opacity-80" /><span className="text-xs opacity-60">Agora</span></div>
          <div className="text-3xl font-bold">{loadingRealtime ? '—' : (realtime?.urgentConversations ?? 0)}</div>
          <div className="text-xs opacity-70 mt-1">Conversas urgentes</div>
        </div>
        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #009C3B, #00702a)' }}>
          <div className="flex items-center justify-between mb-2"><Plug className="w-5 h-5 opacity-80" /><span className="text-xs opacity-60">Canais</span></div>
          <div className="text-3xl font-bold">{loadingRealtime ? '—' : activeChannels.length}</div>
          <div className="text-xs opacity-70 mt-1">{inactiveChannels.length > 0 ? `${inactiveChannels.length} inativo(s)` : 'Todos ativos'}</div>
        </div>
        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #6A1B9A, #4A148C)' }}>
          <div className="flex items-center justify-between mb-2"><Users className="w-5 h-5 opacity-80" /><span className="text-xs opacity-60">24h</span></div>
          <div className="text-3xl font-bold">{loadingRealtime ? '—' : (realtime?.newContactsToday ?? 0)}</div>
          <div className="text-xs opacity-70 mt-1">Novos eleitores hoje</div>
        </div>
      </div>

      {/* Alertas automáticos */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert: any, i: number) => (
            <div key={i} className={cn('flex items-center gap-3 rounded-xl p-3 text-sm border',
              alert.type === 'urgent' || alert.type === 'tse_deactivation' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>
              <FileWarning className="w-4 h-4 shrink-0" />
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs do período */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Período: {periodOptions.find(o => o.days === period)?.label}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Conversas" value={overview?.conversations ?? '—'} icon={MessageSquare} prevValue={prevOverview?.conversations} accent="#002776" loading={loadingOverview} />
          <KPICard title="Novos Eleitores" value={overview?.newContacts ?? '—'} icon={Users} prevValue={prevOverview?.newContacts} accent="#009C3B" loading={loadingOverview} href="/contacts" />
          <KPICard title="Solicitações" value={overview?.requests ?? '—'} icon={FileWarning} prevValue={prevOverview?.requests} accent="#E65100" loading={loadingOverview} />
          <KPICard title="Taxa de Resolução" value={overview ? `${overview.resolutionRate}%` : '—'} icon={Activity} accent="#6A1B9A" loading={loadingOverview} />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Conversas por dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline || []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#002776" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#002776" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [v, 'Conversas']} labelFormatter={v => `Dia ${v}`} />
                <Area type="monotone" dataKey="count" stroke="#002776" strokeWidth={2} fill="url(#gradConv)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Por canal</CardTitle></CardHeader>
          <CardContent>
            {(!byChannel || byChannel.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                <Plug className="w-8 h-8 mb-2" /><span className="text-sm">Sem dados</span>
              </div>
            ) : (
              <div className="space-y-3 mt-1">
                {byChannel.slice(0, 6).map((c: any, i: number) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5 text-gray-700"><span>{channelIcon[c.type] || '📡'}</span><span className="truncate max-w-[120px]">{c.name}</span></span>
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
      </div>

      {/* Eleitores engajados + Canais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Eleitores Mais Engajados</CardTitle>
            <Link href="/contacts" className="text-xs text-[#002776] hover:underline font-medium">Ver todos →</Link>
          </CardHeader>
          <CardContent>
            {(!topContacts || topContacts.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm"><Bot className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhum dado ainda</p></div>
            ) : (
              <div className="space-y-3">
                {topContacts.slice(0, 5).map((contact: any, i: number) => (
                  <div key={contact.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                      {(contact.name || contact.phone)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{contact.name || contact.phone}</div>
                      <div className="text-xs text-gray-400">{contact.totalInteractions} interações</div>
                    </div>
                    <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Canais</CardTitle>
            <Link href="/settings?tab=channels" className="text-xs text-[#002776] hover:underline font-medium">Configurar →</Link>
          </CardHeader>
          <CardContent>
            {(!realtime?.channels || realtime.channels.length === 0) ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Plug className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhum canal conectado</p>
                <Link href="/settings?tab=channels" className="text-[#002776] text-xs mt-1 block hover:underline">Conectar canal →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {realtime.channels.map((ch: any) => (
                  <div key={ch.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-xl">{channelIcon[ch.type] || '📡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{ch.name}</div>
                      <div className="text-xs text-gray-400">{ch.type}</div>
                    </div>
                    {ch.isActive ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Wifi className="w-3 h-3" />Ativo</span> : <span className="flex items-center gap-1 text-xs text-gray-400"><WifiOff className="w-3 h-3" />Inativo</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Termômetro de intenção de voto */}
      {surveySummary && surveySummary.totals.total > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />Termômetro — Intenção de Voto
            </CardTitle>
            <Link href="/meu-desempenho" className="text-xs text-[#002776] hover:underline font-medium">Ver detalhes →</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex rounded-full overflow-hidden h-4">
                {surveySummary.percentages.apoiador > 0 && <div className="bg-green-500" style={{ width: `${surveySummary.percentages.apoiador}%` }} />}
                {surveySummary.percentages.indeciso > 0 && <div className="bg-amber-400" style={{ width: `${surveySummary.percentages.indeciso}%` }} />}
                {surveySummary.percentages.critico > 0 && <div className="bg-red-500" style={{ width: `${surveySummary.percentages.critico}%` }} />}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-green-50 rounded-lg p-2 flex flex-col items-center gap-0.5">
                  <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                  <div className="text-xl font-bold text-green-700">{surveySummary.totals.apoiador}</div>
                  <div className="text-xs text-green-600">{surveySummary.percentages.apoiador}% Apoiadores</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 flex flex-col items-center gap-0.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  <div className="text-xl font-bold text-amber-700">{surveySummary.totals.indeciso}</div>
                  <div className="text-xs text-amber-600">{surveySummary.percentages.indeciso}% Indecisos</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2 flex flex-col items-center gap-0.5">
                  <ThumbsDown className="w-3.5 h-3.5 text-red-600" />
                  <div className="text-xl font-bold text-red-700">{surveySummary.totals.critico}</div>
                  <div className="text-xs text-red-600">{surveySummary.percentages.critico}% Críticos</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">{surveySummary.totals.total} eleitores pesquisados nos últimos 30 dias</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atividade recente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Conversas recentes</CardTitle>
          <Link href="/chat" className="text-xs text-[#002776] hover:underline font-medium">Ver chat →</Link>
        </CardHeader>
        <CardContent>
          {(!realtime?.recentConversations || realtime.recentConversations.length === 0) ? (
            <div className="text-center py-8 text-gray-400 text-sm"><Activity className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhuma atividade</p></div>
          ) : (
            <div className="space-y-2">
              {realtime.recentConversations.map((conv: any) => {
                const st = statusLabel[conv.status] || statusLabel.ACTIVE
                return (
                  <Link href="/chat" key={conv.id}>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0">{channelIcon[conv.channel?.type] || '💬'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">{conv.contact?.name || conv.contact?.phone || 'Desconhecido'}</div>
                      </div>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', st.color)}>{st.label}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
