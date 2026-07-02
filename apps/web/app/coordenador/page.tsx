'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Users, MapPin, Target, TrendingUp, Plus, LogOut, Phone, Calendar, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.syncrofloweleicoes.com.br'
const STORAGE_KEY = 'coord_token'

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null }

interface DashData {
  coordenador: { nome: string; cidade?: string; bairros: string[]; metaVotos?: number }
  stats: { totalCadastros: number; checkIns: number; metaVotos: number; metaPct: number }
  ultimosCadastros: { id: string; nome: string; telefone: string; cidade?: string; createdAt: string }[]
}

export default function CoordenadorDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { router.push('/coordenador/login'); return }

    axios.get(`${API_URL}/coordenador/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .catch(() => { localStorage.removeItem(STORAGE_KEY); router.push('/coordenador/login') })
      .finally(() => setLoading(false))
  }, [router])

  const logout = () => { localStorage.removeItem(STORAGE_KEY); router.push('/coordenador/login') }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#002776] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null

  const { coordenador, stats, ultimosCadastros } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#002776] text-white px-4 pt-8 pb-6">
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

      <div className="px-4 py-5 space-y-5">
        {/* Cards KPI */}
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

          {stats.metaVotos > 0 && (
            <>
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
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${stats.metaPct}%` }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Últimos cadastros */}
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

      {/* FAB */}
      <a
        href="/coordenador/eleitores?novo=1"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#002776] text-white shadow-lg flex items-center justify-center hover:bg-[#001f5e] transition-colors"
      >
        <Plus className="w-6 h-6" />
      </a>
    </div>
  )
}
