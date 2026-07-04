'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, AlertCircle, ExternalLink,
  FileText, Users, Wallet, ClipboardList, BookOpen, Info, Loader2, TrendingUp,
} from 'lucide-react'
import api from '@/lib/api'

interface Step {
  id: number
  titulo: string
  descricao: string
  detalhe: string[]
  aviso?: string
  prazo?: string
}

const ETAPAS: Step[] = [
  {
    id: 1,
    titulo: 'Abrir conta bancária eleitoral',
    descricao: 'Conta corrente exclusiva para movimentação da campanha (obrigatória pelo TSE).',
    detalhe: [
      'Deve ser aberta em nome do candidato, com CPF e número de candidatura.',
      'Preferencialmente na Caixa Econômica Federal ou Banco do Brasil; outros bancos com carteira comercial também são aceitos.',
      'Nenhuma receita ou despesa pode passar por conta pessoal.',
      'O extrato bancário de todo o período é documento obrigatório na prestação de contas.',
      'A conta não pode ter cláusula de sigilo — os dados se tornam públicos na prestação de contas.',
      'Assinatura eletrônica é aceita para abertura (novidade 2026).',
    ],
    aviso: 'Movimentar dinheiro de campanha em conta pessoal é infração eleitoral e pode levar à desaprovação das contas.',
  },
  {
    id: 2,
    titulo: 'Acessar o Conta+JE (sistema oficial TSE 2026)',
    descricao: 'Nova plataforma 100% online que substitui definitivamente o SPCE. Não instala nada.',
    detalhe: [
      'Acesse em: contaje.tse.jus.br (disponível após início oficial da campanha).',
      'Login via gov.br ou e-Título — NÃO é mais CPF+senha avulso como no SPCE.',
      'O sistema já preenche automaticamente: nome, partido, número de candidatura e dados do TSE.',
      'Documentos são enviados digitalmente e já ficam no Processo Judicial Eletrônico (PJe) — sem envio de mídia física.',
      'Detecta erros em tempo real antes de você finalizar o envio.',
      'Integrado ao sistema de candidaturas (Cand) e ao partido (SGIP).',
    ],
    aviso: 'O SPCE foi definitivamente descontinuado para as eleições de 2026. Apenas o Conta+JE é aceito.',
  },
  {
    id: 3,
    titulo: 'Registrar receitas no Conta+JE',
    descricao: 'Cada entrada de dinheiro deve ser lançada individualmente com comprovante.',
    detalhe: [
      'Recursos próprios: informe valor e data do depósito na conta eleitoral.',
      'Doação de pessoa física: nome completo, CPF e valor. Limite máximo: R$ 40.000,00 por doador (Res. TSE 23.752/2026, Art. 27 §3º) — ou 10% da renda bruta anual declarada, o que for menor.',
      'Pix de doador: não exige mais assinatura do recibo pelo doador — basta o relatório com CPF e valor (novidade 2026).',
      'Doações via transferência bancária acima de R$ 1.064,10: obrigatoriamente por Pix nominal, TED ou cheque cruzado nominal.',
      'Doação de pessoa jurídica: PROIBIDA pela legislação vigente.',
      'FEFC (Fundo Eleitoral) e Fundo Partidário: requer comprovante do partido.',
      'Financiamento coletivo (vaquinha): apenas por plataformas cadastradas na JE; só pessoa física pode contribuir.',
      'Criptomoedas: PROIBIDAS como meio de doação.',
    ],
    aviso: 'Doações acima do limite por doador e de pessoa jurídica são ilegais e causam desaprovação automática das contas.',
  },
  {
    id: 4,
    titulo: 'Registrar despesas no Conta+JE',
    descricao: 'Cada saída de dinheiro deve ter documento fiscal correspondente.',
    detalhe: [
      'Cada despesa precisa de: nota fiscal ou recibo sem rasura, data, valor, CNPJ/CPF do fornecedor.',
      'Pagamento DEVE ser por Pix nominal, transferência ou cheque nominal ao fornecedor.',
      'Dinheiro em espécie: apenas para despesas do Fundo de Caixa (pequenos gastos do dia a dia da campanha) — consulte o limite do seu TRE.',
      'Pessoal (cabos eleitorais, coordenadores): lançar com CPF de cada colaborador e contrato assinado.',
      'Publicidade em redes sociais (impulsionamento): nota fiscal da plataforma obrigatória.',
      'Use o CSV exportado pelo SyncroFlow como rascunho para conferir antes de lançar no Conta+JE.',
    ],
  },
  {
    id: 5,
    titulo: 'Anexar documentos comprobatórios',
    descricao: 'Cada lançamento no Conta+JE precisa ter o comprovante em PDF ou imagem.',
    detalhe: [
      'Receitas: comprovante bancário do depósito, Pix ou TED recebido.',
      'Despesas: nota fiscal ou recibo + comprovante do pagamento (Pix, extrato).',
      'Pessoal: contrato de prestação de serviços eleitorais assinado + comprovante de pagamento.',
      'No Conta+JE os documentos ficam diretamente vinculados ao PJe — não é necessário envio físico de CD/DVD como no SPCE.',
      'Organize os arquivos por data antes de subir — facilita revisão do advogado eleitoral.',
    ],
  },
  {
    id: 6,
    titulo: 'Prestação parcial de contas',
    descricao: 'Obrigatória para alguns cargos — enviada pelo Conta+JE antes da eleição.',
    detalhe: [
      'Período: 9 a 13 de setembro de 2026 (movimentação até 8 de setembro incluída).',
      'Presidente, Governador e Senador: prestação parcial obrigatória.',
      'Deputados (estadual e federal): verifique com seu TRE — geralmente só prestação final.',
      'O sistema Conta+JE já abre o módulo de prestação parcial na data correta.',
      'Divulgação pública das contas parciais com identificação dos doadores: 15 de setembro de 2026.',
    ],
    prazo: '9 a 13/09/2026',
  },
  {
    id: 7,
    titulo: 'Prestação final de contas',
    descricao: 'Encerramento oficial da campanha — enviada pelo Conta+JE após a eleição.',
    detalhe: [
      '1º turno: até 30 dias após o dia da eleição.',
      '2º turno: até 20 dias após a segunda votação.',
      'Todas as receitas e despesas do período devem estar lançadas e com comprovantes.',
      'O Conta+JE gera número de protocolo após o envio — guarde.',
      'O TRE analisa e pode pedir complementação de documentos — responda dentro do prazo fixado.',
      'Candidatos com contas desaprovadas ficam impedidos de assumir mandato.',
    ],
    aviso: 'Candidatos que não entregam a prestação de contas ficam com direitos políticos suspensos até regularização.',
    prazo: '30 dias após eleição (1º turno)',
  },
]

