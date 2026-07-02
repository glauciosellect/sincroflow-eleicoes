'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Building2, Calendar, FileText, ClipboardList, Plus, X,
  AlertTriangle, Clock, CheckCircle2, Ban, ChevronRight,
  Phone, Mail, MapPin, Tag, Link as LinkIcon, Search,
} from 'lucide-react'

const PRIORIDADE_COLOR: Record<string, string> = {
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-amber-100 text-amber-700',
  urgente: 'bg-red-100 text-red-700',
}

const STATUS_AUDIENCIA: Record<string, { label: string; color: string }> = {
  agendada: { label: 'Agendada', color: 'text-blue-600' },
  realizada: { label: 'Realizada', color: 'text-green-600' },
  cancelada: { label: 'Cancelada', color: 'text-red-500' },
  reagendada: { label: 'Reagendada', color: 'text-amber-500' },
}

const STATUS_PROTOCOLO: Record<string, { label: string; icon: typeof Clock }> = {
  aberto: { label: 'Aberto', icon: Clock },
  em_andamento: { label: 'Em andamento', icon: ChevronRight },
  resolvido: { label: 'Resolvido', icon: CheckCircle2 },
  arquivado: { label: 'Arquivado', icon: Ban },
}

const STATUS_PROJETO: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'text-muted-foreground' },
  protocolado: { label: 'Protocolado', color: 'text-blue-600' },
  tramitando: { label: 'Tramitando', color: 'text-amber-600' },
  aprovado: { label: 'Aprovado', color: 'text-green-600' },
  rejeitado: { label: 'Rejeitado', color: 'text-red-500' },
  arquivado: { label: 'Arquivado', color: 'text-muted-foreground' },
}

const TIPO_PROJETO: Record<string, string> = {
  pl: 'Projeto de Lei', pec: 'PEC', requerimento: 'Requerimento',
  indicacao: 'Indicação', mocao: 'Moção', outro: 'Outro',
}

