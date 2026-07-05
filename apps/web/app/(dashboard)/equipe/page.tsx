'use client'
import { useEffect, useState } from 'react'
import {
  Plus, Users, Wallet, TrendingDown, X, Loader2, Pencil, Trash2,
  AlertCircle, ChevronDown, ChevronUp, Download, CreditCard, Calendar,
  ShieldCheck,
} from 'lucide-react'
import api from '@/lib/api'
import { validarCPF, formatarCPF } from '@/lib/cpf'

const FUNCOES: Record<string, string> = {
  cabo_eleitoral: 'Cabo Eleitoral', coordenador: 'Coordenador',
  supervisor: 'Supervisor de Campo',
  motorista: 'Motorista', assessor: 'Assessor', mesario: 'Mesário',
  fotografo: 'Fotógrafo/Videomaker', social_media: 'Social Media',
  advogado: 'Advogado Eleitoral', contador: 'Contador', outro: 'Outro',
}
const PERIODICIDADES: Record<string, string> = {
  diario: 'Diário', semanal: 'Semanal', quinzenal: 'Quinzenal',
  mensal: 'Mensal', fixo: 'Valor Fixo (único)',
}
const FORMAS_PAG: Record<string, string> = {
  pix: 'Pix', transferencia: 'Transferência', cheque: 'Cheque Nominal', dinheiro: 'Dinheiro (até R$ 759 — ½ salário mínimo)',
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const ROLES_FLOW: Record<string, string> = {
  ADMINISTRADOR: 'Administrador', ATENDIMENTO: 'Atendimento', CONTEUDO: 'Conteúdo',
  RELATORIOS: 'Relatórios', AGENTE_CAMPO: 'Agente de Campo', COORDENADOR: 'Coordenador',
}

interface Colaborador {
  id: string; nome: string; cpf: string; funcao: string; funcaoCustom?: string
  telefone?: string; email?: string; dataInicio: string; dataFim?: string
  valorAcordado: number; periodicidade: string; formaPagamento: string
  observacao?: string; status: string; teamMemberId?: string; supervisorId?: string
  teamMember?: { id: string; email: string; role: string; status: string } | null
  supervisor?: { id: string; nome: string; funcao: string } | null
  _count: { pagamentos: number }
  pagamentos: { valor: number; dataPagamento: string; competencia?: string }[]
}
interface Resumo {
  total: number; ativos: number; inativos: number; totalMensalAtivos: number
}
interface Pagamento {
  id: string; valor: number; dataPagamento: string; competencia?: string
  formaPagamento: string; observacao?: string
}

const emptyColabForm = {
  nome: '', cpf: '', funcao: 'cabo_eleitoral', funcaoCustom: '',
  telefone: '', email: '', dataInicio: new Date().toISOString().slice(0, 10),
  dataFim: '', valorAcordado: '', periodicidade: 'mensal', formaPagamento: 'pix',
  observacao: '', status: 'ativo', supervisorId: '',
  acessoAtivo: false, acessoRole: 'ATENDIMENTO', acessoEmail: '', acessoWhatsapp: '',
}
const emptyPagForm = {
  valor: '', dataPagamento: new Date().toISOString().slice(0, 10),
  competencia: `${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`,
  formaPagamento: 'pix', observacao: '',
}

export default function EquipePage() {
  const [tab, setTab] = useState<'equipe' | 'relatorio'>('equipe')
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('ativo')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pagamentos, setPagamentos] = useState<Record<string, { lista: Pagamento[]; total: number }>>({})
  const [loadingPag, setLoadingPag] = useState<string | null>(null)

  // modal colaborador
  const [showColab, setShowColab] = useState(false)
  const [editColab, setEditColab] = useState<Colaborador | null>(null)
  const [colabForm, setColabForm] = useState(emptyColabForm)
  const [savingColab, setSavingColab] = useState(false)
  const [erroColab, setErroColab] = useState('')
  const [deletingColab, setDeletingColab] = useState<string | null>(null)

  // modal pagamento
  const [showPag, setShowPag] = useState<Colaborador | null>(null)
  const [pagForm, setPagForm] = useState(emptyPagForm)
  const [savingPag, setSavingPag] = useState(false)
  const [erroPag, setErroPag] = useState('')
  const [deletingPag, setDeletingPag] = useState<string | null>(null)

  // relatório
  const [relatorio, setRelatorio] = useState<any>(null)
  const [filtroPeriodo, setFiltroPeriodo] = useState({ inicio: '', fim: '' })
  const [loadingRel, setLoadingRel] = useState(false)

  const load = async (status = filtroStatus) => {
    setLoading(true)
    const res = await api.get('/equipe', { params: { status: status || undefined } })
    setColaboradores(res.data.colaboradores)
    setResumo(res.data.resumo)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleExpand = async (colab: Colaborador) => {
    if (expanded === colab.id) { setExpanded(null); return }
    setExpanded(colab.id)
    if (!pagamentos[colab.id]) {
      setLoadingPag(colab.id)
      const res = await api.get(`/equipe/${colab.id}/pagamentos`)
      setPagamentos(p => ({ ...p, [colab.id]: { lista: res.data.pagamentos, total: res.data.totalPago } }))
      setLoadingPag(null)
    }
  }

  const abrirNovoColab = () => {
    setEditColab(null); setColabForm(emptyColabForm); setErroColab(''); setShowColab(true)
  }
  const abrirEditarColab = (c: Colaborador) => {
    setEditColab(c)
    setColabForm({
      nome: c.nome, cpf: c.cpf, funcao: c.funcao, funcaoCustom: c.funcaoCustom ?? '',
      telefone: c.telefone ?? '', email: c.email ?? '',
      dataInicio: new Date(c.dataInicio).toISOString().slice(0, 10),
      dataFim: c.dataFim ? new Date(c.dataFim).toISOString().slice(0, 10) : '',
      valorAcordado: String(c.valorAcordado), periodicidade: c.periodicidade,
      formaPagamento: c.formaPagamento, observacao: c.observacao ?? '', status: c.status,
      supervisorId: c.supervisorId ?? '',
      acessoAtivo: !!c.teamMember,
      acessoRole: c.teamMember?.role ?? 'ATENDIMENTO',
      acessoEmail: c.teamMember?.email ?? c.email ?? '',
      acessoWhatsapp: '',
    })
    setErroColab(''); setShowColab(true)
  }

  const salvarColab = async () => {
    setErroColab(''); setSavingColab(true)
    try {
      const { acessoAtivo, acessoRole, acessoEmail, acessoWhatsapp, ...rest } = colabForm
      const payload: any = {
        ...rest,
        email: rest.email || undefined,
        dataFim: rest.dataFim || undefined,
        funcaoCustom: rest.funcaoCustom || undefined,
        observacao: rest.observacao || undefined,
        telefone: rest.telefone || undefined,
        supervisorId: rest.supervisorId || undefined,
        valorAcordado: parseFloat(rest.valorAcordado),
        acesso: {
          ativo: acessoAtivo,
          ...(acessoAtivo ? { role: acessoRole, email: acessoEmail || rest.email || undefined, whatsapp: acessoWhatsapp || undefined } : {}),
        },
      }
      if (editColab) await api.patch(`/equipe/${editColab.id}`, payload)
      else await api.post('/equipe', payload)
      setShowColab(false); setEditColab(null)
      load()
    } catch (e: any) { setErroColab(e.response?.data?.error ?? 'Erro ao salvar') }
    finally { setSavingColab(false) }
  }

  const excluirColab = async (id: string) => {
    if (!confirm('Excluir este colaborador e todos os seus pagamentos?')) return
    setDeletingColab(id)
    try { await api.delete(`/equipe/${id}`); load() }
    catch { alert('Erro ao excluir') } finally { setDeletingColab(null) }
  }

  const abrirPag = (c: Colaborador) => { setShowPag(c); setPagForm(emptyPagForm); setErroPag('') }

  const salvarPag = async () => {
    if (!showPag) return
    setErroPag(''); setSavingPag(true)
    try {
      await api.post(`/equipe/${showPag.id}/pagamentos`, { ...pagForm, valor: parseFloat(pagForm.valor) })
      setShowPag(null)
      // Recarrega pagamentos deste colaborador
      const res = await api.get(`/equipe/${showPag.id}/pagamentos`)
      setPagamentos(p => ({ ...p, [showPag.id]: { lista: res.data.pagamentos, total: res.data.totalPago } }))
      load()
    } catch (e: any) { setErroPag(e.response?.data?.error ?? 'Erro ao registrar') }
    finally { setSavingPag(false) }
  }

  const excluirPag = async (pagId: string, colabId: string) => {
    if (!confirm('Excluir este pagamento? O lançamento financeiro vinculado também será removido.')) return
    setDeletingPag(pagId)
    try {
      await api.delete(`/equipe/pagamentos/${pagId}`)
      const res = await api.get(`/equipe/${colabId}/pagamentos`)
      setPagamentos(p => ({ ...p, [colabId]: { lista: res.data.pagamentos, total: res.data.totalPago } }))
      load()
    } catch { alert('Erro ao excluir') } finally { setDeletingPag(null) }
  }

  const carregarRelatorio = async () => {
    setLoadingRel(true)
    const res = await api.get('/equipe/relatorio-tse', {
      params: { dataInicio: filtroPeriodo.inicio || undefined, dataFim: filtroPeriodo.fim || undefined },
    })
    setRelatorio(res.data); setLoadingRel(false)
  }

  useEffect(() => { if (tab === 'relatorio') carregarRelatorio() }, [tab])

  const exportarRelatorio = () => {
    if (!relatorio) return
    const header = 'Nome,CPF,Função,Total Pago (R$),Nº Pagamentos\n'
    const rows = relatorio.colaboradores.map((c: any) =>
      `"${c.nome}","${c.cpf}","${c.funcao}",${Number(c.totalPago).toFixed(2).replace('.', ',')},${c.pagamentos}`
    )
    const csv = '﻿Relação de Pessoal — Prestação de Contas TSE\n' + header + rows.join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `equipe-tse-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe de Campanha</h1>
          <p className="text-sm text-gray-500">Colaboradores, pagamentos e prestação de contas de pessoal</p>
        </div>
        <button onClick={abrirNovoColab}
          className="flex items-center gap-2 bg-[#002776] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#001f5e] transition-colors">
          <Plus className="w-4 h-4" /> Novo colaborador
        </button>
      </div>

      {/* Resumo cards */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total cadastrado', v: resumo.total, icon: Users, color: 'text-gray-700', bg: 'bg-gray-100' },
            { label: 'Ativos', v: resumo.ativos, icon: Users, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Inativos/Encerrados', v: resumo.inativos, icon: Users, color: 'text-gray-400', bg: 'bg-gray-100' },
            { label: 'Custo mensal (ativos)', v: fmt(resumo.totalMensalAtivos), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-100' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${c.bg}`}>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <span className="text-xs text-gray-500">{c.label}</span>
              </div>
              <p className={`text-xl font-bold ${c.color}`}>{c.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ key: 'equipe', label: 'Colaboradores' }, { key: 'relatorio', label: 'Relatório TSE (Pessoal)' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#009C3B] text-[#009C3B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── COLABORADORES ── */}
      {tab === 'equipe' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['ativo', '', 'encerrado'].map(s => (
              <button key={s} onClick={() => { setFiltroStatus(s); load(s) }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${filtroStatus === s ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s === 'ativo' ? 'Ativos' : s === '' ? 'Todos' : 'Encerrados'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : colaboradores.length === 0 ? (
            <div className="bg-white rounded-2xl border p-12 text-center">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhum colaborador cadastrado.</p>
              <p className="text-gray-400 text-xs mt-1">Clique em "Novo colaborador" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {colaboradores.map(c => (
                <div key={c.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  {/* Linha principal */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-full bg-[#002776]/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-[#002776]">{c.nome.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{c.nome}</p>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {FUNCOES[c.funcao] ?? c.funcaoCustom ?? c.funcao}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {c.status}
                        </span>
                        {c.teamMember && (
                          <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            <ShieldCheck className="w-3 h-3" />
                            {ROLES_FLOW[c.teamMember.role] ?? c.teamMember.role}
                            {c.teamMember.status === 'PENDING' && <span className="text-blue-400"> · aguardando</span>}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-400 flex-wrap">
                        <span>CPF: {c.cpf}</span>
                        {c.telefone && <span>{c.telefone}</span>}
                        <span>Desde {fmtDate(c.dataInicio)}</span>
                        {c.supervisor && (
                          <span className="flex items-center gap-1 text-gray-400">
                            ↳ {FUNCOES[c.supervisor.funcao] ?? c.supervisor.funcao}: <strong className="text-gray-600">{c.supervisor.nome}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{fmt(Number(c.valorAcordado))}</p>
                      <p className="text-xs text-gray-400">{PERIODICIDADES[c.periodicidade] ?? c.periodicidade}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => abrirPag(c)} title="Registrar pagamento"
                        className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors">
                        <CreditCard className="w-4 h-4" />
                      </button>
                      <button onClick={() => abrirEditarColab(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => excluirColab(c.id)} disabled={deletingColab === c.id}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors">
                        {deletingColab === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => toggleExpand(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                        {expanded === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Histórico de pagamentos expandido */}
                  {expanded === c.id && (
                    <div className="border-t bg-gray-50 px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Histórico de Pagamentos</span>
                        {pagamentos[c.id] && (
                          <span className="text-sm font-semibold text-gray-700">
                            Total pago: <span className="text-red-500">{fmt(pagamentos[c.id].total)}</span>
                          </span>
                        )}
                      </div>
                      {loadingPag === c.id ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                      ) : !pagamentos[c.id] || pagamentos[c.id].lista.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-3">Nenhum pagamento registrado.</p>
                      ) : (
                        <div className="space-y-2">
                          {pagamentos[c.id].lista.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{fmt(Number(p.valor))}</p>
                                <p className="text-xs text-gray-400">
                                  {fmtDate(p.dataPagamento)}{p.competencia ? ` · Ref: ${p.competencia}` : ''} · {FORMAS_PAG[p.formaPagamento] ?? p.formaPagamento}
                                </p>
                              </div>
                              <button onClick={() => excluirPag(p.id, c.id)} disabled={deletingPag === p.id}
                                className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                                {deletingPag === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RELATÓRIO TSE ── */}
      {tab === 'relatorio' && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>O TSE exige declarar <strong>nome, CPF e total pago</strong> a cada colaborador. Pagamentos devem ser feitos por Pix nominal, transferência ou cheque — nunca em dinheiro acima de R$ 759 (½ salário mínimo de 2026) por item.</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">De:</label>
              <input type="date" value={filtroPeriodo.inicio}
                onChange={e => setFiltroPeriodo(f => ({ ...f, inicio: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Até:</label>
              <input type="date" value={filtroPeriodo.fim}
                onChange={e => setFiltroPeriodo(f => ({ ...f, fim: e.target.value }))}
                className="border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <button onClick={carregarRelatorio}
              className="px-4 py-2 rounded-xl bg-[#002776] text-white text-sm font-medium">Gerar</button>
            {relatorio && (
              <button onClick={exportarRelatorio}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">
                <Download className="w-4 h-4" /> CSV para TSE
              </button>
            )}
          </div>

          {loadingRel ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : !relatorio ? null : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Colaboradores', v: relatorio.totalColaboradores },
                  { label: 'Total geral pago', v: fmt(relatorio.totalGeral) },
                  { label: 'Categoria TSE', v: '2.01 — Pessoal' },
                ].map(c => (
                  <div key={c.label} className="bg-white rounded-2xl border p-4 shadow-sm text-center">
                    <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                    <p className="text-lg font-bold text-gray-900">{c.v}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">CPF</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Função</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pagamentos</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {relatorio.colaboradores.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.cpf}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{c.funcao}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{c.pagamentos}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-500">{fmt(c.totalPago)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 text-sm">{fmt(relatorio.totalGeral)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL COLABORADOR ── */}
      {showColab && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="font-semibold text-gray-900">{editColab ? 'Editar colaborador' : 'Novo colaborador'}</h2>
              <button onClick={() => { setShowColab(false); setEditColab(null) }}
                className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome completo *</label>
                <input value={colabForm.nome} onChange={e => setColabForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome do colaborador"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">CPF * <span className="text-red-500">(obrigatório TSE)</span></label>
                  <input
                    value={colabForm.cpf}
                    onChange={e => setColabForm(f => ({ ...f, cpf: formatarCPF(e.target.value) }))}
                    placeholder="000.000.000-00" maxLength={14}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] ${colabForm.cpf.replace(/\D/g,'').length === 11 && !validarCPF(colabForm.cpf) ? 'border-red-400 bg-red-50' : ''}`}
                  />
                  {colabForm.cpf.replace(/\D/g,'').length === 11 && !validarCPF(colabForm.cpf) && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> CPF inválido — verifique os números
                    </p>
                  )}
                  {colabForm.cpf.replace(/\D/g,'').length === 11 && validarCPF(colabForm.cpf) && (
                    <p className="text-xs text-green-600 mt-1">✓ CPF válido</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
                  <input value={colabForm.telefone} onChange={e => setColabForm(f => ({ ...f, telefone: e.target.value }))}
                    placeholder="(32) 99999-9999"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Função *</label>
                  <select value={colabForm.funcao} onChange={e => setColabForm(f => ({ ...f, funcao: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                    {Object.entries(FUNCOES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {colabForm.funcao === 'outro' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Descrição da função</label>
                    <input value={colabForm.funcaoCustom} onChange={e => setColabForm(f => ({ ...f, funcaoCustom: e.target.value }))}
                      placeholder="Ex: Fotógrafo"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                  </div>
                )}
              </div>
              {/* Hierarquia — quem é o superior direto */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reporta para <span className="font-normal text-gray-400">(superior direto)</span></label>
                <select value={colabForm.supervisorId}
                  onChange={e => setColabForm(f => ({ ...f, supervisorId: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                  <option value="">— Nenhum (topo da hierarquia) —</option>
                  {colaboradores
                    .filter(c => c.id !== editColab?.id && c.status === 'ativo')
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome} — {FUNCOES[c.funcao] ?? c.funcao}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor acordado (R$) *</label>
                  <input type="number" step="0.01" value={colabForm.valorAcordado}
                    onChange={e => setColabForm(f => ({ ...f, valorAcordado: e.target.value }))}
                    placeholder="0,00" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Periodicidade</label>
                  <select value={colabForm.periodicidade} onChange={e => setColabForm(f => ({ ...f, periodicidade: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                    {Object.entries(PERIODICIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Início *</label>
                  <input type="date" value={colabForm.dataInicio} onChange={e => setColabForm(f => ({ ...f, dataInicio: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Término (se souber)</label>
                  <input type="date" value={colabForm.dataFim} onChange={e => setColabForm(f => ({ ...f, dataFim: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Forma de pagamento padrão</label>
                <select value={colabForm.formaPagamento} onChange={e => setColabForm(f => ({ ...f, formaPagamento: e.target.value }))}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                  {Object.entries(FORMAS_PAG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                <textarea rows={2} value={colabForm.observacao} onChange={e => setColabForm(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Contrato nº, banco, chave Pix, etc."
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776] resize-none" />
              </div>
              {editColab && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={colabForm.status ?? 'ativo'} onChange={e => setColabForm(f => ({ ...f, status: e.target.value } as any))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </div>
              )}

              {/* Acesso ao SyncroFlow */}
              <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={colabForm.acessoAtivo}
                    onChange={e => setColabForm(f => ({ ...f, acessoAtivo: e.target.checked }))}
                    className="w-4 h-4 rounded accent-[#002776]" />
                  <div>
                    <span className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" /> Dar acesso ao SyncroFlow
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">Envia convite por e-mail para este colaborador acessar a plataforma</p>
                  </div>
                </label>

                {colabForm.acessoAtivo && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Perfil de acesso *</label>
                      <select value={colabForm.acessoRole}
                        onChange={e => setColabForm(f => ({ ...f, acessoRole: e.target.value }))}
                        className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                        {Object.entries(ROLES_FLOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">E-mail para convite *</label>
                      <input type="email" value={colabForm.acessoEmail}
                        onChange={e => setColabForm(f => ({ ...f, acessoEmail: e.target.value }))}
                        placeholder="email@exemplo.com"
                        className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                      {editColab?.teamMember && colabForm.acessoAtivo && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {editColab.teamMember.status === 'PENDING' ? 'Convite pendente — reenviar vai gerar novo link' : `Acesso ativo (${editColab.teamMember.status})`}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">WhatsApp (opcional)</label>
                      <input value={colabForm.acessoWhatsapp}
                        onChange={e => setColabForm(f => ({ ...f, acessoWhatsapp: e.target.value }))}
                        placeholder="(32) 99999-9999"
                        className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                    </div>
                  </div>
                )}
              </div>

              {erroColab && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{erroColab}
                </div>
              )}
              <button onClick={salvarColab} disabled={savingColab || !colabForm.nome || !validarCPF(colabForm.cpf) || !colabForm.valorAcordado || (colabForm.acessoAtivo && !colabForm.acessoEmail)}
                className="w-full py-3 rounded-xl bg-[#002776] text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {savingColab && <Loader2 className="w-4 h-4 animate-spin" />}
                {editColab ? 'Salvar alterações' : 'Cadastrar colaborador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PAGAMENTO ── */}
      {showPag && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="font-semibold text-gray-900">Registrar Pagamento</h2>
                <p className="text-xs text-gray-500 mt-0.5">{showPag.nome} — {FUNCOES[showPag.funcao] ?? showPag.funcao}</p>
              </div>
              <button onClick={() => setShowPag(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
                Valor acordado: <strong>{fmt(Number(showPag.valorAcordado))}</strong> ({PERIODICIDADES[showPag.periodicidade] ?? showPag.periodicidade})
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor pago (R$) *</label>
                  <input type="number" step="0.01" value={pagForm.valor}
                    onChange={e => setPagForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder={String(showPag.valorAcordado)}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data do pagamento *</label>
                  <input type="date" value={pagForm.dataPagamento}
                    onChange={e => setPagForm(f => ({ ...f, dataPagamento: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mês de referência</label>
                  <input value={pagForm.competencia} onChange={e => setPagForm(f => ({ ...f, competencia: e.target.value }))}
                    placeholder="07/2026" maxLength={7}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Forma de pagamento</label>
                  <select value={pagForm.formaPagamento} onChange={e => setPagForm(f => ({ ...f, formaPagamento: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#002776]">
                    {Object.entries(FORMAS_PAG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                <input value={pagForm.observacao} onChange={e => setPagForm(f => ({ ...f, observacao: e.target.value }))}
                  placeholder="Chave Pix, nº de comprovante, etc."
                  className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                Um lançamento financeiro na categoria <strong>Pessoal (TSE 2.01)</strong> será criado automaticamente.
              </div>
              {erroPag && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{erroPag}
                </div>
              )}
              <button onClick={salvarPag} disabled={savingPag || !pagForm.valor}
                className="w-full py-3 rounded-xl bg-[#009C3B] text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {savingPag && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