const TETOS_GASTO = [
  { cargo: 'Dep. Estadual / Distrital', valor: 'R$ 1,27 milhão', obs: 'Igual para todos os estados' },
  { cargo: 'Dep. Federal', valor: 'R$ 3,18 milhões', obs: 'Igual para todos os estados' },
  { cargo: 'Senador', valor: 'Varia por estado', obs: 'Proporcional ao eleitorado — consulte TRE' },
  { cargo: 'Governador', valor: 'Varia por estado', obs: 'Proporcional ao eleitorado — ex: MT R$ 7,1M' },
  { cargo: 'Presidente (1º turno)', valor: 'R$ 88,9 milhões', obs: '+R$ 44,4M se for ao 2º turno' },
]

const DOCS_NECESSARIOS = [
  { cat: 'Receitas', items: ['Extrato bancário da conta eleitoral', 'Comprovante de Pix/TED recebidos', 'Recibo de doação — obrigatório para transferências, dispensado para Pix (basta relatório CPF+valor)'] },
  { cat: 'Despesas gerais', items: ['Nota fiscal ou recibo (sem rasura)', 'Comprovante de pagamento (Pix nominal, TED, cheque nominal)', 'Contrato com fornecedor (se serviço contínuo)'] },
  { cat: 'Pessoal (equipe)', items: ['Contrato de Prestação de Serviços Eleitorais assinado', 'CPF de cada colaborador', 'Comprovante de Pix/TED nominal a cada colaborador'] },
  { cat: 'Material gráfico', items: ['Nota fiscal da gráfica ou fornecedor', 'Prova do material (foto ou arquivo digital)'] },
  { cat: 'Impulsionamento digital', items: ['Nota fiscal da plataforma (Google, Meta, etc.)', 'Comprovante de pagamento', 'Print ou relatório das campanhas impulsionadas'] },
]