function dtBr(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function dtSoBr(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

interface Resumo {
  audienciasHoje: number; audienciasSemana: number; audienciasUrgentes: number
  protocolosAbertos: number; protocolosUrgentes: number; projetosTramitando: number
}

const FORM_AUDIENCIA = {
  titulo: '', solicitante: '', telefone: '', email: '', assunto: '',
  descricao: '', dataHora: '', local: '', prioridade: 'normal',
}
const FORM_PROJETO = {
  numero: '', titulo: '', ementa: '', tipo: 'pl', status: 'rascunho',
  dataProtocolo: '', temas: '', linkOficial: '',
}
const FORM_PROTOCOLO = {
  solicitante: '', telefone: '', assunto: '', descricao: '',
  prioridade: 'normal', responsavel: '', prazo: '',
}

export default function GabinetePage() {
  const { token } = useAuthStore()
  const [tab, setTab] = useState<'dashboard' | 'audiencias' | 'projetos' | 'protocolos'>('dashboard')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [audiencias, setAudiencias] = useState<any[]>([])
  const [projetos, setProjetos] = useState<any[]>([])
  const [protocolos, setProtocolos] = useState<any[]>([])
  const [modal, setModal] = useState<'audiencia' | 'projeto' | 'protocolo' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [formA, setFormA] = useState(FORM_AUDIENCIA)
  const [formP, setFormP] = useState(FORM_PROJETO)
  const [formProt, setFormProt] = useState(FORM_PROTOCOLO)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')

  const h = { Authorization: `Bearer ${token}` }

  const loadResumo = useCallback(async () => {
    try { const r = await api.get('/gabinete/resumo', { headers: h }); setResumo(r.data) } catch {}
  }, [token])

  const loadAudiencias = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const r = await api.get(`/gabinete/audiencias?${params}&take=50`, { headers: h })
    setAudiencias(r.data.items)
  }, [token, statusFilter])

  const loadProjetos = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const r = await api.get(`/gabinete/projetos?${params}&take=50`, { headers: h })
    setProjetos(r.data.items)
  }, [token, statusFilter])

  const loadProtocolos = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (q) params.set('q', q)
    const r = await api.get(`/gabinete/protocolos?${params}&take=50`, { headers: h })
    setProtocolos(r.data.items)
  }, [token, statusFilter, q])

  useEffect(() => { loadResumo() }, [loadResumo])
  useEffect(() => { if (tab === 'audiencias') loadAudiencias() }, [tab, loadAudiencias])
  useEffect(() => { if (tab === 'projetos') loadProjetos() }, [tab, loadProjetos])
  useEffect(() => { if (tab === 'protocolos') loadProtocolos() }, [tab, loadProtocolos])

  function fecharModal() { setModal(null); setEditId(null); setFormA(FORM_AUDIENCIA); setFormP(FORM_PROJETO); setFormProt(FORM_PROTOCOLO) }

  async function salvarAudiencia() {
    if (!formA.titulo || !formA.solicitante || !formA.assunto || !formA.dataHora) return
    setSaving(true)
    try {
      const body = { ...formA, dataHora: new Date(formA.dataHora).toISOString() }
      if (editId) await api.patch(`/gabinete/audiencias/${editId}`, body, { headers: h })
      else await api.post('/gabinete/audiencias', body, { headers: h })
      fecharModal(); loadAudiencias(); loadResumo()
    } catch (e: any) { alert(e.response?.data?.error ?? 'Erro') } finally { setSaving(false) }
  }

  async function salvarProjeto() {
    if (!formP.titulo || !formP.ementa) return
    setSaving(true)
    try {
      const body = {
        ...formP,
        temas: formP.temas.split(',').map(t => t.trim()).filter(Boolean),
        ...(formP.dataProtocolo ? { dataProtocolo: new Date(formP.dataProtocolo).toISOString() } : {}),
      }
      if (editId) await api.patch(`/gabinete/projetos/${editId}`, body, { headers: h })
      else await api.post('/gabinete/projetos', body, { headers: h })
      fecharModal(); loadProjetos(); loadResumo()
    } catch (e: any) { alert(e.response?.data?.error ?? 'Erro') } finally { setSaving(false) }
  }

  async function salvarProtocolo() {
    if (!formProt.solicitante || !formProt.assunto) return
    setSaving(true)
    try {
      const body = { ...formProt, ...(formProt.prazo ? { prazo: new Date(formProt.prazo).toISOString() } : {}) }
      if (editId) await api.patch(`/gabinete/protocolos/${editId}`, body, { headers: h })
      else await api.post('/gabinete/protocolos', body, { headers: h })
      fecharModal(); loadProtocolos(); loadResumo()
    } catch (e: any) { alert(e.response?.data?.error ?? 'Erro') } finally { setSaving(false) }
  }

  async function mudarStatusAudiencia(id: string, status: string) {
    await api.patch(`/gabinete/audiencias/${id}`, { status }, { headers: h })
    loadAudiencias(); loadResumo()
  }

  async function mudarStatusProtocolo(id: string, status: string) {
    await api.patch(`/gabinete/protocolos/${id}`, { status }, { headers: h })
    loadProtocolos(); loadResumo()
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6" /> Gabinete 360</h1>
          <p className="text-sm text-muted-foreground mt-1">Audiências, projetos de lei e protocolos de atendimento</p>
        </div>
        {tab === 'audiencias' && (
          <button onClick={() => { setModal('audiencia'); setEditId(null); setFormA(FORM_AUDIENCIA) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#009C3B] text-white rounded-lg hover:bg-[#007d2f] transition-colors">
            <Plus className="w-4 h-4" /> Nova Audiência
          </button>
        )}
        {tab === 'projetos' && (
          <button onClick={() => { setModal('projeto'); setEditId(null); setFormP(FORM_PROJETO) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#002776] text-white rounded-lg hover:bg-[#001855] transition-colors">
            <Plus className="w-4 h-4" /> Novo Projeto
          </button>
        )}
        {tab === 'protocolos' && (
          <button onClick={() => { setModal('protocolo'); setEditId(null); setFormProt(FORM_PROTOCOLO) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
            <Plus className="w-4 h-4" /> Novo Protocolo
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'dashboard', label: 'Painel', icon: Building2 },
          { key: 'audiencias', label: 'Audiências', icon: Calendar },
          { key: 'projetos', label: 'Projetos de Lei', icon: FileText },
          { key: 'protocolos', label: 'Protocolos', icon: ClipboardList },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setStatusFilter('') }}
            className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.key ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && resumo && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Audiências hoje', value: resumo.audienciasHoje, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', onClick: () => { setTab('audiencias') } },
            { label: 'Audiências na semana', value: resumo.audienciasSemana, icon: Calendar, color: 'text-indigo-600', bg: 'bg-indigo-50', onClick: () => setTab('audiencias') },
            { label: 'Audiências urgentes', value: resumo.audienciasUrgentes, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', onClick: () => setTab('audiencias') },
            { label: 'Protocolos abertos', value: resumo.protocolosAbertos, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50', onClick: () => setTab('protocolos') },
            { label: 'Protocolos urgentes', value: resumo.protocolosUrgentes, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50', onClick: () => setTab('protocolos') },
            { label: 'Projetos tramitando', value: resumo.projetosTramitando, icon: FileText, color: 'text-green-600', bg: 'bg-green-50', onClick: () => setTab('projetos') },
          ].map(kpi => (
            <button key={kpi.label} onClick={kpi.onClick}
              className="text-left rounded-xl border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', kpi.bg)}>
                <kpi.icon className={cn('w-5 h-5', kpi.color)} />
              </div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── AUDIÊNCIAS ── */}
      {tab === 'audiencias' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['', 'agendada', 'realizada', 'cancelada', 'reagendada'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-sm rounded-full border transition-colors',
                  statusFilter === s ? 'bg-[#009C3B] text-white border-[#009C3B]' : 'hover:bg-muted')}>
                {s === '' ? 'Todas' : STATUS_AUDIENCIA[s]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {audiencias.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhuma audiência encontrada</div>
            ) : audiencias.map(a => (
              <div key={a.id} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{a.titulo}</h3>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORIDADE_COLOR[a.prioridade])}>
                        {a.prioridade}
                      </span>
                      <span className={cn('text-xs font-medium', STATUS_AUDIENCIA[a.status]?.color)}>
                        {STATUS_AUDIENCIA[a.status]?.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.assunto}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {dtBr(a.dataHora)}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {a.solicitante}</span>
                  {a.local && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.local}</span>}
                </div>
                {a.status === 'agendada' && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => mudarStatusAudiencia(a.id, 'realizada')}
                      className="text-xs px-3 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">
                      Marcar realizada
                    </button>
                    <button onClick={() => mudarStatusAudiencia(a.id, 'cancelada')}
                      className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROJETOS ── */}
      {tab === 'projetos' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['', 'rascunho', 'protocolado', 'tramitando', 'aprovado', 'rejeitado', 'arquivado'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-sm rounded-full border transition-colors',
                  statusFilter === s ? 'bg-[#002776] text-white border-[#002776]' : 'hover:bg-muted')}>
                {s === '' ? 'Todos' : STATUS_PROJETO[s]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {projetos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum projeto encontrado</div>
            ) : projetos.map(p => (
              <div key={p.id} className="rounded-xl border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.numero && <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{p.numero}</span>}
                      <span className="text-xs text-muted-foreground">{TIPO_PROJETO[p.tipo] ?? p.tipo}</span>
                      <span className={cn('text-xs font-medium', STATUS_PROJETO[p.status]?.color)}>
                        {STATUS_PROJETO[p.status]?.label}
                      </span>
                    </div>
                    <h3 className="font-semibold mt-1">{p.titulo}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.ementa}</p>
                  </div>
                  {p.linkOficial && (
                    <a href={p.linkOficial} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                      <LinkIcon className="w-4 h-4" />
                    </a>
                  )}
                </div>
                {p.temas?.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {p.temas.map((t: string) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted">{t}</span>
                    ))}
                  </div>
                )}
                {p.dataProtocolo && (
                  <p className="text-xs text-muted-foreground">Protocolado em {dtSoBr(p.dataProtocolo)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROTOCOLOS ── */}
      {tab === 'protocolos' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <input placeholder="Buscar solicitante..." value={q} onChange={e => setQ(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background" />
            </div>
            {['', 'aberto', 'em_andamento', 'resolvido', 'arquivado'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('px-3 py-1.5 text-sm rounded-full border transition-colors',
                  statusFilter === s ? 'bg-amber-600 text-white border-amber-600' : 'hover:bg-muted')}>
                {s === '' ? 'Todos' : STATUS_PROTOCOLO[s]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {protocolos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum protocolo encontrado</div>
            ) : protocolos.map(p => {
              const stConf = STATUS_PROTOCOLO[p.status]
              const StIcon = stConf?.icon ?? Clock
              return (
                <div key={p.id} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{p.numero}</span>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORIDADE_COLOR[p.prioridade])}>
                          {p.prioridade}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <StIcon className="w-3.5 h-3.5" /> {stConf?.label}
                        </span>
                      </div>
                      <h3 className="font-semibold mt-1 truncate">{p.assunto}</h3>
                      <p className="text-sm text-muted-foreground">{p.solicitante}</p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{dtSoBr(p.createdAt)}</p>
                  </div>
                  {p.status !== 'resolvido' && p.status !== 'arquivado' && (
                    <div className="flex gap-2 pt-1">
                      {p.status === 'aberto' && (
                        <button onClick={() => mudarStatusProtocolo(p.id, 'em_andamento')}
                          className="text-xs px-3 py-1 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">
                          Iniciar atendimento
                        </button>
                      )}
                      <button onClick={() => mudarStatusProtocolo(p.id, 'resolvido')}
                        className="text-xs px-3 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">
                        Marcar resolvido
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MODAL AUDIÊNCIA ── */}
      {modal === 'audiencia' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg">Nova Audiência</h2>
              <button onClick={fecharModal} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Título *</label>
                  <input value={formA.titulo} onChange={e => setFormA(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ex: Reunião com lideranças do bairro" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Solicitante *</label>
                  <input value={formA.solicitante} onChange={e => setFormA(f => ({ ...f, solicitante: e.target.value }))}
                    placeholder="Nome do solicitante" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Telefone</label>
                  <input value={formA.telefone} onChange={e => setFormA(f => ({ ...f, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">E-mail</label>
                  <input type="email" value={formA.email} onChange={e => setFormA(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Assunto *</label>
                  <input value={formA.assunto} onChange={e => setFormA(f => ({ ...f, assunto: e.target.value }))}
                    placeholder="Motivo da audiência" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Data e hora *</label>
                  <input type="datetime-local" value={formA.dataHora} onChange={e => setFormA(f => ({ ...f, dataHora: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Prioridade</label>
                  <select value={formA.prioridade} onChange={e => setFormA(f => ({ ...f, prioridade: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Local</label>
                  <input value={formA.local} onChange={e => setFormA(f => ({ ...f, local: e.target.value }))}
                    placeholder="Gabinete / Endereço" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Descrição</label>
                  <textarea value={formA.descricao} onChange={e => setFormA(f => ({ ...f, descricao: e.target.value }))}
                    rows={2} className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <button onClick={fecharModal} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancelar</button>
              <button onClick={salvarAudiencia} disabled={saving || !formA.titulo || !formA.solicitante || !formA.dataHora}
                className="px-4 py-2 text-sm bg-[#009C3B] text-white rounded-lg hover:bg-[#007d2f] disabled:opacity-60 transition-colors">
                {saving ? 'Salvando...' : 'Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PROJETO ── */}
      {modal === 'projeto' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg">Novo Projeto de Lei</h2>
              <button onClick={fecharModal} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Tipo *</label>
                  <select value={formP.tipo} onChange={e => setFormP(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                    {Object.entries(TIPO_PROJETO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Número</label>
                  <input value={formP.numero} onChange={e => setFormP(f => ({ ...f, numero: e.target.value }))}
                    placeholder="Ex: PL 001/2026" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Título *</label>
                  <input value={formP.titulo} onChange={e => setFormP(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Título do projeto" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Ementa *</label>
                  <textarea value={formP.ementa} onChange={e => setFormP(f => ({ ...f, ementa: e.target.value }))}
                    rows={3} placeholder="Descreva o objeto do projeto..." className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Status</label>
                  <select value={formP.status} onChange={e => setFormP(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                    {Object.entries(STATUS_PROJETO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Data protocolo</label>
                  <input type="date" value={formP.dataProtocolo} onChange={e => setFormP(f => ({ ...f, dataProtocolo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Temas (separados por vírgula)</label>
                  <input value={formP.temas} onChange={e => setFormP(f => ({ ...f, temas: e.target.value }))}
                    placeholder="saúde, educação, mobilidade" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Link oficial</label>
                  <input value={formP.linkOficial} onChange={e => setFormP(f => ({ ...f, linkOficial: e.target.value }))}
                    placeholder="https://..." className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <button onClick={fecharModal} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancelar</button>
              <button onClick={salvarProjeto} disabled={saving || !formP.titulo || !formP.ementa}
                className="px-4 py-2 text-sm bg-[#002776] text-white rounded-lg hover:bg-[#001855] disabled:opacity-60 transition-colors">
                {saving ? 'Salvando...' : 'Criar Projeto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PROTOCOLO ── */}
      {modal === 'protocolo' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg">Novo Protocolo de Atendimento</h2>
              <button onClick={fecharModal} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Solicitante *</label>
                  <input value={formProt.solicitante} onChange={e => setFormProt(f => ({ ...f, solicitante: e.target.value }))}
                    placeholder="Nome do cidadão" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Telefone</label>
                  <input value={formProt.telefone} onChange={e => setFormProt(f => ({ ...f, telefone: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Prioridade</label>
                  <select value={formProt.prioridade} onChange={e => setFormProt(f => ({ ...f, prioridade: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Assunto *</label>
                  <input value={formProt.assunto} onChange={e => setFormProt(f => ({ ...f, assunto: e.target.value }))}
                    placeholder="Descreva o assunto do atendimento" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Descrição detalhada</label>
                  <textarea value={formProt.descricao} onChange={e => setFormProt(f => ({ ...f, descricao: e.target.value }))}
                    rows={3} className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Responsável</label>
                  <input value={formProt.responsavel} onChange={e => setFormProt(f => ({ ...f, responsavel: e.target.value }))}
                    placeholder="Membro da equipe" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Prazo</label>
                  <input type="datetime-local" value={formProt.prazo} onChange={e => setFormProt(f => ({ ...f, prazo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <button onClick={fecharModal} className="px-4 py-2 text-sm border rounded-lg hover:bg-muted">Cancelar</button>
              <button onClick={salvarProtocolo} disabled={saving || !formProt.solicitante || !formProt.assunto}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors">
                {saving ? 'Salvando...' : 'Abrir Protocolo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
