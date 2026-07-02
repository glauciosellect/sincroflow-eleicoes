'use client'
import { useState } from 'react'
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, AlertCircle, ExternalLink,
  Download, FileText, Users, Wallet, ClipboardList, BookOpen, Info,
} from 'lucide-react'

interface Step {
  id: number
  titulo: string
  descricao: string
  detalhe: string[]
  aviso?: string
  prazo?: string
}

const ETAPAS_PARCIAL: Step[] = [
  {
    id: 1,
    titulo: 'Abrir conta bancária eleitoral',
    descricao: 'Conta corrente exclusiva para movimentação da campanha (obrigatória pelo TSE).',
    detalhe: [
      'Deve ser aberta em nome do candidato, com CPF e número de candidatura.',
      'Nenhuma receita ou despesa pode passar por conta pessoal.',
      'Bancos aceitam conta corrente comum — alguns têm modalidade "conta eleitoral".',
      'Guarde o extrato bancário de todo o período da campanha.',
    ],
    aviso: 'Movimentar dinheiro de campanha em conta pessoal é infração eleitoral.',
  },
  {
    id: 2,
    titulo: 'Acessar o sistema Conta+JE (TSE)',
    descricao: 'Sistema online do TSE que substitui o SPCE a partir de 2026.',
    detalhe: [
      'Acesse em: https://contaje.tse.jus.br (disponível após o início oficial da campanha).',
      'Login com o CPF e senha do candidato cadastrado no TSE.',
      'Não instala nada — é 100% pelo navegador.',
      'O sistema já conhece seu nome, partido e número de candidatura.',
    ],
  },
  {
    id: 3,
    titulo: 'Registrar receitas no Conta+JE',
    descricao: 'Cada entrada de dinheiro deve ser lançada individualmente.',
    detalhe: [
      'Recursos próprios: informe valor e data do depósito.',
      'Doação de pessoa física: nome completo, CPF e valor. Limite: R$ 1.064,10 por doador (10% da renda bruta anual declarada).',
      'Doação de pessoa jurídica: PROIBIDA pela legislação atual.',
      'Transferência do partido/comitê: requer comprovante bancário.',
      'Use o CSV exportado pelo SyncroFlow como rascunho para conferência antes de lançar no Conta+JE.',
    ],
    aviso: 'Doações acima de R$ 1.064,10 de uma única pessoa física são ilegais.',
  },
  {
    id: 4,
    titulo: 'Registrar despesas no Conta+JE',
    descricao: 'Cada saída de dinheiro deve ter documento fiscal correspondente.',
    detalhe: [
      'Cada despesa precisa de: nota fiscal ou recibo sem rasura, data, valor, CNPJ/CPF do fornecedor.',
      'Pagamento DEVE ser por Pix nominal, transferência ou cheque nominal ao fornecedor.',
      'Dinheiro em espécie aceito apenas até ½ salário mínimo por item (Fundo de Caixa).',
      'Pessoal (cabos eleitorais, coordenadores): lançar com CPF de cada um.',
      'O lançamento é igual ao que você fez aqui no SyncroFlow — o código TSE (ex: 2.04) já está preenchido.',
    ],
  },
  {
    id: 5,
    titulo: 'Anexar documentos comprobatórios',
    descricao: 'Cada lançamento no Conta+JE precisa ter o comprovante em PDF ou imagem.',
    detalhe: [
      'Receitas: comprovante bancário do depósito ou Pix recebido.',
      'Despesas: nota fiscal ou recibo, mais comprovante do pagamento (Pix, extrato).',
      'Pessoal: contrato de prestação de serviços eleitorais assinado + comprovante de pagamento.',
      'Organize os arquivos por data antes de subir — facilita a revisão do advogado eleitoral.',
    ],
  },
  {
    id: 6,
    titulo: 'Prestação parcial (se exigida)',
    descricao: 'Alguns cargos exigem prestação de contas antes do dia da eleição.',
    detalhe: [
      'Presidente, Governador e Senador: prestação parcial obrigatória.',
      'Vereador e Deputados: geralmente só prestação final (confirme com seu TRE).',
      'Data da parcial: definida pelo TSE no calendário eleitoral oficial.',
      'Envia pelo Conta+JE, mesmo sistema da prestação final.',
    ],
    prazo: 'Consultar calendário TSE 2026',
  },
  {
    id: 7,
    titulo: 'Prestação final de contas',
    descricao: 'Encerramento oficial da campanha — enviada pelo Conta+JE.',
    detalhe: [
      'Prazo: 30 dias após o dia da eleição (1º turno) ou 30 dias após o 2º turno.',
      'Todas as receitas e despesas do período devem estar lançadas.',
      'O sistema gera um número de protocolo após o envio — guarde.',
      'O TRE analisa e pode pedir complementação de documentos.',
      'Aprovação final pode levar meses — candidato fica impedido de assumir mandato se reprovado.',
    ],
    aviso: 'Candidatos que não entregam a prestação de contas ficam com contas desaprovadas e podem ter direitos políticos cassados.',
    prazo: '30 dias após a eleição',
  },
]