const CORRESPONDENCIA = [
  { syncro: 'Doação Pessoa Física', tse: '1.02', obs: 'CPF obrigatório; limite R$ 40 mil por doador' },
  { syncro: 'Recursos Próprios', tse: '1.01', obs: 'Depósito da conta pessoal na conta eleitoral' },
  { syncro: 'Transferência Partido', tse: '1.03', obs: 'Requer comprovante do partido' },
  { syncro: 'Transferência Comitê', tse: '1.04', obs: '' },
  { syncro: 'Financiamento Coletivo', tse: '1.05', obs: 'Vaquinha online — plataforma deve estar cadastrada na JE' },
  { syncro: 'FEFC (Fundo Eleitoral)', tse: '1.06', obs: 'Transferência do partido com comprovante' },
  { syncro: 'Pessoal', tse: '2.01', obs: 'CPF + contrato de cada colaborador' },
  { syncro: 'Publicidade', tse: '2.02', obs: 'NF de agência ou veículo' },
  { syncro: 'Produção de Material', tse: '2.03', obs: 'Gráfica, camisetas, brindes' },
  { syncro: 'Impulsionamento Digital', tse: '2.04', obs: 'Google/Meta Ads — NF obrigatória' },
  { syncro: 'Combustível/Transporte', tse: '2.05', obs: 'Nota do posto ou locadora' },
  { syncro: 'Alimentação', tse: '2.06', obs: 'Fundo de caixa — preferência por NF' },
  { syncro: 'Aluguel de Espaço', tse: '2.07', obs: 'Contrato de locação' },
  { syncro: 'Equipamentos', tse: '2.08', obs: 'NF de compra ou locação' },
  { syncro: 'Serviços Jurídicos', tse: '2.09', obs: 'Advogado eleitoral' },
  { syncro: 'Segurança', tse: '2.10', obs: 'Inclui prevenção de violência política (novidade 2026)' },
]

