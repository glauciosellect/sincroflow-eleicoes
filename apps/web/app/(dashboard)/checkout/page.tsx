'use client'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle2, QrCode, CreditCard, ExternalLink } from 'lucide-react'

const PLANOS = [
  {
    key: 'deputado_estadual',
    label: 'Deputado Estadual',
    valor: 5990,
    desc: 'Campanha completa para deputado estadual — IA, portal do eleitor, agentes de campo, relatórios.',
  },
  {
    key: 'deputado_federal',
    label: 'Deputado Federal',
    valor: 7490,
    desc: 'Todos os recursos + suporte prioritário para campanha federal.',
  },
  {
    key: 'senador_governador',
    label: 'Senador / Governador',
    valor: 10990,
    desc: 'Solução completa para candidaturas estaduais e federais de alto impacto.',
  },
] as const

type PlanoKey = typeof PLANOS[number]['key']
type FormaPagamento = 'pix' | 'cartao'
type Parcelas = 1 | 2 | 3

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface CheckoutResult {
  type: 'pix' | 'card'
  paymentId: string
  qrCodeImage?: string | null
  qrCodePayload?: string | null
  invoiceUrl?: string | null
  installments?: number
  installmentValue?: number
}

export default function CheckoutPage() {
  const { toast } = useToast()
  const [plano, setPlano] = useState<PlanoKey>('deputado_estadual')
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [parcelas, setParcelas] = useState<Parcelas>(1)
  const [resultado, setResultado] = useState<CheckoutResult | null>(null)
  const [copiado, setCopiado] = useState(false)

  const planoSelecionado = PLANOS.find(p => p.key === plano)!
  const valorParcela = Math.ceil((planoSelecionado.valor / parcelas) * 100) / 100

  const checkoutMutation = useMutation({
    mutationFn: () => api.post('/billing/asaas/checkout', {
      plano,
      formaPagamento: forma,
      parcelas: forma === 'pix' ? 1 : parcelas,
    }).then(r => r.data),
    onSuccess: (data: CheckoutResult) => setResultado(data),
    onError: (e: any) => toast({
      title: 'Erro ao gerar cobrança',
      description: e.response?.data?.error || 'Tente novamente.',
      variant: 'destructive',
    }),
  })

  const copiarPix = () => {
    if (!resultado?.qrCodePayload) return
    navigator.clipboard.writeText(resultado.qrCodePayload)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
  }

  if (resultado) {
    return (
      <div className="max-w-xl mx-auto py-10 space-y-6">
        <div className="text-center space-y-2">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Cobrança gerada!</h1>
          <p className="text-gray-500 text-sm">
            {resultado.type === 'pix'
              ? 'Escaneie o QR Code ou copie o código Pix para pagar.'
              : `Cartão — ${resultado.installments}x de ${fmt(resultado.installmentValue ?? 0)}`}
          </p>
        </div>

        {resultado.type === 'pix' && resultado.qrCodeImage && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={`data:image/png;base64,${resultado.qrCodeImage}`}
              alt="QR Code Pix"
              className="w-56 h-56 rounded-xl border border-gray-200 shadow"
            />
            <Button variant="outline" onClick={copiarPix} className="gap-2">
              <QrCode className="w-4 h-4" />
              {copiado ? 'Copiado!' : 'Copiar código Pix'}
            </Button>
          </div>
        )}

        {resultado.invoiceUrl && (
          <div className="flex justify-center">
            <a href={resultado.invoiceUrl} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2 bg-[#002776] hover:bg-[#001f5e]">
                <ExternalLink className="w-4 h-4" />
                {resultado.type === 'card' ? 'Pagar com cartão' : 'Abrir fatura'}
              </Button>
            </a>
          </div>
        )}

        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 text-center">
          Após confirmação do pagamento seu acesso será liberado automaticamente em poucos minutos.
        </div>

        <div className="text-center">
          <button
            className="text-sm text-gray-400 hover:text-gray-600 underline"
            onClick={() => setResultado(null)}
          >
            Voltar e escolher outra forma de pagamento
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assinar SyncroFlow Eleições</h1>
        <p className="text-gray-500 text-sm mt-1">Escolha seu plano e forma de pagamento</p>
      </div>

      {/* Seleção de plano */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">1. Cargo / Plano</h2>
        {PLANOS.map(p => (
          <div
            key={p.key}
            onClick={() => setPlano(p.key)}
            className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${plano === p.key ? 'border-[#002776] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{p.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{p.desc}</div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className="text-lg font-bold text-[#002776]">{fmt(p.valor)}</div>
                <div className="text-xs text-gray-400">à vista</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Forma de pagamento */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">2. Forma de pagamento</h2>
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => { setForma('pix'); setParcelas(1) }}
            className={`cursor-pointer rounded-xl border-2 p-4 flex items-center gap-3 transition-all ${forma === 'pix' ? 'border-[#009C3B] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <QrCode className={`w-6 h-6 ${forma === 'pix' ? 'text-[#009C3B]' : 'text-gray-400'}`} />
            <div>
              <div className="font-semibold text-gray-900">Pix</div>
              <div className="text-xs text-gray-500">À vista, aprovação imediata</div>
            </div>
          </div>
          <div
            onClick={() => setForma('cartao')}
            className={`cursor-pointer rounded-xl border-2 p-4 flex items-center gap-3 transition-all ${forma === 'cartao' ? 'border-[#002776] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <CreditCard className={`w-6 h-6 ${forma === 'cartao' ? 'text-[#002776]' : 'text-gray-400'}`} />
            <div>
              <div className="font-semibold text-gray-900">Cartão de crédito</div>
              <div className="text-xs text-gray-500">1x, 2x ou 3x sem juros</div>
            </div>
          </div>
        </div>

        {/* Parcelas — só para cartão */}
        {forma === 'cartao' && (
          <div className="grid grid-cols-3 gap-3 mt-2">
            {([1, 2, 3] as Parcelas[]).map(n => (
              <div
                key={n}
                onClick={() => setParcelas(n)}
                className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${parcelas === n ? 'border-[#002776] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="font-bold text-gray-900">{n}x</div>
                <div className="text-sm text-[#002776] font-semibold">{fmt(Math.ceil((planoSelecionado.valor / n) * 100) / 100)}</div>
                <div className="text-xs text-gray-400">sem juros</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resumo e botão */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Resumo</h2>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{planoSelecionado.label}</span>
          <span className="font-medium">{fmt(planoSelecionado.valor)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Forma de pagamento</span>
          <span className="font-medium">
            {forma === 'pix' ? 'Pix à vista' : `Cartão ${parcelas}x de ${fmt(valorParcela)}`}
          </span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-[#002776] text-lg">{fmt(planoSelecionado.valor)}</span>
        </div>
      </div>

      <Button
        className="w-full bg-[#002776] hover:bg-[#001f5e] text-white py-6 text-base font-bold"
        disabled={checkoutMutation.isPending}
        onClick={() => checkoutMutation.mutate()}
      >
        {checkoutMutation.isPending
          ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Gerando cobrança...</>
          : `Pagar ${fmt(planoSelecionado.valor)}`}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        Pagamento processado com segurança pelo Asaas. Seus dados estão protegidos.
      </p>
    </div>
  )
}
