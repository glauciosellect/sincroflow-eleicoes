'use client'
import { useEffect, useState, useCallback } from 'react'
import { Heart, QrCode, CheckCircle, Clock, XCircle, Download, Settings, TrendingUp, Users, DollarSign, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react'
import api from '@/lib/api'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtCPF = (v: string) => v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

interface Doacao {
  id: string; descricao: string; valor: number; data: string
  doadorCpf?: string; status: string; observacao?: string; createdAt: string
}
interface Resumo {
  totalArrecadado: number; totalDoadores: number
  pendente: { valor: number; count: number }
  canceladas: number
  evolucao: { mes: string; valor: number; count: number }[]
}
interface QRGerado {
  txid: string; lancamentoId: string; qrPayload: string
  valor: number; doadorNome: string; expiresAt: string
}
interface Config { pixKey: string | null; hasPixKey: boolean; candidate: { name: string; city: string } }

type Tab = 'visao-geral' | 'doacoes' | 'gerar' | 'configurar'

export default function DoacoesPage() {
  const [tab, setTab] = useState<Tab>('visao-geral')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [doacoes, setDoacoes] = useState<Doacao[]>([])
  const [total, setTotal] = useState(0); const [pages, setPages] = useState(1); const [page, setPage] = useState(1)
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')

  // Form gerar
  const [gerarForm, setGerarForm] = useState({ valor: '', doadorNome: '', doadorCpf: '', doadorTelefone: '', mensagem: '' })
  const [gerando, setGerando] = useState(false)
  const [qrGerado, setQrGerado] = useState<QRGerado | null>(null)
  const [copiado, setCopiado] = useState(false)

  // Config pix
  const [pixKeyInput, setPixKeyInput] = useState('')
  const [salvandoPix, setSalvandoPix] = useState(false)

  const loadResumo = useCallback(async () => {
    try {
      const r = await api.get('/doacoes/resumo')
      setResumo(r.data)
    } catch {}
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      const r = await api.get('/doacoes/config')
      setConfig(r.data)
      setPixKeyInput(r.data.pixKey ?? '')
    } catch {}
  }, [])

  const loadDoacoes = useCallback(async (p = 1, status = filtroStatus) => {
    try {
      const params: any = { page: p }
      if (status) params.status = status
      const r = await api.get('/doacoes', { params })
      setDoacoes(r.data.doacoes)
      setTotal(r.data.total)
      setPages(r.data.pages)
      setPage(p)
    } catch {}
  }, [filtroStatus])

  useEffect(() => {
    Promise.all([loadResumo(), loadConfig(), loadDoacoes()]).finally(() => setLoading(false))
  }, [loadResumo, loadConfig, loadDoacoes])

  async function handleGerar(e: React.FormEvent) {
    e.preventDefault()
    if (!config?.hasPixKey) { alert('Configure sua chave Pix primeiro.'); return }
    setGerando(true)
    try {
      const cpfLimpo = gerarForm.doadorCpf.replace(/\D/g, '')
      const r = await api.post('/doacoes/gerar', {
        valor: parseFloat(gerarForm.valor.replace(',', '.')),
        doadorNome: gerarForm.doadorNome,
        doadorCpf: cpfLimpo,
        doadorTelefone: gerarForm.doadorTelefone || undefined,
        mensagem: gerarForm.mensagem || undefined,
      })
      setQrGerado(r.data)
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Erro ao gerar QR Code')
    } finally { setGerando(false) }
  }

  async function confirmarDoacao(id: string) {
    try {
      await api.post(`/doacoes/${id}/confirmar`)
      loadDoacoes(); loadResumo()
      if (qrGerado?.lancamentoId === id) setQrGerado(null)
    } catch { alert('Erro ao confirmar') }
  }

  async function cancelarDoacao(id: string) {
    if (!confirm('Cancelar esta doação?')) return
    try {
      await api.post(`/doacoes/${id}/cancelar`)
      loadDoacoes(); loadResumo()
    } catch { alert('Erro ao cancelar') }
  }

  async function copiarPix() {
    if (!qrGerado) return
    await navigator.clipboard.writeText(qrGerado.qrPayload)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function baixarRecibo(id: string) {
    try {
      const r = await api.get(`/doacoes/${id}/recibo`)
      const { recibo } = r.data
      const linhas = [
        '========================================',
        `  RECIBO DE DOAÇÃO ELEITORAL`,
        `  ${recibo.numero}`,
        '========================================',
        `Emitido em: ${recibo.emitidoEm}`,
        '',
        'CANDIDATO:',
        `  Nome: ${recibo.candidato.nome}`,
        `  CPF: ${recibo.candidato.cpf}`,
        `  Partido: ${recibo.candidato.partido ?? '-'}`,
        `  Cargo: ${recibo.candidato.cargo ?? '-'}`,
        `  Município: ${recibo.candidato.municipio}`,
        '',
        'DOAÇÃO:',
        `  Valor: ${fmt(recibo.doacao.valor)}`,
        `  Data: ${recibo.doacao.data}`,
        `  CPF Doador: ${recibo.doacao.doadorCpf ? fmtCPF(recibo.doacao.doadorCpf) : '-'}`,
        `  Categoria TSE: ${recibo.doacao.tseCategoria}`,
        `  Status: ${recibo.doacao.status.toUpperCase()}`,
        '',
        recibo.conformidade,
        '========================================',
      ].join('\n')
      const blob = new Blob([linhas], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${recibo.numero}.txt`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Erro ao gerar recibo') }
  }

  async function salvarPixKey() {
    if (!pixKeyInput.trim()) return
    setSalvandoPix(true)
    try {
      await api.post('/doacoes/config/pix', { pixKey: pixKeyInput.trim() })
      await loadConfig()
      alert('Chave Pix salva com sucesso!')
    } catch { alert('Erro ao salvar') } finally { setSalvandoPix(false) }
  }

  const maxEvolucao = Math.max(...(resumo?.evolucao.map(e => e.valor) ?? [1]))

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'visao-geral', label: 'Visão Geral', icon: <TrendingUp size={15} /> },
    { key: 'gerar', label: 'Gerar QR Pix', icon: <QrCode size={15} /> },
    { key: 'doacoes', label: 'Doações', icon: <Heart size={15} /> },
    { key: 'configurar', label: 'Configurar', icon: <Settings size={15} /> },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 rounded-lg"><Heart className="text-green-600" size={22} /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doação por Pix</h1>
          <p className="text-sm text-gray-500">Receba doações de campanha com recibo automático — conforme TSE</p>
        </div>
      </div>

      {!config?.hasPixKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
          <AlertCircle className="text-amber-500 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-medium text-amber-800">Chave Pix não configurada</p>
            <p className="text-sm text-amber-700">Configure sua chave Pix para começar a receber doações.</p>
            <button onClick={() => setTab('configurar')} className="mt-2 text-sm font-medium text-amber-700 underline">
              Configurar agora →
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* VISÃO GERAL */}
      {tab === 'visao-geral' && resumo && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total Arrecadado</p>
              <p className="text-2xl font-bold text-green-600">{fmt(resumo.totalArrecadado)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Doadores Confirmados</p>
              <p className="text-2xl font-bold text-gray-900">{resumo.totalDoadores}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Pendente</p>
              <p className="text-2xl font-bold text-amber-600">{fmt(resumo.pendente.valor)}</p>
              <p className="text-xs text-gray-400">{resumo.pendente.count} doação(ões)</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Canceladas</p>
              <p className="text-2xl font-bold text-red-500">{resumo.canceladas}</p>
            </div>
          </div>

          {/* Evolução */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Evolução Mensal</h3>
            <div className="space-y-3">
              {resumo.evolucao.map(e => (
                <div key={e.mes} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-12 text-right">{e.mes}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all flex items-center justify-end pr-2"
                      style={{ width: maxEvolucao > 0 ? `${(e.valor / maxEvolucao) * 100}%` : '0%', minWidth: e.valor > 0 ? '2rem' : '0' }}
                    >
                      {e.valor > 0 && <span className="text-white text-[10px] font-medium">{e.count}</span>}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-24 text-right">{fmt(e.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GERAR QR CODE */}
      {tab === 'gerar' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Dados do Doador</h3>
            <form onSubmit={handleGerar} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$) *</label>
                <input value={gerarForm.valor} onChange={e => setGerarForm(f => ({ ...f, valor: e.target.value }))}
                  placeholder="50,00" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome do Doador *</label>
                <input value={gerarForm.doadorNome} onChange={e => setGerarForm(f => ({ ...f, doadorNome: e.target.value }))}
                  placeholder="Nome completo" required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CPF do Doador *</label>
                <input value={gerarForm.doadorCpf} onChange={e => setGerarForm(f => ({ ...f, doadorCpf: e.target.value }))}
                  placeholder="000.000.000-00" required maxLength={14}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <p className="text-xs text-gray-400 mt-0.5">Obrigatório pelo TSE para doações eleitorais</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
                <input value={gerarForm.doadorTelefone} onChange={e => setGerarForm(f => ({ ...f, doadorTelefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem (opcional)</label>
                <textarea value={gerarForm.mensagem} onChange={e => setGerarForm(f => ({ ...f, mensagem: e.target.value }))}
                  placeholder="Mensagem do doador..." rows={2} maxLength={200}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <button type="submit" disabled={gerando || !config?.hasPixKey}
                className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {gerando ? <><RefreshCw size={15} className="animate-spin" /> Gerando...</> : <><QrCode size={15} /> Gerar QR Code Pix</>}
              </button>
            </form>
          </div>

          {/* QR Gerado */}
          {qrGerado ? (
            <div className="bg-white border border-green-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle size={18} />
                <h3 className="font-semibold">QR Code Gerado!</h3>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 mb-2">Código Pix Copia e Cola</p>
                <div className="bg-white border border-gray-200 rounded p-2 text-xs font-mono break-all text-gray-700 max-h-24 overflow-y-auto">
                  {qrGerado.qrPayload}
                </div>
                <button onClick={copiarPix}
                  className="mt-2 flex items-center gap-1.5 mx-auto text-sm text-green-600 hover:text-green-700 font-medium">
                  {copiado ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar código</>}
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Valor:</span><span className="font-bold text-green-600">{fmt(qrGerado.valor)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Doador:</span><span className="font-medium">{qrGerado.doadorNome}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Expira em:</span><span className="text-amber-600 text-xs">{new Date(qrGerado.expiresAt).toLocaleTimeString('pt-BR')}</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => confirmarDoacao(qrGerado.lancamentoId)}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center justify-center gap-1.5">
                  <CheckCircle size={14} /> Confirmar Recebido
                </button>
                <button onClick={() => baixarRecibo(qrGerado.lancamentoId)}
                  className="px-3 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                  <Download size={14} /> Recibo
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-8 text-center">
              <QrCode size={48} className="text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">Preencha o formulário e clique em<br />"Gerar QR Code Pix"</p>
            </div>
          )}
        </div>
      )}

      {/* LISTA DE DOAÇÕES */}
      {tab === 'doacoes' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(['', 'confirmado', 'pendente', 'cancelado'] as const).map(s => (
              <button key={s} onClick={() => { setFiltroStatus(s); loadDoacoes(1, s) }}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  filtroStatus === s ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {s === '' ? 'Todas' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <span className="ml-auto text-sm text-gray-500 self-center">{total} doação(ões)</span>
          </div>

          {doacoes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Heart size={40} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma doação encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {doacoes.map(d => (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-gray-800 text-sm truncate">{d.descricao}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        d.status === 'confirmado' ? 'bg-green-100 text-green-700' :
                        d.status === 'pendente' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                      }`}>{d.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {fmtDate(d.createdAt)} {d.doadorCpf ? `· CPF: ${fmtCPF(d.doadorCpf)}` : ''}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-green-600">{fmt(d.valor)}</p>
                  <div className="flex gap-1.5">
                    {d.status === 'pendente' && (
                      <button onClick={() => confirmarDoacao(d.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Confirmar">
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button onClick={() => baixarRecibo(d.id)}
                      className="p-1.5 text-gray-500 hover:bg-gray-50 rounded" title="Recibo">
                      <Download size={16} />
                    </button>
                    {d.status !== 'cancelado' && (
                      <button onClick={() => cancelarDoacao(d.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Cancelar">
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => loadDoacoes(p)}
                  className={`w-8 h-8 rounded text-sm ${page === p ? 'bg-green-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CONFIGURAR */}
      {tab === 'configurar' && (
        <div className="max-w-md space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Chave Pix</h3>
            <p className="text-sm text-gray-500">
              Informe sua chave Pix (CPF, e-mail, telefone ou chave aleatória). As doações serão recebidas nesta chave.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chave Pix *</label>
              <input value={pixKeyInput} onChange={e => setPixKeyInput(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            {config?.hasPixKey && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-2">
                <CheckCircle size={15} />
                <span>Chave Pix configurada</span>
              </div>
            )}
            <button onClick={salvarPixKey} disabled={salvandoPix || !pixKeyInput.trim()}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50">
              {salvandoPix ? 'Salvando...' : 'Salvar Chave Pix'}
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 space-y-2">
            <p className="font-semibold">Conformidade TSE</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>CPF do doador é obrigatório para doações eleitorais</li>
              <li>Limite de R$ 1.064,10 por doador (pessoa física)</li>
              <li>Todas as doações são lançadas automaticamente no Financeiro</li>
              <li>Recibo gerado com categoria TSE 1.02 (Doação de pessoa física)</li>
              <li>Registros integrados à Prestação de Contas TSE</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
