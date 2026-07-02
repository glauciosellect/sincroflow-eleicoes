'use client'
import { useEffect, useState } from 'react'
import { Plus, X, Loader2, AlertCircle, CalendarDays, FileText, ClipboardList, LayoutDashboard, ChevronRight, GripVertical } from 'lucide-react'
import api from '@/lib/api'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface DashData {
  audienciasHoje: number; audienciasSemana: number; audienciasUrgentes: number
  protocolosAbertos: number; protocolosUrgentes: number; projetosTramitando: number
}

interface Projeto {
  id: string; titulo: string; tipo: string; numero?: string; ementa: string
  status: string; temas: string[]; dataProtocolo?: string; linkOficial?: string
}

interface Protocolo {
  id: string; numero: string; solicitante: string; assunto: string
  descricao?: string; prioridade: string; status: string
  responsavel?: string; createdAt: string
}

interface Audiencia {
  id: string; solicitante: string; pauta: string; dataHora: string
  local?: string; status: string; prioridade: string; observacao?: string
}

// ── Kanban cols ───────────────────────────────────────────────────────────────

const COLS_PROJETOS = [
  { key: 'rascunho', label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
  { key: 'protocolado', label: 'Protocolado', color: 'bg-blue-100 text-blue-700' },
  { key: 'tramitando', label: 'Tramitando', color: 'bg-amber-100 text-amber-700' },
  { key: 'aprovado', label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  { key: 'rejeitado', label: 'Rejeitado', color: 'bg-red-100 text-red-600' },
  { key: 'arquivado', label: 'Arquivado', color: 'bg-gray-100 text-gray-400' },
]

const COLS_PROTOCOLOS = [
  { key: 'aberto', label: 'Aberto', color: 'bg-blue-100 text-blue-700' },
  { key: 'em_andamento', label: 'Em andamento', color: 'bg-amber-100 text-amber-700' },
  { key: 'resolvido', label: 'Resolvido', color: 'bg-green-100 text-green-700' },
  { key: 'arquivado', label: 'Arquivado', color: 'bg-gray-100 text-gray-400' },
]

const TIPO_LABEL: Record<string, string> = {
  pl: 'PL', pec: 'PEC', requerimento: 'Req.', indicacao: 'Ind.', mocao: 'Moção', outro: 'Outro'
}
const PRIORIDADE_COLOR: Record<string, string> = {
  urgente: 'bg-red-100 text-red-600', alta: 'bg-orange-100 text-orange-600',
  normal: 'bg-gray-100 text-gray-500', baixa: 'bg-blue-50 text-blue-400',
}

const fmtDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

// ── Formulários vazios ────────────────────────────────────────────────────────

const emptyProjeto = { titulo: '', tipo: 'pl', numero: '', ementa: '', status: 'rascunho', temas: '', dataProtocolo: '', linkOficial: '' }
const emptyProtocolo = { solicitante: '', assunto: '', descricao: '', prioridade: 'normal', responsavel: '' }
const emptyAudiencia = { solicitante: '', pauta: '', dataHora: '', local: '', prioridade: 'normal', observacao: '' }

// ── Componente ────────────────────────────────────────────────────────────────

export default function GabinetePage() {
  const [tab, setTab] = useState<'painel' | 'projetos' | 'protocolos' | 'audiencias'>('painel')
  const [dash, setDash] = useState<DashData | null>(null)
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [protocolos, setProtocolos] = useState<Protocolo[]>([])
  const [audiencias, setAudiencias] = useState<Audiencia[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formProjeto, setFormProjeto] = useState(emptyProjeto)
  const [formProtocolo, setFormProtocolo] = useState(emptyProtocolo)
  const [formAudiencia, setFormAudiencia] = useState(emptyAudiencia)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [dragging, setDragging] = useState<{ id: string; tipo: 'projeto' | 'protocolo' } | null>(null)

  const loadDash = async () => { const r = await api.get('/gabinete/dashboard'); setDash(r.data) }
  const loadProjetos = async () => { const r = await api.get('/gabinete/projetos', { params: { page: 1 } }); setProjetos(r.data.items) }
  const loadProtocolos = async () => { const r = await api.get('/gabinete/protocolos', { params: { page: 1 } }); setProtocolos(r.data.items) }
  const loadAudiencias = async () => { const r = await api.get('/gabinete/audiencias', { params: { page: 1 } }); setAudiencias(r.data.items) }

  useEffect(() => {
    setLoading(true)
    loadDash().finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'projetos') loadProjetos()
    if (tab === 'protocolos') loadProtocolos()
    if (tab === 'audiencias') loadAudiencias()
  }, [tab])

  // Drag & drop Kanban — move card entre colunas
  const onDrop = async (status: string, tipo: 'projeto' | 'protocolo') => {
    if (!dragging || dragging.tipo !== tipo) return
    const { id } = dragging
    setDragging(null)
    try {
      if (tipo === 'projeto') {
        await api.patch(`/gabinete/projetos/${id}`, { status })
        setProjetos(ps => ps.map(p => p.id === id ? { ...p, status } : p))
      } else {
        await api.patch(`/gabinete/protocolos/${id}`, { status })
        setProtocolos(ps => ps.map(p => p.id === id ? { ...p, status } : p))
      }
    } catch { }
  }

  const salvarProjeto = async () => {
    setErro(''); setSaving(true)
    try {
      await api.post('/gabinete/projetos', {
        ...formProjeto,
        temas: formProjeto.temas ? formProjeto.temas.split(',').map(t => t.trim()).filter(Boolean) : [],
        numero: formProjeto.numero || undefined,
        dataProtocolo: formProjeto.dataProtocolo || undefined,
        linkOficial: formProjeto.linkOficial || undefined,
      })
      setShowForm(false); setFormProjeto(emptyProjeto); loadProjetos(); loadDash()
    } catch (e: any) { setErro(e.response?.data?.error ?? 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const salvarProtocolo = async () => {
    setErro(''); setSaving(true)
    try {
      await api.post('/gabinete/protocolos', { ...formProtocolo, descricao: formProtocolo.descricao || undefined, responsavel: formProtocolo.responsavel || undefined })
      setShowForm(false); setFormProtocolo(emptyProtocolo); loadProtocolos(); loadDash()
    } catch (e: any) { setErro(e.response?.data?.error ?? 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const salvarAudiencia = async () => {
    setErro(''); setSaving(true)
    try {
      await api.post('/gabinete/audiencias', { ...formAudiencia, local: formAudiencia.local || undefined, observacao: formAudiencia.observacao || undefined })
      setShowForm(false); setFormAudiencia(emptyAudiencia); loadAudiencias(); loadDash()
    } catch (e: any) { setErro(e.response?.data?.error ?? 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6 max-w-full mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gabinete</h1>
          <p className="text-sm text-gray-500">Audiências, projetos de lei e protocolos de atendimento</p>
        </div>
        {tab !== 'painel' && (
          <button onClick={() => { setShowForm(true); setErro('') }}
            className="flex items-center gap-2 bg-[#002776] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#001f5e] transition-colors">
            <Plus className="w-4 h-4" />
            {tab === 'projetos' ? 'Novo projeto' : tab === 'protocolos' ? 'Novo protocolo' : 'Nova audiência'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {[
          { key: 'painel', label: 'Painel', icon: LayoutDashboard },
          { key: 'audiencias', label: 'Audiências', icon: CalendarDays },
          { key: 'projetos', label: 'Projetos de Lei', icon: FileText },
          { key: 'protocolos', label: 'Protocolos', icon: ClipboardList },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── PAINEL ── */}
      {tab === 'painel' && (
        loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> :
        !dash ? null : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Audiências hoje', value: dash.audienciasHoje, color: 'text-blue-600', bg: 'bg-blue-50', icon: CalendarDays, onClick: () => setTab('audiencias') },
              { label: 'Audiências na semana', value: dash.audienciasSemana, color: 'text-purple-600', bg: 'bg-purple-50', icon: CalendarDays, onClick: () => setTab('audiencias') },
              { label: 'Audiências urgentes', value: dash.audienciasUrgentes, color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle, onClick: () => setTab('audiencias') },
              { label: 'Protocolos abertos', value: dash.protocolosAbertos, color: 'text-amber-600', bg: 'bg-amber-50', icon: ClipboardList, onClick: () => setTab('protocolos') },
              { label: 'Protocolos urgentes', value: dash.protocolosUrgentes, color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle, onClick: () => setTab('protocolos') },
              { label: 'Projetos tramitando', value: dash.projetosTramitando, color: 'text-green-600', bg: 'bg-green-50', icon: FileText, onClick: () => setTab('projetos') },
            ].map(c => (
              <button key={c.label} onClick={c.onClick}
                className="bg-white rounded-2xl border p-5 shadow-sm text-left hover:border-gray-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.bg}`}>
                    <c.icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
              </button>
            ))}
          </div>
        )
      )}

      {/* ── KANBAN PROJETOS ── */}
      {tab === 'projetos' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {COLS_PROJETOS.map(col => (
              <div key={col.key} className="w-72 flex-shrink-0"
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(col.key, 'projeto')}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-gray-400">{projetos.filter(p => p.status === col.key).length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {projetos.filter(p => p.status === col.key).map(p => (
                    <div key={p.id} draggable
                      onDragStart={() => setDragging({ id: p.id, tipo: 'projeto' })}
                      onDragEnd={() => setDragging(null)}
                      className="bg-white rounded-xl border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-2 mb-2">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{TIPO_LABEL[p.tipo]}</span>
                            {p.numero && <span className="text-xs text-gray-400">#{p.numero}</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">{p.titulo}</p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.ementa}</p>
                        </div>
                      </div>
                      {p.temas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.temas.slice(0, 3).map(t => (
                            <span key={t} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                      {p.dataProtocolo && <p className="text-xs text-gray-400 mt-2">{fmtDate(p.dataProtocolo)}</p>}
                    </div>
                  ))}
                  {projetos.filter(p => p.status === col.key).length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center">
                      <p className="text-xs text-gray-300">Arraste aqui</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KANBAN PROTOCOLOS ── */}
      {tab === 'protocolos' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {COLS_PROTOCOLOS.map(col => (
              <div key={col.key} className="w-72 flex-shrink-0"
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(col.key, 'protocolo')}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-gray-400">{protocolos.filter(p => p.status === col.key).length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {protocolos.filter(p => p.status === col.key).map(p => (
                    <div key={p.id} draggable
                      onDragStart={() => setDragging({ id: p.id, tipo: 'protocolo' })}
                      onDragEnd={() => setDragging(null)}
                      className="bg-white rounded-xl border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-500">#{p.numero}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORIDADE_COLOR[p.prioridade] ?? 'bg-gray-100 text-gray-500'}`}>{p.prioridade}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{p.assunto}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.solicitante}</p>
                          {p.responsavel && <p className="text-xs text-blue-500 mt-1">→ {p.responsavel}</p>}
                          <p className="text-xs text-gray-300 mt-1">{fmtDate(p.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {protocolos.filter(p => p.status === col.key).length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center">
                      <p className="text-xs text-gray-300">Arraste aqui</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIÊNCIAS ── */}
      {tab === 'audiencias' && (
        <div className="space-y-3">
          {audiencias.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhuma audiência agendada</div>
          ) : audiencias.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border p-4 shadow-sm flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-50 flex flex-col items-center justify-center shrink-0">
                <span className="text-lg font-bold text-blue-700">{new Date(a.dataHora).getDate()}</span>
                <span className="text-xs text-blue-500">{new Date(a.dataHora).toLocaleString('pt-BR', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900">{a.solicitante}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORIDADE_COLOR[a.prioridade] ?? 'bg-gray-100 text-gray-500'}`}>{a.prioridade}</span>
                </div>
                <p className="text-sm text-gray-600">{a.pauta}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{fmtDateTime(a.dataHora)}</span>
                  {a.local && <span>· {a.local}</span>}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                a.status === 'agendada' ? 'bg-blue-100 text-blue-700' :
                a.status === 'realizada' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAIS ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-900">
                {tab === 'projetos' ? 'Novo Projeto de Lei' : tab === 'protocolos' ? 'Novo Protocolo' : 'Nova Audiência'}
              </h2>
              <button onClick={() => { setShowForm(false); setErro('') }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* FORM PROJETO */}
              {tab === 'projetos' && (<>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                    <select value={formProjeto.tipo} onChange={e => setFormProjeto(f => ({ ...f, tipo: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                      <option value="pl">Projeto de Lei (PL)</option>
                      <option value="pec">PEC</option>
                      <option value="requerimento">Requerimento</option>
                      <option value="indicacao">Indicação</option>
                      <option value="mocao">Moção</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Número</label>
                    <input value={formProjeto.numero} onChange={e => setFormProjeto(f => ({ ...f, numero: e.target.value }))}
                      placeholder="Ex: 2545" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
                  <input value={formProjeto.titulo} onChange={e => setFormProjeto(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Título do projeto" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ementa *</label>
                  <textarea rows={3} value={formProjeto.ementa} onChange={e => setFormProjeto(f => ({ ...f, ementa: e.target.value }))}
                    placeholder="Descrição resumida do projeto" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select value={formProjeto.status} onChange={e => setFormProjeto(f => ({ ...f, status: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                      {COLS_PROJETOS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data protocolo</label>
                    <input type="date" value={formProjeto.dataProtocolo} onChange={e => setFormProjeto(f => ({ ...f, dataProtocolo: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Temas (separados por vírgula)</label>
                  <input value={formProjeto.temas} onChange={e => setFormProjeto(f => ({ ...f, temas: e.target.value }))}
                    placeholder="saúde, educação, infraestrutura" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Link oficial (opcional)</label>
                  <input value={formProjeto.linkOficial} onChange={e => setFormProjeto(f => ({ ...f, linkOficial: e.target.value }))}
                    placeholder="https://camara.jf.mg.gov.br/..." className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
              </>)}

              {/* FORM PROTOCOLO */}
              {tab === 'protocolos' && (<>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Solicitante *</label>
                  <input value={formProtocolo.solicitante} onChange={e => setFormProtocolo(f => ({ ...f, solicitante: e.target.value }))}
                    placeholder="Nome do cidadão" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Assunto *</label>
                  <input value={formProtocolo.assunto} onChange={e => setFormProtocolo(f => ({ ...f, assunto: e.target.value }))}
                    placeholder="Ex: Buraco na Rua XV de Novembro" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea rows={3} value={formProtocolo.descricao} onChange={e => setFormProtocolo(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Detalhes da solicitação" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prioridade</label>
                    <select value={formProtocolo.prioridade} onChange={e => setFormProtocolo(f => ({ ...f, prioridade: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                      <option value="baixa">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Responsável</label>
                    <input value={formProtocolo.responsavel} onChange={e => setFormProtocolo(f => ({ ...f, responsavel: e.target.value }))}
                      placeholder="Nome do responsável" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  </div>
                </div>
              </>)}

              {/* FORM AUDIÊNCIA */}
              {tab === 'audiencias' && (<>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Solicitante *</label>
                  <input value={formAudiencia.solicitante} onChange={e => setFormAudiencia(f => ({ ...f, solicitante: e.target.value }))}
                    placeholder="Nome do solicitante" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pauta *</label>
                  <input value={formAudiencia.pauta} onChange={e => setFormAudiencia(f => ({ ...f, pauta: e.target.value }))}
                    placeholder="Assunto da audiência" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data e hora *</label>
                    <input type="datetime-local" value={formAudiencia.dataHora} onChange={e => setFormAudiencia(f => ({ ...f, dataHora: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prioridade</label>
                    <select value={formAudiencia.prioridade} onChange={e => setFormAudiencia(f => ({ ...f, prioridade: e.target.value }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                      <option value="baixa">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Local</label>
                  <input value={formAudiencia.local} onChange={e => setFormAudiencia(f => ({ ...f, local: e.target.value }))}
                    placeholder="Ex: Gabinete, Câmara, Online" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                  <textarea rows={2} value={formAudiencia.observacao} onChange={e => setFormAudiencia(f => ({ ...f, observacao: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none" />
                </div>
              </>)}

              {erro && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{erro}
                </div>
              )}

              <button
                onClick={tab === 'projetos' ? salvarProjeto : tab === 'protocolos' ? salvarProtocolo : salvarAudiencia}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-[#002776] text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
