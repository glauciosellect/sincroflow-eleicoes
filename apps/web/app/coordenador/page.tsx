'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Users, MapPin, Target, TrendingUp, Plus, LogOut, Phone, CheckCircle, Trophy, BarChart2, ThumbsUp, ThumbsDown, Minus, UserCheck, AlertCircle, Clock, Activity } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'
const STORAGE_KEY = 'coord_token'
function getToken() { return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null }

interface DashData {
  coordenador: { nome: string; cidade?: string; bairros: string[]; metaVotos?: number }
  stats: { totalCadastros: number; checkIns: number; metaVotos: number; metaPct: number }
  ultimosCadastros: { id: string; nome: string; telefone: string; cidade?: string; createdAt: string }[]
}

interface RankingItem {
  id: string; nome: string; cidade?: string; cadastros: number
  checkins: number; metaVotos?: number; pct: number; isMe: boolean
}

interface Pesquisas {
  total: number
  intencoes: { intencao: string; total: number; pct: number }[]
  ultimas: { id: string; voterName?: string; intention: string; neighborhood?: string; city?: string; createdAt: string }[]
}

interface MembroEquipe {
  id: string
  nome: string
  email: string
  whatsapp?: string
  role: string
  regiao?: string
  pesquisasTotal: number
  pesquisas7d: number
  apoiadores: number
  indecisos: number
  criticos: number
  ultimaAtividade?: string
  diasSemAtividade?: number
  statusAtividade: 'hoje' | 'ativo' | 'regular' | 'inativo' | 'nunca'
}

interface Equipe {
  equipe: MembroEquipe[]
  total: number
}

