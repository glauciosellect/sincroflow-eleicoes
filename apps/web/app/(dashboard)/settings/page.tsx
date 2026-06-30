'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/store/auth.store'
import { formatDate } from '@/lib/utils'
import {
  Plus, Trash2, Loader2, KeyRound,
  User, Radio, Save, Copy, ShieldAlert, ShieldCheck, AlertTriangle, Wallet,
} from 'lucide-react'
import { channelLabel, cn } from '@/lib/utils'
import { ChannelIcon } from '@/components/channel-icon'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── ABA: PERFIL DA CONTA (seção 4.11) ────────────────────────────────────────
function ProfileTab() {
  const { user, candidate, setUser, setCandidate } = useAuthStore()
  const { toast } = useToast()
  const router = useRouter()
  const qc = useQueryClient()
  const [name, setName] = useState(user?.name || '')
  const [form, setForm] = useState({
    name: candidate?.name || '',
    candidateNumber: candidate?.candidateNumber || '',
    whatsapp: candidate?.whatsapp || '',
    party: candidate?.party || '',
    position: candidate?.position || '',
    state: candidate?.state || '',
    city: candidate?.city || '',
  })
  const [weeklyBriefingEnabled, setWeeklyBriefingEnabled] = useState(candidate?.weeklyBriefingEnabled ?? true)

  const briefingMutation = useMutation({
    mutationFn: (enabled: boolean) => api.patch('/candidates/me', { weeklyBriefingEnabled: enabled }),
    onSuccess: (res) => { setCandidate(res.data); toast({ title: 'Preferência atualizada!' }) },
    onError: () => toast({ title: 'Erro ao atualizar preferência', variant: 'destructive' }),
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing').then(r => r.data),
  })
  const cancellationPending = !!billing?.cancellationReason && billing?.status !== 'CANCELLED'
  const isCancelled = billing?.status === 'CANCELLED'

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.post('/billing/cancel', { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] })
      setShowCancelDialog(false); setCancelReason('')
      toast({ title: 'Cancelamento solicitado', description: 'Sua assinatura permanece ativa até o fim do período já pago. O assistente foi desativado.' })
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  const reactivateMutation = useMutation({
    mutationFn: () => api.post('/billing/reactivate'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing'] }); toast({ title: 'Cancelamento desfeito!', description: 'Seu assistente foi reativado.' }) },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const userMutation = useMutation({
    mutationFn: () => api.patch('/auth/me', { name }),
    onSuccess: (res) => { setUser({ name: res.data.name }); toast({ title: 'Perfil atualizado!' }) },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  })

  const candidateMutation = useMutation({
    mutationFn: () => api.patch('/candidates/me', form),
    onSuccess: (res) => { setCandidate(res.data); toast({ title: 'Dados da campanha atualizados!' }) },
    onError: (err: any) => toast({ title: 'Erro ao atualizar', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/candidates/me'),
    onSuccess: () => { localStorage.clear(); router.push('/login') },
    onError: () => toast({ title: 'Erro ao excluir conta', variant: 'destructive' }),
  })

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Seu acesso</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input className="mt-1 bg-gray-50 text-gray-400" value={user?.email || ''} disabled />
          </div>
          <Button onClick={() => userMutation.mutate()} disabled={userMutation.isPending || name === user?.name} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
            {userMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da campanha</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome completo do candidato</Label>
            <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Número do candidato</Label>
            <Input className="mt-1" value={form.candidateNumber} onChange={e => setForm({ ...form, candidateNumber: e.target.value })} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input className="mt-1" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Partido</Label>
              <Input className="mt-1" value={form.party} onChange={e => setForm({ ...form, party: e.target.value })} />
            </div>
            <div>
              <Label>Cargo disputado</Label>
              <Input className="mt-1" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Estado</Label>
              <Input className="mt-1" maxLength={2} value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Município</Label>
              <Input className="mt-1" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <Button onClick={() => candidateMutation.mutate()} disabled={candidateMutation.isPending} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
            {candidateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Briefing semanal</CardTitle></CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={weeklyBriefingEnabled}
              onChange={(e) => {
                setWeeklyBriefingEnabled(e.target.checked)
                briefingMutation.mutate(e.target.checked)
              }}
            />
            <span className="text-sm text-gray-600">
              Receber por e-mail, toda segunda de manhã, um resumo da semana anterior (volume de conversas, temas em alta, solicitações pendentes e alertas de gaps de conteúdo).
            </span>
          </label>
        </CardContent>
      </Card>

      {cancellationPending && (
        <Card className="border-amber-300">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Cancelamento solicitado</p>
              <p className="text-sm text-amber-700 mt-0.5">Sua assinatura permanece ativa até o fim do período já pago. O assistente de IA está desativado — não responde eleitores nem envia criativos. Você continua com acesso total ao painel e aos seus dados.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => reactivateMutation.mutate()} disabled={reactivateMutation.isPending}>
                {reactivateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Desfazer cancelamento e reativar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isCancelled && (
        <Card className="border-red-300">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Assinatura encerrada</p>
              <p className="text-sm text-red-700 mt-0.5">O assistente de IA está desativado. Você continua com acesso ao painel e aos seus dados, mas para reativar o assistente é necessário assinar novamente.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isCancelled && !cancellationPending && (
        <Card className="border-red-100">
          <CardHeader><CardTitle className="text-base">Cancelar assinatura</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">Sua assinatura continua ativa até o fim do período já pago. O assistente de IA é desativado imediatamente, mas você mantém acesso ao painel e a todos os seus dados por tempo indeterminado.</p>
            <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setShowCancelDialog(true)}>
              Solicitar cancelamento
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar cancelamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Conte pra gente o motivo do cancelamento — isso nos ajuda a melhorar o sistema.</p>
            <Label className="text-sm text-gray-600">Motivo</Label>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-3 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#002776]"
              placeholder="Conte o motivo do cancelamento..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Voltar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(cancelReason.trim())}
            >
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-4 h-4" />
            Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <strong>Ação irreversível.</strong> Ao excluir sua conta, todos os dados serão permanentemente removidos: configuração do agente, conversas, contatos, canais e solicitações. Não há como desfazer.
          </div>
          {!showDeleteConfirm ? (
            <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir minha conta
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">Para confirmar, digite <strong>EXCLUIR CONTA</strong> abaixo:</p>
              <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="EXCLUIR CONTA" className="border-red-300 focus:ring-red-300" />
              <div className="flex gap-2">
                <Button className="bg-red-600 hover:bg-red-700 text-white" disabled={deleteConfirmText !== 'EXCLUIR CONTA' || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar exclusão
                </Button>
                <Button variant="ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── ABA: CANAIS (seção 4.8 — WhatsApp, Instagram, Facebook, Telegram, E-mail) ──
function ChannelsTab() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showTelegramForm, setShowTelegramForm] = useState(false)
  const [telegramName, setTelegramName] = useState('')
  const [telegramToken, setTelegramToken] = useState('')
  const [blockSendersChannel, setBlockSendersChannel] = useState<any>(null)
  const [blockSendersText, setBlockSendersText] = useState('')
  const [showVirtualNumberDialog, setShowVirtualNumberDialog] = useState(false)
  const [virtualNumberAreaCode, setVirtualNumberAreaCode] = useState<number | null>(null)
  const [pendingVirtualChannelId, setPendingVirtualChannelId] = useState<string | null>(null)
  const [virtualVerificationCode, setVirtualVerificationCode] = useState('')
  const searchParams = useSearchParams()
  const { token: authToken, refreshToken: authRefreshToken } = useAuthStore()

  useEffect(() => {
    const success = searchParams.get('meta_success')
    const error = searchParams.get('meta_error')
    if (success) {
      toast({ title: 'Instagram/Facebook conectado!', description: decodeURIComponent(success) })
      qc.invalidateQueries({ queryKey: ['channels'] })
    }
    if (error) toast({ title: 'Erro ao conectar', description: decodeURIComponent(error), variant: 'destructive' })
  }, [])

  const { data: channels, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => api.get('/channels').then(r => r.data),
  })

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing').then(r => r.data),
  })

  const whatsappChannels = (channels || []).filter((c: any) => c.type === 'WHATSAPP')
  const whatsappLimit = billing?.whatsappLineLimit ?? 1
  const whatsappUnlimited = whatsappLimit === -1
  const whatsappAtLimit = !whatsappUnlimited && whatsappChannels.length >= whatsappLimit

  const createTelegramMutation = useMutation({
    mutationFn: () => api.post('/channels/telegram', { name: telegramName, botToken: telegramToken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      setShowTelegramForm(false); setTelegramName(''); setTelegramToken('')
      toast({ title: 'Telegram conectado!' })
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.error || 'Erro ao conectar Telegram', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/channels/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); toast({ title: 'Canal desconectado' }) },
    onError: (err: any) => toast({ title: 'Erro ao desconectar', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  const blockSendersMutation = useMutation({
    mutationFn: (blockedSenders: string[]) => api.patch(`/channels/${blockSendersChannel.id}/email-settings`, { blockedSenders }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      setBlockSendersChannel(null)
      toast({ title: 'Lista de bloqueios atualizada' })
    },
    onError: (err: any) => toast({ title: 'Erro ao salvar', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const connectMeta = (type: 'instagram' | 'facebook') => {
    const token = localStorage.getItem('sf_token') || authToken || localStorage.getItem('sf_refresh') || authRefreshToken || ''
    window.location.href = `${API_URL}/integrations/meta/connect?token=${encodeURIComponent(token)}&type=${type}`
  }

  const embeddedSignupDataRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({})

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com') return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          embeddedSignupDataRef.current = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id }
        }
      } catch {}
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const whatsappEmbeddedSignupMutation = useMutation({
    mutationFn: (params: { code: string; wabaId?: string; phoneNumberId?: string }) =>
      api.post('/channels/whatsapp-meta/signup', params),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); toast({ title: 'WhatsApp (Meta) conectado!' }) },
    onError: (err: any) => {
      if (err.response?.data?.code === 'WHATSAPP_LIMIT_EXCEEDED') {
        toast({ title: 'Limite do plano atingido', description: err.response.data.error, variant: 'destructive' })
      } else {
        toast({ title: 'Erro', description: err.response?.data?.error || 'Erro ao conectar', variant: 'destructive' })
      }
    },
  })

  const connectWhatsAppMeta = () => {
    if (whatsappAtLimit) {
      toast({ title: 'Limite do plano atingido', description: `Seu plano permite ${whatsappLimit} número(s) de WhatsApp. Faça upgrade para conectar mais.`, variant: 'destructive' })
      return
    }
    if (!(window as any).FB) {
      toast({ title: 'SDK da Meta ainda não carregou — tente novamente em alguns segundos', variant: 'destructive' })
      return
    }
    ;(window as any).FB.login((response: any) => {
      const code = response.authResponse?.code
      if (!code) { toast({ title: 'Conexão cancelada', variant: 'destructive' }); return }
      whatsappEmbeddedSignupMutation.mutate({ code, ...embeddedSignupDataRef.current })
    }, {
      config_id: process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
    })
  }

  // Número virtual (Salvy) — alternativa a trazer um número próprio: a plataforma
  // provisiona um número novo, registra na WABA e o candidato confirma com o
  // código SMS recebido. Ver salvy.routes.ts (Adquirir → Ativar → opcional Cancelar).
  const { data: areaCodesData } = useQuery({
    queryKey: ['salvy-area-codes'],
    queryFn: () => api.get('/integrations/salvy/area-codes').then(r => r.data),
    enabled: showVirtualNumberDialog,
  })

  const acquireVirtualNumberMutation = useMutation({
    mutationFn: (areaCode: number) => api.post('/integrations/salvy/virtual-numbers', { areaCode }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      setPendingVirtualChannelId(res.data.channel.id)
      toast({ title: 'Número adquirido! Aguardando SMS com o código de verificação do WhatsApp...' })
    },
    onError: (err: any) => toast({ title: 'Erro ao adquirir número', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  const { data: verificationStatus } = useQuery({
    queryKey: ['salvy-verification-code', pendingVirtualChannelId],
    queryFn: () => api.get(`/integrations/salvy/virtual-numbers/${pendingVirtualChannelId}/verification-code`).then(r => r.data),
    enabled: !!pendingVirtualChannelId,
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (verificationStatus?.verificationCode && !virtualVerificationCode) {
      setVirtualVerificationCode(verificationStatus.verificationCode)
    }
  }, [verificationStatus?.verificationCode])

  const activateVirtualNumberMutation = useMutation({
    mutationFn: () => api.post(`/integrations/salvy/virtual-numbers/${pendingVirtualChannelId}/activate`, { verificationCode: virtualVerificationCode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['channels'] })
      toast({ title: 'WhatsApp ativado com sucesso!' })
      closeVirtualNumberDialog()
    },
    onError: (err: any) => toast({ title: 'Erro ao ativar', description: err.response?.data?.error || 'Código inválido ou expirado', variant: 'destructive' }),
  })

  const cancelVirtualNumberMutation = useMutation({
    mutationFn: (channelId: string) => api.delete(`/integrations/salvy/virtual-numbers/${channelId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['channels'] }); toast({ title: 'Número cancelado' }) },
    onError: (err: any) => toast({ title: 'Erro ao cancelar', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  const closeVirtualNumberDialog = () => {
    setShowVirtualNumberDialog(false)
    setVirtualNumberAreaCode(null)
    setPendingVirtualChannelId(null)
    setVirtualVerificationCode('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Conecte os canais pelos quais os eleitores vão falar com seu assistente.</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {whatsappUnlimited
              ? `${whatsappChannels.length} número(s) de WhatsApp conectados (plano ilimitado)`
              : `${whatsappChannels.length} de ${whatsappLimit} número(s) de WhatsApp conectados`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={connectWhatsAppMeta} className="border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50" disabled={whatsappEmbeddedSignupMutation.isPending || whatsappAtLimit} title={whatsappAtLimit ? 'Limite do plano atingido — faça upgrade para conectar mais números' : undefined}>
            {whatsappEmbeddedSignupMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
            WhatsApp (número próprio){whatsappAtLimit ? ' — limite atingido' : ''}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowVirtualNumberDialog(true)} className="border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50" disabled={whatsappAtLimit} title={whatsappAtLimit ? 'Limite do plano atingido — faça upgrade para conectar mais números' : undefined}>
            <Plus className="w-3 h-3 mr-1" />
            WhatsApp (número novo){whatsappAtLimit ? ' — limite atingido' : ''}
          </Button>
          <Button variant="outline" size="sm" onClick={() => connectMeta('instagram')} className="border-pink-200 text-pink-700 hover:bg-pink-50">
            <Plus className="w-3 h-3 mr-1" />Instagram
          </Button>
          <Button variant="outline" size="sm" onClick={() => connectMeta('facebook')} className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <Plus className="w-3 h-3 mr-1" />Facebook
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTelegramForm(true)} className="border-sky-200 text-sky-700 hover:bg-sky-50">
            <Plus className="w-3 h-3 mr-1" />Telegram
          </Button>
          <Button variant="outline" size="sm" onClick={() => { window.location.href = `${API_URL}/channels/email/connect?token=${authRefreshToken || authToken}` }} className="border-red-200 text-red-700 hover:bg-red-50">
            <Plus className="w-3 h-3 mr-1" />Email
          </Button>
        </div>
      </div>

      {showTelegramForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Conectar Telegram Bot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-800">
              <strong>Como criar um bot:</strong> No Telegram, abra <strong>@BotFather</strong>, envie <code>/newbot</code>, escolha um nome e copie o token fornecido.
            </div>
            <div>
              <Label>Nome da conexão</Label>
              <Input placeholder="Ex: Atendimento da Campanha" value={telegramName} onChange={e => setTelegramName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Token do Bot</Label>
              <Input placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" value={telegramToken} onChange={e => setTelegramToken(e.target.value)} className="mt-1 font-mono text-sm" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createTelegramMutation.mutate()} className="bg-sky-600 hover:bg-sky-700 text-white" disabled={createTelegramMutation.isPending || !telegramName.trim() || !telegramToken.trim()}>
                {createTelegramMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Conectar
              </Button>
              <Button variant="ghost" onClick={() => { setShowTelegramForm(false); setTelegramName(''); setTelegramToken('') }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
      ) : !channels?.length ? (
        <div className="text-center py-16">
          <Radio className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum canal conectado</h3>
          <p className="text-gray-400 text-sm">Use os botões acima para conectar seu primeiro canal</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(channels || []).map((channel: any) => (
            <Card key={channel.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <ChannelIcon type={channel.type} />
                    <div>
                      <div className="font-semibold text-gray-900">{channel.name}</div>
                      <Badge variant={channel.isActive ? 'success' : 'secondary'} className="text-xs mt-0.5">
                        {channel.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-gray-400 font-mono">{channel.id}</span>
                        <button onClick={() => { navigator.clipboard.writeText(channel.id); toast({ title: 'ID copiado!' }) }} className="text-gray-400 hover:text-gray-600 transition-colors" title="Copiar ID do canal">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{channelLabel(channel.type)}</span>
                </div>

                {channel.type === 'WHATSAPP' && (
                  <div className="mt-3 text-center text-sm text-green-600 font-medium py-2">
                    Conectado via API oficial — {channel.config?.displayPhoneNumber || 'WhatsApp Business'}
                    {channel.config?.salvyVirtualPhoneAccountId && (
                      <div className="text-xs text-gray-400 font-normal mt-0.5">Número virtual (Salvy)</div>
                    )}
                    {channel.config?.qualityRating && channel.config.qualityRating !== 'GREEN' && (
                      <div className="text-xs text-amber-600 font-normal mt-0.5">
                        Quality Rating: {channel.config.qualityRating === 'YELLOW' ? 'Médio' : channel.config.qualityRating === 'RED' ? 'Baixo' : channel.config.qualityRating}
                      </div>
                    )}
                  </div>
                )}

                {(channel.type === 'INSTAGRAM' || channel.type === 'FACEBOOK') && channel.config?.igUsername && (
                  <div className="mt-2 text-xs text-gray-500">@{channel.config.igUsername}</div>
                )}

                {channel.type === 'EMAIL' && (
                  <>
                    <div className="mt-2 text-xs text-gray-500">Conectado: {channel.config?.email}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-xs text-gray-500 hover:text-gray-700 w-full"
                      onClick={() => {
                        setBlockSendersChannel(channel)
                        setBlockSendersText((channel.config?.blockedSenders || []).join('\n'))
                      }}
                    >
                      Gerenciar bloqueios
                    </Button>
                  </>
                )}

                <div className="mt-3 pt-3 border-t border-gray-100">
                  {channel.config?.salvyVirtualPhoneAccountId ? (
                    <Button variant="ghost" size="sm" onClick={() => cancelVirtualNumberMutation.mutate(channel.id)} disabled={cancelVirtualNumberMutation.isPending} className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full">
                      {cancelVirtualNumberMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Trash2 className="w-3 h-3 mr-2" />}
                      Cancelar número
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(channel.id)} disabled={deleteMutation.isPending} className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full">
                      {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Trash2 className="w-3 h-3 mr-2" />}
                      Desconectar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!blockSendersChannel} onOpenChange={(open) => !open && setBlockSendersChannel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar bloqueios de e-mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-gray-500">
              Por padrão, o assistente responde e-mails de qualquer remetente. Liste abaixo (um por linha) e-mails ou domínios (ex: <code className="text-xs bg-gray-100 px-1 rounded">@dominio.com</code>) que nunca devem receber resposta automática. Deixe vazio para responder a todos.
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
              style={{ minHeight: 140 }}
              placeholder={'spam@exemplo.com\n@dominio-indesejado.com'}
              value={blockSendersText}
              onChange={(e) => setBlockSendersText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={blockSendersMutation.isPending}
              onClick={() => {
                const list = blockSendersText.split('\n').map((s) => s.trim()).filter(Boolean)
                blockSendersMutation.mutate(list)
              }}
            >
              {blockSendersMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVirtualNumberDialog} onOpenChange={(open) => !open && closeVirtualNumberDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adquirir número de WhatsApp</DialogTitle>
          </DialogHeader>

          {!pendingVirtualChannelId ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Escolha o DDD do novo número. Ele será provisionado automaticamente e registrado na nossa conta oficial do WhatsApp (Meta).
              </p>
              <div>
                <Label>DDD</Label>
                <select
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={virtualNumberAreaCode ?? ''}
                  onChange={(e) => setVirtualNumberAreaCode(Number(e.target.value) || null)}
                >
                  <option value="">Selecione...</option>
                  {(areaCodesData?.areaCodes || []).map((code: number) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  disabled={!virtualNumberAreaCode || acquireVirtualNumberMutation.isPending}
                  onClick={() => acquireVirtualNumberMutation.mutate(virtualNumberAreaCode!)}
                >
                  {acquireVirtualNumberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Adquirir número
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Número adquirido! Assim que o SMS com o código de verificação chegar, ele aparece automaticamente abaixo — ou cole manualmente se preferir.
              </p>
              <div>
                <Label>Código de verificação</Label>
                <Input
                  className="mt-1 font-mono"
                  placeholder="123456"
                  value={virtualVerificationCode}
                  onChange={(e) => setVirtualVerificationCode(e.target.value)}
                />
                {verificationStatus?.verificationCode ? (
                  <p className="text-xs text-green-600 mt-1">Código recebido via SMS</p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Aguardando SMS...</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  className="w-full"
                  disabled={!virtualVerificationCode.trim() || activateVirtualNumberMutation.isPending}
                  onClick={() => activateVirtualNumberMutation.mutate()}
                >
                  {activateVirtualNumberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar e ativar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── ABA: CHAVES DE API ───────────────────────────────────────────────────────
function ApiKeysTab() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/api-keys').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api-keys', { name: newKeyName }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      setCreatedKey(res.data.key)
      setNewKeyName('')
      toast({ title: 'Chave criada! Copie agora — não será exibida novamente.' })
    },
    onError: () => toast({ title: 'Erro ao criar chave', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['api-keys'] }); toast({ title: 'Chave revogada' }) },
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Nova chave de API</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome identificador</Label>
            <Input className="mt-1" placeholder="Ex: Integração n8n" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
          </div>
          {createdKey && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-700 mb-1">Copie sua chave — ela não será exibida novamente:</p>
              <div className="font-mono text-xs text-green-900 bg-white border border-green-200 rounded px-3 py-2 break-all">{createdKey}</div>
              <Button size="sm" variant="ghost" className="mt-2 text-xs text-green-700" onClick={() => { navigator.clipboard.writeText(createdKey); toast({ title: 'Copiado!' }) }}>Copiar</Button>
            </div>
          )}
          <Button onClick={() => createMutation.mutate()} disabled={!newKeyName.trim() || createMutation.isPending} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Gerar chave
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Chaves ativas</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#002776]" /></div>}
          {!isLoading && keys?.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma chave criada</p>}
          <div className="space-y-2">
            {(keys || []).map((k: any) => (
              <div key={k.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">{k.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Criada em {formatDate(k.createdAt)}{k.lastUsedAt ? ` · Último uso ${formatDate(k.lastUsedAt)}` : ''}</div>
                </div>
                <button onClick={() => deleteMutation.mutate(k.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── ABA: COMPLIANCE TSE (seção 4.11 + 7 da spec) ─────────────────────────────
function ComplianceTab() {
  const { data: compliance, isLoading } = useQuery({
    queryKey: ['agent-compliance'],
    queryFn: () => api.get('/agent/compliance').then(r => r.data),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>

  const hasElectionDate = !!compliance?.round

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className={cn(compliance?.mustBeDeactivated ? 'border-red-300' : 'border-green-200')}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            {compliance?.mustBeDeactivated ? (
              <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-green-500 shrink-0" />
            )}
            <div>
              <h2 className="font-bold text-gray-900">
                {compliance?.mustBeDeactivated ? 'Assistente desativado por exigência do TSE' : 'Em conformidade com o TSE'}
              </h2>
              <p className="text-sm text-gray-500">Resolução TSE nº 23.755/2026</p>
            </div>
          </div>

          {!hasElectionDate && (
            <p className="text-sm text-gray-500">Nenhuma data de turno eleitoral configurada pelo sistema ainda.</p>
          )}

          {hasElectionDate && !compliance.mustBeDeactivated && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Seu assistente será desativado automaticamente em <strong>{compliance.daysUntilDeactivation} dia(s)</strong>,
                72h antes do pleito em {formatDate(compliance.round.electionDate)}.
              </span>
            </div>
          )}

          {compliance?.mustBeDeactivated && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              O assistente está desativado e só pode ser reativado manualmente após o pleito em {formatDate(compliance.round.electionDate)}.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">O que a Resolução TSE exige</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Identificação obrigatória como assistente virtual em toda primeira mensagem.</p>
          <p>• O assistente nunca recomenda voto, mesmo se perguntado diretamente.</p>
          <p>• Respostas restritas ao conteúdo cadastrado por você (Minha História e Plataforma Eleitoral).</p>
          <p>• Desativação automática 72h antes de cada turno eleitoral.</p>
          <p>• Nenhuma geração de imagem, vídeo ou áudio sintético do candidato.</p>
          <p>• Log de auditoria imutável de todas as conversas, preservado para defesa legal.</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── ABA: FINANCEIRO (compra de linhas extra de WhatsApp e recarga de mensagens) ──
function BillingTab() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [lineQty, setLineQty] = useState(1)
  const [rechargeQty, setRechargeQty] = useState(1)

  const { data: billing, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing').then(r => r.data),
  })

  const { data: invoices } = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => api.get('/billing/invoices').then(r => r.data),
  })

  const buyLinesMutation = useMutation({
    mutationFn: (quantity: number) => api.post('/billing/whatsapp-lines', { quantity }),
    onSuccess: () => toast({ title: 'Linhas adicionadas!', description: 'O número de linhas disponíveis será atualizado após a confirmação do pagamento.' }),
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  const rechargeMutation = useMutation({
    mutationFn: (quantity: number) => api.post('/billing/checkout-active-msgs', { quantity }).then(r => r.data),
    onSuccess: (data) => { if (data.url) window.location.href = data.url },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  const mandateMutation = useMutation({
    mutationFn: () => api.post('/billing/upgrade-mandate'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing'] }); toast({ title: 'Modo Mandato ativado!', description: 'Sua campanha agora opera como Mandato — todo o histórico foi preservado.' }) },
    onError: (err: any) => toast({ title: 'Erro', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>

  const whatsappLimit = billing?.whatsappLineLimit ?? 1
  const msgsIncluded = billing?.activeMsgsIncluded ?? 0
  const msgsUsed = billing?.activeMsgsUsed ?? 0
  const msgsExtra = billing?.activeMsgsExtra ?? 0
  const msgsPercent = msgsIncluded > 0 ? Math.min(100, Math.round((msgsUsed / msgsIncluded) * 100)) : 0
  const isCancelled = billing?.status === 'CANCELLED'

  return (
    <div className="space-y-5 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Resumo do plano</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Plano</span>
            <Badge>{billing?.plan === 'MANDATE' ? 'Mandato' : 'Campanha'}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Linhas de WhatsApp contratadas</span>
            <span className="font-medium text-gray-900">{whatsappLimit}</span>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-gray-500">Mensagens ativas usadas neste ciclo</span>
              <span className="font-medium text-gray-900">{msgsUsed} / {msgsIncluded}{msgsExtra > 0 ? ` (+${msgsExtra} extras)` : ''}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#009C3B] rounded-full transition-all" style={{ width: `${msgsPercent}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Mensagens passivas (eleitor escreve primeiro) nunca são limitadas.</p>
          </div>
          {billing?.plan === 'CAMPAIGN' && !isCancelled && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Foi eleito? Continue usando o sistema no pós-eleição sem perder nada do seu histórico.</p>
              <Button size="sm" variant="outline" onClick={() => mandateMutation.mutate()} disabled={mandateMutation.isPending}>
                {mandateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Seguir Mandato
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Comprar linhas de WhatsApp</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Cada linha extra custa <strong>R$ 497,00/mês</strong> e é cobrada junto da sua assinatura. Escolha quantas linhas quer adicionar.</p>
          <div className="flex items-center gap-3">
            <Label className="text-sm text-gray-600 shrink-0">Quantidade</Label>
            <Input type="number" min={1} max={30} value={lineQty}
              onChange={(e) => setLineQty(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              className="w-24" />
            <Button onClick={() => buyLinesMutation.mutate(lineQty)} disabled={buyLinesMutation.isPending}>
              {buyLinesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Adicionar {lineQty} linha{lineQty > 1 ? 's' : ''} — R$ {(lineQty * 497).toLocaleString('pt-BR')}/mês
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recarga de mensagens ativas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Se sua cota mensal de mensagens ativas se esgotar, compre pacotes avulsos de 1.000 mensagens por <strong>R$ 97,00</strong> cada.</p>
          <div className="flex items-center gap-3">
            <Label className="text-sm text-gray-600 shrink-0">Pacotes (1.000 cada)</Label>
            <Input type="number" min={1} max={20} value={rechargeQty}
              onChange={(e) => setRechargeQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-24" />
          </div>
          <Button variant="outline" onClick={() => rechargeMutation.mutate(rechargeQty)} disabled={rechargeMutation.isPending}>
            {rechargeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Comprar {rechargeQty * 1000} mensagens — R$ {(rechargeQty * 97).toLocaleString('pt-BR')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Faturas</CardTitle></CardHeader>
        <CardContent>
          {(!invoices || invoices.length === 0) && <p className="text-sm text-gray-400 text-center py-6">Nenhuma fatura ainda</p>}
          <div className="space-y-2">
            {(invoices || []).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg text-sm">
                <span className="text-gray-600">{formatDate(inv.createdAt)}</span>
                <span className="text-gray-900 font-medium">R$ {(inv.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>{inv.status === 'paid' ? 'Pago' : inv.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isCancelled && (
        <p className="text-xs text-gray-400 text-center">Sua assinatura foi cancelada. Para reativar o assistente, assine novamente em Perfil.</p>
      )}
    </div>
  )
}

const tabs = [
  { key: 'profile',    label: 'Perfil',         icon: User },
  { key: 'channels',   label: 'Canais',         icon: Radio },
  { key: 'billing',    label: 'Financeiro',     icon: Wallet },
  { key: 'apikeys',    label: 'Chaves de API',  icon: KeyRound },
  { key: 'compliance', label: 'Compliance TSE', icon: ShieldCheck },
]

function SettingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialTab = searchParams.get('tab') || 'profile'
  const [active, setActive] = useState(initialTab)

  const handleTab = (key: string) => {
    setActive(key)
    router.replace(`/settings?tab=${key}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie seu perfil, canais e conformidade legal</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => handleTab(t.key)}
            className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
              active === t.key ? 'border-[#002776] text-[#002776]' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {active === 'profile'    && <ProfileTab />}
        {active === 'channels'   && <ChannelsTab />}
        {active === 'billing'    && <BillingTab />}
        {active === 'apikeys'    && <ApiKeysTab />}
        {active === 'compliance' && <ComplianceTab />}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