export default function PrestacaoContasPage() {
  const [expandido, setExpandido] = useState<number | null>(1)
  const [concluidos, setConcluidos] = useState<number[]>([])
  const [loadingChecklist, setLoadingChecklist] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/financeiro/checklist')
      .then(res => setConcluidos(res.data.concluidos ?? []))
      .catch(() => {})
      .finally(() => setLoadingChecklist(false))
  }, [])

  const salvarChecklist = useCallback(async (lista: number[]) => {
    setSalvando(true)
    await api.put('/financeiro/checklist', { concluidos: lista }).catch(() => {})
    setSalvando(false)
  }, [])

  const toggleConcluido = (id: number) => {
    setConcluidos(prev => {
      const nova = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      salvarChecklist(nova)
      return nova
    })
  }

  const progresso = Math.round((concluidos.length / ETAPAS.length) * 100)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prestação de Contas — Guia TSE 2026</h1>
        <p className="text-sm text-gray-500 mt-1">Baseado na Resolução TSE nº 23.752/2026 e nas regras do Conta+JE</p>
      </div>

      {/* Alerta Conta+JE */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-4">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-2">
          <p className="font-semibold">Novo sistema em 2026: Conta+JE — SPCE descontinuado</p>
          <p>O TSE substituiu definitivamente o SPCE (arquivo físico) pelo <strong>Conta+JE</strong>, plataforma 100% online. Não instala software, não envia mídia física. Login via <strong>gov.br</strong> ou <strong>e-Título</strong>.</p>
          <p>O sistema preenche automaticamente seus dados de candidatura e integra com o PJe (Processo Judicial Eletrônico).</p>
          <a href="https://contaje.tse.jus.br" target="_blank" rel="noopener noreferrer"
            className="text-blue-600 flex items-center gap-1 mt-1 hover:underline w-fit">
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="font-medium">contaje.tse.jus.br</span>
            <span className="text-blue-500">(disponível após início da campanha)</span>
          </a>
        </div>
      </div>

      {/* Alerta teto de gastos */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
        <TrendingUp className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Tetos de gasto mantidos iguais a 2022 (TSE, jul/2026)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {TETOS_GASTO.map(t => (
              <div key={t.cargo} className="bg-white rounded-xl px-3 py-2 border border-amber-100">
                <p className="text-xs font-bold text-amber-700">{t.cargo}</p>
                <p className="text-sm font-bold text-amber-900">{t.valor}</p>
                <p className="text-xs text-amber-600">{t.obs}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">Ultrapassar o teto gera multa de até 100% do excesso + risco de cassação por abuso de poder econômico.</p>
        </div>
      </div>

      {/* Progresso */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">Seu progresso no checklist</span>
          <div className="flex items-center gap-2">
            {loadingChecklist
              ? <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              : salvando
                ? <span className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />salvando...</span>
                : <span className="text-xs text-green-600">✓ salvo</span>
            }
            <span className="text-sm font-bold text-[#009C3B]">{concluidos.length} / {ETAPAS.length} etapas</span>
          </div>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#009C3B] rounded-full transition-all duration-500"
            style={{ width: loadingChecklist ? 0 : progresso + '%' }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {progresso === 100
            ? '✓ Todas as etapas concluídas! Guarde o protocolo gerado pelo Conta+JE.'
            : 'Marque cada etapa como concluída conforme for avançando na prestação. O progresso é salvo automaticamente.'}
        </p>
      </div>

      {/* Etapas */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#002776]" /> Checklist de Prestação de Contas
        </h2>
        {ETAPAS.map(step => {
          const done = concluidos.includes(step.id)
          const open = expandido === step.id
          return (
            <div key={step.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${done ? 'border-green-200' : ''}`}>
              <div className="flex items-start gap-4 px-5 py-4 cursor-pointer"
                onClick={() => setExpandido(open ? null : step.id)}>
                <button
                  onClick={e => { e.stopPropagation(); toggleConcluido(step.id) }}
                  className="mt-0.5 shrink-0">
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : <Circle className="w-5 h-5 text-gray-300" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-400">ETAPA {step.id}</span>
                    {step.prazo && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Prazo: {step.prazo}
                      </span>
                    )}
                  </div>
                  <p className={`font-semibold mt-0.5 ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {step.titulo}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">{step.descricao}</p>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                  : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
              </div>

              {open && (
                <div className="px-5 pb-5 border-t bg-gray-50 pt-4 space-y-3">
                  <ul className="space-y-2">
                    {step.detalhe.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#002776] shrink-0 mt-2" />
                        {d}
                      </li>
                    ))}
                  </ul>
                  {step.aviso && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{step.aviso}</span>
                    </div>
                  )}
                  <button onClick={() => toggleConcluido(step.id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${done ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {done ? 'Desmarcar como concluído' : '✓ Marcar como concluído'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Correspondência SyncroFlow → Conta+JE */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-[#002776]" /> Correspondência: SyncroFlow → Conta+JE
        </h2>
        <p className="text-sm text-gray-500">
          Use a tabela abaixo para encontrar o código correto no Conta+JE ao lançar cada categoria do SyncroFlow.
        </p>
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoria SyncroFlow</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código TSE</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {CORRESPONDENCIA.map((r, i) => (
                <tr key={i} className={`hover:bg-gray-50 ${r.tse.startsWith('1') ? 'bg-green-50/40' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.syncro}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg ${r.tse.startsWith('1') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.tse}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{r.obs || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 border-t flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-100 inline-block" />Receita (grupo 1.xx)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block" />Despesa (grupo 2.xx)</span>
          </div>
        </div>
      </div>

      {/* Documentos necessários */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#002776]" /> Documentos obrigatórios por tipo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCS_NECESSARIOS.map(grupo => (
            <div key={grupo.cat} className="bg-white rounded-2xl border p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-800 mb-3">{grupo.cat}</p>
              <ul className="space-y-1.5">
                {grupo.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#009C3B] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Regras pessoal */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#002776]" /> Regras para Equipe (Pessoal)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            { titulo: 'Tipo de contrato', texto: 'Prestação de Serviços Eleitorais — não gera vínculo CLT, sem férias ou 13º.' },
            { titulo: 'Deve ser escrito', texto: 'Contrato assinado (pode ser eletrônico) com data de início, término, função e valor. O TSE disponibiliza modelo.' },
            { titulo: 'Pagamento obrigatório', texto: 'Pix nominal, TED ou cheque nominal ao colaborador. Dinheiro em espécie: apenas dentro dos limites do Fundo de Caixa do TRE.' },
            { titulo: 'Cotas obrigatórias (FEFC)', texto: 'Recursos do FEFC: 30% para mulheres, 30% para negros, percentual proporcional para indígenas (Res. 23.752/2026).' },
            { titulo: 'O que declarar', texto: 'Nome completo, CPF e valor total pago a cada colaborador. Use o Relatório TSE da aba Equipe do SyncroFlow.' },
            { titulo: 'INSS', texto: 'O colaborador é contribuinte individual. O candidato não recolhe INSS patronal durante a campanha.' },
          ].map(r => (
            <div key={r.titulo} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">{r.titulo}</p>
              <p className="text-gray-700">{r.texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm space-y-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#002776]" /> Ações rápidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a href="/financeiro" className="flex items-center gap-3 border rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors">
            <Wallet className="w-5 h-5 text-[#002776]" />
            <div>
              <p className="text-sm font-medium text-gray-900">Ir para Financeiro</p>
              <p className="text-xs text-gray-400">Lançamentos e exportação CSV</p>
            </div>
          </a>
          <a href="/equipe" className="flex items-center gap-3 border rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors">
            <Users className="w-5 h-5 text-[#009C3B]" />
            <div>
              <p className="text-sm font-medium text-gray-900">Ir para Equipe</p>
              <p className="text-xs text-gray-400">Colaboradores e relatório pessoal TSE</p>
            </div>
          </a>
          <a href="https://contaje.tse.jus.br" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 border rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors">
            <ExternalLink className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Acessar Conta+JE</p>
              <p className="text-xs text-gray-400">Sistema oficial TSE — login gov.br</p>
            </div>
          </a>
        </div>
      </div>

      {/* Aviso final */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 text-sm text-amber-800">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
        <div className="space-y-1">
          <p className="font-semibold">Recomendação: tenha um advogado eleitoral ou contador na equipe</p>
          <p>A prestação de contas eleitoral tem regras específicas que mudam a cada eleição. Um erro pode levar à desaprovação das contas e à cassação do mandato. O SyncroFlow organiza seus dados — a revisão final deve ser feita por um profissional habilitado.</p>
          <p className="text-xs mt-2 text-amber-700">Resolução TSE nº 23.752/2026 · Conta+JE substituiu o SPCE definitivamente para eleições 2026.</p>
        </div>
      </div>
    </div>
  )
}
