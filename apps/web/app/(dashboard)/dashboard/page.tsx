'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bot, Users, MessageSquare, AlertTriangle,
  Plug, ShieldAlert, ShieldCheck, Activity, FileWarning,
  ArrowUpRight, ArrowDownRight, Minus, Wifi, WifiOff,
  ThumbsUp, HelpCircle, ThumbsDown, ClipboardList, X,
  MapPin, Trophy, TrendingUp, UserCheck, Target,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
  RadialBarChart, RadialBar,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
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

const INTENÇÃO_COLORS = { apoiador: '#22c55e', indeciso: '#f59e0b', critico: '#ef4444' }
const CANAL_COLORS = ['#002776', '#009C3B', '#6A1B9A', '#E65100', '#0ea5e9', '#64748b']

function Trend({ value, prev }: { value: number; prev?: number }) {
  if (prev === undefined || prev === 0) return null
  const diff = value - prev
  const pct = Math.round(Math.abs(diff / prev) * 100)
  if (diff > 0) return <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium"><ArrowUpRight className="w-3 h-3" />{pct}%</span>
  if (diff < 0) return <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium"><ArrowDownRight className="w-3 h-3" />{pct}%</span>
  return <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus className="w-3 h-3" />0%</span>
}

function KPICard({ title, value, icon: Icon, sub, prevValue, href, gradient, loading }: {
  title: string; value: string | number; icon: any; sub?: string
  prevValue?: number; href?: string; gradient: string; loading?: boolean
}) {
  const content = (
    <div className={cn('rounded-2xl p-5 text-white relative overflow-hidden cursor-default transition-transform hover:-translate-y-0.5', href && 'cursor-pointer')} style={{ background: gradient }}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
      <div className="absolute -right-1 -bottom-6 w-16 h-16 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-white/70 uppercase tracking-wide">{title}</p>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20">
            <Icon className="w-4.5 h-4.5 text-white" />
          </div>
        </div>
        {loading
          ? <div className="h-9 w-20 bg-white/20 animate-pulse rounded-lg" />
          : <div className="text-3xl font-bold leading-none">{value ?? '—'}</div>
        }
        <div className="mt-2 flex items-center gap-2">
          {sub && <p className="text-xs text-white/60">{sub}</p>}
          {!loading && prevValue !== undefined && (
            <span className="text-xs text-white/80">
              <Trend value={Number(value)} prev={prevValue} />
            </span>
          )}
        </div>
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export default function DashboardPage() {
  const { candidate } = useAuthStore()
  const [period, setPeriod] = useState(30)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const qc = useQueryClient()
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
    refetchInterval: 2 * 60 * 1000,
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
    refetchInterval: 3 * 60 * 1000,
  })

  const { data: lideresStats } = useQuery({
    queryKey: ['lideres-stats-dash'],
    queryFn: () => api.get('/lideres/stats').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: lideresRanking } = useQuery({
    queryKey: ['lideres-ranking-dash'],
    queryFn: () => api.get('/lideres/ranking').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const unurgentMutation = useMutation({
    mutationFn: (conversationId: string) => api.post(`/conversations/${conversationId}/unurgent`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts-dashboard'] }),
  })

  const dismissAlert = (alert: any) => {
    setDismissedAlerts(prev => { const s = new Set(prev); s.add(alert.message); return s })
    if (alert.type === 'urgent' && alert.data?.conversationId) {
      unurgentMutation.mutate(alert.data.conversationId)
    }
  }

  const visibleAlerts = alerts.filter((a: any) => !dismissedAlerts.has(a.message))
  const compliance = realtime?.compliance
  const activeChannels = (realtime?.channels || []).filter((c: any) => c.isActive)
  const inactiveChannels = (realtime?.channels || []).filter((c: any) => !c.isActive)
  const isAgentActive = candidate?.status === 'ACTIVE'

  // Dados para gráfico de pizza de intenção de voto
  const intentPieData = surveySummary?.totals?.total > 0 ? [
    { name: 'Apoiadores', value: surveySummary.totals.apoiador, color: INTENÇÃO_COLORS.apoiador },
    { name: 'Indecisos', value: surveySummary.totals.indeciso, color: INTENÇÃO_COLORS.indeciso },
    { name: 'Críticos', value: surveySummary.totals.critico, color: INTENÇÃO_COLORS.critico },
  ] : []

  // Dados para gráfico de barras de canais
  const channelBarData = (byChannel || []).slice(0, 6).map((c: any) => ({
    name: c.name?.slice(0, 10) || c.type,
    conversas: c.count,
  }))

  // Top líderes
  const topLideres = (lideresRanking?.lideres || []).slice(0, 5)
  const alertasLideres = lideresRanking?.alertas || []

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral da campanha • atualiza automaticamente</p>
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

      {/* ── Status do Agente ──────────────────────────────────────── */}
      <div className={cn('rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 border-2',
        compliance?.mustBeDeactivated ? 'bg-red-50 border-red-200' : isAgentActive ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200')}>
        <div className="flex items-center gap-3">
          {compliance?.mustBeDeactivated ? <ShieldAlert className="w-6 h-6 text-red-600" /> : isAgentActive ? <ShieldCheck className="w-6 h-6 text-green-600" /> : <AlertTriangle className="w-6 h-6 text-amber-600" />}
          <div>
            <div className="font-bold text-gray-900">
              {compliance?.mustBeDeactivated ? '🔴 DESATIVADO — Compliance TSE' : isAgentActive ? '🟢 AGENTE ATIVO' : '🟡 AGENTE PAUSADO'}
            </div>
            {compliance?.round && !compliance.mustBeDeactivated && (
              <div className="text-xs text-gray-500">Desativação automática em {compliance.daysUntilDeactivation} dia(s) — Resolução TSE nº 23.755/2026</div>
            )}
          </div>
        </div>
        <Link href="/agents" className="text-xs font-semibold text-[#002776] hover:underline">Gerenciar assistente →</Link>
      </div>

      {/* ── Alertas ───────────────────────────────────────────────── */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.slice(0, 5).map((alert: any, i: number) => (
            <div key={i} className={cn('flex items-center gap-3 rounded-xl p-3 text-sm border',
              alert.type === 'urgent' || alert.type === 'tse_deactivation' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800')}>
              <FileWarning className="w-4 h-4 shrink-0" />
              <span className="flex-1">{alert.message}</span>
              {alert.data?.conversationId && (
                <Link href={`/chat?conversation=${alert.data.conversationId}`} className="text-xs font-semibold underline shrink-0">Ver conversa</Link>
              )}
              <button onClick={() => dismissAlert(alert)} className="shrink-0 p-0.5 rounded hover:bg-black/10">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── KPIs Tempo Real (topo, coloridos) ────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tempo Real</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title="Conversas Abertas"
            value={loadingRealtime ? '—' : (realtime?.openConversations ?? 0)}
            icon={MessageSquare}
            sub="agora"
            gradient="linear-gradient(135deg, #002776, #00509e)"
            loading={loadingRealtime}
          />
          <KPICard
            title="Urgentes"
            value={loadingRealtime ? '—' : (realtime?.urgentConversations ?? 0)}
            icon={AlertTriangle}
            sub="requer atenção"
            gradient="linear-gradient(135deg, #B91C1C, #DC2626)"
            href="/chat"
            loading={loadingRealtime}
          />
          <KPICard
            title="Canais Ativos"
            value={loadingRealtime ? '—' : activeChannels.length}
            icon={Plug}
            sub={inactiveChannels.length > 0 ? `${inactiveChannels.length} inativo(s)` : 'todos conectados'}
            gradient="linear-gradient(135deg, #009C3B, #00702a)"
            loading={loadingRealtime}
          />
          <KPICard
            title="Eleitores Hoje"
            value={loadingRealtime ? '—' : (realtime?.newContactsToday ?? 0)}
            icon={Users}
            sub="novos contatos"
            gradient="linear-gradient(135deg, #6A1B9A, #4A148C)"
            href="/contacts"
            loading={loadingRealtime}
          />
        </div>
      </div>

      {/* ── Período: RadialBar (métricas) + Radar (campo) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* RadialBarChart — métricas do período */}
        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Métricas do Período</CardTitle>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{periodOptions.find(o => o.days === period)?.label}</span>
          </CardHeader>
          <CardContent>
            {loadingOverview ? (
              <div className="h-48 bg-gray-50 animate-pulse rounded-xl" />
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <RadialBarChart
                    cx="50%" cy="50%" innerRadius="25%" outerRadius="90%"
                    data={[
                      { name: 'Taxa Resolução', value: overview?.resolutionRate ?? 0, fill: '#6A1B9A' },
                      { name: 'Conversas', value: Math.min(100, Math.round(((overview?.conversations ?? 0) / Math.max(1, (prevOverview?.conversations ?? 1) * 1.2)) * 100)), fill: '#002776' },
                      { name: 'Eleitores', value: Math.min(100, Math.round(((overview?.newContacts ?? 0) / Math.max(1, (prevOverview?.newContacts ?? 1) * 1.2)) * 100)), fill: '#009C3B' },
                      { name: 'Solicitações', value: Math.min(100, Math.round(((overview?.requests ?? 0) / Math.max(1, 50)) * 100)), fill: '#E65100' },
                    ]}
                    startAngle={90} endAngle={-270}
                  >
                    <RadialBar dataKey="value" cornerRadius={6} animationDuration={1000} />
                    <Tooltip formatter={(v: any, name: any) => [`${v}%`, name]} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {[
                    { label: 'Conversas', value: overview?.conversations ?? 0, prev: prevOverview?.conversations, color: '#002776' },
                    { label: 'Novos Eleitores', value: overview?.newContacts ?? 0, prev: prevOverview?.newContacts, color: '#009C3B' },
                    { label: 'Solicitações', value: overview?.requests ?? 0, prev: prevOverview?.requests, color: '#E65100' },
                    { label: 'Resolução', value: `${overview?.resolutionRate ?? 0}%`, color: '#6A1B9A' },
                  ].map((m, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-500">{m.label}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-gray-900">{m.value}</span>
                          {typeof m.prev === 'number' && <Trend value={Number(m.value)} prev={m.prev} />}
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div className="h-1 rounded-full" style={{ width: `${Math.min(100, (Number(m.value) / Math.max(1, Number(m.value) * 1.3)) * 100)}%`, background: m.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RadarChart — perfil da equipe de campo */}
        <Card>
          <CardHeader className="pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Radar da Equipe de Campo</CardTitle>
            <Link href="/lideres" className="text-xs text-[#002776] hover:underline">Ver →</Link>
          </CardHeader>
          <CardContent>
            {lideresStats ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={200}>
                  <RadarChart data={[
                    { metric: 'Membros', A: Math.min(100, (lideresStats.totalLideres ?? 0) * 10) },
                    { metric: 'Votos', A: Math.min(100, (lideresStats.totalVotosComprometidos ?? 0) / 10) },
                    { metric: 'Ações/sem', A: Math.min(100, (lideresStats.atividadesSemana ?? 0) * 5) },
                    { metric: 'Ativos', A: lideresStats.totalLideres > 0 ? Math.round(((lideresStats.totalLideres - (lideresStats.semAtividadeSemana ?? 0)) / lideresStats.totalLideres) * 100) : 0 },
                    { metric: 'Cobertura', A: Math.min(100, (lideresStats.totalLideres ?? 0) * 8) },
                  ]} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#6b7280' }} />
                    <Radar name="Campo" dataKey="A" stroke="#002776" fill="#002776" fillOpacity={0.15} animationDuration={1000} />
                    <Tooltip formatter={(v: any) => [`${v}`, 'Score']} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2.5">
                  {[
                    { label: 'Membros ativos', value: lideresStats.totalLideres ?? 0, color: '#002776', icon: '👥' },
                    { label: 'Votos comprometidos', value: lideresStats.totalVotosComprometidos ?? 0, color: '#009C3B', icon: '🗳️' },
                    { label: 'Ações esta semana', value: lideresStats.atividadesSemana ?? 0, color: '#7c3aed', icon: '⚡' },
                    { label: 'Sem atividade (7d)', value: lideresStats.semAtividadeSemana ?? 0, color: lideresStats.semAtividadeSemana > 0 ? '#dc2626' : '#009C3B', icon: lideresStats.semAtividadeSemana > 0 ? '⚠️' : '✅' },
                  ].map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 flex items-center gap-1"><span>{m.icon}</span>{m.label}</span>
                      <span className="text-sm font-bold" style={{ color: m.color }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                <Users className="w-8 h-8 mb-2" />
                <span className="text-sm text-center">Cadastre líderes para ver o radar</span>
                <Link href="/lideres" className="text-xs text-[#002776] mt-2 hover:underline">Ir para líderes →</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficos Linha 1: Conversas + Intenção de Voto ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Conversas por dia — área */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Conversas por dia</CardTitle>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Atualiza a cada 2 min</span>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeline || []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#002776" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#002776" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) ?? ''} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [v, 'Conversas']} labelFormatter={v => `${v}`} />
                <Area type="monotone" dataKey="count" stroke="#002776" strokeWidth={2} fill="url(#gradConv)" dot={false} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Intenção de voto — pizza */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-gray-400" /> Intenção de Voto
            </CardTitle>
            <Link href="/meu-desempenho" className="text-xs text-[#002776] hover:underline">Ver →</Link>
          </CardHeader>
          <CardContent>
            {intentPieData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={intentPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" animationDuration={800}>
                      {intentPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, name: any) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 w-full gap-1 mt-1">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{surveySummary.totals.apoiador}</div>
                    <div className="text-[10px] text-gray-400">Apoiadores</div>
                    <div className="text-[10px] text-green-500">{surveySummary.percentages.apoiador}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-amber-500">{surveySummary.totals.indeciso}</div>
                    <div className="text-[10px] text-gray-400">Indecisos</div>
                    <div className="text-[10px] text-amber-400">{surveySummary.percentages.indeciso}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-500">{surveySummary.totals.critico}</div>
                    <div className="text-[10px] text-gray-400">Críticos</div>
                    <div className="text-[10px] text-red-400">{surveySummary.percentages.critico}%</div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">{surveySummary.totals.total} eleitores pesquisados</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                <ClipboardList className="w-8 h-8 mb-2" />
                <span className="text-sm text-center">Registre pesquisas de campo para ver aqui</span>
                <Link href="/meu-desempenho" className="text-xs text-[#002776] mt-2 hover:underline">Ir para pesquisa →</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficos Linha 2: Canais (barras) + Ranking Líderes ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Canais — barras */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Conversas por Canal</CardTitle>
            <Link href="/settings?tab=channels" className="text-xs text-[#002776] hover:underline">Configurar →</Link>
          </CardHeader>
          <CardContent>
            {channelBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={channelBarData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="conversas" radius={[4, 4, 0, 0]} animationDuration={800}>
                    {channelBarData.map((_: any, index: number) => (
                      <Cell key={index} fill={CANAL_COLORS[index % CANAL_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300">
                <Plug className="w-8 h-8 mb-2" />
                <span className="text-sm">Sem dados de canais</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking Top Líderes */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" /> Top Líderes da Semana
            </CardTitle>
            <Link href="/lideres" className="text-xs text-[#002776] hover:underline">Ver ranking →</Link>
          </CardHeader>
          <CardContent>
            {topLideres.length > 0 ? (
              <div className="space-y-2.5">
                {topLideres.map((lider: any, i: number) => {
                  const isAlerta = alertasLideres.includes(lider.id)
                  const maxScore = topLideres[0]?.scoreAtividade || 1
                  return (
                    <div key={lider.id} className="flex items-center gap-3">
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white',
                        i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200 text-gray-600'
                      )}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-900 truncate">{lider.nome}</span>
                          <span className="text-xs text-gray-500 shrink-0 ml-2">{lider.scoreAtividade} pts</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className={cn('h-1.5 rounded-full transition-all', isAlerta ? 'bg-red-400' : 'bg-[#009C3B]')}
                            style={{ width: `${Math.max(4, (lider.scoreAtividade / maxScore) * 100)}%` }}
                          />
                        </div>
                      </div>
                      {isAlerta && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                <Trophy className="w-8 h-8 mb-2" />
                <span className="text-sm text-center">Sem líderes cadastrados</span>
                <Link href="/lideres" className="text-xs text-[#002776] mt-2 hover:underline">Cadastrar líderes →</Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Listas (parte de baixo) ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Canais conectados */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Canais</CardTitle>
            <Link href="/settings?tab=channels" className="text-xs text-[#002776] hover:underline font-medium">Configurar →</Link>
          </CardHeader>
          <CardContent>
            {(!realtime?.channels || realtime.channels.length === 0) ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Plug className="w-7 h-7 mx-auto mb-2 opacity-30" /><p>Nenhum canal</p>
                <Link href="/settings?tab=channels" className="text-[#002776] text-xs mt-1 block hover:underline">Conectar →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {realtime.channels.map((ch: any) => (
                  <div key={ch.id} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-lg">{channelIcon[ch.type] || '📡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{ch.name}</div>
                      <div className="text-[10px] text-gray-400">{ch.type}</div>
                    </div>
                    {ch.isActive
                      ? <span className="flex items-center gap-0.5 text-[10px] text-green-600"><Wifi className="w-3 h-3" />Ativo</span>
                      : <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><WifiOff className="w-3 h-3" />Inativo</span>
                    }
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Eleitores mais engajados */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Eleitores Engajados</CardTitle>
            <Link href="/contacts" className="text-xs text-[#002776] hover:underline font-medium">Ver todos →</Link>
          </CardHeader>
          <CardContent>
            {(!topContacts || topContacts.length === 0) ? (
              <div className="text-center py-6 text-gray-400 text-sm"><Bot className="w-7 h-7 mx-auto mb-2 opacity-30" /><p>Nenhum dado</p></div>
            ) : (
              <div className="space-y-2.5">
                {topContacts.slice(0, 5).map((contact: any, i: number) => (
                  <div key={contact.id} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                      {(contact.name || contact.phone)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">{contact.name || contact.phone}</div>
                      <div className="text-[10px] text-gray-400">{contact.totalInteractions} interações</div>
                    </div>
                    <span className="text-xs font-bold text-gray-300">#{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversas recentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Conversas Recentes</CardTitle>
            <Link href="/chat" className="text-xs text-[#002776] hover:underline font-medium">Ver chat →</Link>
          </CardHeader>
          <CardContent>
            {(!realtime?.recentConversations || realtime.recentConversations.length === 0) ? (
              <div className="text-center py-6 text-gray-400 text-sm"><Activity className="w-7 h-7 mx-auto mb-2 opacity-30" /><p>Nenhuma atividade</p></div>
            ) : (
              <div className="space-y-1.5">
                {realtime.recentConversations.map((conv: any) => {
                  const st = statusLabel[conv.status] || statusLabel.ACTIVE
                  return (
                    <Link href="/chat" key={conv.id}>
                      <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50 transition-colors">
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
    </div>
  )
}
