'use client'
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ExternalLink, Unplug, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function IntegrationsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { token, refreshToken, candidate } = useAuthStore()
  const searchParams = useSearchParams()

  const { data: googleStatus, refetch: refetchGoogle } = useQuery({
    queryKey: ['google-integration'],
    queryFn: () => api.get('/integrations/google').then(r => r.data),
  })

  useEffect(() => {
    const result = searchParams.get('google')
    if (result === 'success') { refetchGoogle(); toast({ title: 'Google Calendar conectado!' }) }
    if (result === 'error') toast({ title: 'Erro ao conectar Google Calendar', variant: 'destructive' })
  }, [searchParams])

  const disconnectGoogleMutation = useMutation({
    mutationFn: () => api.delete('/integrations/google'),
    onSuccess: () => { refetchGoogle(); toast({ title: 'Google Calendar desconectado' }) },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
        <p className="text-sm text-gray-500 mt-1">
          O assistente eleitoral integra apenas com o Google Calendar, para informar seus compromissos públicos aos eleitores.
        </p>
      </div>

      <div className={cn('p-5 border rounded-2xl bg-white space-y-3', googleStatus?.connected ? 'border-green-200' : 'border-gray-200')}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white border flex items-center justify-center shrink-0 shadow-sm">
              <svg viewBox="0 0 24 24" className="w-6 h-6">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" fill="#4285F4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">Google Calendar</p>
                {googleStatus?.connected ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                    <CheckCircle className="w-3 h-3" /> Conectado
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Não conectado</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {googleStatus?.connected
                  ? `Conta: ${googleStatus.email}${googleStatus.tokenExpired ? ' · Token expirado' : ''}`
                  : 'Eventos públicos da sua agenda são importados automaticamente a cada 30 minutos'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {googleStatus?.connected ? (
              <>
                {googleStatus.tokenExpired && (
                  <Button size="sm" className="text-xs bg-[#4285F4] hover:bg-[#3367D6] text-white"
                    onClick={() => { window.location.href = `${API_URL}/integrations/google/connect?token=${refreshToken || token}&wid=${candidate?.id || ''}` }}>
                    Reconectar
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-xs text-red-600 hover:bg-red-50 border-red-200"
                  onClick={() => disconnectGoogleMutation.mutate()} disabled={disconnectGoogleMutation.isPending}>
                  {disconnectGoogleMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3 mr-1" />}
                  Desconectar
                </Button>
              </>
            ) : (
              <Button size="sm" className="text-xs bg-[#4285F4] hover:bg-[#3367D6] text-white"
                onClick={() => { window.location.href = `${API_URL}/integrations/google/connect?token=${refreshToken || token}&wid=${candidate?.id || ''}` }}>
                <ExternalLink className="w-3 h-3 mr-1" /> Conectar
              </Button>
            )}
          </div>
        </div>
        {googleStatus?.connected && (
          <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
            O assistente nunca cria, altera ou cancela eventos — apenas informa os compromissos já cadastrados ou importados desta agenda.
          </p>
        )}
      </div>
    </div>
  )
}
