'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Award, Users, Phone, ThumbsUp, HelpCircle, ThumbsDown, Plus, CheckCircle2, ClipboardList } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

type VoteIntention = 'APOIADOR' | 'INDECISO' | 'CRITICO'

const INTENTIONS: { value: VoteIntention; label: string; icon: any; color: string; bg: string; border: string }[] = [
  { value: 'APOIADOR', label: 'Apoiador', icon: ThumbsUp, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-400' },
  { value: 'INDECISO', label: 'Indeciso', icon: HelpCircle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-400' },
  { value: 'CRITICO', label: 'Crítico', icon: ThumbsDown, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400' },
]

export default function MeuDesempenhoPage() {
  const { role } = useAuthStore()
  const isAdmin = role === 'ADMINISTRADOR'

  if (isAdmin) return <AdminView />
  return <AgentView />
}

const CARGOS = [
  { key: 'prefVereador', label: 'Vereador' },
  { key: 'prefDepEstadual', label: 'Dep. Estadual' },
  { key: 'prefDepFederal', label: 'Dep. Federal' },
  { key: 'prefSenador', label: 'Senador' },
  { key: 'prefGovernador', label: 'Governador' },
  { key: 'prefPresidente', label: 'Presidente' },
]

function SurveyForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast()
  const [voterName, setVoterName] = useState('')
  const [voterPhone, setVoterPhone] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [intention, setIntention] = useState<VoteIntention | null>(null)
  const [notes, setNotes] = useState('')
  const [prefs, setPrefs] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.post('/surveys/vote', {
      voterName: voterName || undefined,
      voterPhone: voterPhone || undefined,
      neighborhood: neighborhood || undefined,
      intention,
      notes: notes || undefined,
      prefVereador: prefs.prefVereador || undefined,
      prefDepEstadual: prefs.prefDepEstadual || undefined,
      prefDepFederal: prefs.prefDepFederal || undefined,
      prefSenador: prefs.prefSenador || undefined,
      prefGovernador: prefs.prefGovernador || undefined,
      prefPresidente: prefs.prefPresidente || undefined,
    }),
    onSuccess: () => {
      setSubmitted(true)
      onSuccess()
      setTimeout(() => {
        setVoterName(''); setVoterPhone(''); setNeighborhood(''); setIntention(null); setNotes(''); setPrefs({}); setSubmitted(false)
      }, 2000)
    },
    onError: (err: any) => toast({ title: 'Erro ao registrar', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-green-700">
        <CheckCircle2 className="w-12 h-12" />
        <p className="font-semibold text-lg">Registrado!</p>
        <p className="text-sm text-gray-500">Preparando para o próximo eleitor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Nome do eleitor</Label>
          <Input className="mt-1" placeholder="Opcional" value={voterName} onChange={e => setVoterName(e.target.value)} />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input className="mt-1" placeholder="Opcional" value={voterPhone} onChange={e => setVoterPhone(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Bairro / Região</Label>
        <Input className="mt-1" placeholder="Ex: Centro, Vila Nova..." value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
      </div>

      <div>
        <Label>Intenção de voto <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {INTENTIONS.map(opt => {
            const Icon = opt.icon
            const selected = intention === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntention(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium',
                  selected ? `${opt.bg} ${opt.border} ${opt.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                )}
              >
                <Icon className="w-5 h-5" />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <Label className="text-sm font-semibold text-gray-700">Preferências por cargo <span className="font-normal text-gray-400">(opcional)</span></Label>
        <p className="text-xs text-gray-400 mb-2 mt-0.5">Escreva o nome do candidato preferido em cada cargo</p>
        <div className="grid grid-cols-2 gap-2">
          {CARGOS.map(cargo => (
            <div key={cargo.key}>
              <Label className="text-xs text-gray-500">{cargo.label}</Label>
              <Input
                className="mt-0.5 text-sm"
                placeholder="Nome do candidato..."
                value={prefs[cargo.key] || ''}
                onChange={e => setPrefs(p => ({ ...p, [cargo.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>Observações</Label>
        <Input className="mt-1" placeholder="Opcional — tema principal, preocupação mencionada..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <Button
        className="w-full"
        disabled={!intention || mutation.isPending}
        onClick={() => mutation.mutate()}
        style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        Registrar
      </Button>
    </div>
  )
}

function AgentView() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['my-field-performance'],
    queryFn: () => api.get('/analytics/my-field-performance').then(r => r.data),
  })
  const { data: surveySummary } = useQuery({
    queryKey: ['survey-summary-agent'],
    queryFn: () => api.get('/surveys/vote/summary').then(r => r.data),
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Desempenho</h1>
        <p className="text-gray-500 text-sm mt-1">Registre intenções de voto e acompanhe sua captação em campo.</p>
      </div>

      {/* Termômetro pessoal */}
      {surveySummary && surveySummary.totals.total > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4" />Pesquisas registradas por mim</CardTitle></CardHeader>
          <CardContent>
            <ThermometerBar totals={surveySummary.totals} percentages={surveySummary.percentages} />
          </CardContent>
        </Card>
      )}

      {/* Formulário de coleta */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />Registrar intenção de voto</CardTitle></CardHeader>
        <CardContent>
          <SurveyForm onSuccess={() => qc.invalidateQueries({ queryKey: ['survey-summary-agent'] })} />
        </CardContent>
      </Card>

      {/* Captação via WhatsApp */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Award className="w-4 h-4" />
            Captação via WhatsApp
            <span className="ml-auto text-2xl font-bold text-gray-900">{isLoading ? '—' : (data?.count ?? 0)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 mb-3">Eleitores que mencionaram seu nome ao falar com o assistente.</p>
          {(!data?.contacts || data.contacts.length === 0) ? (
            <div className="text-center py-6 text-gray-400 text-sm">Nenhum eleitor captado via WhatsApp ainda.</div>
          ) : (
            <div className="space-y-2">
              {data.contacts.slice(0, 10).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                    {(c.name || c.phone || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.name || 'Sem nome'}</div>
                    {c.phone && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone className="w-3 h-3" />{c.phone}</div>}
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(c.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ThermometerBar({ totals, percentages }: { totals: any; percentages: any }) {
  return (
    <div className="space-y-3">
      <div className="flex rounded-full overflow-hidden h-4">
        {percentages.apoiador > 0 && <div className="bg-green-500 transition-all" style={{ width: `${percentages.apoiador}%` }} title={`Apoiadores: ${percentages.apoiador}%`} />}
        {percentages.indeciso > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${percentages.indeciso}%` }} title={`Indecisos: ${percentages.indeciso}%`} />}
        {percentages.critico > 0 && <div className="bg-red-500 transition-all" style={{ width: `${percentages.critico}%` }} title={`Críticos: ${percentages.critico}%`} />}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-50 rounded-lg p-2">
          <div className="text-xl font-bold text-green-700">{totals.apoiador}</div>
          <div className="text-xs text-green-600">{percentages.apoiador}% Apoiadores</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <div className="text-xl font-bold text-amber-700">{totals.indeciso}</div>
          <div className="text-xs text-amber-600">{percentages.indeciso}% Indecisos</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-xl font-bold text-red-700">{totals.critico}</div>
          <div className="text-xs text-red-600">{percentages.critico}% Críticos</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-center">{totals.total} eleitores pesquisados</p>
    </div>
  )
}

function AdminView() {
  const qc = useQueryClient()
  const { data: ranking, isLoading: loadingRanking } = useQuery({
    queryKey: ['field-agent-ranking'],
    queryFn: () => api.get('/analytics/field-agent-ranking').then(r => r.data),
  })
  const { data: surveySummary, isLoading: loadingSurvey } = useQuery({
    queryKey: ['survey-summary'],
    queryFn: () => api.get('/surveys/vote/summary').then(r => r.data),
    refetchInterval: 60 * 1000,
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pesquisa de Intenção de Voto</h1>
        <p className="text-gray-500 text-sm mt-1">Dados coletados pelos agentes de campo nos últimos 30 dias.</p>
      </div>

      {/* Termômetro geral */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4" />Termômetro geral</CardTitle></CardHeader>
        <CardContent>
          {loadingSurvey ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#002776]" /></div>
          ) : !surveySummary || surveySummary.totals.total === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhuma pesquisa registrada ainda. Os agentes de campo registram pelo menu "Meu Desempenho".</div>
          ) : (
            <ThermometerBar totals={surveySummary.totals} percentages={surveySummary.percentages} />
          )}
        </CardContent>
      </Card>

      {/* Por bairro */}
      {surveySummary?.byNeighborhood?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Por bairro / região</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(
                surveySummary.byNeighborhood.reduce((acc: any, row: any) => {
                  if (!row.neighborhood) return acc
                  if (!acc[row.neighborhood]) acc[row.neighborhood] = { APOIADOR: 0, INDECISO: 0, CRITICO: 0 }
                  acc[row.neighborhood][row.intention] += row._count
                  return acc
                }, {})
              ).slice(0, 10).map(([bairro, counts]: any) => {
                const total = counts.APOIADOR + counts.INDECISO + counts.CRITICO
                return (
                  <div key={bairro} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-32 truncate font-medium">{bairro}</span>
                    <div className="flex-1 flex rounded-full overflow-hidden h-3">
                      {counts.APOIADOR > 0 && <div className="bg-green-500" style={{ width: `${Math.round(counts.APOIADOR / total * 100)}%` }} />}
                      {counts.INDECISO > 0 && <div className="bg-amber-400" style={{ width: `${Math.round(counts.INDECISO / total * 100)}%` }} />}
                      {counts.CRITICO > 0 && <div className="bg-red-500" style={{ width: `${Math.round(counts.CRITICO / total * 100)}%` }} />}
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{total}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Por agente */}
      {surveySummary?.byAgent?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Por agente de campo</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {surveySummary.byAgent.map((agent: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                    {agent.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800 w-28 truncate">{agent.name}</span>
                  <div className="flex gap-2 flex-1">
                    <span className="text-xs bg-green-50 text-green-700 rounded px-1.5 py-0.5">{agent.APOIADOR} ap.</span>
                    <span className="text-xs bg-amber-50 text-amber-700 rounded px-1.5 py-0.5">{agent.INDECISO} ind.</span>
                    <span className="text-xs bg-red-50 text-red-700 rounded px-1.5 py-0.5">{agent.CRITICO} cr.</span>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{agent.total}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preferências por cargo */}
      {surveySummary?.byCargoRanking && Object.keys(surveySummary.byCargoRanking).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Preferências por cargo</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(surveySummary.byCargoRanking).map(([cargo, data]: any) => (
                <div key={cargo} className="space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{data.label}</p>
                  {data.top.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">#{i + 1}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-[#002776] h-2 rounded-full" style={{ width: `${Math.round((item.count / data.top[0].count) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-700 capitalize truncate max-w-[100px]">{item.name}</span>
                      <span className="text-xs font-bold text-gray-500 shrink-0">{item.count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário também disponível para admin */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><Plus className="w-4 h-4" />Registrar intenção de voto</CardTitle></CardHeader>
        <CardContent>
          <SurveyForm onSuccess={() => qc.invalidateQueries({ queryKey: ['survey-summary'] })} />
        </CardContent>
      </Card>

      {/* Ranking captação WhatsApp */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Ranking de captação via WhatsApp</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loadingRanking ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#002776]" /></div>
          ) : (!ranking || ranking.length === 0) ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              Nenhum Agente de Campo cadastrado ainda.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {ranking.map((agent: any, i: number) => (
                <div key={agent.id} className="flex items-center gap-3 p-4">
                  <span className="text-sm font-bold text-gray-400 w-6">#{i + 1}</span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                    {agent.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{agent.name}</div>
                    <Badge variant={agent.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-xs mt-0.5">{agent.status === 'ACTIVE' ? 'Ativo' : agent.status}</Badge>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{agent.count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
