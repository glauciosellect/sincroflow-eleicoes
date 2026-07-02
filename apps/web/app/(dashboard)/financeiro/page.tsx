'use client'
import { useEffect, useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, AlertCircle, X, Loader2, FileDown, Filter } from 'lucide-react'
import api from '@/lib/api'

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

const CATEGORIAS_RECEITA = [
  'recursos_proprios', 'doacao_pessoa_fisica', 'transferencia_partido',
  'transferencia_comite', 'financiamento_coletivo', 'outros_receita',
]
const CATEGORIAS_DESPESA = [
  'pessoal', 'publicidade', 'producao_material', 'impulsionamento_digital',
  'combustivel_transporte', 'alimentacao', 'aluguel_espaco', 'equipamentos',
  'servicos_juridicos', 'doacao_outros_candidatos', 'outros_despesa',
]

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

interface Resumo {
  totalReceita: number; totalDespesa: number; saldo: number
  porCategoria: Record<string, { receita: number; despesa: number }>
  evolucaoMensal: { mes: string; receita: number; despesa: number }[]
  meta: { totalPrevisto: number; alertaPercentual: number; percentualGasto: number | null } | null
}

interface Lancamento {
  id: string; tipo: string; categoria: string; descricao: string
  valor: number; data: string; fornecedor?: string; notaFiscal?: string
  status: string; tseCategoria?: string
}

const emptyForm = { tipo: 'despesa', categoria: '', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10), fornecedor: '', notaFiscal: '', observacao: '', status: 'confirmado' }

export default function FinanceiroPage() {
  const [tab, setTab] = useState<'resumo' | 'lancamentos' | 'meta'>('resumo')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [metaForm, setMetaForm] = useState({ totalPrevisto: '', alertaPercentual: '80' })
  const [savingMeta, setSavingMeta] = useState(false)

  const loadResumo = async () => {
    const res = await api.get('/financeiro/resumo')
    setResumo(res.data)
    if (res.data.meta) {
      setMetaForm({ totalPrevisto: res.data.meta.totalPrevisto, alertaPercentual: res.data.meta.alertaPercentual })
    }
  }

  const loadLancamentos = async (p = 1, tipo = filtroTipo) => {
    setLoading(true)
    const res = await api.get('/financeiro', { params: { page: p, tipo: tipo || undefined } })
    setLancamentos(res.data.items)
    setTotal(res.data.total)
    setPages(res.data.pages)
    setLoading(false)
  }

  useEffect(() => { loadResumo().finally(() => setLoading(false)) }, [])
  useEffect(() => { if (tab === 'lancamentos') loadLancamentos(1, filtroTipo) }, [tab, filtroTipo])

  const salvarLancamento = async () => {
    setErro('')
    setSaving(true)
    try {
      await api.post('/financeiro', { ...form, valor: parseFloat(form.valor) })
      setShowForm(false)
      setForm(emptyForm)
      loadResumo()
      if (tab === 'lancamentos') loadLancamentos(1)
    } catch (e: any) {
      setErro(e.response?.data?.error ?? 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const salvarMeta = async () => {
    setSavingMeta(true)
    try {
      await api.put('/financeiro/meta', { totalPrevisto: parseFloat(metaForm.totalPrevisto), alertaPercentual: parseInt(metaForm.alertaPercentual) })
      loadResumo()
    } catch { } finally { setSavingMeta(false) }
  }

  const categorias = form.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500">Controle de receitas e despesas da campanha</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#002776] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#001f5e] transition-colors">
          <Plus className="w-4 h-4" /> Novo lançamento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ key: 'resumo', label: 'Resumo' }, { key: 'lancamentos', label: 'Lançamentos' }, { key: 'meta', label: 'Meta Orçamentária' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMO ── */}
      {tab === 'resumo' && (
        <div className="space-y-6">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> : !resumo ? null : (<>
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-500 font-medium">Total Receitas</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{fmt(resumo.totalReceita)}</p>
              </div>
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
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

            {/* Meta */}
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

            {/* Evolução mensal */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Evolução Mensal</h3>
              <div className="space-y-3">
                {resumo.evolucaoMensal.map(m => (
                  <div key={m.mes}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="font-medium text-gray-700">{m.mes}</span>
                      <span className="text-green-600">+{fmt(m.receita)}</span>
                      <span className="text-red-500">-{fmt(m.despesa)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
                      {m.receita > 0 && <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.min(100, (m.receita / Math.max(m.receita, m.despesa)) * 100)}%` }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por categoria */}
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

          {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> : (
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {lancamentos.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Nenhum lançamento encontrado</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">TSE</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lancamentos.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.data)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{l.descricao}</p>
                          {l.fornecedor && <p className="text-xs text-gray-400">{l.fornecedor}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{LABEL_CATEGORIA[l.categoria] ?? l.categoria}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{l.tseCategoria ?? '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${l.tipo === 'receita' ? 'text-green-600' : 'text-red-500'}`}>
                          {l.tipo === 'receita' ? '+' : '-'}{fmt(Number(l.valor))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.status === 'confirmado' ? 'bg-green-100 text-green-700' : l.status === 'pendente' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {l.status}
                          </span>
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
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); loadLancamentos(page - 1) }} className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">Anterior</button>
              <span className="px-4 py-2 text-sm text-gray-600">{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => { setPage(p => p + 1); loadLancamentos(page + 1) }} className="px-4 py-2 rounded-xl border text-sm disabled:opacity-40">Próximo</button>
            </div>
          )}
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
              <input type="number" value={metaForm.totalPrevisto} onChange={e => setMetaForm(f => ({ ...f, totalPrevisto: e.target.value }))}
                placeholder="Ex: 50000" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alertar ao atingir (%)</label>
              <input type="number" min={1} max={100} value={metaForm.alertaPercentual} onChange={e => setMetaForm(f => ({ ...f, alertaPercentual: e.target.value }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              <p className="text-xs text-gray-400 mt-1">Um alerta aparece no resumo quando o percentual de gastos atingir este valor.</p>
            </div>
            <button onClick={salvarMeta} disabled={savingMeta || !metaForm.totalPrevisto}
              className="w-full py-2.5 rounded-xl bg-[#002776] text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
              {savingMeta && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar meta
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL NOVO LANÇAMENTO ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-900">Novo lançamento</h2>
              <button onClick={() => { setShowForm(false); setErro('') }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value, categoria: '' }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
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
                  placeholder="Ex: Impressão de panfletos" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor (R$) *</label>
                  <input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fornecedor / Origem</label>
                <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                  placeholder="Nome do fornecedor ou doador" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nº Nota Fiscal</label>
                <input value={form.notaFiscal} onChange={e => setForm(f => ({ ...f, notaFiscal: e.target.value }))}
                  placeholder="Número da NF" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
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
              <button onClick={salvarLancamento} disabled={saving || !form.categoria || !form.descricao || !form.valor}
                className="w-full py-3 rounded-xl bg-[#002776] text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar lançamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
