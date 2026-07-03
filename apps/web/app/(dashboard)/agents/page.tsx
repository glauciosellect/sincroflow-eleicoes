'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Send, MessageSquareText, Image as ImageIcon, Upload, Trash2, Megaphone, AlertTriangle, Plus, Wand2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

const CreativeEditor = dynamic(() => import('@/components/editor/CreativeEditor'), { ssr: false })

const CONTACT_TYPE_LABELS: Record<string, string> = {
  VOTER: 'Eleitor',
  FAMILY_FRIEND: 'Família/Amigo',
  STAFF: 'Equipe',
  CONTRACTOR: 'Terceirizado',
  OTHER: 'Outro',
}
const BROADCAST_STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Na fila',
  SENDING: 'Enviando',
  COMPLETED: 'Concluído',
  COMPLETED_WITH_ERRORS: 'Concluído com erros',
}

const TABS = ['Minha História', 'Disclaimer', 'Plataforma Eleitoral', 'Criativos', 'Configuração'] as const
type Tab = typeof TABS[number]

interface Creative {
  id: string
  title: string
  topicKey: string | null
  fileUrl: string
  fileType: string
  createdAt: string
}

interface AgentConfig {
  agentName: string
  agentRole: string
  agentStyle: 'FORMAL' | 'INFORMAL' | 'ACOLHEDOR'
  story: string | null
  disclaimer: string
  fixedAiDisclaimer: string
  candidateSite: string | null
  voiceEnabled: boolean
  ttsVoice: string | null
  responseDelay: number
  language: string
  timezone: string
  isActive: boolean
}

interface PlatformTopic {
  topicKey: string
  topicName: string
  content: string | null
}

const STYLE_OPTIONS: { value: AgentConfig['agentStyle']; label: string }[] = [
  { value: 'FORMAL', label: 'Formal' },
  { value: 'INFORMAL', label: 'Informal' },
  { value: 'ACOLHEDOR', label: 'Próximo e acolhedor' },
]

const TTS_VOICES = [
  { value: 'onyx', label: 'Homem — Grave e sóbrio (padrão)' },
  { value: 'echo', label: 'Homem — Jovem e claro' },
  { value: 'fable', label: 'Homem — Caloroso e narrativo' },
  { value: 'alloy', label: 'Mulher — Neutra e profissional' },
  { value: 'nova', label: 'Mulher — Jovem e animada' },
  { value: 'shimmer', label: 'Mulher — Suave e elegante' },
]

export default function AgentPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(tabParam && TABS.includes(tabParam) ? tabParam : 'Minha História')

  const { data: config, isLoading: loadingConfig } = useQuery<AgentConfig>({
    queryKey: ['agent-config'],
    queryFn: () => api.get('/agent/config').then(r => r.data),
  })

  const { data: topics, isLoading: loadingTopics } = useQuery<PlatformTopic[]>({
    queryKey: ['platform-topics'],
    queryFn: () => api.get('/agent/platform-topics').then(r => r.data),
  })

  const [form, setForm] = useState<Partial<AgentConfig> | null>(null)

  useEffect(() => {
    if (config && !form) setForm(config)
  }, [config, form])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<AgentConfig>) => api.patch('/agent/config', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-config'] }); toast({ title: 'Salvo com sucesso!' }) },
    onError: (err: any) => toast({ title: 'Erro ao salvar', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const toggleMutation = useMutation({
    mutationFn: () => api.patch('/agent/toggle'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-config'] }) },
    onError: (err: any) => toast({ title: 'Não foi possível alterar o status', description: err.response?.data?.error, variant: 'destructive' }),
  })

  if (loadingConfig || !form) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Assistente</h1>
          <p className="text-gray-500 text-sm mt-1">Configure como seu assistente representa sua campanha</p>
        </div>
        <button
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            config?.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          )}
        >
          <span className={cn('w-2 h-2 rounded-full', config?.isActive ? 'bg-green-500' : 'bg-gray-400')} />
          {config?.isActive ? 'Assistente ATIVO' : 'Assistente DESATIVADO'}
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === t ? 'border-[#002776] text-[#002776]' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Minha História' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="agentName">Nome do agente</Label>
              <Input
                id="agentName"
                placeholder="Ex: Assistente da Campanha de João Silva"
                className="mt-1"
                value={form.agentName || ''}
                onChange={(e) => setForm({ ...form, agentName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="agentRole">Função do agente</Label>
              <Input
                id="agentRole"
                placeholder="Ex: Assistente virtual de atendimento eleitoral"
                className="mt-1"
                value={form.agentRole || ''}
                onChange={(e) => setForm({ ...form, agentRole: e.target.value })}
              />
            </div>
            <div>
              <Label>Estilo de comunicação</Label>
              <div className="flex gap-2 mt-1">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, agentStyle: opt.value })}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors',
                      form.agentStyle === opt.value ? 'border-[#002776] bg-blue-50 text-[#002776]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="story">Minha História</Label>
              <p className="text-xs text-gray-400 mb-1">Conte sua trajetória, valores e motivações. Este conteúdo é usado para apresentar você de forma humanizada.</p>
              <Textarea
                id="story"
                placeholder="Nasci em [cidade], sou [profissão] há X anos. Ao longo da minha vida..."
                className="mt-1"
                style={{ minHeight: 300 }}
                value={form.story || ''}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{(form.story || '').length} caracteres</p>
            </div>
            <div>
              <Label htmlFor="candidateSite">Site do candidato (opcional)</Label>
              <Input
                id="candidateSite"
                placeholder="https://..."
                className="mt-1"
                value={form.candidateSite || ''}
                onChange={(e) => setForm({ ...form, candidateSite: e.target.value })}
              />
            </div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Salvar e continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'Disclaimer' && (
        <DisclaimerTab form={form} setForm={setForm} onSave={() => saveMutation.mutate(form)} saving={saveMutation.isPending} />
      )}

      {tab === 'Plataforma Eleitoral' && (
        <PlatformTopicsTab topics={topics} loading={loadingTopics} />
      )}

      {tab === 'Criativos' && (
        <CreativesTab topics={topics} />
      )}

      {tab === 'Configuração' && (
        <ConfigTab form={form} setForm={setForm} onSave={() => saveMutation.mutate(form)} saving={saveMutation.isPending} />
      )}
    </div>
  )
}

