'use client'
import { useEffect, useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, AlertCircle, X, Loader2, Filter, Download, Pencil, Trash2, FileBarChart2, Users } from 'lucide-react'
import api from '@/lib/api'
import { validarCPF, formatarCPF } from '@/lib/cpf'

const LABEL_CATEGORIA: Record<string, string> = {
  recursos_proprios: 'Recursos Próprios', doacao_pessoa_fisica: 'Doação Pessoa Física',
  transferencia_partido: 'Transferência Partido', transferencia_comite: 'Transferência Comitê',
  financiamento_coletivo: 'Financiamento Coletivo', outros_receita: 'Outros (Receita)',
  pessoal: 'Pessoal', publicidade: 'Publicidade', producao_material: 'Produção de Material',
  impulsionamento_digital: 'Impulsionamento Digital', combustivel_transporte: 'Combustível/Transporte',
  alimentacao: 'Alimentação', aluguel_espaco: 'Aluguel de Espaço', equipamentos: 'Equipamentos',
  servicos_juridicos: 'Serviços Jurídicos', doacao_outros_candidatos: 'Doação a Outros Candidatos',
  outros_despesa: 'Outros (Despesa)',
}
const CATEGORIAS_RECEITA = ['recursos_proprios','doacao_pessoa_fisica','transferencia_partido','transferencia_comite','financiamento_coletivo','outros_receita']
const CATEGORIAS_DESPESA = ['pessoal','publicidade','producao_material','impulsionamento_digital','combustivel_transporte','alimentacao','aluguel_espaco','equipamentos','servicos_juridicos','doacao_outros_candidatos','outros_despesa']

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

interface Lancamento {
  id: string; tipo: string; categoria: string; descricao: string
  valor: number; data: string; fornecedor?: string; doadorCpf?: string
  notaFiscal?: string; status: string; tseCategoria?: string; observacao?: string
}
interface Resumo {
  totalReceita: number; totalDespesa: number; saldo: number
  porCategoria: Record<string, { receita: number; despesa: number }>
  evolucaoMensal: { mes: string; receita: number; despesa: number }[]
  meta: { totalPrevisto: number; alertaPercentual: number; percentualGasto: number | null } | null
}
interface Relatorio {
  totalReceita: number; totalDespesa: number; saldo: number
  receitasPorCategoria: Record<string, number>
  despesasPorCategoria: Record<string, number>
  doadores: { nome: string; cpf: string; valor: number; data: string }[]
  maioresDespesas: { descricao: string; categoria: string; valor: number; data: string; fornecedor?: string }[]
  totalLancamentos: number
}

const emptyForm = {
  tipo: 'despesa', categoria: '', descricao: '', valor: '',
  data: new Date().toISOString().slice(0, 10),
  fornecedor: '', doadorCpf: '', notaFiscal: '', observacao: '', status: 'confirmado',
}

