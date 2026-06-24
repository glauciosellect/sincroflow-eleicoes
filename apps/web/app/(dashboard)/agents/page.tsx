'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Send, MessageSquareText } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = ['Minha História', 'Disclaimer', 'Plataforma Eleitoral', 'Configuração'] as const
type Tab = typeof TABS[number]

interface AgentConfig {
  agentName: string
  agentRole: string
  agentStyle: 'FORMAL' | 'INFORMAL' | 'ACOLHEDOR'
  story: string | null
  disclaimer: string
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
  const [tab, setTab] = useState<Tab>('Minha História')

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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Esta mensagem é obrigatória pela Resolução TSE nº 23.755/2026 e será enviada automaticamente na primeira mensagem de cada novo contato. Não remova a identificação como assistente virtual.
        </div>
        <div>
          <Label htmlFor="disclaimer">Mensagem de apresentação</Label>
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
          <div className="mt-2 bg-[#DCF8C6] rounded-2xl rounded-tl-none p-3 max-w-sm text-sm text-gray-800 shadow-sm">
            {form.disclaimer || 'Sua mensagem aparecerá aqui...'}
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