function DisclaimerTab({ form, setForm, onSave, saving }: { form: Partial<AgentConfig>; setForm: (f: Partial<AgentConfig>) => void; onSave: () => void; saving: boolean }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label>Disclaimer de IA (obrigatório por lei — não editável)</Label>
          <div className="mt-1 bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-700 select-none">
            {form.fixedAiDisclaimer}
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Exigido pela Resolução TSE nº 23.755/2026 — é enviado automaticamente antes da sua mensagem de apresentação, na primeira mensagem de cada novo contato, e não pode ser removido nem alterado.
          </p>
        </div>
        <div>
          <Label htmlFor="disclaimer">Mensagem de apresentação (editável)</Label>
          <Textarea
            id="disclaimer"
            className="mt-1"
            style={{ minHeight: 160 }}
            value={form.disclaimer || ''}
            onChange={(e) => setForm({ ...form, disclaimer: e.target.value })}
          />
        </div>
        <div>
          <Label>Preview — é assim que o eleitor vai receber:</Label>
          <div className="mt-2 bg-[#DCF8C6] rounded-2xl rounded-tl-none p-3 max-w-sm text-sm text-gray-800 shadow-sm whitespace-pre-wrap">
            {`${form.fixedAiDisclaimer || ''}\n\n${form.disclaimer || 'Sua mensagem aparecerá aqui...'}`}
          </div>
        </div>
        <Button onClick={onSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Salvar e continuar
        </Button>
      </CardContent>
    </Card>
  )
}