export default function FinanceiroPage() {
  const [tab, setTab] = useState<'resumo' | 'lancamentos' | 'relatorio' | 'meta' | 'dre'>('resumo')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Lancamento | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [metaForm, setMetaForm] = useState({ totalPrevisto: '', alertaPercentual: '80' })
  const [savingMeta, setSavingMeta] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filtroPeriodo, setFiltroPeriodo] = useState({ inicio: '', fim: '' })
  const [dre, setDre] = useState<any>(null)
  const [dreAno, setDreAno] = useState(new Date().getFullYear().toString())
  const [loadingDre, setLoadingDre] = useState(false)

  const loadResumo = async () => {
    const res = await api.get('/financeiro/resumo')
    setResumo(res.data)
    if (res.data.meta) setMetaForm({ totalPrevisto: res.data.meta.totalPrevisto, alertaPercentual: res.data.meta.alertaPercentual })
  }

  const loadLancamentos = async (p = 1, tipo = filtroTipo) => {
    setLoading(true)
    const res = await api.get('/financeiro', { params: { page: p, tipo: tipo || undefined } })
    setLancamentos(res.data.items); setTotal(res.data.total); setPages(res.data.pages)
    setLoading(false)
  }

  const loadRelatorio = async () => {
    setLoading(true)
    const res = await api.get('/financeiro/relatorio', {
      params: { dataInicio: filtroPeriodo.inicio || undefined, dataFim: filtroPeriodo.fim || undefined },
    })
    setRelatorio(res.data); setLoading(false)
  }

  useEffect(() => { loadResumo().finally(() => setLoading(false)) }, [])
  useEffect(() => { if (tab === 'lancamentos') loadLancamentos(1, filtroTipo) }, [tab, filtroTipo])
  useEffect(() => { if (tab === 'relatorio') loadRelatorio() }, [tab])

  const loadDre = async (ano = dreAno) => {
    setLoadingDre(true)
    try {
      const res = await api.get('/financeiro/dre', { params: { ano } })
      setDre(res.data)
    } catch {} finally { setLoadingDre(false) }
  }

  useEffect(() => { if (tab === 'dre') loadDre() }, [tab])

  const abrirNovo = () => { setEditando(null); setForm(emptyForm); setErro(''); setShowForm(true) }

  const abrirEditar = (l: Lancamento) => {
    setEditando(l)
    setForm({
      tipo: l.tipo, categoria: l.categoria, descricao: l.descricao,
      valor: String(l.valor), data: new Date(l.data).toISOString().slice(0, 10),
      fornecedor: l.fornecedor ?? '', doadorCpf: l.doadorCpf ?? '',
      notaFiscal: l.notaFiscal ?? '', observacao: l.observacao ?? '', status: l.status,
    })
    setErro(''); setShowForm(true)
  }

  const salvar = async () => {
    setErro(''); setSaving(true)
    try {
      const payload = {
        ...form, valor: parseFloat(form.valor),
        doadorCpf: form.doadorCpf || undefined,
        fornecedor: form.fornecedor || undefined,
        notaFiscal: form.notaFiscal || undefined,
        observacao: form.observacao || undefined,
      }
      if (editando) await api.patch(`/financeiro/${editando.id}`, payload)
      else await api.post('/financeiro', payload)
      setShowForm(false); setForm(emptyForm); setEditando(null)
      loadResumo()
      if (tab === 'lancamentos') loadLancamentos(1)
    } catch (e: any) { setErro(e.response?.data?.error ?? 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const excluir = async (id: string) => {
    if (!confirm('Confirma exclusão deste lançamento?')) return
    setDeletingId(id)
    try { await api.delete(`/financeiro/${id}`); loadResumo(); loadLancamentos(page) }
    catch { alert('Erro ao excluir') } finally { setDeletingId(null) }
  }

  const salvarMeta = async () => {
    setSavingMeta(true)
    try {
      await api.put('/financeiro/orcamento', {
        totalPrevisto: parseFloat(metaForm.totalPrevisto),
        alertaPercentual: parseInt(metaForm.alertaPercentual),
      })
      loadResumo()
    } catch { } finally { setSavingMeta(false) }
  }

  const exportarCSV = async () => {
    setExportando(true)
    try {
      const res = await api.get('/financeiro/export', {
        responseType: 'blob',
        params: { dataInicio: filtroPeriodo.inicio || undefined, dataFim: filtroPeriodo.fim || undefined },
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `prestacao-contas-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erro ao exportar') } finally { setExportando(false) }
  }

  const categorias = form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA
  const isDoacao = form.categoria === 'doacao_pessoa_fisica'

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500">Controle de receitas e despesas da campanha</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportarCSV} disabled={exportando}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar TSE
          </button>
          <button onClick={abrirNovo}
            className="flex items-center gap-2 bg-[#002776] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#001f5e] transition-colors">
            <Plus className="w-4 h-4" /> Novo lançamento
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {[
          { key: 'resumo', label: 'Resumo' },
          { key: 'lancamentos', label: 'Lançamentos' },
          { key: 'dre', label: '⭐ DRE Eleitoral' },
          { key: 'relatorio', label: 'Relatório Contador' },
          { key: 'meta', label: 'Meta Orçamentária' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as 'resumo' | 'lancamentos' | 'relatorio' | 'meta' | 'dre')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMO ── */}
      {tab === 'resumo' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : !resumo ? null : (<>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div>
                  <span className="text-sm text-gray-500 font-medium">Total Receitas</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{fmt(resumo.totalReceita)}</p>
              </div>
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><TrendingDown className="w-5 h-5 text-red-500" /></div>
                  <span className="text-sm text-gray-500 font-medium">Total Despesas</span>
                </div>
                <p className="text-2xl font-bold text-red-500">{fmt(resumo.totalDespesa)}</p>
              </div>
              <div className={`bg-white rounded-2xl border p-5 shadow-sm ${resumo.saldo < 0 ? 'border-red-200' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${resumo.saldo >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                    <Wallet className={`w-5 h-5 ${resumo.saldo >= 0 ? 'text-blue-600' : 'text-red-500'}`} />
                  </div>
                  <span className="text-sm text-gray-500 font-medium">Saldo</span>
                </div>
                <p className={`text-2xl font-bold ${resumo.saldo >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmt(resumo.saldo)}</p>
              </div>
            </div>

            {resumo.meta && (
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Meta Orçamentária</h3>
                  <span className="text-sm text-gray-500">{fmt(resumo.totalDespesa)} de {fmt(resumo.meta.totalPrevisto)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${(resumo.meta.percentualGasto ?? 0) >= resumo.meta.alertaPercentual ? 'bg-red-500' : 'bg-[#009C3B]'}`}
                    style={{ width: `${Math.min(100, resumo.meta.percentualGasto ?? 0)}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>{resumo.meta.percentualGasto ?? 0}% utilizado</span>
                  {(resumo.meta.percentualGasto ?? 0) >= resumo.meta.alertaPercentual && (
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Alerta: {resumo.meta.alertaPercentual}% atingido
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Evolução Mensal</h3>
              <div className="space-y-3">
                {resumo.evolucaoMensal.map(m => (
                  <div key={m.mes}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="font-medium text-gray-700 w-16">{m.mes}</span>
                      <span className="text-green-600">+{fmt(m.receita)}</span>
                      <span className="text-red-500">-{fmt(m.despesa)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      {m.receita > 0 && <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(100, (m.receita / Math.max(m.receita, m.despesa, 1)) * 100)}%` }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {Object.keys(resumo.porCategoria).length > 0 && (
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Por Categoria</h3>
                <div className="space-y-2">
                  {Object.entries(resumo.porCategoria).sort((a, b) => (b[1].despesa + b[1].receita) - (a[1].despesa + a[1].receita)).map(([cat, vals]) => (
                    <div key={cat} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm text-gray-700">{LABEL_CATEGORIA[cat] ?? cat}</span>
                      <div className="flex gap-4 text-sm">
                        {vals.receita > 0 && <span className="text-green-600 font-medium">+{fmt(vals.receita)}</span>}
                        {vals.despesa > 0 && <span className="text-red-500 font-medium">-{fmt(vals.despesa)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}
        </div>
      )}

      {/* ── LANÇAMENTOS ── */}
      {tab === 'lancamentos' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
              <option value="">Todos os tipos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
            </select>
            <span className="text-sm text-gray-500 ml-auto">{total} lançamentos</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {lancamentos.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Nenhum lançamento encontrado</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Descrição</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">TSE</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lancamentos.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.data)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{l.descricao}</p>
                          {l.fornecedor && (
                            <p className="text-xs text-gray-400">{l.fornecedor}{l.doadorCpf ? ` · CPF: ${l.doadorCpf}` : ''}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{LABEL_CATEGORIA[l.categoria] ?? l.categoria}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{l.tseCategoria ?? '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${l.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                          {l.tipo === 'receita' ? '+' : '-'}{fmt(Number(l.valor))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.status === 'confirmado' ? 'bg-green-100 text-green-700' : l.status === 'pendente' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => abrirEditar(l)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => excluir(l.id)} disabled={deletingId === l.id}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors">
                              {deletingId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {pages > 1 && (
            <div className="flex justify-center gap-3">
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); loadLancamentos(page - 1) }}
                className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">Anterior</button>
              <span className="px-4 py-2 text-sm text-gray-600">{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => { setPage(p => p + 1); loadLancamentos(page + 1) }}
                className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">Próximo</button>
            </div>
          )}
        </div>
      )}

      {/* ── RELATÓRIO CONTADOR ── */}
      {tab === 'relatorio' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">De:</label>
              <input type="date" value={filtroPeriodo.inicio}
                onChange={e => setFiltroPeriodo(f => ({ ...f, inicio: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">Até:</label>
              <input type="date" value={filtroPeriodo.fim}
                onChange={e => setFiltroPeriodo(f => ({ ...f, fim: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <button onClick={loadRelatorio}
              className="px-4 py-2 rounded-xl bg-[#002776] text-white text-sm font-medium">Gerar</button>
            <button onClick={exportarCSV} disabled={exportando}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} CSV para TSE
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : !relatorio ? null : (<>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Receitas', v: relatorio.totalReceita, color: 'text-green-600' },
                { label: 'Total Despesas', v: relatorio.totalDespesa, color: 'text-red-500' },
                { label: 'Saldo', v: relatorio.saldo, color: relatorio.saldo >= 0 ? 'text-blue-600' : 'text-red-500' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border p-4 shadow-sm text-center">
                  <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                  <p className={`text-xl font-bold ${c.color}`}>{fmt(c.v)}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <h3 className="font-semibold text-gray-900">Receitas por Origem</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(relatorio.receitasPorCategoria).sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
                    <div key={cat} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <span className="text-sm text-gray-700">{LABEL_CATEGORIA[cat] ?? cat}</span>
                      <span className="text-sm font-semibold text-green-600">{fmt(v)}</span>
                    </div>
                  ))}
                  {Object.keys(relatorio.receitasPorCategoria).length === 0 && (
                    <p className="text-sm text-gray-400">Nenhuma receita no período</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-gray-900">Despesas por Categoria</h3>
                </div>
                <div className="space-y-2">
                  {Object.entries(relatorio.despesasPorCategoria).sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
                    <div key={cat} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <span className="text-sm text-gray-700">{LABEL_CATEGORIA[cat] ?? cat}</span>
                      <span className="text-sm font-semibold text-red-500">{fmt(v)}</span>
                    </div>
                  ))}
                  {Object.keys(relatorio.despesasPorCategoria).length === 0 && (
                    <p className="text-sm text-gray-400">Nenhuma despesa no período</p>
                  )}
                </div>
              </div>
            </div>

            {relatorio.doadores.length > 0 && (
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Lista de Doadores (Pessoa Física)</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">Nome</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">CPF</th>
                      <th className="text-right px-3 py-2 text-xs text-gray-500">Valor</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {relatorio.doadores.map((d, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900">{d.nome}</td>
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">{d.cpf}</td>
                        <td className="px-3 py-2 text-right text-green-600 font-semibold">{fmt(d.valor)}</td>
                        <td className="px-3 py-2 text-gray-400">{fmtDate(String(d.data))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {relatorio.maioresDespesas.length > 0 && (
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <FileBarChart2 className="w-4 h-4 text-amber-600" />
                  <h3 className="font-semibold text-gray-900">Maiores Despesas</h3>
                </div>
                <div className="space-y-2">
                  {relatorio.maioresDespesas.map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.descricao}</p>
                        <p className="text-xs text-gray-400">{LABEL_CATEGORIA[d.categoria] ?? d.categoria}{d.fornecedor ? ` · ${d.fornecedor}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-500">{fmt(d.valor)}</p>
                        <p className="text-xs text-gray-400">{fmtDate(String(d.data))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}
        </div>
      )}

      {/* ── META ── */}
      {tab === 'meta' && (
        <div className="max-w-lg space-y-4">
          <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">Configurar Meta Orçamentária</h3>
            <p className="text-sm text-gray-500">Defina o teto de gastos da campanha para acompanhar o progresso e receber alertas.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total previsto (R$)</label>
              <input type="number" value={metaForm.totalPrevisto}
                onChange={e => setMetaForm(f => ({ ...f, totalPrevisto: e.target.value }))}
                placeholder="Ex: 50000" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alertar ao atingir (%)</label>
              <input type="number" min={1} max={100} value={metaForm.alertaPercentual}
                onChange={e => setMetaForm(f => ({ ...f, alertaPercentual: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              <p className="text-xs text-gray-400 mt-1">Um alerta aparece no resumo quando o percentual de gastos atingir este valor.</p>
            </div>
            <button onClick={salvarMeta} disabled={savingMeta || !metaForm.totalPrevisto}
              className="w-full py-2.5 rounded-xl bg-[#002776] text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
              {savingMeta && <Loader2 className="w-4 h-4 animate-spin" />} Salvar meta
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL LANÇAMENTO ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-900">{editando ? 'Editar lançamento' : 'Novo lançamento'}</h2>
              <button onClick={() => { setShowForm(false); setEditando(null); setErro('') }}
                className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value, categoria: '', doadorCpf: '' }))}
                    disabled={!!editando}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776] disabled:bg-gray-50">
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                    <option value="confirmado">Confirmado</option>
                    <option value="pendente">Pendente</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Categoria *</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                  <option value="">Selecione...</option>
                  {categorias.map(c => <option key={c} value={c}>{LABEL_CATEGORIA[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descrição *</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Impressão de panfletos"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {isDoacao ? 'Nome do doador' : 'Fornecedor / Origem'}
                </label>
                <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                  placeholder={isDoacao ? 'Nome completo do doador' : 'Nome do fornecedor'}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              {isDoacao && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    CPF do doador <span className="text-red-500 font-semibold">(obrigatório TSE)</span>
                  </label>
                  <input value={form.doadorCpf}
                    onChange={e => setForm(f => ({ ...f, doadorCpf: formatarCPF(e.target.value) }))}
                    placeholder="000.000.000-00" maxLength={14}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] ${form.doadorCpf.replace(/\D/g,'').length === 11 && !validarCPF(form.doadorCpf) ? 'border-red-400 bg-red-50' : ''}`}
                  />
                  {form.doadorCpf.replace(/\D/g,'').length === 11 && !validarCPF(form.doadorCpf) && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> CPF inválido — verifique os números
                    </p>
                  )}
                  {form.doadorCpf.replace(/\D/g,'').length === 11 && validarCPF(form.doadorCpf) && (
                    <p className="text-xs text-green-600 mt-1">✓ CPF válido</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nº Nota Fiscal</label>
                <input value={form.notaFiscal} onChange={e => setForm(f => ({ ...f, notaFiscal: e.target.value }))}
                  placeholder="Número da NF"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                <textarea rows={2} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none" />
              </div>
              {erro && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{erro}
                </div>
              )}
              <button onClick={salvar} disabled={saving || !form.categoria || !form.descricao || !form.valor || (isDoacao && !validarCPF(form.doadorCpf))}
                className="w-full py-3 rounded-xl bg-[#002776] text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editando ? 'Salvar alterações' : 'Salvar lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRE ELEITORAL ── */}
      {tab === 'dre' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Ano de referência:</label>
              <select value={dreAno} onChange={e => { setDreAno(e.target.value); loadDre(e.target.value) }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#009C3B]">
                {[2024, 2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button onClick={() => loadDre(dreAno)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
              <FileBarChart2 size={14} /> Atualizar
            </button>
          </div>

          {loadingDre ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : !dre ? null : (
            <div className="space-y-5">
              {/* Cards de resultado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-xs text-green-700 font-medium mb-1">Total Receitas</p>
                  <p className="text-xl font-bold text-green-700">{fmt(dre.totalReceita)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-xs text-red-700 font-medium mb-1">Total Despesas</p>
                  <p className="text-xl font-bold text-red-600">{fmt(dre.totalDespesa)}</p>
                </div>
                <div className={`border rounded-2xl p-4 ${dre.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                  <p className={`text-xs font-medium mb-1 ${dre.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Resultado</p>
                  <p className={`text-xl font-bold ${dre.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(dre.saldo)}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 font-medium mb-1">Índice Eficiência</p>
                  <p className="text-xl font-bold text-gray-700">{dre.indicadores.indiceEficiencia}%</p>
                  <p className="text-xs text-gray-400">{dre.totalLancamentos} lançamentos</p>
                </div>
              </div>

              {/* Alerta orçamento */}
              {dre.indicadores.alertaOrcamento && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle size={16} />
                  <span>Orçamento em alerta — {dre.indicadores.execucaoOrcamento}% do previsto ({fmt(dre.indicadores.orcamentoPrevisto)}) já foi gasto</span>
                </div>
              )}

              {/* Evolução mensal */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Evolução Mensal {dreAno}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="text-left pb-2 font-medium">Mês</th>
                        <th className="text-right pb-2 font-medium text-green-600">Receitas</th>
                        <th className="text-right pb-2 font-medium text-red-500">Despesas</th>
                        <th className="text-right pb-2 font-medium">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dre.meses.map((m: any, i: number) => (
                        <tr key={i} className={`border-b border-gray-50 ${m.receita === 0 && m.despesa === 0 ? 'text-gray-300' : ''}`}>
                          <td className="py-2 capitalize">{m.mes}</td>
                          <td className="py-2 text-right text-green-600">{m.receita > 0 ? fmt(m.receita) : '—'}</td>
                          <td className="py-2 text-right text-red-500">{m.despesa > 0 ? fmt(m.despesa) : '—'}</td>
                          <td className={`py-2 text-right font-medium ${m.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {m.receita > 0 || m.despesa > 0 ? fmt(m.saldo) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td className="py-2 px-1">TOTAL</td>
                        <td className="py-2 text-right text-green-600">{fmt(dre.totalReceita)}</td>
                        <td className="py-2 text-right text-red-500">{fmt(dre.totalDespesa)}</td>
                        <td className={`py-2 text-right ${dre.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{fmt(dre.saldo)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Por categoria TSE */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Por Categoria TSE</h3>
                <div className="space-y-2">
                  {dre.porCategoriaTSE
                    .sort((a: any, b: any) => b.valor - a.valor)
                    .map((cat: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono w-10 text-center">{cat.codigo}</span>
                      <span className="text-xs text-gray-500 flex-1 truncate capitalize">{LABEL_CATEGORIA[cat.descricao] ?? cat.descricao}</span>
                      <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${cat.tipo === 'receita' ? 'bg-green-400' : 'bg-red-400'}`}
                          style={{ width: `${cat.percentual}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-24 text-right">{fmt(cat.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão exportar */}
              <button onClick={exportarCSV} disabled={exportando}
                className="flex items-center gap-2 bg-[#002776] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#001f5e] transition-colors disabled:opacity-50">
                {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Exportar CSV — Prestação de Contas TSE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
