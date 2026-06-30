'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ShieldCheck, ShieldX, ShieldAlert, ShieldQuestion, BookMarked, BookmarkPlus, Search, Clock, Copy, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type Verdict = 'VERDADEIRO' | 'FALSO' | 'PARCIALMENTE_VERDADEIRO' | 'INCONCLUSIVO'

interface FactCheckResult {
  id: string
  query: string
  verdict: Verdict
  analysis: string
  suggestedReply: string
  sources: string[]
  savedToLibrary: boolean
  checkedBy?: { name: string }
  createdAt: string
}

const VERDICT_CONFIG: Record<Verdict, { label: string; icon: any; color: string; bg: string; border: string }> = {
  VERDADEIRO: { label: 'Verdadeiro', icon: ShieldCheck, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  FALSO: { label: 'Falso', icon: ShieldX, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  PARCIALMENTE_VERDADEIRO: { label: 'Parcialmente verdadeiro', icon: ShieldAlert, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  INCONCLUSIVO: { label: 'Inconclusivo', icon: ShieldQuestion, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const cfg = VERDICT_CONFIG[verdict]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className="w-4 h-4" />{cfg.label}
    </span>
  )
}

function ResultCard({ result, onToggleLibrary }: { result: FactCheckResult; onToggleLibrary: (id: string, saved: boolean) => void }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const copyReply = () => {
    navigator.clipboard.writeText(result.suggestedReply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className={`border-l-4 ${VERDICT_CONFIG[result.verdict]?.border ?? 'border-gray-200'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <button
              className="flex items-center gap-2 text-left w-full"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
              <p className="text-sm text-gray-700 font-medium line-clamp-2">{result.query}</p>
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <VerdictBadge verdict={result.verdict} />
            <button
              onClick={() => onToggleLibrary(result.id, !result.savedToLibrary)}
              title={result.savedToLibrary ? 'Remover da biblioteca' : 'Salvar na biblioteca'}
              className={`p-1.5 rounded-lg transition-colors ${result.savedToLibrary ? 'text-[#002776] bg-blue-50' : 'text-gray-400 hover:text-[#002776] hover:bg-blue-50'}`}
            >
              {result.savedToLibrary ? <BookMarked className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Análise */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Análise</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.analysis}</p>
          </div>

          {/* Resposta sugerida */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Resposta sugerida para o eleitor</p>
              <button
                onClick={copyReply}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                {copied ? <><CheckCircle2 className="w-3.5 h-3.5" />Copiado!</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
              </button>
            </div>
            <p className="text-sm text-blue-900 leading-relaxed italic">"{result.suggestedReply}"</p>
          </div>

          {/* Fontes */}
          {result.sources?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Fontes</p>
              <ul className="space-y-0.5">
                {result.sources.map((s, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="mt-0.5 text-gray-300">•</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 border-t border-gray-100 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {formatDate(result.createdAt)}
            {result.checkedBy && <span>· por {result.checkedBy.name}</span>}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function ConsultorFatosPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<FactCheckResult | null>(null)
  const [tab, setTab] = useState<'consultar' | 'historico' | 'biblioteca'>('consultar')
  const [search, setSearch] = useState('')

  const analyzeMutation = useMutation({
    mutationFn: (q: string) => api.post('/factcheck/analyze', { query: q, saveToLibrary: false }).then(r => r.data),
    onSuccess: (data) => {
      setResult(data)
      qc.invalidateQueries({ queryKey: ['factcheck-history'] })
    },
    onError: () => toast({ title: 'Erro ao consultar', description: 'Tente novamente em instantes.', variant: 'destructive' }),
  })

  const libraryMutation = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) =>
      api.patch(`/factcheck/${id}/library`, { saved }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factcheck-history'] })
      qc.invalidateQueries({ queryKey: ['factcheck-library'] })
      if (result) setResult(prev => prev ? { ...prev, savedToLibrary: !prev.savedToLibrary } : prev)
    },
  })

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['factcheck-history'],
    queryFn: () => api.get('/factcheck').then(r => r.data),
    enabled: tab === 'historico',
  })

  const { data: library, isLoading: loadingLibrary } = useQuery({
    queryKey: ['factcheck-library'],
    queryFn: () => api.get('/factcheck?libraryOnly=true').then(r => r.data),
    enabled: tab === 'biblioteca',
  })

  const handleAnalyze = () => {
    if (!query.trim()) return
    setResult(null)
    analyzeMutation.mutate(query.trim())
  }

  const filteredHistory = (history ?? []).filter((r: FactCheckResult) =>
    !search || r.query.toLowerCase().includes(search.toLowerCase())
  )
  const filteredLibrary = (library ?? []).filter((r: FactCheckResult) =>
    !search || r.query.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Consultor de Fatos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Cole uma dúvida ou boato recebido em campo. A IA analisa e gera uma resposta para o eleitor.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'consultar', label: 'Consultar' },
          { key: 'historico', label: 'Histórico' },
          { key: 'biblioteca', label: 'Biblioteca' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch('') }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Consultar */}
      {tab === 'consultar' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#002776]" />
                O que o eleitor disse ou perguntou?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ex: &quot;Ouvi que o candidato foi condenado por desvio de verba&quot; ou &quot;É verdade que a proposta de saúde vai acabar com o SUS?&quot;"
                rows={4}
                className="resize-none text-sm"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{query.length}/2000 caracteres</p>
                <Button
                  onClick={handleAnalyze}
                  disabled={!query.trim() || analyzeMutation.isPending}
                  className="bg-[#002776] hover:bg-[#001a5e] text-white"
                >
                  {analyzeMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analisando...</>
                    : <><ShieldCheck className="w-4 h-4 mr-2" />Analisar</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {analyzeMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#002776]" />
              <p className="text-sm">Consultando fontes e analisando...</p>
            </div>
          )}

          {result && !analyzeMutation.isPending && (
            <ResultCard
              result={result}
              onToggleLibrary={(id, saved) => libraryMutation.mutate({ id, saved })}
            />
          )}

          {!result && !analyzeMutation.isPending && (
            <div className="text-center py-12 text-gray-300">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm text-gray-400">Cole uma dúvida ou boato acima para começar</p>
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      {tab === 'historico' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar no histórico..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002776]/20"
            />
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#002776]" /></div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              Nenhuma consulta encontrada.
            </div>
          ) : (
            filteredHistory.map((r: FactCheckResult) => (
              <ResultCard key={r.id} result={r} onToggleLibrary={(id, saved) => libraryMutation.mutate({ id, saved })} />
            ))
          )}
        </div>
      )}

      {/* Biblioteca */}
      {tab === 'biblioteca' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar na biblioteca..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#002776]/20"
            />
          </div>
          <p className="text-xs text-gray-400">Consultas salvas ficam disponíveis para toda a equipe reusar quando o mesmo boato aparecer novamente.</p>

          {loadingLibrary ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#002776]" /></div>
          ) : filteredLibrary.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <BookMarked className="w-10 h-10 mx-auto mb-2 opacity-30" />
              Nenhuma consulta salva na biblioteca ainda.<br />
              Clique no ícone de marcador em qualquer consulta para salvar.
            </div>
          ) : (
            filteredLibrary.map((r: FactCheckResult) => (
              <ResultCard key={r.id} result={r} onToggleLibrary={(id, saved) => libraryMutation.mutate({ id, saved })} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
