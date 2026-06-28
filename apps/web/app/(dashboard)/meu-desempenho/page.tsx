'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Award, Users, Phone } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'

// Tela de captação de eleitores em campo (Agentes de Campo) — visão pessoal para
// o próprio agente, e ranking completo para o Administrador decidir bonificação.
export default function MeuDesempenhoPage() {
  const { role } = useAuthStore()
  const isAdmin = role === 'ADMINISTRADOR'

  if (isAdmin) return <RankingView />
  return <MyPerformanceView />
}

function MyPerformanceView() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-field-performance'],
    queryFn: () => api.get('/analytics/my-field-performance').then(r => r.data),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Desempenho</h1>
        <p className="text-gray-500 text-sm mt-1">Eleitores que você captou em campo, identificados quando mencionam seu nome ao falar com o assistente.</p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}>
            <Award className="w-7 h-7" />
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">{data?.count ?? 0}</div>
            <div className="text-sm text-gray-500">eleitores captados</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base font-semibold">Eleitores captados</CardTitle></CardHeader>
        <CardContent>
          {(!data?.contacts || data.contacts.length === 0) ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Nenhum eleitor captado ainda. Oriente quem você abordar a mandar uma mensagem ao WhatsApp da campanha mencionando seu nome.
            </div>
          ) : (
            <div className="space-y-2">
              {data.contacts.map((c: any, i: number) => (
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

function RankingView() {
  const { data, isLoading } = useQuery({
    queryKey: ['field-agent-ranking'],
    queryFn: () => api.get('/analytics/field-agent-ranking').then(r => r.data),
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#002776]" /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ranking de Agentes de Campo</h1>
        <p className="text-gray-500 text-sm mt-1">Eleitores captados por cada agente — use para decidir bonificação por desempenho.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {(!data || data.length === 0) ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              Nenhum Agente de Campo cadastrado ainda. Convide um em Equipe.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.map((agent: any, i: number) => (
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
