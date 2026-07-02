'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  DollarSign, TrendingUp, TrendingDown, Scale, Plus, Download,
  ChevronDown, ChevronUp, X, Search, Filter, PiggyBank, Target,
  AlertTriangle, CheckCircle2, Clock, Ban,
} from 'lucide-react'

const LABEL_CATEGORIA: Record<string, string> = {
  recursos_proprios: 'Recursos próprios', doacao_pessoa_fisica: 'Doação PF',
  transferencia_partido: 'Transferência partido', transferencia_comite: 'Transferência comitê',
  financiamento_coletivo: 'Financiamento coletivo', outros_receita: 'Outros (receita)',
  pessoal: 'Pessoal', publicidade: 'Publicidade', producao_material: 'Produção de material',
  impulsionamento_digital: 'Impulsionamento digital', combustivel_transporte: 'Combustível/Transporte',
  alimentacao: 'Alimentação', aluguel_espaco: 'Aluguel de espaço', equipamentos: 'Equipamentos',
  servicos_juridicos: 'Serviços jurídicos', doacao_outros_candidatos: 'Doação a outros candidatos',
  outros_despesa: 'Outros (despesa)',
}

const STATUS_CONFIG = {
  confirmado: { label: 'Confirmado', icon: CheckCircle2, color: 'text-green-600' },
  pendente: { label: 'Pendente', icon: Clock, color: 'text-amber-500' },
  cancelado: { label: 'Cancelado', icon: Ban, color: 'text-red-500' },
}

function moeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface Lancamento {
  id: string; tipo: 'receita' | 'despesa'; categoria: string; descricao: string
  valor: number; data: string; fornecedor?: string; notaFiscal?: string
  comprovante?: string; observacao?: string; status: string; tseCategoria?: string
}

interface Resumo {
  totalReceita: number; totalDespesa: number; saldo: number
  porCategoria: Record<string, { receita: number; despesa: number }>
  evolucaoMensal: { mes: string; receita: number; despesa: number }[]
  meta: { totalPrevisto: number; alertaPercentual: number; percentualGasto: number | null } | null
}

const EMPTY_FORM = {
  tipo: 'despesa' as 'receita' | 'despesa', categoria: '', descricao: '',
  valor: '', data: new Date().toISOString().slice(0, 10),
  fornecedor: '', notaFiscal: '', observacao: '', status: 'confirmado',
}