function PlatformTopicsTab({ topics, loading }: { topics?: PlatformTopic[]; loading: boolean }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const saveMutation = useMutation({
    mutationFn: ({ topicKey, content }: { topicKey: string; content: string }) =>
      api.patch(`/agent/platform-topics/${topicKey}`, { content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-topics'] }); toast({ title: 'Tema salvo!' }) },
    onError: (err: any) => toast({ title: 'Erro ao salvar tema', description: err.response?.data?.error, variant: 'destructive' }),
  })

  if (loading || !topics) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
  }

  const filledCount = topics.filter(t => t.content && t.content.trim().length > 0).length

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center justify-between">
        <span>Seu assistente só responde sobre os temas que você preencher.</span>
        <span className="font-semibold whitespace-nowrap ml-3">{filledCount} de {topics.length} temas preenchidos</span>
      </div>

      {topics.map((topic) => {
        const value = drafts[topic.topicKey] ?? topic.content ?? ''
        const filled = topic.content && topic.content.trim().length > 0
        return (
          <Card key={topic.topicKey} className={cn(filled && 'border-l-4 border-l-green-500')}>
            <CardContent className="p-4 space-y-2">
              <Label className="text-base font-semibold">{topic.topicName}</Label>
              <Textarea
                placeholder="Descreva suas propostas para este tema..."
                style={{ minHeight: 100 }}
                value={value}
                onChange={(e) => setDrafts({ ...drafts, [topic.topicKey]: e.target.value })}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => saveMutation.mutate({ topicKey: topic.topicKey, content: value })}
                  disabled={saveMutation.isPending}
                >
                  Salvar tema
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function CreativesTab({ topics }: { topics?: PlatformTopic[] }) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [topicKey, setTopicKey] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const { candidate } = useAuthStore()

  const { data: creatives, isLoading } = useQuery<Creative[]>({
    queryKey: ['creatives'],
    queryFn: () => api.get('/creatives').then(r => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData()
      formData.append('file', file as File)
      formData.append('title', title)
      if (topicKey) formData.append('topicKey', topicKey)
      return api.post('/creatives', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['creatives'] })
      setFile(null); setTitle(''); setTopicKey(''); setUploadOpen(false)
      toast({ title: 'Criativo enviado!' })
    },
    onError: (err: any) => toast({ title: 'Erro ao enviar criativo', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/creatives/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['creatives'] })
      setSelectedCreative((prev) => (prev?.id === id ? null : prev))
      toast({ title: 'Criativo removido' })
    },
  })

  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null)
  const [broadcastContactType, setBroadcastContactType] = useState('VOTER')
  const [broadcastChannelType, setBroadcastChannelType] = useState<'WHATSAPP' | 'EMAIL' | 'TELEGRAM'>('WHATSAPP')

  const { data: channels } = useQuery<{ id: string; type: string; isActive: boolean }[]>({
    queryKey: ['channels'],
    queryFn: () => api.get('/channels').then(r => r.data),
  })
  const hasEmailChannel = !!channels?.some(c => c.type === 'EMAIL' && c.isActive)
  const hasTelegramChannel = !!channels?.some(c => c.type === 'TELEGRAM' && c.isActive)

  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ['broadcast-preview', selectedCreative?.id, broadcastContactType, broadcastChannelType],
    queryFn: () => api.get('/broadcasts/preview', { params: { creativeId: selectedCreative!.id, contactType: broadcastContactType, channelType: broadcastChannelType } }).then(r => r.data),
    enabled: !!selectedCreative,
  })

  const { data: broadcasts } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => api.get('/broadcasts').then(r => r.data),
  })

  const broadcastMutation = useMutation({
    mutationFn: () => api.post('/broadcasts', { creativeId: selectedCreative!.id, contactType: broadcastContactType, channelType: broadcastChannelType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['broadcasts'] })
      setSelectedCreative(null)
      toast({ title: 'Disparo iniciado!', description: 'Os envios serão feitos gradualmente para evitar bloqueio do número/conta.' })
    },
    onError: (err: any) => toast({ title: 'Erro ao disparar', description: err.response?.data?.error, variant: 'destructive' }),
  })

  const exceeds24h = preview && preview.totalTargets > preview.remaining24hCapacity
  const exceedsMax = preview && preview.totalTargets > preview.maxTargets
  const exceedsQuota = preview && preview.totalTargets > preview.activeMsgsRemaining
  const canConfirm = preview && !exceeds24h && !exceedsMax && !exceedsQuota && preview.totalTargets > 0

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        Suba imagens, vídeos ou PDFs ("Santinho") da sua campanha. Vincule a um tema para o assistente anexar automaticamente quando um eleitor perguntar sobre aquele assunto, anexe manualmente ao responder no chat, ou selecione um criativo abaixo para enviar a um grupo de eleitores.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Coluna esquerda — biblioteca */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Biblioteca de criativos</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditorOpen(true)}
                className="gap-2"
              >
                <Wand2 className="w-3 h-3" />Editor visual
              </Button>
              <Button
                size="sm"
                onClick={() => setUploadOpen(true)}
                style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
                className="text-white"
              >
                <Plus className="w-3 h-3 mr-2" />Novo criativo
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>
          ) : !creatives?.length ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhum criativo cadastrado ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {creatives.map((c) => {
                const topicName = topics?.find(t => t.topicKey === c.topicKey)?.topicName
                const isSelected = selectedCreative?.id === c.id
                return (
                  <Card
                    key={c.id}
                    onClick={() => setSelectedCreative(c)}
                    className={cn('cursor-pointer transition-colors', isSelected ? 'border-2 border-green-500' : 'hover:border-gray-300')}
                  >
                    <CardContent className="p-3">
                      {c.fileType === 'image' ? (
                        <img src={c.fileUrl} alt={c.title} className="w-full h-32 object-cover rounded-lg mb-2" />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      <div className="font-medium text-sm text-gray-900">{c.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{topicName || 'Genérico'}</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id) }}
                        disabled={deleteMutation.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full mt-2"
                      >
                        <Trash2 className="w-3 h-3 mr-2" />Remover
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {!!broadcasts?.length && (
            <div>
              <Label className="text-base font-semibold">Histórico de disparos</Label>
              <div className="mt-2 space-y-2">
                {broadcasts.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg p-3">
                    <div>
                      <span className="font-medium text-gray-900">{b.creative?.title}</span>
                      <span className="text-gray-400 ml-2">{new Date(b.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {b.sentCount}/{b.totalTargets} enviados · {BROADCAST_STATUS_LABELS[b.status]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita — painel de envio */}
        <div className="lg:sticky lg:top-4 self-start">
          <Card>
            <CardContent className="p-4">
              {!selectedCreative ? (
                <div className="text-center py-12">
                  <Megaphone className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Selecione um criativo na biblioteca para enviar aos eleitores</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    {selectedCreative.fileType === 'image' ? (
                      <img src={selectedCreative.fileUrl} alt={selectedCreative.title} className="w-full h-40 object-cover rounded-lg mb-2" />
                    ) : (
                      <div className="w-full h-40 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    <Label className="text-base font-semibold">{selectedCreative.title}</Label>
                    <p className="text-xs text-gray-400">{topics?.find(t => t.topicKey === selectedCreative.topicKey)?.topicName || 'Genérico'}</p>
                  </div>

                  {(hasEmailChannel || hasTelegramChannel) && (
                    <div>
                      <Label htmlFor="broadcast-channel">Enviar por</Label>
                      <select
                        id="broadcast-channel"
                        className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        value={broadcastChannelType}
                        onChange={(e) => setBroadcastChannelType(e.target.value as 'WHATSAPP' | 'EMAIL' | 'TELEGRAM')}
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        {hasEmailChannel && <option value="EMAIL">E-mail</option>}
                        {hasTelegramChannel && <option value="TELEGRAM">Telegram</option>}
                      </select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="broadcast-type">Enviar para</Label>
                    <select
                      id="broadcast-type"
                      className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={broadcastContactType}
                      onChange={(e) => setBroadcastContactType(e.target.value)}
                    >
                      {Object.entries(CONTACT_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {loadingPreview ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#002776]" /></div>
                  ) : preview && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Contatos elegíveis</span><span className="font-medium">{preview.totalTargets}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Mensagens ativas restantes</span><span className="font-medium">{preview.activeMsgsRemaining}</span></div>
                      {preview.max24hPerLine !== null && (
                        <div className="flex justify-between"><span className="text-gray-500">Já enviados nas últimas 24h</span><span className="font-medium">{preview.sentLast24h}/{preview.max24hPerLine}</span></div>
                      )}
                      {preview.alreadyReceivedCount > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          {preview.alreadyReceivedCount} desses contatos já receberam este criativo antes.
                        </div>
                      )}
                      {exceedsMax && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                          Limite de {preview.maxTargets} contatos por disparo excedido. Restrinja o filtro.
                        </div>
                      )}
                      {exceedsQuota && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                          Mensagens ativas insuficientes para cobrir todos os contatos selecionados.
                        </div>
                      )}
                      {exceeds24h && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                          {broadcastChannelType === 'EMAIL'
                            ? `Esse disparo já excederia o limite de 24h por e-mail (${preview.max24hPerLine}). Aguarde para enviar novamente.`
                            : `Esse número já enviaria mais que o limite de 24h (${preview.max24hPerLine}). Aguarde ou use outro WhatsApp.`}
                        </div>
                      )}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800">
                        Este envio é considerado mensagem ativa e será registrado em log de auditoria. Use apenas para conteúdo já autorizado pelo contratante — todo re-engajamento deve seguir a Resolução TSE nº 23.755/2026.
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={!canConfirm || broadcastMutation.isPending}
                    onClick={() => broadcastMutation.mutate()}
                    style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
                  >
                    {broadcastMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Confirmar envio
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo criativo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="creative-title">Título</Label>
              <Input id="creative-title" className="mt-1" placeholder="Ex: Proposta de Saúde" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="creative-topic">Tema vinculado (opcional)</Label>
              <select
                id="creative-topic"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={topicKey}
                onChange={(e) => setTopicKey(e.target.value)}
              >
                <option value="">Nenhum (genérico)</option>
                {(topics || []).map((t) => (
                  <option key={t.topicKey} value={t.topicKey}>{t.topicName}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="creative-file">Arquivo</Label>
              <Input id="creative-file" type="file" className="mt-1" accept="image/*,video/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => uploadMutation.mutate()}
              disabled={!file || !title.trim() || uploadMutation.isPending}
              style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Enviar criativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal do Editor Visual */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-[#002776]" />Editor Visual de Criativos
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Crie santinhos, stories e banners personalizados com a identidade da sua campanha.</p>
              </div>
              <button onClick={() => setEditorOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <CreativeEditor
                candidateName={candidate?.name}
                candidateNumber={candidate?.candidateNumber ?? undefined}
                candidatePosition={candidate?.position ?? undefined}
                candidateParty={candidate?.party ?? undefined}
                candidatePhoto={candidate?.photoUrl ?? null}
                onExport={async (dataUrl, filename) => {
                  // Converte dataUrl para File e faz upload para a biblioteca
                  const res = await fetch(dataUrl)
                  const blob = await res.blob()
                  const pngFile = new File([blob], filename, { type: 'image/png' })
                  const fd = new FormData()
                  fd.append('file', pngFile)
                  fd.append('title', filename.replace('.png', '').replace('criativo-', 'Criativo '))
                  try {
                    await api.post('/creatives', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                    qc.invalidateQueries({ queryKey: ['creatives'] })
                    toast({ title: 'Criativo salvo na biblioteca!' })
                    // Também faz o download local
                    const a = document.createElement('a')
                    a.href = dataUrl
                    a.download = filename
                    a.click()
                  } catch {
                    // Se falhar o upload, ao menos faz o download
                    const a = document.createElement('a')
                    a.href = dataUrl
                    a.download = filename
                    a.click()
                    toast({ title: 'PNG exportado (falha ao salvar na biblioteca)' })
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConfigTab({ form, setForm, onSave, saving }: { form: Partial<AgentConfig>; setForm: (f: Partial<AgentConfig>) => void; onSave: () => void; saving: boolean }) {
  const { toast } = useToast()
  const [testMessage, setTestMessage] = useState('')
  const [testHistory, setTestHistory] = useState<{ role: string; content: string }[]>([])
  const [testLoading, setTestLoading] = useState(false)

  const sendTest = async () => {
    if (!testMessage.trim()) return
    const userMsg = { role: 'user', content: testMessage }
    setTestHistory((h) => [...h, userMsg])
    setTestMessage('')
    setTestLoading(true)
    try {
      const res = await api.post('/agent/test', { message: userMsg.content, history: testHistory })
      setTestHistory((h) => [...h, { role: 'assistant', content: res.data.response }])
    } catch (err: any) {
      toast({ title: 'Erro ao testar', description: err.response?.data?.error, variant: 'destructive' })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Voz (resposta em áudio)</Label>
              <p className="text-xs text-gray-400">Permite que o assistente responda eleitores com mensagens de voz</p>
            </div>
            <button
              onClick={() => setForm({ ...form, voiceEnabled: !form.voiceEnabled })}
              className={cn('w-11 h-6 rounded-full transition-colors', form.voiceEnabled ? 'bg-[#009C3B]' : 'bg-gray-300')}
            >
              <div className={cn('w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5', form.voiceEnabled ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>

          {form.voiceEnabled && (
            <div>
              <Label>Voz do assistente</Label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.ttsVoice || 'onyx'}
                onChange={(e) => setForm({ ...form, ttsVoice: e.target.value })}
              >
                {TTS_VOICES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="responseDelay">Velocidade de resposta (segundos de espera)</Label>
            <Input
              id="responseDelay"
              type="number"
              min={0}
              max={300}
              className="mt-1 w-32"
              value={form.responseDelay ?? 0}
              onChange={(e) => setForm({ ...form, responseDelay: Number(e.target.value) })}
            />
          </div>

          <div>
            <Label htmlFor="timezone">Fuso horário</Label>
            <Input
              id="timezone"
              className="mt-1"
              value={form.timezone || 'America/Sao_Paulo'}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>

          <Button onClick={onSave} disabled={saving} style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }} className="text-white">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar configurações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Label className="flex items-center gap-2 mb-3"><MessageSquareText className="w-4 h-4" /> Testar assistente</Label>
          <div className="space-y-2 max-h-80 overflow-y-auto mb-3 border border-gray-100 rounded-lg p-3 min-h-[120px]">
            {testHistory.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Envie uma mensagem para testar como o assistente responde</p>}
            {testHistory.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('rounded-lg px-3 py-2 text-sm max-w-[80%]', m.role === 'user' ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-800')}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Digite uma mensagem de teste..."
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendTest()}
            />
            <Button onClick={sendTest} disabled={testLoading || !testMessage.trim()}>
              {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