const DOCS_NECESSARIOS = [
  { cat: 'Receitas', items: ['Extrato bancário da conta eleitoral', 'Comprovante de Pix/TED recebidos', 'Recibo de doação assinado pelo doador (pessoa física)'] },
  { cat: 'Despesas gerais', items: ['Nota fiscal ou recibo (sem rasura)', 'Comprovante de pagamento (Pix, TED, cheque)', 'Contrato com fornecedor (se serviço contínuo)'] },
  { cat: 'Pessoal (equipe)', items: ['Contrato de Prestação de Serviços Eleitorais assinado', 'CPF de cada colaborador', 'Comprovante de Pix/TED nominal a cada colaborador'] },
  { cat: 'Material gráfico', items: ['Nota fiscal da gráfica ou fornecedor', 'Prova do material (foto ou arquivo)'] },
  { cat: 'Impulsionamento digital', items: ['Nota fiscal da plataforma (Google, Meta, etc.)', 'Comprovante de pagamento', 'Print das campanhas impulsionadas'] },
]

const CORRESPONDENCIA = [
  { syncro: 'Doação Pessoa Física', tse: '1.02', obs: 'CPF obrigatório' },
  { syncro: 'Recursos Próprios', tse: '1.01', obs: 'Depósito da conta pessoal na conta eleitoral' },
  { syncro: 'Transferência Partido', tse: '1.03', obs: 'Requer comprovante do partido' },
  { syncro: 'Transferência Comitê', tse: '1.04', obs: '' },
  { syncro: 'Financiamento Coletivo', tse: '1.05', obs: 'Vaquinha online regulamentada' },
  { syncro: 'Pessoal', tse: '2.01', obs: 'CPF + contrato de cada colaborador' },
  { syncro: 'Publicidade', tse: '2.02', obs: 'NF de agência ou veículo' },
  { syncro: 'Produção de Material', tse: '2.03', obs: 'Gráfica, camisetas, brindes' },
  { syncro: 'Impulsionamento Digital', tse: '2.04', obs: 'Google/Meta Ads — NF obrigatória' },
  { syncro: 'Combustível/Transporte', tse: '2.05', obs: 'Nota do posto ou locadora' },
  { syncro: 'Alimentação', tse: '2.06', obs: 'Limite do Fundo de Caixa em dinheiro' },
  { syncro: 'Aluguel de Espaço', tse: '2.07', obs: 'Contrato de locação' },
  { syncro: 'Equipamentos', tse: '2.08', obs: 'NF de compra ou locação' },
  { syncro: 'Serviços Jurídicos', tse: '2.09', obs: '' },
]

export default function PrestacaoContasPage() {
  const [expandido, setExpandido] = useState<number | null>(1)
  const [concluidos, setConcluidos] = useState<number[]>([])

  const toggleConcluido = (id: number) => {
    setConcluidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const progresso = Math.round((concluidos.length / ETAPAS_PARCIAL.length) * 100)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prestação de Contas — Guia TSE 2026</h1>
        <p className="text-sm text-gray-500 mt-1">Passo a passo para usar o Conta+JE e entregar a prestação de contas sem erros</p>
      </div>

      {/* Alerta sistema 2026 */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-4">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Novo sistema em 2026: Conta+JE</p>
          <p>O TSE substituiu o antigo SPCE (arquivo físico) pelo <strong>Conta+JE</strong>, plataforma 100% online. Não é mais necessário instalar software ou enviar arquivo. Tudo é lançado diretamente no site do TSE.</p>
          <p className="text-blue-600 flex items-center gap-1 mt-2">
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="font-medium">contaje.tse.jus.br</span>
            <span className="text-blue-500">(disponível após início da campanha)</span>
          </p>
        </div>
      </div>

      {/* Progresso */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">Seu progresso no checklist</span>
          <span className="text-sm font-bold text-[#009C3B]">{concluidos.length} / {ETAPAS_PARCIAL.length} etapas</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#009C3B] rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-2">Marque cada etapa como concluída conforme for avançando na prestação.</p>
      </div>

      {/* Etapas */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#002776]" /> Checklist de Prestação de Contas
        </h2>
        {ETAPAS_PARCIAL.map(step => {
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
            { titulo: 'Tipo de contrato', texto: 'Prestação de Serviços Eleitorais — não gera CLT, sem férias ou 13º.' },
            { titulo: 'Deve ser escrito', texto: 'Contrato assinado com data de início, término, função e valor. O TSE disponibiliza modelo.' },
            { titulo: 'Pagamento obrigatório', texto: 'Pix nominal, TED ou cheque nominal ao colaborador. Nunca em dinheiro acima de ½ SM.' },
            { titulo: 'Limite de pessoal', texto: 'Municípios até 30 mil eleitores: 1% do eleitorado. Acima: +1 por cada 1.000 eleitores excedentes.' },
            { titulo: 'O que declarar', texto: 'Nome completo, CPF e valor total pago a cada colaborador. Use o Relatório TSE da aba Equipe.' },
            { titulo: 'INSS', texto: 'O colaborador é contribuinte individual. O candidato não recolhe INSS patronal.' },
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
              <p className="text-xs text-gray-400">Sistema oficial do TSE</p>
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
        </div>
      </div>
    </div>
  )
}
