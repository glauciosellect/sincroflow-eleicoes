'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Loader2, ClipboardList, Plus, ThumbsUp, HelpCircle, ThumbsDown,
  AlertCircle, CheckCircle2, Users, Phone, Calendar,
} from 'lucide-react'

type VoteIntention = 'APOIADOR' | 'INDECISO' | 'CRITICO'
type Tab = 'pesquisar' | 'resultados'

const INTENTIONS: { value: VoteIntention; label: string; icon: any; color: string; bg: string; border: string }[] = [
  { value: 'APOIADOR', label: 'Apoiador', icon: ThumbsUp, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-400' },
  { value: 'INDECISO', label: 'Indeciso', icon: HelpCircle, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-400' },
  { value: 'CRITICO', label: 'Crítico', icon: ThumbsDown, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400' },
]

const CARGOS = [
  { key: 'prefVereador', label: 'Vereador' },
  { key: 'prefDepEstadual', label: 'Dep. Estadual' },
  { key: 'prefDepFederal', label: 'Dep. Federal' },
  { key: 'prefSenador', label: 'Senador' },
  { key: 'prefGovernador', label: 'Governador' },
  { key: 'prefPresidente', label: 'Presidente' },
]

// ── Termômetro ─────────────────────────────────────────────────────────────────
function ThermometerBar({ totals, percentages }: { totals: any; percentages: any }) {
  return (
    <div className="space-y-3">
      <div className="flex rounded-full overflow-hidden h-4">
        {percentages.apoiador > 0 && <div className="bg-green-500 transition-all" style={{ width: `${percentages.apoiador}%` }} />}
        {percentages.indeciso > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${percentages.indeciso}%` }} />}
        {percentages.critico > 0 && <div className="bg-red-500 transition-all" style={{ width: `${percentages.critico}%` }} />}
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

// ── Formulário de coleta ───────────────────────────────────────────────────────
function SurveyForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast()
  const [voterName, setVoterName] = useState('')
  const [voterPhone, setVoterPhone] = useState('')
  const [cep, setCep] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [intention, setIntention] = useState<VoteIntention | null>(null)
  const [notes, setNotes] = useState('')
  const [prefs, setPrefs] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const lookupCep = async (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) { setNeighborhood(data.bairro || ''); setCity(data.localidade || '') }
    } catch { /* ignora */ } finally { setCepLoading(false) }
  }

  const mutation = useMutation({
    mutationFn: () => api.post('/surveys/vote', {
      voterName: voterName || undefined, voterPhone: voterPhone || undefined,
      cep: cep.replace(/\D/g, '') || undefined, neighborhood: neighborhood || undefined, city: city || undefined,
      intention, notes: notes || undefined,
      prefVereador: prefs.prefVereador || undefined, prefDepEstadual: prefs.prefDepEstadual || undefined,
      prefDepFederal: prefs.prefDepFederal || undefined, prefSenador: prefs.prefSenador || undefined,
      prefGovernador: prefs.prefGovernador || undefined, prefPresidente: prefs.prefPresidente || undefined,
    }),
    onSuccess: () => {
      setSubmitted(true); onSuccess()
      setTimeout(() => {
        setVoterName(''); setVoterPhone(''); setCep(''); setNeighborhood(''); setCity('')
        setIntention(null); setNotes(''); setPrefs({}); setSubmitted(false)
      }, 2000)
    },
    onError: (err: any) => toast({ title: 'Erro ao registrar', description: err.response?.data?.error || 'Tente novamente', variant: 'destructive' }),
  })

  if (submitted) return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-green-700">
      <CheckCircle2 className="w-12 h-12" />
      <p className="font-semibold text-lg">Registrado!</p>
      <p className="text-sm text-gray-500">Preparando para o próximo eleitor...</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Nome do eleitor</Label><Input className="mt-1" placeholder="Opcional" value={voterName} onChange={e => setVoterName(e.target.value)} /></div>
        <div><Label>Telefone</Label><Input className="mt-1" placeholder="Opcional" value={voterPhone} onChange={e => setVoterPhone(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>CEP</Label>
          <div className="relative mt-1">
            <Input placeholder="00000-000" value={cep} maxLength={9}
              onChange={e => { const v = e.target.value.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2'); setCep(v); lookupCep(v) }} />
            {cepLoading && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-gray-400" />}
          </div>
        </div>
        <div><Label>Bairro</Label><Input className="mt-1" placeholder="Auto ou manual" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} /></div>
        <div><Label>Cidade</Label><Input className="mt-1" placeholder="Auto ou manual" value={city} onChange={e => setCity(e.target.value)} /></div>
      </div>
      <div>
        <Label>Intenção de voto <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {INTENTIONS.map(opt => {
            const Icon = opt.icon; const selected = intention === opt.value
            return (
              <button key={opt.value} type="button" onClick={() => setIntention(opt.value)}
                className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-medium',
                  selected ? `${opt.bg} ${opt.border} ${opt.color}` : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                <Icon className="w-5 h-5" />{opt.label}
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
              <Input className="mt-0.5 text-sm" placeholder="Nome do candidato..."
                value={prefs[cargo.key] || ''} onChange={e => setPrefs(p => ({ ...p, [cargo.key]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>
      <div><Label>Observações</Label><Input className="mt-1" placeholder="Opcional — tema principal, preocupação mencionada..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <Button className="w-full" disabled={!intention || mutation.isPending} onClick={() => mutation.mutate()}
        style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
        Registrar
      </Button>
    </div>
  )
}

// ── Resultados ─────────────────────────────────────────────────────────────────
function ResultadosTab() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['survey-summary-pesquisa'],
    queryFn: () => api.get('/surveys/vote/summary').then(r => r.data),
    refetchInterval: 60 * 1000,
  })

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !summary || summary.totals.total === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma pesquisa registrada ainda.</p>
          <p className="text-xs mt-1">Use a aba "Realizar Pesquisa" para começar.</p>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4" />Termômetro geral</CardTitle></CardHeader>
            <CardContent><ThermometerBar totals={summary.totals} percentages={summary.percentages} /></CardContent>
          </Card>

          {summary.byNeighborhood?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">{summary.regionLabel ?? 'Por bairro / região'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(
                    summary.byNeighborhood.reduce((acc: any, row: any) => {
                      if (!row.neighborhood) return acc
                      if (!acc[row.neighborhood]) acc[row.neighborhood] = { APOIADOR: 0, INDECISO: 0, CRITICO: 0 }
                      acc[row.neighborhood][row.intention] += row._count
                      return acc
                    }, {})
                  ).slice(0, 10).map(([bairro, counts]: any) => {
                    const tot = counts.APOIADOR + counts.INDECISO + counts.CRITICO
                    return (
                      <div key={bairro} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-36 truncate font-medium">{bairro}</span>
                        <div className="flex-1 flex rounded-full overflow-hidden h-3">
                          {counts.APOIADOR > 0 && <div className="bg-green-500" style={{ width: `${Math.round(counts.APOIADOR / tot * 100)}%` }} />}
                          {counts.INDECISO > 0 && <div className="bg-amber-400" style={{ width: `${Math.round(counts.INDECISO / tot * 100)}%` }} />}
                          {counts.CRITICO > 0 && <div className="bg-red-500" style={{ width: `${Math.round(counts.CRITICO / tot * 100)}%` }} />}
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{tot}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {summary.byAgent?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><Users className="w-4 h-4" />Por agente de campo</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100">
                  {summary.byAgent.map((agent: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
                        {agent.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-800 w-32 truncate">{agent.name}</span>
                      <div className="flex gap-2 flex-1 flex-wrap">
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
        </>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function PesquisaPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('pesquisar')

  const tabs = [
    { key: 'pesquisar', label: 'Realizar Pesquisa', icon: ClipboardList },
    { key: 'resultados', label: 'Resultados', icon: Users },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pesquisa de Voto</h1>
        <p className="text-sm text-gray-500">Coleta de intenções de voto em campo e análise de resultados</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      {tab === 'pesquisar' && (
        <div className="max-w-2xl">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" />Registrar intenção de voto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SurveyForm onSuccess={() => {
                qc.invalidateQueries({ queryKey: ['survey-summary-pesquisa'] })
                qc.invalidateQueries({ queryKey: ['survey-map'] })
              }} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'resultados' && <ResultadosTab />}
    </div>
  )
}
