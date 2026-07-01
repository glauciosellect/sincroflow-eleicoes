'use client'
import dynamic from 'next/dynamic'
import { useState, Component, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Map, Users, ThumbsUp, HelpCircle, ThumbsDown, AlertCircle } from 'lucide-react'

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
          <AlertCircle className="w-10 h-10 text-amber-400" />
          <p className="text-sm font-medium text-gray-500">Não foi possível carregar o mapa.</p>
          <button className="text-xs text-[#002776] underline" onClick={() => this.setState({ hasError: false })}>
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
      <Loader2 className="w-6 h-6 animate-spin text-[#002776]" />
    </div>
  ),
})

const PERIOD_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
]

export default function MapaApoiadoresPage() {
  const [days, setDays] = useState(30)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, isLoading, error } = useQuery({
    queryKey: ['survey-map', days],
    queryFn: () => api.get(`/surveys/vote/map?since=${since}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const points = data?.points ?? []
  const totalApoiador = points.reduce((s: number, p: any) => s + p.apoiador, 0)
  const totalIndeciso = points.reduce((s: number, p: any) => s + p.indeciso, 0)
  const totalCritico = points.reduce((s: number, p: any) => s + p.critico, 0)
  const total = totalApoiador + totalIndeciso + totalCritico

  return (
    <div className="space-y-4 h-full flex flex-col max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Map className="w-6 h-6 text-[#002776]" />
            Mapa de Apoiadores
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data?.regionLabel === 'Cidade' ? 'Distribuição por cidade' : 'Distribuição por bairro'} — baseado nos CEPs coletados em campo
          </p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${days === opt.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Totalizadores */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-green-100">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <ThumbsUp className="w-4 h-4 text-green-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-700">{totalApoiador}</div>
                <div className="text-xs text-green-600">{total > 0 ? Math.round(totalApoiador / total * 100) : 0}% Apoiadores</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-700">{totalIndeciso}</div>
                <div className="text-xs text-amber-600">{total > 0 ? Math.round(totalIndeciso / total * 100) : 0}% Indecisos</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-100">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <ThumbsDown className="w-4 h-4 text-red-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-700">{totalCritico}</div>
                <div className="text-xs text-red-600">{total > 0 ? Math.round(totalCritico / total * 100) : 0}% Críticos</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Mapa */}
      <Card className="flex-1 min-h-[480px]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Map className="w-4 h-4 text-[#002776]" />
            {data?.regionLabel === 'Cidade' ? 'Por cidade' : 'Por bairro'}
            {points.length > 0 && <span className="text-xs font-normal text-gray-400 ml-1">· {points.length} {data?.regionLabel === 'Cidade' ? 'cidades' : 'bairros'} com dados</span>}
          </CardTitle>
          {/* Legenda */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" />Apoiador</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />Indeciso</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" />Crítico</span>
          </div>
        </CardHeader>
        <CardContent className="p-3 h-[calc(100%-60px)]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#002776]" />
              <p className="text-sm">Buscando dados e geocodificando regiões...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-red-400">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">Erro ao carregar mapa. Tente novamente.</p>
            </div>
          ) : points.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
              <Map className="w-14 h-14 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-400">Nenhum dado no período</p>
                <p className="text-xs text-gray-400 mt-1">
                  Registre pesquisas de voto com CEP para ver o mapa de distribuição.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-lg overflow-hidden">
              <MapErrorBoundary>
                <MapComponent points={points} regionLabel={data?.regionLabel ?? 'Bairro'} />
              </MapErrorBoundary>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking de regiões */}
      {points.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#002776]" />
              Ranking por {data?.regionLabel === 'Cidade' ? 'cidade' : 'bairro'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...points]
                .sort((a: any, b: any) => b.total - a.total)
                .slice(0, 8)
                .map((point: any, i: number) => {
                  const pAp = point.total > 0 ? Math.round(point.apoiador / point.total * 100) : 0
                  const pIn = point.total > 0 ? Math.round(point.indeciso / point.total * 100) : 0
                  const pCr = point.total > 0 ? Math.round(point.critico / point.total * 100) : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                      <span className="text-sm font-medium text-gray-700 w-32 truncate">{point.region}</span>
                      <div className="flex-1 flex rounded-full overflow-hidden h-3">
                        {pAp > 0 && <div className="bg-green-500 transition-all" style={{ width: `${pAp}%` }} title={`Apoiadores: ${pAp}%`} />}
                        {pIn > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${pIn}%` }} title={`Indecisos: ${pIn}%`} />}
                        {pCr > 0 && <div className="bg-red-500 transition-all" style={{ width: `${pCr}%` }} title={`Críticos: ${pCr}%`} />}
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right font-medium">{point.total}</span>
                    </div>
                  )
                })}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Círculo maior = mais eleitores naquela região · Cor = intenção predominante
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