export default function FinanceiroPage() {
  const { token } = useAuthStore()
  const [tab, setTab] = useState<'dashboard' | 'lancamentos' | 'orcamento'>('dashboard')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [items, setItems] = useState<Lancamento[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Lancamento | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [categorias, setCategorias] = useState<{ receita: string[]; despesa: string[] }>({ receita: [], despesa: [] })
  const [filtros, setFiltros] = useState({ tipo: '', categoria: '', status: '', q: '', dataInicio: '', dataFim: '' })
  const [orcamento, setOrcamento] = useState({ totalPrevisto: '', alertaPercentual: '80' })
  const [saving, setSaving] = useState(false)

  const headers = { Authorization: `Bearer ${token}` }

  const loadResumo = useCallback(async () => {
    try {
      const res = await api.get('/financeiro/resumo', { headers })
      setResumo(res.data)
    } catch {}
  }, [token])

  const loadLancamentos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (filtros.tipo) params.set('tipo', filtros.tipo)
      if (filtros.categoria) params.set('categoria', filtros.categoria)
      if (filtros.status) params.set('status', filtros.status)
      if (filtros.q) params.set('q', filtros.q)
      if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio)
      if (filtros.dataFim) params.set('dataFim', filtros.dataFim)
      const { data } = await api.get(`/financeiro?${params}`, { headers })
      setItems(data.items); setTotal(data.total); setPages(data.pages)
    } finally { setLoading(false) }
  }, [token, page, filtros])

  const loadOrcamento = useCallback(async () => {
    try {
      const { data } = await api.get('/financeiro/orcamento', { headers })
      setOrcamento({ totalPrevisto: String(data.totalPrevisto ?? ''), alertaPercentual: String(data.alertaPercentual ?? 80) })
    } catch {}
  }, [token])

  useEffect(() => {
    api.get('/financeiro/categorias', { headers }).then(({ data }) => setCategorias(data)).catch(() => {})
  }, [token])

  useEffect(() => { loadResumo() }, [loadResumo])
  useEffect(() => { if (tab === 'lancamentos') loadLancamentos() }, [tab, loadLancamentos])
  useEffect(() => { if (tab === 'orcamento') loadOrcamento() }, [tab, loadOrcamento])

  async function salvarLancamento() {
    if (!form.categoria || !form.descricao || !form.valor) return
    setSaving(true)
    try {
      const body = { ...form, valor: parseFloat(form.valor.replace(',', '.')) }
      if (editItem) {
        await api.patch(`/financeiro/${editItem.id}`, body, { headers })
      } else {
        await api.post('/financeiro', body, { headers })
      }
      setShowForm(false); setEditItem(null); setForm(EMPTY_FORM)
      loadLancamentos(); loadResumo()
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir lançamento?')) return
    await api.delete(`/financeiro/${id}`, { headers })
    loadLancamentos(); loadResumo()
  }

  function abrirEdicao(l: Lancamento) {
    setEditItem(l)
    setForm({
      tipo: l.tipo, categoria: l.categoria, descricao: l.descricao,
      valor: String(l.valor), data: l.data.slice(0, 10),
      fornecedor: l.fornecedor ?? '', notaFiscal: l.notaFiscal ?? '',
      observacao: l.observacao ?? '', status: l.status,
    })
    setShowForm(true)
  }

  async function salvarOrcamento() {
    setSaving(true)
    try {
      await api.put('/financeiro/orcamento', {
        totalPrevisto: parseFloat(orcamento.totalPrevisto || '0'),
        alertaPercentual: parseInt(orcamento.alertaPercentual),
      }, { headers })
      loadResumo()
      alert('Orçamento salvo!')
    } finally { setSaving(false) }
  }

  function exportCSV() {
    const params = new URLSearchParams()
    if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio)
    if (filtros.dataFim) params.set('dataFim', filtros.dataFim)
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/financeiro/export?${params}`, '_blank')
  }

  const saldoPositivo = (resumo?.saldo ?? 0) >= 0
  const catOptions = form.tipo === 'receita' ? categorias.receita : categorias.despesa

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controle Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Receitas, despesas e prestação de contas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={() => { setEditItem(null); setForm(EMPTY_FORM); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#009C3B] text-white rounded-lg hover:bg-[#007d2f] transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['dashboard', 'lancamentos', 'orcamento'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors',
              tab === t ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {t === 'orcamento' ? 'Orçamento' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && resumo && (
        <div className="space-y-6">
          {/* Alerta de orçamento */}
          {resumo.meta?.percentualGasto !== null && resumo.meta!.percentualGasto! >= resumo.meta!.alertaPercentual && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                Atenção: {resumo.meta!.percentualGasto}% do orçamento previsto já foi utilizado
                ({moeda(resumo.totalDespesa)} de {moeda(resumo.meta!.totalPrevisto)})
              </span>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Receitas', value: resumo.totalReceita, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Total Despesas', value: resumo.totalDespesa, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
              { label: 'Saldo Atual', value: resumo.saldo, icon: Scale, color: saldoPositivo ? 'text-green-600' : 'text-red-500', bg: saldoPositivo ? 'bg-green-50' : 'bg-red-50' },
              { label: 'Orçamento Previsto', value: resumo.meta?.totalPrevisto ?? 0, icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl border bg-card p-4 space-y-2">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', kpi.bg)}>
                  <kpi.icon className={cn('w-5 h-5', kpi.color)} />
                </div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={cn('text-lg font-bold', kpi.color)}>{moeda(kpi.value)}</p>
              </div>
            ))}
          </div>

          {/* Barra de orçamento */}
          {resumo.meta && resumo.meta.totalPrevisto > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Progresso do Orçamento</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {moeda(resumo.totalDespesa)} / {moeda(resumo.meta.totalPrevisto)}
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', (resumo.meta.percentualGasto ?? 0) >= resumo.meta.alertaPercentual ? 'bg-amber-500' : 'bg-[#009C3B]')}
                  style={{ width: `${Math.min(100, resumo.meta.percentualGasto ?? 0)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{resumo.meta.percentualGasto ?? 0}% utilizado</p>
            </div>
          )}

          {/* Evolução mensal */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Evolução Mensal</h3>
            <div className="space-y-3">
              {resumo.evolucaoMensal.map(m => {
                const maxVal = Math.max(...resumo.evolucaoMensal.map(x => Math.max(x.receita, x.despesa)), 1)
                return (
                  <div key={m.mes} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="font-medium">{m.mes}</span>
                      <span>{moeda(m.receita - m.despesa)}</span>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className="rounded bg-green-500" style={{ width: `${(m.receita / maxVal) * 100}%`, minWidth: m.receita > 0 ? '2px' : '0' }} />
                      <div className="rounded bg-red-400" style={{ width: `${(m.despesa / maxVal) * 100}%`, minWidth: m.despesa > 0 ? '2px' : '0' }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-green-500 inline-block" /> Receita</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded bg-red-400 inline-block" /> Despesa</span>
            </div>
          </div>

          {/* Por categoria */}
          {Object.keys(resumo.porCategoria).length > 0 && (
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Por Categoria</h3>
              <div className="space-y-2">
                {Object.entries(resumo.porCategoria)
                  .sort((a, b) => (b[1].despesa + b[1].receita) - (a[1].despesa + a[1].receita))
                  .map(([cat, vals]) => (
                    <div key={cat} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-sm">{LABEL_CATEGORIA[cat] ?? cat}</span>
                      <div className="flex gap-4 text-sm">
                        {vals.receita > 0 && <span className="text-green-600">+{moeda(vals.receita)}</span>}
                        {vals.despesa > 0 && <span className="text-red-500">-{moeda(vals.despesa)}</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LANÇAMENTOS ── */}
      {tab === 'lancamentos' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Buscar descrição..."
                value={filtros.q}
                onChange={e => { setFiltros(f => ({ ...f, q: e.target.value })); setPage(1) }}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background"
              />
            </div>
            <select value={filtros.tipo} onChange={e => { setFiltros(f => ({ ...f, tipo: e.target.value })); setPage(1) }}
              className="px-3 py-2 text-sm border rounded-lg bg-background">
              <option value="">Tipo</option>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
            <select value={filtros.status} onChange={e => { setFiltros(f => ({ ...f, status: e.target.value })); setPage(1) }}
              className="px-3 py-2 text-sm border rounded-lg bg-background">
              <option value="">Status</option>
              <option value="confirmado">Confirmado</option>
              <option value="pendente">Pendente</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <input type="date" value={filtros.dataInicio} onChange={e => { setFiltros(f => ({ ...f, dataInicio: e.target.value })); setPage(1) }}
              className="px-3 py-2 text-sm border rounded-lg bg-background" />
            <input type="date" value={filtros.dataFim} onChange={e => { setFiltros(f => ({ ...f, dataFim: e.target.value })); setPage(1) }}
              className="px-3 py-2 text-sm border rounded-lg bg-background" />
          </div>

          {/* Total */}
          <p className="text-sm text-muted-foreground">{total} lançamento{total !== 1 ? 's' : ''}</p>

          {/* Tabela */}
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  {['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum lançamento encontrado</td></tr>
                ) : items.map(l => {
                  const statusConf = STATUS_CONFIG[l.status as keyof typeof STATUS_CONFIG]
                  const Icon = statusConf?.icon ?? CheckCircle2
                  return (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                          l.tipo === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {l.tipo === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">{LABEL_CATEGORIA[l.categoria] ?? l.categoria}</td>
                      <td className="px-3 py-3 max-w-[200px] truncate">{l.descricao}</td>
                      <td className={cn('px-3 py-3 font-semibold whitespace-nowrap', l.tipo === 'receita' ? 'text-green-600' : 'text-red-500')}>
                        {l.tipo === 'receita' ? '+' : '-'}{moeda(l.valor)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('flex items-center gap-1 text-xs', statusConf?.color)}>
                          <Icon className="w-3.5 h-3.5" /> {statusConf?.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => abrirEdicao(l)} className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors">Editar</button>
                          <button onClick={() => excluir(l.id)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">Excluir</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors">
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">Página {page} de {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted transition-colors">
                Próxima
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ORÇAMENTO ── */}
      {tab === 'orcamento' && (
        <div className="max-w-md space-y-5">
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Target className="w-5 h-5" /> Meta de Orçamento</h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Orçamento total previsto (R$)</label>
              <input
                type="number" min="0" step="100"
                value={orcamento.totalPrevisto}
                onChange={e => setOrcamento(o => ({ ...o, totalPrevisto: e.target.value }))}
                placeholder="0,00"
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Alertar quando gastar (%) do orçamento</label>
              <input
                type="number" min="1" max="100"
                value={orcamento.alertaPercentual}
                onChange={e => setOrcamento(o => ({ ...o, alertaPercentual: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg bg-background text-sm"
              />
              <p className="text-xs text-muted-foreground">Você receberá um alerta visual ao atingir este percentual</p>
            </div>
            <button onClick={salvarOrcamento} disabled={saving}
              className="w-full py-2 bg-[#009C3B] text-white rounded-lg text-sm font-medium hover:bg-[#007d2f] disabled:opacity-60 transition-colors">
              {saving ? 'Salvando...' : 'Salvar Orçamento'}
            </button>
          </div>
          <div className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
            <p className="font-medium">Limite TSE para campanha eleitoral</p>
            <p className="text-xs">O limite de gastos é definido pelo TSE por cargo e estado. Consulte a Resolução TSE nº 23.607 para o valor permitido para seu cargo/estado e defina-o como orçamento previsto.</p>
          </div>
        </div>
      )}

      {/* ── MODAL DE LANÇAMENTO ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg">{editItem ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
              <button onClick={() => { setShowForm(false); setEditItem(null); setForm(EMPTY_FORM) }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Tipo */}
              <div className="flex rounded-lg border overflow-hidden">
                {(['receita', 'despesa'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, tipo: t, categoria: '' }))}
                    className={cn('flex-1 py-2.5 text-sm font-medium transition-colors',
                      form.tipo === t ? (t === 'receita' ? 'bg-green-600 text-white' : 'bg-red-500 text-white') : 'hover:bg-muted')}>
                    {t === 'receita' ? '+ Receita' : '− Despesa'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Categoria */}
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Categoria *</label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                    <option value="">Selecione...</option>
                    {catOptions.map(c => <option key={c} value={c}>{LABEL_CATEGORIA[c] ?? c}</option>)}
                  </select>
                </div>
                {/* Descrição */}
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Descrição *</label>
                  <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex: Impressão de panfletos" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                {/* Valor */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Valor (R$) *</label>
                  <input type="number" min="0" step="0.01" value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                {/* Data */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                {/* Fornecedor */}
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Fornecedor / Origem</label>
                  <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                    placeholder="Nome do fornecedor ou doador" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                {/* Nota Fiscal */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nota Fiscal / Recibo</label>
                  <input value={form.notaFiscal} onChange={e => setForm(f => ({ ...f, notaFiscal: e.target.value }))}
                    placeholder="Nº da NF" className="w-full px-3 py-2 border rounded-lg bg-background text-sm" />
                </div>
                {/* Status */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm">
                    <option value="confirmado">Confirmado</option>
                    <option value="pendente">Pendente</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                {/* Observação */}
                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">Observação</label>
                  <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                    rows={2} placeholder="Informações adicionais..."
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm resize-none" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditItem(null); setForm(EMPTY_FORM) }}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={salvarLancamento} disabled={saving || !form.categoria || !form.descricao || !form.valor}
                className="px-4 py-2 text-sm bg-[#009C3B] text-white rounded-lg hover:bg-[#007d2f] disabled:opacity-60 transition-colors">
                {saving ? 'Salvando...' : editItem ? 'Salvar Alterações' : 'Criar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
