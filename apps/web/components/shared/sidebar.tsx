'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, FileText, Users, MessageSquare, Contact, Settings, CalendarDays, X, Menu, BarChart3, FileWarning, Image as ImageIcon, Plug, Award, ShieldCheck, Map, Globe, Sparkles, Radar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useState, useEffect } from 'react'

type TeamRole = 'ADMINISTRADOR' | 'ATENDIMENTO' | 'CONTEUDO' | 'RELATORIOS' | 'AGENTE_CAMPO'

// Módulos liberados por role (espelha lib/rbac.ts do backend — seção 4.10 da spec)
const ROLE_MODULES: Record<TeamRole, string[]> = {
  ADMINISTRADOR: ['story', 'platform', 'chat', 'contacts', 'agenda', 'reports', 'settings', 'team', 'field_agent', 'portal'],
  ATENDIMENTO: ['chat', 'contacts', 'agenda'],
  CONTEUDO: ['story', 'platform', 'agenda'],
  RELATORIOS: ['contacts', 'reports'],
  AGENTE_CAMPO: ['field_agent'],
}

const navItems = [
  { section: 'VISÃO GERAL', items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: null }] },
  { section: 'CADASTRO DO AGENTE', items: [{ href: '/agents', label: 'Minha História e Propostas', icon: FileText, module: 'story' }] },
  { section: 'ATENDIMENTO', items: [
    { href: '/chat', label: 'Chat', icon: MessageSquare, module: 'chat' },
    { href: '/contacts', label: 'Contatos', icon: Contact, module: 'contacts' },
    { href: '/solicitacoes', label: 'Solicitações', icon: FileWarning, module: 'chat' },
  ] },
  { section: 'AGENDA', items: [
    { href: '/agenda', label: 'Agenda', icon: CalendarDays, module: 'agenda' },
    { href: '/integrations', label: 'Integrações', icon: Plug, module: 'agenda' },
  ] },
  { section: 'GESTÃO', items: [
    { href: '/relatorios', label: 'Relatórios', icon: BarChart3, module: 'reports' },
    { href: '/team', label: 'Equipe', icon: Users, module: 'team' },
    { href: '/equipe/coordenadores', label: 'Coordenadores', icon: Users, module: 'team' },
    { href: '/agents?tab=Criativos', label: 'Criativos', icon: ImageIcon, module: 'story' },
    { href: '/meu-desempenho', label: 'Meu Desempenho', icon: Award, module: 'field_agent' },
    { href: '/consultor-fatos', label: 'Consultor de Fatos', icon: ShieldCheck, module: 'field_agent' },
    { href: '/mapa-apoiadores', label: 'Mapa de Apoiadores', icon: Map, module: 'reports' },
    { href: '/portal', label: 'Portal do Eleitor', icon: Globe, module: 'portal' },
    { href: '/conteudo', label: 'Conteúdo com IA', icon: Sparkles, module: 'platform' },
    { href: '/radar', label: 'Radar Político', icon: Radar, module: 'reports' },
  ] },
  { section: 'SISTEMA', items: [{ href: '/settings', label: 'Configurações', icon: Settings, module: 'settings' }] },
]

const PLAN_LABELS: Record<string, string> = { CAMPAIGN: 'Plano Campanha', MANDATE: 'Plano Mandato' }

export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const { candidate, role } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const allowedModules = role ? ROLE_MODULES[role as TeamRole] ?? [] : []
  const activeMsgsRemaining = candidate
    ? Math.max(0, candidate.activeMsgsIncluded + candidate.activeMsgsExtra - candidate.activeMsgsUsed)
    : 0

  useEffect(() => { setMobileOpen(false) }, [pathname])

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[hsl(var(--sidebar-bg))]">
      {/* Logo */}
      <div className="px-3 py-3 border-b border-[hsl(var(--sidebar-border))] flex items-center justify-between shrink-0">
        <div className="flex-1 flex items-center justify-center">
          <span className="font-bold text-base tracking-tight" style={{ color: '#009C3B' }}>
            SyncroFlow<span style={{ color: '#FFDF00' }}>Eleições</span>
          </span>
        </div>
        <button
          className="md:hidden p-1.5 rounded-md text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] transition-colors shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Candidato */}
      <div className="px-3 py-3 border-b border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="text-[10px] font-semibold text-[hsl(var(--sidebar-section))] uppercase tracking-widest mb-2 px-2">
          MINHA CAMPANHA
        </div>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-[hsl(var(--sidebar-hover-bg))]">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #009C3B 0%, #002776 100%)' }}
          >
            {candidate?.name?.[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-[hsl(var(--sidebar-fg))] truncate leading-tight">
            {candidate?.name}
          </span>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {navItems.map((group) => {
          const visibleItems = group.items.filter((item) => {
            // Dashboard (module: null) é visível a todos os roles, exceto Agente de
            // Campo — que só acessa 'field_agent', mesmo o Dashboard geral não sendo
            // um módulo "fechável" como os demais.
            if (item.href === '/dashboard' && role === 'AGENTE_CAMPO') return false
            return !item.module || allowedModules.includes(item.module)
          })
          if (visibleItems.length === 0) return null
          return (
            <div key={group.section}>
              <div className="text-[10px] font-semibold text-[hsl(var(--sidebar-section))] uppercase tracking-widest px-2 mb-1.5">
                {group.section}
              </div>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const [itemPath, itemQuery] = item.href.split('?')
                  const itemTab = itemQuery ? new URLSearchParams(itemQuery).get('tab') : null
                  const active = pathname === itemPath && (itemTab ? tabParam === itemTab : !tabParam)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        active
                          ? 'bg-[hsl(var(--sidebar-active-bg))] text-[hsl(var(--sidebar-active-fg))] shadow-sm'
                          : 'text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover-bg))] hover:text-[hsl(var(--sidebar-active-fg))]'
                      )}
                    >
                      <item.icon className={cn('w-4 h-4 shrink-0', active ? 'opacity-100' : 'opacity-60')} />
                      {item.label}
                      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#009C3B] shrink-0" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Rodapé */}
      <div className="px-3 py-3 border-t border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="text-[11px] text-[hsl(var(--sidebar-section))] text-center">
          {candidate ? PLAN_LABELS[candidate.plan] : ''} · {activeMsgsRemaining.toLocaleString()} mensagens ativas restantes
        </div>
      </div>
    </div>
  )

  return (
    <>
      <button
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-[hsl(var(--sidebar-bg))] rounded-lg shadow-lg border border-[hsl(var(--sidebar-border))]"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu"
      >
        <Menu className="w-5 h-5 text-[hsl(var(--sidebar-fg))]" />
      </button>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className="hidden md:flex w-60 flex-col h-full shrink-0 border-r border-[hsl(var(--sidebar-border))]">
        <SidebarContent />
      </aside>

      <aside className={cn(
        'md:hidden fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[280px] flex flex-col h-full transition-transform duration-300 ease-in-out border-r border-[hsl(var(--sidebar-border))]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent />
      </aside>
    </>
  )
}
