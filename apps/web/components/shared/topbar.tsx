'use client'
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Bell, LogOut, Settings, Key, AlertTriangle, ShieldAlert, Flame, FileWarning, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/shared/theme-provider'

interface Alert {
  type: 'peak' | 'content_gap' | 'urgent' | 'tse_deactivation'
  message: string
  data?: Record<string, any>
}

const ALERT_ICONS: Record<Alert['type'], typeof AlertTriangle> = {
  urgent: AlertTriangle,
  tse_deactivation: ShieldAlert,
  peak: Flame,
  content_gap: FileWarning,
}

// Para onde cada tipo de alerta leva ao ser clicado — sem isso, com volume alto de
// alertas, a equipe não consegue localizar manualmente a conversa/tema na lista.
function alertHref(alert: Alert): string {
  switch (alert.type) {
    case 'urgent':
      return alert.data?.conversationId ? `/chat?conversationId=${alert.data.conversationId}` : '/chat'
    case 'peak':
    case 'content_gap':
      return '/relatorios'
    case 'tse_deactivation':
      return '/settings?tab=compliance'
  }
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ['alerts-notify'],
    queryFn: () => api.get('/alerts').then(r => r.data),
    refetchInterval: 5 * 60_000,
    staleTime: 3 * 60_000,
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const urgent = alerts.filter(a => a.type === 'urgent')
  const others = alerts.filter(a => a.type !== 'urgent').slice(0, 8)
  const total = alerts.length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          open
            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
            : 'text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
        )}
      >
        <Bell className={cn('w-4 h-4', urgent.length > 0 ? 'text-red-500' : '')} />
        {total > 0 && (
          <span className={cn(
            'absolute -top-0.5 -right-0.5 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1',
            urgent.length > 0 ? 'bg-red-500' : 'bg-[hsl(var(--primary))]'
          )}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[hsl(var(--card))] rounded-xl shadow-xl border border-[hsl(var(--border))] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
            <span className="font-semibold text-[hsl(var(--card-foreground))] text-sm">Alertas</span>
          </div>

          {total === 0 ? (
            <div className="py-8 text-center text-[hsl(var(--muted-foreground))] text-sm">
              <Bell className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Nenhum alerta
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[hsl(var(--border))]">
              {[...urgent, ...others].map((alert, i) => {
                const Icon = ALERT_ICONS[alert.type]
                const isCritical = alert.type === 'urgent' || alert.type === 'tse_deactivation'
                return (
                  <Link
                    key={i}
                    href={alertHref(alert)}
                    onClick={() => setOpen(false)}
                    className={cn('flex items-start gap-3 px-4 py-3 transition-colors', isCritical ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-[hsl(var(--accent))]')}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', isCritical ? 'text-red-500' : 'text-[hsl(var(--primary))]')} />
                    <div className="flex-1 min-w-0 text-sm text-[hsl(var(--card-foreground))]">{alert.message}</div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-[hsl(var(--foreground-muted))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors"
      title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

// Espelha apps/api/src/lib/rbac.ts — Agente de Campo não tem acesso a
// Configurações nem Chaves de API (admin-only), mesma regra usada no sidebar.
const SETTINGS_ROLES = ['ADMINISTRADOR', 'ATENDIMENTO', 'CONTEUDO', 'RELATORIOS']

export function Topbar() {
  const { user, candidate, role, logout, refreshToken, setCandidate } = useAuthStore()
  const router = useRouter()
  const canSeeSettings = role ? SETTINGS_ROLES.includes(role) : false
  const isAdmin = role === 'ADMINISTRADOR'
  const qc = useQueryClient()

  // Atualiza o uso de mensagens ativas a cada 2 minutos
  useQuery({
    queryKey: ['active-msgs-usage'],
    queryFn: () => api.get('/billing').then(r => {
      setCandidate({ activeMsgsUsed: r.data.activeMsgsUsed, activeMsgsExtra: r.data.activeMsgsExtra })
      return r.data
    }),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
    enabled: !!candidate,
  })

  const handleLogout = async () => {
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken })
    } catch {}
    logout()
    qc.clear()
    router.push('/login')
  }

  const activeMsgsRemaining = candidate
    ? Math.max(0, candidate.activeMsgsIncluded + candidate.activeMsgsExtra - candidate.activeMsgsUsed)
    : 0
  const total = candidate ? candidate.activeMsgsIncluded + candidate.activeMsgsExtra : 1
  const pct = activeMsgsRemaining / total
  const isLow = pct <= 0.2 && activeMsgsRemaining > 0
  const isEmpty = activeMsgsRemaining <= 0

  return (
    <header className="h-14 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] flex items-center justify-between pl-14 pr-4 md:pl-5 md:pr-5 shrink-0">
      <div />

      <div className="flex items-center gap-1.5">
        {/* Mensagens ativas restantes — não é relevante para o trabalho do Agente de Campo */}
        {role !== 'AGENTE_CAMPO' && (
        <div className="flex items-center gap-1.5 mr-1">
          {isEmpty ? (
            <Link href="/billing" className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1.5 rounded-lg font-medium hover:bg-red-500/20 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              Sem mensagens ativas
            </Link>
          ) : isLow ? (
            <Link href="/billing" className="flex items-center gap-1.5 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-medium">{activeMsgsRemaining.toLocaleString()}</span>
              <span className="hidden sm:inline opacity-70">mensagens ativas</span>
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--foreground-muted))]">
              <MessageCircle className="w-3.5 h-3.5 text-[#009C3B]" />
              <span className="font-semibold text-[hsl(var(--foreground))]">{activeMsgsRemaining.toLocaleString()}</span>
              <span className="hidden sm:inline opacity-60">mensagens ativas</span>
            </div>
          )}
        </div>
        )}

        <ThemeToggle />
        {role !== 'AGENTE_CAMPO' && <NotificationBell />}

        <div className="relative group ml-1">
          <button className="flex items-center gap-2 hover:bg-[hsl(var(--accent))] rounded-lg px-2 py-1.5 transition-colors">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #009C3B 0%, #002776 100%)' }}
            >
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="hidden sm:inline text-sm font-medium text-[hsl(var(--foreground))]">
              {user?.name?.split(' ')[0]}
            </span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-48 bg-[hsl(var(--card))] rounded-xl shadow-xl border border-[hsl(var(--border))] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="p-1.5">
              {isAdmin && (
                <Link href="/api-keys" className="flex items-center gap-2.5 px-3 py-2 text-sm text-[hsl(var(--card-foreground))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                  <Key className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  Chaves de API
                </Link>
              )}
              {canSeeSettings && (
                <Link href="/settings" className="flex items-center gap-2.5 px-3 py-2 text-sm text-[hsl(var(--card-foreground))] rounded-lg hover:bg-[hsl(var(--accent))] transition-colors">
                  <Settings className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                  Configurações
                </Link>
              )}
              {(isAdmin || canSeeSettings) && <hr className="my-1 border-[hsl(var(--border))]" />}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 rounded-lg hover:bg-red-500/10 w-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