const INTENCAO_CONFIG: Record<string, { label: string; icon: typeof ThumbsUp; color: string; bg: string }> = {
  FAVORAVEL: { label: 'Favorável', icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-100' },
  DESFAVORAVEL: { label: 'Desfavorável', icon: ThumbsDown, color: 'text-red-500', bg: 'bg-red-100' },
  INDECISO: { label: 'Indeciso', icon: Minus, color: 'text-amber-500', bg: 'bg-amber-100' },
  NEUTRO: { label: 'Neutro', icon: Minus, color: 'text-gray-400', bg: 'bg-gray-100' },
}

export default function CoordenadorDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [pesquisas, setPesquisas] = useState<Pesquisas | null>(null)
  const [tab, setTab] = useState<'home' | 'ranking' | 'pesquisas' | 'equipe'>('home')
  const [equipe, setEquipe] = useState<Equipe | null>(null)
  const [loading, setLoading] = useState(true)

  const token = getToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    if (!token) { router.push('/coordenador/login'); return }
    axios.get(`${API_URL}/coordenador/dashboard`, { headers })
      .then(r => setData(r.data))
      .catch(() => { localStorage.removeItem(STORAGE_KEY); router.push('/coordenador/login') })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!token) return
    if (tab === 'ranking' && ranking.length === 0) {
      axios.get(`${API_URL}/coordenador/ranking`, { headers }).then(r => setRanking(r.data)).catch(() => {})
    }
    if (tab === 'pesquisas' && !pesquisas) {
      axios.get(`${API_URL}/coordenador/pesquisas`, { headers }).then(r => setPesquisas(r.data)).catch(() => {})
    }
    if (tab === 'equipe' && !equipe) {
      axios.get(`${API_URL}/coordenador/minha-equipe`, { headers }).then(r => setEquipe(r.data)).catch(() => {})
    }
  }, [tab])

  const logout = () => { localStorage.removeItem(STORAGE_KEY); router.push('/coordenador/login') }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#002776] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null
  const { coordenador, stats, ultimosCadastros } = data

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-[#002776] text-white px-4 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-sm opacity-75">Olá,</p>
            <h1 className="text-xl font-bold">{coordenador.nome}</h1>
          </div>
          <button onClick={logout} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        {coordenador.cidade && (
          <div className="flex items-center gap-1.5 text-sm opacity-75 mt-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>{coordenador.cidade}{coordenador.bairros.length > 0 ? ` — ${coordenador.bairros.join(', ')}` : ''}</span>
          </div>
        )}
        <p className="text-xs opacity-50 mt-1">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b sticky top-0 z-10">
        {[
          { key: 'home', label: 'Início', icon: Users },
          { key: 'equipe', label: 'Equipe', icon: UserCheck },
          { key: 'ranking', label: 'Ranking', icon: Trophy },
          { key: 'pesquisas', label: 'Pesquisas', icon: BarChart2 },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-gray-400'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── HOME ── */}
      {tab === 'home' && (
        <div className="px-4 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Eleitores</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCadastros}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs text-gray-500 font-medium">Check-ins</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.checkIns}</p>
            </div>
            {stats.metaVotos > 0 && (<>
              <div className="bg-white rounded-2xl p-4 shadow-sm border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Target className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Minha Meta</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.metaVotos.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">Progresso</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.metaPct}%</p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${stats.metaPct}%` }} />
                </div>
              </div>
            </>)}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-900 text-sm">Últimos cadastros</h2>
              <a href="/coordenador/eleitores" className="text-xs text-[#002776] font-medium">Ver todos</a>
            </div>
            {ultimosCadastros.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Nenhum cadastro ainda</div>
            ) : (
              <div className="divide-y">
                {ultimosCadastros.map(c => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-gray-600">{c.nome.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.nome}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefone}</span>
                        {c.cidade && <span>· {c.cidade}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(c.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EQUIPE ── */}
      {tab === 'equipe' && (
        <div className="px-4 py-5 space-y-3">
          {!equipe ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : equipe.total === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              <UserCheck className="w-10 h-10 mx-auto mb-3 text-gray-200" />
              <p>Nenhum agente de campo cadastrado ainda.</p>
              <p className="text-xs mt-1">Os agentes aparecem aqui quando tiverem o papel "Agente de Campo" na equipe.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 text-center">{equipe.total} membros · últimos 7 dias</p>
              {equipe.equipe.map((m) => {
                const statusCor = m.statusAtividade === 'hoje' ? 'bg-green-500'
                  : m.statusAtividade === 'ativo' ? 'bg-green-400'
                  : m.statusAtividade === 'regular' ? 'bg-amber-400'
                  : m.statusAtividade === 'inativo' ? 'bg-red-400'
                  : 'bg-gray-300'
                const statusLabel = m.statusAtividade === 'hoje' ? 'Ativo hoje'
                  : m.statusAtividade === 'ativo' ? `${m.diasSemAtividade}d atrás`
                  : m.statusAtividade === 'regular' ? `${m.diasSemAtividade}d atrás`
                  : m.statusAtividade === 'inativo' ? `${m.diasSemAtividade}d sem ativ.`
                  : 'Sem atividade'

                return (
                  <div key={m.id} className="bg-white rounded-2xl shadow-sm border p-4">
                    {/* Cabeçalho do membro */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#002776]/10 flex items-center justify-center shrink-0 font-bold text-[#002776]">
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{m.nome}</p>
                        <p className="text-xs text-gray-400">{m.role === 'AGENTE_CAMPO' ? 'Agente de Campo' : 'Coordenador'}{m.regiao ? ` · ${m.regiao}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${statusCor}`} />
                        <span className="text-xs text-gray-500">{statusLabel}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-gray-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-bold text-[#002776]">{m.pesquisas7d}</p>
                        <p className="text-xs text-gray-400">7 dias</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-bold text-gray-700">{m.pesquisasTotal}</p>
                        <p className="text-xs text-gray-400">Total</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-bold text-green-600">{m.apoiadores}</p>
                        <p className="text-xs text-gray-400">Apoia</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-2 text-center">
                        <p className="text-lg font-bold text-amber-600">{m.indecisos}</p>
                        <p className="text-xs text-gray-400">Indec.</p>
                      </div>
                    </div>

                    {/* Contato rápido */}
                    {m.whatsapp && (
                      <a
                        href={`https://wa.me/${m.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-green-200 text-green-700 text-xs font-medium hover:bg-green-50 transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Cobrar via WhatsApp
                      </a>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ── RANKING ── */}
      {tab === 'ranking' && (
        <div className="px-4 py-5 space-y-3">
          <p className="text-xs text-gray-400 text-center">Coordenadores ordenados por eleitores cadastrados</p>
          {ranking.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : ranking.map((r, i) => (
            <div key={r.id} className={`bg-white rounded-2xl shadow-sm border p-4 flex items-center gap-3 ${r.isMe ? 'border-[#009C3B] border-2' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                i === 0 ? 'bg-yellow-100 text-yellow-600' :
                i === 1 ? 'bg-gray-100 text-gray-500' :
                i === 2 ? 'bg-orange-100 text-orange-500' : 'bg-blue-50 text-blue-400'
              }`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.nome}</p>
                  {r.isMe && <span className="text-xs bg-[#009C3B] text-white px-1.5 py-0.5 rounded-full">Você</span>}
                </div>
                {r.cidade && <p className="text-xs text-gray-400">{r.cidade}</p>}
                {r.metaVotos && (
                  <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#009C3B] rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-[#002776]">{r.cadastros}</p>
                <p className="text-xs text-gray-400">eleitores</p>
                {r.metaVotos && <p className="text-xs text-green-600 font-medium">{r.pct}% da meta</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PESQUISAS ── */}
      {tab === 'pesquisas' && (
        <div className="px-4 py-5 space-y-4">
          {!pesquisas ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : pesquisas.total === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhuma pesquisa registrada na sua área ainda</div>
          ) : (<>
            <div className="bg-white rounded-2xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Intenção de voto</h3>
                <span className="text-xs text-gray-400">{pesquisas.total} pesquisas</span>
              </div>
              <div className="space-y-3">
                {pesquisas.intencoes.map(int => {
                  const conf = INTENCAO_CONFIG[int.intencao] ?? { label: int.intencao, icon: Minus, color: 'text-gray-400', bg: 'bg-gray-100' }
                  const Icon = conf.icon
                  return (
                    <div key={int.intencao}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${conf.bg}`}>
                            <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                          </div>
                          <span className="text-sm text-gray-700">{conf.label}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{int.pct}% <span className="text-xs font-normal text-gray-400">({int.total})</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${int.intencao === 'FAVORAVEL' ? 'bg-green-500' : int.intencao === 'DESFAVORAVEL' ? 'bg-red-400' : 'bg-amber-400'}`}
                          style={{ width: `${int.pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-gray-900 text-sm">Últimas pesquisas</h3>
              </div>
              <div className="divide-y">
                {pesquisas.ultimas.map(u => {
                  const conf = INTENCAO_CONFIG[u.intention] ?? { label: u.intention, color: 'text-gray-400' }
                  return (
                    <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.voterName ?? 'Anônimo'}</p>
                        <p className="text-xs text-gray-400">{[u.neighborhood, u.city].filter(Boolean).join(', ')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-semibold ${conf.color}`}>{conf.label}</p>
                        <p className="text-xs text-gray-400">{formatDate(u.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* FAB */}
      <a href="/coordenador/eleitores?novo=1"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#002776] text-white shadow-lg flex items-center justify-center hover:bg-[#001f5e] transition-colors">
        <Plus className="w-6 h-6" />
      </a>
    </div>
  )
}
