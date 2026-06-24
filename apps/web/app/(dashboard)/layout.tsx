'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Sidebar } from '@/components/shared/sidebar'
import { Topbar } from '@/components/shared/topbar'
import { MascoteHelper } from '@/components/shared/mascote-helper'
import { useSocketConnect } from '@/hooks/use-socket'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const candidate = useAuthStore((s) => s.candidate)
  const [hydrated, setHydrated] = useState(false)

  useSocketConnect()

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !user) router.push('/login')
  }, [hydrated, user, router])

  if (!hydrated || !user) return null

  const isSuspended = candidate?.status === 'SUSPENDED'

  // Permite acessar apenas /billing quando a conta está suspensa
  const isBillingPage = pathname.startsWith('/billing')

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

        <MascoteHelper />
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
