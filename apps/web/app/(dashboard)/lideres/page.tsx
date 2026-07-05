'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Trophy, Target, AlertTriangle, TrendingUp, MapPin,
  Star, Activity, ChevronDown, ChevronRight, Phone, Mail,
  Plus, Edit2, Trash2, Eye, BarChart2, Calendar, CheckCircle,
  Clock, Zap, Shield, Search, Filter, X, Award
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

function tok() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('accessToken') ?? ''
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tok()}`,
      ...(opts.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  if (res.status === 204) return null
  return res.json()
}

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Lider {
  id: string
  nome: string
  funcao: string
  funcaoCustom?: string
  telefone?: string
  email?: string
  bairros: string[]
  metaVotos?: number
  scoreAtividade: number
  votosComprometidos: number
  confiabilidade: number
  ultimaAtividade?: string
  supervisor?: { id: string; nome: string; funcao: string }
  _count?: { subordinados: number; atividades: number }
}

interface Territorio {
  id: string
  nome: string
  bairros: string[]
  metaVotos: number
  responsavel?: { id: string; nome: string; funcao: string; votosComprometidos: number }
  votosReais: number
  percentualMeta: number
  cor?: string
  observacao?: string
}

interface Stats {
  totalLideres: number
  totalVotosComprometidos: number
  atividadesSemana: number
  lidereSemAtividade: number
}

interface ArvoreLider extends Lider {
  filhos: ArvoreLider[]
}

const FUNCAO_LABEL: Record<string, string> = {
  cabo_eleitoral: 'Cabo Eleitoral',
  coordenador: 'Coordenador',
  motorista: 'Motorista',
  assessor: 'Assessor',
  mesario: 'Mesário',
  fotografo: 'Fotógrafo',
  social_media: 'Social Media',
  advogado: 'Advogado',
  contador: 'Contador',
  outro: 'Outro',
}

const TIPO_ATIVIDADE_LABEL: Record<string, string> = {
  pesquisa_voto: 'Pesquisa de Voto',
  check_in: 'Check-in',
  evento: 'Evento',
  tarefa: 'Tarefa',
  contato: 'Contato',
  outro: 'Outro',
}

const PONTOS_TIPO: Record<string, number> = {
  pesquisa_voto: 3,
  check_in: 2,
  evento: 4,
  tarefa: 2,
  contato: 1,
  outro: 1,
}

const CORES_PADRAO = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#065f46', '#9f1239', '#1e40af',
]

// ── Score Badge ────────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  if (score >= 20) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><Zap size={10} /> {score} pts</span>
  if (score >= 10) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"><Activity size={10} /> {score} pts</span>
  if (score > 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"><Activity size={10} /> {score} pts</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"><Clock size={10} /> sem ativ.</span>
}

// ── Nó da Hierarquia ───────────────────────────────────────────────────────────

function NoHierarquia({ no, nivel, onVerPerfil }: { no: ArvoreLider; nivel: number; onVerPerfil: (id: string) => void }) {
  const [aberto, setAberto] = useState(nivel < 2)
  const temFilhos = no.filhos.length > 0
  const diasSemAtividade = no.ultimaAtividade
    ? Math.floor((Date.now() - new Date(no.ultimaAtividade).getTime()) / 86400000)
    : 999
  const inativo = diasSemAtividade > 7

  return (
    <div className={`ml-${nivel > 0 ? 6 : 0}`}>
      <div
        className={`flex items-center gap-2 p-3 rounded-lg mb-1 border transition-colors group ${
          inativo
            ? 'border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50 hover:border-blue-300 dark:hover:border-blue-600'
        }`}
      >
        {temFilhos ? (
          <button onClick={() => setAberto(!aberto)} className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{no.nome}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{FUNCAO_LABEL[no.funcao] ?? no.funcao}</span>
            {inativo && <span className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-0.5"><AlertTriangle size={10} /> {diasSemAtividade === 999 ? 'sem atividade' : `${diasSemAtividade}d inativo`}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><Trophy size={10} className="text-blue-500" /> {no.votosComprometidos} votos</span>
            {no.metaVotos && <span className="flex items-center gap-1"><Target size={10} /> meta: {no.metaVotos}</span>}
            {no.bairros.length > 0 && <span className="flex items-center gap-1"><MapPin size={10} /> {no.bairros.slice(0, 2).join(', ')}{no.bairros.length > 2 ? ` +${no.bairros.length - 2}` : ''}</span>}
            {temFilhos && <span className="flex items-center gap-1"><Users size={10} /> {no.filhos.length} sub</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ScoreBadge score={no.scoreAtividade} />
          <button
            onClick={() => onVerPerfil(no.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-opacity"
          >
            <Eye size={14} />
          </button>
        </div>
      </div>

      {aberto && temFilhos && (
        <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-3 pl-3">
          {no.filhos.map(filho => (
            <NoHierarquia key={filho.id} no={filho} nivel={nivel + 1} onVerPerfil={onVerPerfil} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal Perfil do Líder ──────────────────────────────────────────────────────

function ModalPerfil({ liderId, onClose }: { liderId: string; onClose: () => void }) {
  const [lider, setLider] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [novaAtividade, setNovaAtividade] = useState(false)
  const [tipoAtividade, setTipoAtividade] = useState('check_in')
  const [descAtividade, setDescAtividade] = useState('')
  const [bairroAtividade, setBairroAtividade] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    apiFetch(`/lideres/${liderId}`)
      .then(setLider)
      .finally(() => setLoading(false))
  }, [liderId])

  const registrarAtividade = async () => {
    setSalvando(true)
    try {
      await apiFetch(`/lideres/${liderId}/atividades`, {
        method: 'POST',
        body: JSON.stringify({ tipo: tipoAtividade, descricao: descAtividade, bairro: bairroAtividade }),
      })
      const updated = await apiFetch(`/lideres/${liderId}`)
      setLider(updated)
      setNovaAtividade(false)
      setDescAtividade('')
      setBairroAtividade('')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    </div>
  )

  if (!lider) return null

  const meta = lider.metaVotos ?? 0
  const pct = meta > 0 ? Math.min(100, Math.round((lider.votosComprometidos / meta) * 100)) : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{lider.nome}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{FUNCAO_LABEL[lider.funcao] ?? lider.funcao}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Score cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{lider.scoreAtividade}</p>
              <p className="text-xs text-gray-500 mt-1">Score Semanal</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{lider.votosComprometidos}</p>
              <p className="text-xs text-gray-500 mt-1">Votos Comprometidos</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{lider.confiabilidade}%</p>
              <p className="text-xs text-gray-500 mt-1">Confiabilidade</p>
            </div>
          </div>

          {/* Meta de votos */}
          {meta > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Meta de votos</span>
                <span className="font-medium text-gray-900 dark:text-white">{lider.votosComprometidos}/{meta} ({pct}%)</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Contato + Territórios */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {lider.telefone && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone size={14} />
                <span>{lider.telefone}</span>
              </div>
            )}
            {lider.email && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Mail size={14} />
                <span className="truncate">{lider.email}</span>
              </div>
            )}
            {lider.supervisor && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 col-span-2">
                <Shield size={14} />
                <span>Supervisor: <strong className="text-gray-900 dark:text-white">{lider.supervisor.nome}</strong></span>
              </div>
            )}
          </div>

          {/* Bairros */}
          {lider.bairros?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Territórios de Atuação</p>
              <div className="flex flex-wrap gap-1.5">
                {lider.bairros.map((b: string) => (
                  <span key={b} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subordinados */}
          {lider.subordinados?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Equipe ({lider.subordinados.length})</p>
              <div className="space-y-1.5">
                {lider.subordinados.slice(0, 6).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-900 dark:text-white">{s.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{s.votosComprometidos} votos</span>
                      <ScoreBadge score={s.scoreAtividade} />
                    </div>
                  </div>
                ))}
                {lider.subordinados.length > 6 && (
                  <p className="text-xs text-center text-gray-400">+{lider.subordinados.length - 6} membros</p>
                )}
              </div>
            </div>
          )}

          {/* Registrar Atividade */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Registrar Atividade</p>
              {!novaAtividade && (
                <button
                  onClick={() => setNovaAtividade(true)}
                  className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <Plus size={14} /> Nova
                </button>
              )}
            </div>

            {novaAtividade && (
              <div className="space-y-3">
                <select
                  value={tipoAtividade}
                  onChange={e => setTipoAtividade(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {Object.entries(TIPO_ATIVIDADE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l} (+{PONTOS_TIPO[v]} pts)</option>
                  ))}
                </select>
                <input
                  placeholder="Descrição (opcional)"
                  value={descAtividade}
                  onChange={e => setDescAtividade(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                />
                <input
                  placeholder="Bairro (opcional)"
                  value={bairroAtividade}
                  onChange={e => setBairroAtividade(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setNovaAtividade(false)}
                    className="flex-1 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={registrarAtividade}
                    disabled={salvando}
                    className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvando ? 'Salvando...' : 'Registrar'}
                  </button>
                </div>
              </div>
            )}

            {/* Últimas atividades */}
            {lider.atividades?.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {lider.atividades.slice(0, 5).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-gray-900 dark:text-white">{TIPO_ATIVIDADE_LABEL[a.tipo] ?? a.tipo}</span>
                    {a.descricao && <span className="truncate text-gray-500">— {a.descricao}</span>}
                    <span className="ml-auto shrink-0 text-gray-400">
                      {formatDistanceToNow(new Date(a.dataAtividade), { locale: ptBR, addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal Território ───────────────────────────────────────────────────────────

function ModalTerritorio({
  territorio,
  lideres,
  onClose,
  onSave,
}: {
  territorio?: Territorio
  lideres: Lider[]
  onClose: () => void
  onSave: () => void
}) {
  const [nome, setNome] = useState(territorio?.nome ?? '')
  const [bairrosText, setBairrosText] = useState((territorio?.bairros ?? []).join(', '))
  const [metaVotos, setMetaVotos] = useState(String(territorio?.metaVotos ?? 0))
  const [responsavelId, setResponsavelId] = useState(territorio?.responsavel?.id ?? '')
  const [observacao, setObservacao] = useState(territorio?.observacao ?? '')
  const [cor, setCor] = useState(territorio?.cor ?? CORES_PADRAO[0])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const salvar = async () => {
    if (!nome.trim()) return setErro('Nome obrigatório')
    const bairros = bairrosText.split(',').map(b => b.trim()).filter(Boolean)
    if (bairros.length === 0) return setErro('Informe ao menos um bairro')

    setSalvando(true)
    setErro('')
    try {
      const body = {
        nome,
        bairros,
        metaVotos: parseInt(metaVotos) || 0,
        responsavelId: responsavelId || undefined,
        observacao,
        cor,
      }

      if (territorio) {
        await apiFetch(`/lideres/territorios/${territorio.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      } else {
        await apiFetch('/lideres/territorios', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      onSave()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white">
            {territorio ? 'Editar Território' : 'Novo Território'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Zona Norte, Centro, Bairro Novo..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bairros (separados por vírgula)</label>
            <textarea
              value={bairrosText}
              onChange={e => setBairrosText(e.target.value)}
              placeholder="Centro, Jardim América, Vila Nova..."
              rows={2}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meta de Votos</label>
              <input
                type="number"
                min={0}
                value={metaVotos}
                onChange={e => setMetaVotos(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cor</label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {CORES_PADRAO.slice(0, 5).map(c => (
                  <button
                    key={c}
                    onClick={() => setCor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${cor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Líder Responsável</label>
            <select
              value={responsavelId}
              onChange={e => setResponsavelId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Sem responsável definido</option>
              {lideres.map(l => (
                <option key={l.id} value={l.id}>
                  {l.nome} — {FUNCAO_LABEL[l.funcao] ?? l.funcao}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observação</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            />
          </div>

          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando}
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página Principal ───────────────────────────────────────────────────────────

type Tab = 'ranking' | 'territorios' | 'hierarquia' | 'alertas'

const LIDER_FORM_INICIAL = {
  nome: '', funcao: 'cabo_eleitoral', funcaoCustom: '',
  telefone: '', email: '', cpf: '', bairros: '',
  metaVotos: '', supervisorId: '', observacao: '',
}

export default function LideresPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('ranking')
  const [stats, setStats] = useState<Stats | null>(null)
  const [lideres, setLideres] = useState<Lider[]>([])
  const [alertas, setAlertasIds] = useState<string[]>([])
  const [territorios, setTerritorios] = useState<Territorio[]>([])
  const [arvore, setArvore] = useState<ArvoreLider[]>([])
  const [alertasData, setAlertasData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroFuncao, setFiltroFuncao] = useState('')
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [modalTerritorio, setModalTerritorio] = useState<Territorio | null | 'novo'>(null)
  const [showNovoLider, setShowNovoLider] = useState(false)
  const [novoLiderForm, setNovoLiderForm] = useState(LIDER_FORM_INICIAL)
  const [salvandoLider, setSalvandoLider] = useState(false)
  const [erroLider, setErroLider] = useState('')
  const [editandoLider, setEditandoLider] = useState<Lider | null>(null)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [statsData, rankData, territData, hierData, alertData] = await Promise.all([
        apiFetch('/lideres/stats'),
        apiFetch('/lideres/ranking'),
        apiFetch('/lideres/territorios'),
        apiFetch('/lideres/hierarquia'),
        apiFetch('/lideres/alertas'),
      ])
      setStats(statsData)
      setLideres(rankData.lideres)
      setAlertasIds(rankData.alertas)
      setTerritorios(territData)
      setArvore(hierData.arvore)
      setAlertasData(alertData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarDados() }, [])

  const criarLider = async () => {
    if (!novoLiderForm.nome.trim()) return setErroLider('Nome obrigatório')
    setSalvandoLider(true)
    setErroLider('')
    try {
      await apiFetch('/lideres', {
        method: 'POST',
        body: JSON.stringify({
          nome: novoLiderForm.nome,
          funcao: novoLiderForm.funcao,
          funcaoCustom: novoLiderForm.funcaoCustom || undefined,
          telefone: novoLiderForm.telefone || undefined,
          email: novoLiderForm.email || undefined,
          cpf: novoLiderForm.cpf || undefined,
          bairros: novoLiderForm.bairros ? novoLiderForm.bairros.split(',').map(b => b.trim()).filter(Boolean) : [],
          metaVotos: novoLiderForm.metaVotos ? parseInt(novoLiderForm.metaVotos) : undefined,
          supervisorId: novoLiderForm.supervisorId || undefined,
          observacao: novoLiderForm.observacao || undefined,
        }),
      })
      setShowNovoLider(false)
      setNovoLiderForm(LIDER_FORM_INICIAL)
      await carregarDados()
    } catch (e: any) {
      setErroLider(e.message || 'Erro ao criar líder')
    } finally {
      setSalvandoLider(false)
    }
  }

  const salvarEdicaoLider = async () => {
    if (!editandoLider) return
    setSalvandoLider(true)
    setErroLider('')
    try {
      await apiFetch(`/lideres/${editandoLider.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nome: novoLiderForm.nome,
          funcao: novoLiderForm.funcao,
          funcaoCustom: novoLiderForm.funcaoCustom || undefined,
          telefone: novoLiderForm.telefone || undefined,
          email: novoLiderForm.email || undefined,
          cpf: novoLiderForm.cpf || undefined,
          bairros: novoLiderForm.bairros ? novoLiderForm.bairros.split(',').map(b => b.trim()).filter(Boolean) : [],
          metaVotos: novoLiderForm.metaVotos ? parseInt(novoLiderForm.metaVotos) : undefined,
          supervisorId: novoLiderForm.supervisorId || undefined,
          observacao: novoLiderForm.observacao || undefined,
        }),
      })
      setEditandoLider(null)
      setNovoLiderForm(LIDER_FORM_INICIAL)
      await carregarDados()
    } catch (e: any) {
      setErroLider(e.message || 'Erro ao salvar')
    } finally {
      setSalvandoLider(false)
    }
  }

  const abrirEdicaoLider = (lider: Lider) => {
    setEditandoLider(lider)
    setNovoLiderForm({
      nome: lider.nome,
      funcao: lider.funcao,
      funcaoCustom: lider.funcaoCustom ?? '',
      telefone: lider.telefone ?? '',
      email: lider.email ?? '',
      cpf: '',
      bairros: lider.bairros.join(', '),
      metaVotos: lider.metaVotos ? String(lider.metaVotos) : '',
      supervisorId: lider.supervisor?.id ?? '',
      observacao: '',
    })
    setErroLider('')
    setShowNovoLider(false)
  }

  const lideresFiltrados = lideres.filter(l => {
    const matchBusca = !busca || l.nome.toLowerCase().includes(busca.toLowerCase()) || l.bairros.some(b => b.toLowerCase().includes(busca.toLowerCase()))
    const matchFuncao = !filtroFuncao || l.funcao === filtroFuncao
    return matchBusca && matchFuncao
  })

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'territorios', label: 'Territórios', icon: MapPin, badge: territorios.length },
    { id: 'hierarquia', label: 'Hierarquia', icon: Users },
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle, badge: alertasData?.total ?? 0 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Trophy className="text-yellow-500" size={24} />
                Gestor de Líderes
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Gerencie territórios, metas e atividade dos seus líderes de campanha
              </p>
            </div>
            <button
              onClick={() => { setShowNovoLider(s => !s); setEditandoLider(null); setNovoLiderForm(LIDER_FORM_INICIAL); setErroLider('') }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} /> Novo Líder
            </button>
          </div>

          {/* Formulário inline novo/editar líder */}
          {(showNovoLider || editandoLider) && (
            <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                <Plus size={16} />
                {editandoLider ? `Editar: ${editandoLider.nome}` : 'Novo Líder'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nome *</label>
                  <input
                    value={novoLiderForm.nome}
                    onChange={e => setNovoLiderForm(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Nome completo"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Função</label>
                  <select
                    value={novoLiderForm.funcao}
                    onChange={e => setNovoLiderForm(f => ({ ...f, funcao: e.target.value }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {Object.entries(FUNCAO_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Supervisor</label>
                  <select
                    value={novoLiderForm.supervisorId}
                    onChange={e => setNovoLiderForm(f => ({ ...f, supervisorId: e.target.value }))}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Sem supervisor</option>
                    {lideres.filter(l => !editandoLider || l.id !== editandoLider.id).map(l => (
                      <option key={l.id} value={l.id}>{l.nome} ({FUNCAO_LABEL[l.funcao] ?? l.funcao})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Telefone</label>
                  <input
                    value={novoLiderForm.telefone}
                    onChange={e => setNovoLiderForm(f => ({ ...f, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Email</label>
                  <input
                    value={novoLiderForm.email}
                    onChange={e => setNovoLiderForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                    type="email"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Meta de Votos</label>
                  <input
                    value={novoLiderForm.metaVotos}
                    onChange={e => setNovoLiderForm(f => ({ ...f, metaVotos: e.target.value }))}
                    placeholder="Ex: 500"
                    type="number"
                    min="0"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Bairros de atuação (separados por vírgula)</label>
                  <input
                    value={novoLiderForm.bairros}
                    onChange={e => setNovoLiderForm(f => ({ ...f, bairros: e.target.value }))}
                    placeholder="Centro, Vila Nova, Jardim das Flores..."
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              {erroLider && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{erroLider}</p>}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowNovoLider(false); setEditandoLider(null); setNovoLiderForm(LIDER_FORM_INICIAL) }}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={editandoLider ? salvarEdicaoLider : criarLider}
                  disabled={salvandoLider}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {salvandoLider ? 'Salvando...' : editandoLider ? 'Salvar alterações' : 'Cadastrar Líder'}
                </button>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Líderes Ativos</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.totalLideres}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-100 dark:border-green-800">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Votos Comprometidos</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{stats.totalVotosComprometidos.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Atividades esta Semana</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{stats.atividadesSemana}</p>
              </div>
              <div className={`rounded-xl p-3 border ${stats.lidereSemAtividade > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                <p className={`text-xs font-medium ${stats.lidereSemAtividade > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>Inativos (7+ dias)</p>
                <p className={`text-2xl font-bold mt-1 ${stats.lidereSemAtividade > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'}`}>{stats.lidereSemAtividade}</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mt-5 border-b border-gray-200 dark:border-gray-700 -mb-px">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <t.icon size={15} />
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${
                    t.id === 'alertas' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── RANKING ──────────────────────────────────────────────────────── */}
            {tab === 'ranking' && (
              <div className="space-y-4">
                {/* Filtros */}
                <div className="flex gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar líder ou bairro..."
                      className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <select
                    value={filtroFuncao}
                    onChange={e => setFiltroFuncao(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Todas as funções</option>
                    {Object.entries(FUNCAO_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {lideresFiltrados.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <Trophy size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Nenhum líder cadastrado</p>
                    <button
                      onClick={() => { setShowNovoLider(true); setEditandoLider(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700"
                    >
                      <Plus size={14} className="inline mr-1" /> Cadastrar primeiro líder
                    </button>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {lideresFiltrados.map((lider, idx) => {
                      const isAlerta = alertas.includes(lider.id)
                      const meta = lider.metaVotos ?? 0
                      const pct = meta > 0 ? Math.min(100, Math.round((lider.votosComprometidos / meta) * 100)) : null

                      return (
                        <div
                          key={lider.id}
                          className={`flex items-center gap-4 px-5 py-4 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isAlerta ? 'bg-orange-50/50 dark:bg-orange-950/10' : ''}`}
                        >
                          {/* Posição */}
                          <div className="w-8 shrink-0 text-center">
                            {idx === 0 ? <span className="text-yellow-500 text-lg">🥇</span> :
                             idx === 1 ? <span className="text-gray-400 text-lg">🥈</span> :
                             idx === 2 ? <span className="text-amber-600 text-lg">🥉</span> :
                             <span className="text-sm font-medium text-gray-400">#{idx + 1}</span>}
                          </div>

                          {/* Info — clicável para abrir perfil */}
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setPerfilId(lider.id)}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 dark:text-white">{lider.nome}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{FUNCAO_LABEL[lider.funcao] ?? lider.funcao}</span>
                              {isAlerta && <span className="text-xs text-orange-500 flex items-center gap-0.5"><AlertTriangle size={10} /> inativo</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                              {lider.bairros.slice(0, 3).map(b => (
                                <span key={b} className="flex items-center gap-0.5"><MapPin size={9} /> {b}</span>
                              ))}
                              {lider.bairros.length > 3 && <span>+{lider.bairros.length - 3}</span>}
                              {lider._count && <span>{lider._count.subordinados} subordinados</span>}
                            </div>

                            {/* Barra de meta */}
                            {pct !== null && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-32">
                                  <div
                                    className={`h-full rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-400">{pct}% da meta</span>
                              </div>
                            )}
                          </div>

                          {/* Métricas e ações */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-center hidden sm:block">
                              <p className="text-lg font-bold text-green-600 dark:text-green-400">{lider.votosComprometidos}</p>
                              <p className="text-xs text-gray-400">votos</p>
                            </div>
                            <ScoreBadge score={lider.scoreAtividade} />
                            <button
                              onClick={(e) => { e.stopPropagation(); abrirEdicaoLider(lider); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                              className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/30 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Editar líder"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setPerfilId(lider.id) }}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-700 transition-colors"
                              title="Ver perfil"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TERRITÓRIOS ──────────────────────────────────────────────────── */}
            {tab === 'territorios' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{territorios.length} territórios cadastrados</p>
                  <button
                    onClick={() => setModalTerritorio('novo')}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700"
                  >
                    <Plus size={15} /> Novo Território
                  </button>
                </div>

                {territorios.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Nenhum território cadastrado</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Divida sua cidade em zonas e atribua líderes responsáveis</p>
                    <button
                      onClick={() => setModalTerritorio('novo')}
                      className="mt-4 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700"
                    >
                      Criar primeiro território
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {territorios.map(t => (
                      <div
                        key={t.id}
                        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                      >
                        {/* Barra de cor */}
                        <div className="h-1.5" style={{ backgroundColor: t.cor ?? '#2563eb' }} />

                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{t.nome}</h3>
                            <button
                              onClick={() => setModalTerritorio(t)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>

                          {/* Progress */}
                          {t.metaVotos > 0 && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>{t.votosReais.toLocaleString('pt-BR')} votos</span>
                                <span>meta: {t.metaVotos.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    t.percentualMeta >= 80 ? 'bg-green-500' :
                                    t.percentualMeta >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                                  }`}
                                  style={{ width: `${Math.min(100, t.percentualMeta)}%` }}
                                />
                              </div>
                              <p className="text-xs text-right text-gray-400 mt-1">{t.percentualMeta}%</p>
                            </div>
                          )}

                          {/* Bairros */}
                          <div className="flex flex-wrap gap-1 mt-3">
                            {t.bairros.slice(0, 4).map(b => (
                              <span key={b} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">{b}</span>
                            ))}
                            {t.bairros.length > 4 && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">+{t.bairros.length - 4}</span>
                            )}
                          </div>

                          {/* Responsável */}
                          {t.responsavel ? (
                            <div
                              className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              onClick={() => setPerfilId(t.responsavel!.id)}
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 shrink-0">
                                {t.responsavel.nome[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{t.responsavel.nome}</p>
                                <p className="text-xs text-gray-500">{t.responsavel.votosComprometidos} votos</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 italic">Sem responsável definido</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── HIERARQUIA ───────────────────────────────────────────────────── */}
            {tab === 'hierarquia' && (
              <div>
                {arvore.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <Users size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">Nenhuma hierarquia configurada</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Defina supervisores na aba Equipe para ver a árvore aqui</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                      <Users size={14} />
                      {lideres.length} líderes — clique em <Eye size={12} className="inline" /> para ver a ficha completa
                    </p>
                    {arvore.map(no => (
                      <NoHierarquia key={no.id} no={no} nivel={0} onVerPerfil={setPerfilId} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ALERTAS ──────────────────────────────────────────────────────── */}
            {tab === 'alertas' && (
              <div className="space-y-5">
                {/* Inativos */}
                {alertasData?.semAtividade?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2 mb-3">
                      <Clock size={15} /> Sem Atividade há 7+ dias ({alertasData.semAtividade.length})
                    </h3>
                    <div className="space-y-2">
                      {alertasData.semAtividade.map((l: any) => (
                        <div
                          key={l.id}
                          className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl cursor-pointer hover:border-orange-400"
                          onClick={() => setPerfilId(l.id)}
                        >
                          <AlertTriangle size={18} className="text-orange-500 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{l.nome}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {FUNCAO_LABEL[l.funcao] ?? l.funcao}
                              {l.supervisor && ` · Supervisor: ${l.supervisor.nome}`}
                            </p>
                          </div>
                          <p className="text-xs text-orange-600 dark:text-orange-400 text-right">
                            {l.ultimaAtividade
                              ? `Último acesso ${formatDistanceToNow(new Date(l.ultimaAtividade), { locale: ptBR, addSuffix: true })}`
                              : 'Nunca registrou atividade'
                            }
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metas em risco */}
                {alertasData?.metaEmRisco?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 mb-3">
                      <Target size={15} /> Metas em Risco (abaixo de 50%) — {alertasData.metaEmRisco.length}
                    </h3>
                    <div className="space-y-2">
                      {alertasData.metaEmRisco.map((l: any) => {
                        const pct = Math.round((l.votosComprometidos / l.metaVotos) * 100)
                        return (
                          <div
                            key={l.id}
                            className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl cursor-pointer hover:border-red-400"
                            onClick={() => setPerfilId(l.id)}
                          >
                            <Target size={18} className="text-red-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">{l.nome}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{FUNCAO_LABEL[l.funcao] ?? l.funcao}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="flex-1 h-1.5 bg-red-200 dark:bg-red-900/40 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-red-600 dark:text-red-400 shrink-0">{l.votosComprometidos}/{l.metaVotos} ({pct}%)</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(!alertasData || alertasData.total === 0) && (
                  <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <CheckCircle size={40} className="mx-auto text-green-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Tudo certo!</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Nenhum alerta no momento. Continue assim!</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modais */}
      {perfilId && (
        <ModalPerfil liderId={perfilId} onClose={() => setPerfilId(null)} />
      )}

      {modalTerritorio !== null && (
        <ModalTerritorio
          territorio={modalTerritorio === 'novo' ? undefined : modalTerritorio}
          lideres={lideres}
          onClose={() => setModalTerritorio(null)}
          onSave={() => {
            setModalTerritorio(null)
            carregarDados()
          }}
        />
      )}
    </div>
  )
}
