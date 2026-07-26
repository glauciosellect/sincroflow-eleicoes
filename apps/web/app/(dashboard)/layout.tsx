'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Sidebar } from '@/components/shared/sidebar'
import { Topbar } from '@/components/shared/topbar'
import { MascoteHelper } from '@/components/shared/mascote-helper'
import { TutorialPanel } from '@/components/shared/tutorial-panel'
import { useSocketConnect } from '@/hooks/use-socket'
import api from '@/lib/api'
import { AlertTriangle, Clock } from 'lucide-react'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const candidate = useAuthStore((s) => s.candidate)
  const role = useAuthStore((s) => s.role)
  const [hydrated, setHydrated] = useState(false)

  useSocketConnect()

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !user) router.push('/login')
  }, [hydrated, user, router])

  // Agente de Campo só acessa rotas de campo — qualquer outra redireciona
  const AGENTE_CAMPO_ROUTES = ['/meu-desempenho', '/consultor-fatos', '/pesquisa', '/mapa-apoiadores']
  const isAgenteRoute = AGENTE_CAMPO_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  useEffect(() => {
    if (hydrated && role === 'AGENTE_CAMPO' && !isAgenteRoute) {
      router.replace('/meu-desempenho')
    }
  }, [hydrated, role, isAgenteRoute, router])

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing').then(r => r.data),
    enabled: hydrated && !!user,
    staleTime: 5 * 60 * 1000,
  })

  if (!hydrated || !user) return null

  const isSuspended = candidate?.status === 'SUSPENDED'

  // Permite acessar apenas /billing quando a conta está suspensa
  const isBillingPage = pathname.startsWith('/billing')
  const isSettingsPage = pathname.startsWith('/settings')

  // Módulo 8: aviso regressivo até a data-limite de ativação da campanha — some quando
  // já ativou, quando já passou do prazo (nesse caso o bloqueio de RBAC já cuida), ou
  // quando o usuário já está em Configurações/Financeiro resolvendo isso.
  const showActivationBanner = !!billing && !billing.campaignActivated && !billing.isPastActivationDeadline && !isSettingsPage
  const daysLeft = billing?.daysUntilActivationDeadline ?? null

  return (
    <div className="flex h-screen h-dvh bg-[hsl(var(--background))]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />

        {/* Banner conta suspensa — aparece em todas as páginas exceto Configurações */}
        {isSuspended && !isBillingPage && (
          <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Sua assinatura está com pendência. Regularize o pagamento para continuar usando o assistente.</span>
            </div>
            <Link
              href="/billing"
              className="shrink-0 bg-white text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              Ver pagamento
            </Link>
          </div>
        )}

        {/* Faixa suave de lembrete regressivo — Ativação da Campanha (Módulo 8) */}
        {!isSuspended && showActivationBanner && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                Ative o SyncroFlowEleições para não sofrer bloqueio
                {daysLeft !== null && <>, restam <strong>{daysLeft} dia{daysLeft === 1 ? '' : 's'}</strong></>}.
              </span>
            </div>
            <Link
              href="/settings?tab=billing"
              className="shrink-0 bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
            >
              Ativar agora
            </Link>
          </div>
        )}

        {role !== 'AGENTE_CAMPO' && <MascoteHelper />}
        {role !== 'AGENTE_CAMPO' && <TutorialPanel />}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {isSuspended && !isBillingPage ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <AlertTriangle className="w-12 h-12 text-red-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-800">Acesso suspenso</h2>
                <p className="text-gray-500 mt-1 max-w-sm">
                  Sua assinatura está com pendência de pagamento. Regularize para voltar a usar o SyncroFlowEleições.
                </p>
              </div>
              <Link
                href="/billing"
                className="bg-[#002776] text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                Resolver pagamento
              </Link>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  )
}
