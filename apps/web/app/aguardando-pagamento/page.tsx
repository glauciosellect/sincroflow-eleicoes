'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, CheckCircle2, QrCode, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'

function AguardandoContent() {
  const searchParams = useSearchParams()
  const paymentId = searchParams.get('id')
  const qrImage = searchParams.get('qr')
  const qrPayload = searchParams.get('payload')
  const [copiado, setCopiado] = useState(false)
  const [pago, setPago] = useState(false)

  // Polling de status a cada 5s
  const { data } = useQuery({
    queryKey: ['pix-status', paymentId],
    queryFn: () => axios.get(`${API_URL}/billing/asaas/status-public/${paymentId}`).then(r => r.data),
    refetchInterval: pago ? false : 5000,
    enabled: !!paymentId && !pago,
  })

  useEffect(() => {
    if (data?.status === 'CONFIRMED' || data?.status === 'RECEIVED') {
      setPago(true)
      setTimeout(() => { window.location.href = '/login?payment=success' }, 3000)
    }
  }, [data])

  const copiar = () => {
    if (!qrPayload) return
    navigator.clipboard.writeText(qrPayload)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
  }

  if (pago) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <h1 className="text-2xl font-bold text-gray-900">Pagamento confirmado!</h1>
        <p className="text-gray-500">Sua conta está sendo criada. Redirecionando para o login...</p>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <QrCode className="w-10 h-10 text-[#002776] mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Pague via Pix</h1>
        <p className="text-gray-500 text-sm mt-1">Escaneie o QR Code ou copie o código abaixo</p>
      </div>

      {qrImage && (
        <img
          src={`data:image/png;base64,${qrImage}`}
          alt="QR Code Pix"
          className="w-56 h-56 rounded-xl border border-gray-200 shadow"
        />
      )}

      {qrPayload && (
        <Button variant="outline" onClick={copiar} className="gap-2">
          <Copy className="w-4 h-4" />
          {copiado ? 'Copiado!' : 'Copiar código Pix'}
        </Button>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Aguardando confirmação do pagamento...
      </div>

      <p className="text-xs text-gray-400 text-center max-w-xs">
        Após o pagamento sua conta será criada automaticamente e você receberá acesso ao sistema.
      </p>
    </div>
  )
}

export default function AguardandoPagamentoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>}>
      <AguardandoContent />
    </Suspense>
  )
}
