'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Check, Loader2, AlertTriangle, ExternalLink, CreditCard, MessageSquare, Award, Smartphone } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'

const ACTIVE_MSG_RECHARGE = { amount: 1000, priceLabel: 'A definir' }
const WHATSAPP_LINE_PRICE = 497
const WHATSAPP_LINE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30]

const PLAN_LABELS: Record<string, string> = { CAMPAIGN: 'Plano Campanha', MANDATE: 'Plano Mandato' }
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativa', SUSPENDED: 'Suspensa', CANCELLED: 'Cancelada' }

export default function BillingPage() {
  const { candidate, setCandidate } = useAuthStore()
  const { toast } = useToast()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const paymentStatus = searchParams.get('payment')

  const [termsOpen, setTermsOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [whatsappLinesQty, setWhatsappLinesQty] = useState(1)
  const [renewMethod, setRenewMethod] = useState<'pix' | 'boleto'>('pix')
  const [rechargeMethod, setRechargeMethod] = useState<'card' | 'pix' | 'boleto'>('card')

  const isSuspended = candidate?.status === 'SUSPENDED'

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing').then(r => r.data),
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then(r => r.data),
  })

  const { data: terms } = useQuery({
    queryKey: ['billing-terms'],
    queryFn: () => api.get('/billing/terms').then(r => r.data),
    enabled: termsOpen,
  })

  // Recarga avulsa de mensagens ativas
  const checkoutActiveMsgsMutation = useMutation({
    mutationFn: (paymentMethod: 'card' | 'pix' | 'boleto') => api.post('/billing/checkout-active-msgs', { paymentMethod }).then(r => r.data),
    onSuccess: (data) => { if (data.url) window.location.href = data.url },
    onError: (err: any) => toast({ title: 'Erro ao processar pagamento', description: err.response?.data?.error, variant: 'destructive' }),
  })

  // Créditos de IA com linha virtual para WhatsApp — checkout avulso via Stripe
  const whatsappLinesMutation = useMutation({
    mutationFn: () => api.post('/billing/whatsapp-lines', { quantity: whatsappLinesQty }).then(r => r.data),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url
    },
    onError: (err: any) => toast({ title: 'Erro ao adicionar linhas', description: err.response?.data?.error, variant: 'destructive' }),
  })

  // Modo Mandato — upgrade após a eleição (seção 4.11 da spec)
  const upgradeMandateMutation = useMutation({
    mutationFn: () => api.post('/billing/upgrade-mandate').then(r => r.data),
    onSuccess: (data) => { setCandidate({ plan: data.plan }); qc.invalidateQueries({ queryKey: ['billing'] }); toast({ title: 'Modo Mandato ativado!' }) },
    onError: (err: any) => toast({ title: 'Erro ao ativar Modo Mandato', description: err.response?.data?.error, variant: 'destructive' }),
  })

  // Renovação manual mensal via Pix/boleto (só Plano Campanha)
  const renewCampaignMutation = useMutation({
    mutationFn: () => api.post('/billing/checkout-campaign-payment', { paymentMethod: renewMethod }).then(r => r.data),
    onSuccess: (data) => { if (data.url) window.location.href = data.url },
    onError: (err: any) => toast({ title: 'Erro ao gerar pagamento', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const acceptTermsMutation = useMutation({
    mutationFn: () => api.post('/billing/terms/accept').then(r => r.data),
    onSuccess: () => { setTermsOpen(false); setAgreed(false); toast({ title: 'Termo aceito' }) },
    onError: () => toast({ title: 'Erro ao registrar aceite do termo', variant: 'destructive' }),
  })

  // Portal de gerenciamento (cancelar, trocar cartão)
  const portalMutation = useMutation({
    mutationFn: () => api.post('/billing/portal').then(r => r.data),
    onSuccess: (data) => { if (data.url) window.location.href = data.url },
    onError: (err: any) => toast({ title: 'Erro ao abrir portal de pagamento', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const activeMsgsRemaining = billing
    ? Math.max(0, billing.activeMsgsIncluded + billing.activeMsgsExtra - billing.activeMsgsUsed)
    : 0
  const activeMsgsTotal = billing ? billing.activeMsgsIncluded + billing.activeMsgsExtra : 1
  const usagePct = Math.min(100, Math.round((1 - activeMsgsRemaining / activeMsgsTotal) * 100))

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Faturamento</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie sua assinatura e mensagens ativas</p>
      </div>

      {isSuspended && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Sua assinatura está com pendência de pagamento</p>
            <p className="text-sm text-red-600 mt-0.5">Regularize para voltar a usar o assistente normalmente.</p>
          </div>
        </div>
      )}

      {paymentStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-600 shrink-0" />
          <div className="font-medium text-green-800">Pagamento confirmado!</div>
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-700">Pagamento cancelado. Nenhum valor foi cobrado.</div>
        </div>
      )}

      {/* Card status */}
      <Card className="text-white border-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm opacity-80 mb-1">Sua assinatura</div>
              <div className="text-2xl font-bold">{billing ? PLAN_LABELS[billing.plan] : '—'}</div>
              <div className="text-sm opacity-80 mt-1">{billing ? STATUS_LABELS[billing.status] : ''}</div>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-2 text-2xl font-bold justify-end">
                <MessageSquare className="w-6 h-6 opacity-80" />
                {activeMsgsRemaining.toLocaleString()}
              </div>
              <div className="text-sm opacity-80">mensagens ativas restantes</div>
              <Button
                size="sm"
                variant="outline"
                className="text-white border-white/40 hover:bg-white/10 text-xs"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
                Gerenciar assinatura
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-white/20 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-white" style={{ width: `${usagePct}%` }} />
            </div>
            <div className="text-xs opacity-70 mt-1">{billing?.activeMsgsUsed?.toLocaleString() ?? 0} de {activeMsgsTotal.toLocaleString()} mensagens ativas usadas neste ciclo</div>
          </div>
        </CardContent>
      </Card>

      {/* Pagamento avulso via Pix/boleto (Plano Campanha) */}
      {billing?.campaignPaidUntil && (
        <div className="rounded-xl border-2 border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-[#002776]" />
            <h2 className="text-lg font-semibold text-gray-900">Pagamento via {billing.campaignPaymentMethod === 'pix' ? 'Pix' : 'Boleto'}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Seu pagamento é válido até <strong>{formatDate(billing.campaignPaidUntil)}</strong>. Renove antes do vencimento para não ter o assistente suspenso automaticamente.
          </p>
          <div className="flex items-center gap-3 max-w-md">
            <select
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={renewMethod}
              onChange={(e) => setRenewMethod(e.target.value as 'pix' | 'boleto')}
            >
              <option value="pix">Pix</option>
              <option value="boleto">Boleto</option>
            </select>
            <Button
              size="sm"
              disabled={renewCampaignMutation.isPending}
              onClick={() => renewCampaignMutation.mutate()}
            >
              {renewCampaignMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Renovar agora
            </Button>
          </div>
        </div>
      )}

      {/* Recarga de mensagens ativas */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5 text-[#002776]" />
          <h2 className="text-lg font-semibold text-gray-900">Recarregar mensagens ativas</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Use quando esgotar a cota do ciclo. Mensagens passivas (respostas a eleitores que escrevem primeiro) nunca são afetadas — apenas envios iniciados pelo agente (disclaimer, lembretes) são bloqueados até a recarga.
        </p>
        <div className="rounded-xl border-2 border-gray-200 p-4 max-w-xs space-y-3">
          <div>
            <div className="font-bold text-gray-900 mb-1">+{ACTIVE_MSG_RECHARGE.amount.toLocaleString('pt-BR')} mensagens ativas</div>
            <div className="text-xl font-bold text-gray-900">{ACTIVE_MSG_RECHARGE.priceLabel}</div>
          </div>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            value={rechargeMethod}
            onChange={(e) => setRechargeMethod(e.target.value as 'card' | 'pix' | 'boleto')}
          >
            <option value="card">Cartão de crédito</option>
            <option value="pix">Pix</option>
            <option value="boleto">Boleto</option>
          </select>
          <Button
            size="sm"
            className="w-full"
            disabled={checkoutActiveMsgsMutation.isPending}
            onClick={() => checkoutActiveMsgsMutation.mutate(rechargeMethod)}
          >
            {checkoutActiveMsgsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Comprar recarga'}
          </Button>
        </div>
      </div>

      {/* Créditos de IA com linha Virtual para WhatsApp */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Smartphone className="w-5 h-5 text-[#009C3B]" />
          <h2 className="text-lg font-semibold text-gray-900">Comprar Créditos de IA com linha Virtual para Whatsapp</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Cada pacote de créditos de IA com linha virtual para Whatsapp custa: R$ {WHATSAPP_LINE_PRICE},00 até o dia 30/09/26. Escolha a quantidade de pacote que desejar.
        </p>
        <div className="rounded-xl border-2 border-gray-200 p-4 max-w-xs space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Quantidade de pacotes</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={whatsappLinesQty}
              onChange={(e) => setWhatsappLinesQty(Number(e.target.value))}
            >
              {WHATSAPP_LINE_OPTIONS.map((n) => (
                <option key={n} value={n}>+{n} pacote{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          <div className="text-xl font-bold text-gray-900">
            R$ {(whatsappLinesQty * WHATSAPP_LINE_PRICE).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={whatsappLinesMutation.isPending}
            onClick={() => whatsappLinesMutation.mutate()}
          >
            {whatsappLinesMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Comprar agora'}
          </Button>
        </div>
      </div>

      {/* Modo Mandato */}
      {billing?.plan === 'CAMPAIGN' && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-amber-900">Foi eleito? Ative o Modo Mandato</h2>
          </div>
          <p className="text-sm text-amber-700 mb-4">
            Após a eleição, transforme seu assistente em ouvidoria do mandato — novo disclaimer, novo contexto, mesma plataforma.
          </p>
          {!billing?.hasCardSubscription && (
            <p className="text-sm text-amber-800 bg-amber-100 rounded-lg p-3 mb-4">
              O Modo Mandato exige cartão de crédito (cobrança recorrente automática) — Pix e boleto não são aceitos neste plano. Gerencie sua assinatura para cadastrar um cartão antes de migrar.
            </p>
          )}
          <Button
            disabled={upgradeMandateMutation.isPending}
            onClick={() => upgradeMandateMutation.mutate()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {upgradeMandateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Ativar Modo Mandato
          </Button>
        </div>
      )}

      {/* Histórico de faturas */}
      {invoices && invoices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Histórico de faturas</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Data</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Valor</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      R$ {(inv.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'failed' ? 'destructive' : 'warning'}>
                        {inv.status === 'paid' ? 'Pago' : inv.status === 'failed' ? 'Falhou' : inv.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={() => portalMutation.mutate()}
          disabled={portalMutation.isPending}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Gerenciar cartão, cancelar ou ver faturas no portal Stripe
        </button>
      </div>

      {/* Modal de Termo de Aceite */}
      <Dialog open={termsOpen} onOpenChange={(open) => { setTermsOpen(open); if (!open) setAgreed(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Termo de Aceite do Contrato</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto text-sm text-gray-600 whitespace-pre-wrap border border-gray-200 rounded-lg p-4 bg-gray-50">
            {terms?.text || 'Carregando termo...'}
          </div>
          <div className="flex items-start gap-2 pt-2">
            <Checkbox id="terms-agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <label htmlFor="terms-agree" className="text-sm text-gray-700 cursor-pointer">
              Li e aceito os termos do contrato de assinatura.
            </label>
          </div>
          <DialogFooter>
            <Button
              className="w-full sm:w-auto"
              disabled={!agreed || acceptTermsMutation.isPending}
              onClick={() => acceptTermsMutation.mutate()}
            >
              {acceptTermsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Aceitar termo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
