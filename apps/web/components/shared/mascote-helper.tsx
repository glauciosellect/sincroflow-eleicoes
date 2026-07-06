'use client'
import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: 'Conte sua história ao assistente',
    content: 'Vá em **Minha História e Propostas** no menu lateral. Cadastre sua trajetória, suas propostas e a Plataforma Eleitoral. O assistente só responde eleitores com base no que você cadastrar aqui — nunca inventa nada.',
  },
  {
    step: 2,
    title: 'Personalizar o disclaimer',
    content: 'Na aba **Disclaimer**, defina a mensagem de apresentação do assistente. Por exigência da Resolução TSE nº 23.755/2026, ele sempre se identifica como assistente virtual na primeira interação com cada eleitor.',
  },
  {
    step: 3,
    title: 'Conectar seu WhatsApp',
    content: 'Vá em **Configurações → Canais** e clique em **WhatsApp**. Conecte o número real da sua campanha — é por ele que o assistente vai conversar com os eleitores.',
  },
  {
    step: 4,
    title: 'Conectar e-mail (opcional)',
    content: 'Ainda em **Canais**, você pode conectar uma conta de e-mail (Gmail). O assistente responde e-mails de eleitores do mesmo jeito que responde no WhatsApp, incluindo envio de Santinho em anexo.',
  },
  {
    step: 5,
    title: 'Cadastrar Criativos (Santinho Digital)',
    content: 'Em **Criativos**, faça upload de imagens/PDFs vinculados a um tema (ex: Saúde, Educação). Quando um eleitor perguntar sobre aquele tema, o assistente já anexa o material automaticamente.',
  },
  {
    step: 6,
    title: 'Disparar Criativos em massa (Broadcast)',
    content: 'No **Chat**, use o seletor de criativos para enviar um material para um grupo de contatos que já falaram com você. O envio é limitado por segurança (até 500 contatos, 250 por linha de WhatsApp em 24h) — nunca para listas externas ou compradas.',
  },
  {
    step: 7,
    title: 'Conectar a Agenda (Google Calendar)',
    content: 'Vá em **Configurações → Integrações** e conecte o **Google Calendar**. O assistente passa a informar automaticamente seus compromissos públicos quando um eleitor perguntar sobre a agenda — ele nunca cria ou altera eventos, só informa.',
  },
  {
    step: 8,
    title: 'Ativar respostas por áudio',
    content: 'Em **Minha História e Propostas → Configuração**, ative a opção de responder por áudio. Se o eleitor mandar um áudio, o assistente transcreve, entende e responde também em áudio.',
  },
  {
    step: 9,
    title: 'Monitorar pelo Chat',
    content: 'Em **Chat** você vê todas as conversas em tempo real. Pode responder manualmente a qualquer momento (assumindo o atendimento), marcar uma conversa como **Urgente** ou **Remover urgência**, ou devolver para o assistente continuar. Alertas urgentes aparecem no Dashboard com botão X para dispensar.',
  },
  {
    step: 10,
    title: 'Acompanhar Solicitações',
    content: 'Em **Solicitações** você vê pedidos e reclamações que o assistente registrou automaticamente, cada um com um número de protocolo. Atualize o status conforme sua equipe resolve.',
  },
  {
    step: 11,
    title: 'Analisar Relatórios',
    content: 'Em **Relatórios** clique no ícone de expandir (⊠) em qualquer card para abrir um relatório detalhado com **seletor de período próprio** e botão **Gerar PDF** daquele relatório específico. Inclui pesquisa de intenção de voto dos agentes de campo.',
  },
  {
    step: 12,
    title: 'Acompanhar Compliance TSE',
    content: 'Em **Configurações → Compliance TSE** você vê quando o assistente será desativado automaticamente (72h antes de cada turno), conforme exige a Resolução TSE nº 23.755/2026. Após a eleição, o sistema administrativo continua disponível para análises e fechamento financeiro.',
  },
  {
    step: 13,
    title: 'Gerenciar Financeiro',
    content: 'Em **Financeiro** você lança receitas e despesas da campanha, controla o orçamento e exporta relatórios para prestação de contas ao TSE. Use as categorias TSE para garantir conformidade.',
  },
  {
    step: 14,
    title: 'Adicionar Equipe e Agentes de Campo',
    content: 'Em **Equipe** convide colaboradores da sua campanha pelo e-mail. O papel **Agente de Campo** acessa apenas **Meu Desempenho** (para registrar pesquisas de voto com CEP) e o **Consultor de Fatos** (para tirar dúvidas de eleitores em campo com IA).',
  },
  {
    step: 15,
    title: 'Coordenadores de Campo',
    content: 'Em **Equipe → Coordenadores** você cadastra coordenadores que supervisionam grupos de agentes. Cada coordenador acessa um painel próprio em **/coordenador** com o desempenho da sua equipe, check-ins e ranking semanal. Vincule o coordenador à sua equipe no painel administrativo para que ele veja apenas seus subordinados.',
  },
  {
    step: 16,
    title: 'Gestor de Líderes',
    content: 'Em **Equipe → Líderes** você gerencia os membros de campo: define territórios (bairros), metas de votos, acompanha o score de atividade semanal (pesquisas + check-ins + contatos) e vê o ranking completo. Líderes com mais de 7 dias sem atividade aparecem com alerta vermelho.',
  },
  {
    step: 17,
    title: 'Pesquisa de Intenção de Voto',
    content: 'Em **Meu Desempenho**, agentes de campo registram eleitores pesquisados com nome, telefone, **CEP** (preenchimento automático de bairro e cidade) e intenção de voto (Apoiador, Indeciso ou Crítico). Também é possível registrar preferências por cargo (Vereador, Dep. Estadual, Dep. Federal, Senador, Governador, Presidente).',
  },
  {
    step: 18,
    title: 'Mapa de Apoiadores',
    content: 'Em **Mapa de Apoiadores** você visualiza no mapa onde estão seus apoiadores, indecisos e críticos. Cada círculo representa um bairro ou cidade — o tamanho é proporcional ao volume e a cor indica a intenção predominante. Para **Vereadores** agrupa por bairro; para **Deputados, Senadores, Governadores e Presidente** agrupa por cidade. Filtre por 7, 30, 60 ou 90 dias.',
  },
  {
    step: 19,
    title: 'Consultor de Fatos com IA',
    content: 'Em **Consultor de Fatos**, agentes de campo colam uma dúvida ou boato recebido de um eleitor. A IA analisa com base em fontes públicas (TSE, IBGE, legislação, veículos reconhecidos) e retorna um **veredicto** (Verdadeiro, Falso, Parcialmente verdadeiro ou Inconclusivo), uma **análise** e uma **resposta pronta** para usar com o eleitor. Respostas podem ser salvas na **Biblioteca** para reuso.',
  },
  {
    step: 20,
    title: 'Discurso de Palanque com IA',
    content: 'Em **Discurso de Palanque**, escolha o tema, o tom (entusiasta, técnico, emocional) e o público-alvo. A IA gera um discurso personalizado com base na sua história e propostas cadastradas. Você pode salvar, editar e exportar como PDF para usar em eventos.',
  },
  {
    step: 21,
    title: 'Radar de Notícias',
    content: 'Em **Radar de Notícias** a IA monitora notícias relevantes para sua campanha e área de atuação. Acompanhe os temas em alta no seu município, veja o que os eleitores estão comentando e use como base para seus posicionamentos.',
  },
  {
    step: 22,
    title: 'Relatórios Semanais Automáticos',
    content: 'Todo **segunda-feira às 8h** você recebe por e-mail o briefing semanal da campanha. Coordenadores recebem o resumo da sua equipe (ativos, inativos, cadastros, pesquisas). Líderes recebem seu próprio desempenho individual com posição no ranking e progresso da meta de votos.',
  },
  {
    step: 23,
    title: 'Portal do Eleitor',
    content: 'Em **Portal do Eleitor** você cria uma página pública personalizada onde eleitores podem se cadastrar, enviar mensagens e acompanhar suas propostas. Cada cadastro feito no portal é automaticamente sincronizado com sua base de contatos.',
  },
]

const FAQ = [
  { q: 'Como cadastro minhas propostas?', step: 1 },
  { q: 'Como conecto meu WhatsApp?', step: 3 },
  { q: 'Como conecto e-mail?', step: 4 },
  { q: 'Como funciona o Santinho Digital?', step: 5 },
  { q: 'Como faço um disparo (broadcast)?', step: 6 },
  { q: 'Como conecto o Google Calendar?', step: 7 },
  { q: 'Como ativo respostas por áudio?', step: 8 },
  { q: 'Como vejo as Solicitações?', step: 10 },
  { q: 'Como exporto um relatório em PDF?', step: 11 },
  { q: 'Quando o assistente é desativado pelo TSE?', step: 12 },
  { q: 'Como adiciono agentes de campo?', step: 14 },
  { q: 'Como funciona o Gestor de Líderes?', step: 16 },
  { q: 'Como cadastro coordenadores?', step: 15 },
  { q: 'Como registrar pesquisa de intenção de voto?', step: 17 },
  { q: 'Como funciona o Mapa de Apoiadores?', step: 18 },
  { q: 'O que é o Consultor de Fatos?', step: 19 },
  { q: 'Como gero um discurso de palanque?', step: 20 },
  { q: 'Como funciona o relatório semanal?', step: 22 },
  { q: 'Como criar um Portal do Eleitor?', step: 23 },
]

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
}

export function MascoteHelper() {
  const [open, setOpen] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Posição arrastável — começa no canto inferior direito
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const hasMoved = useRef(false)

  // Inicializa posição depois de montar (evita SSR mismatch)
  useEffect(() => {
    setPos({ x: window.innerWidth - 88, y: window.innerHeight - 88 })
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    hasMoved.current = false
    dragOffset.current = {
      x: e.clientX - (pos?.x ?? 0),
      y: e.clientY - (pos?.y ?? 0),
    }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      hasMoved.current = true
      const x = Math.min(Math.max(0, e.clientX - dragOffset.current.x), window.innerWidth - 64)
      const y = Math.min(Math.max(0, e.clientY - dragOffset.current.y), window.innerHeight - 64)
      setPos({ x, y })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // Posição da janela: abre acima/esquerda do botão conforme espaço disponível
  const windowStyle = pos ? (() => {
    const spaceBelow = window.innerHeight - pos.y - 64
    const spaceRight = window.innerWidth - pos.x - 64
    return {
      position: 'fixed' as const,
      top: spaceBelow > 580 ? pos.y + 72 : Math.max(8, pos.y - 580),
      left: spaceRight > 320 ? pos.x : Math.max(8, pos.x - 320 + 64),
      zIndex: 50,
      width: 320,
      maxHeight: 560,
    }
  })() : {}

  useEffect(() => {
    if (expandedFaq !== null) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [expandedFaq])

  const toggleFaq = (index: number) => {
    setExpandedFaq(prev => prev === index ? null : index)
  }

  const openTutorial = (stepIndex: number) => {
    setTutorialStep(stepIndex)
    setShowTutorial(true)
  }

  const handleFaqStep = (faq: typeof FAQ[0]) => {
    const stepIndex = TUTORIAL_STEPS.findIndex(s => s.step === faq.step)
    if (stepIndex >= 0) openTutorial(stepIndex)
  }

  if (!pos) return null

  return (
    <>
      {/* Botão flutuante arrastável */}
      <button
        ref={btnRef}
        onMouseDown={onMouseDown}
        onClick={() => { if (!hasMoved.current) setOpen(o => !o) }}
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, cursor: dragging.current ? 'grabbing' : 'grab' }}
        className="w-16 h-16 rounded-full shadow-2xl overflow-hidden border-2 border-white hover:scale-110 transition-transform select-none"
        title="Ajuda — SyncroFlowEleições"
      >
        <img src="/mascote-eleicoes.png" alt="Mascote SyncroFlowEleições" className="w-full h-full object-cover object-top" />
      </button>

      {/* Janela do assistente */}
      {open && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden" style={{ ...windowStyle, maxHeight: '560px' }}>
          {/* Header */}
          <div className="flex items-center gap-3 p-4 text-white shrink-0" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
            <img src="/mascote-eleicoes.png" alt="" className="w-9 h-9 rounded-full object-cover object-top border-2 border-white/30" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Assistente SyncroFlowEleições</div>
              <div className="text-xs text-white/70">Tira-dúvidas · Tutorial</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Perguntas frequentes em accordion */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 pb-0">
              <p className="text-xs text-gray-400 font-medium mb-2">Perguntas frequentes — clique para ver a resposta:</p>
            </div>
            <div className="px-3 space-y-1.5 pb-3">
              {FAQ.map((faq, i) => {
                const step = TUTORIAL_STEPS.find(s => s.step === faq.step)
                const isOpen = expandedFaq === i
                return (
                  <div key={i} className={cn('rounded-xl border transition-all overflow-hidden', isOpen ? 'border-[#002776] bg-blue-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200')}>
                    <button
                      onClick={() => toggleFaq(i)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className={cn('text-xs font-medium leading-snug', isOpen ? 'text-[#002776]' : 'text-gray-700')}>{faq.q}</span>
                      <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 ml-2 transition-transform', isOpen ? 'rotate-180 text-[#002776]' : 'text-gray-400')} />
                    </button>
                    {isOpen && step && (
                      <div className="px-3 pb-3">
                        <p
                          className="text-xs text-gray-600 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(step.content) }}
                        />
                        <button
                          onClick={() => handleFaqStep(faq)}
                          className="mt-2.5 text-xs font-semibold text-[#002776] hover:underline flex items-center gap-1"
                        >
                          Ver no tutorial completo →
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Botão tutorial */}
          <div className="p-3 border-t border-gray-100 shrink-0">
            <button
              onClick={() => openTutorial(0)}
              className="w-full py-2.5 text-xs font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}
            >
              📖 Ver tutorial completo ({TUTORIAL_STEPS.length} passos)
            </button>
          </div>
        </div>
      )}

      {/* Modal Tutorial Completo */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header tutorial */}
            <div className="p-5 text-white" style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <img src="/mascote-eleicoes.png" alt="" className="w-10 h-10 rounded-full object-cover object-top border-2 border-white/30" />
                  <div>
                    <div className="font-bold">Tutorial SyncroFlowEleições</div>
                    <div className="text-xs text-white/70">Passo {tutorialStep + 1} de {TUTORIAL_STEPS.length}</div>
                  </div>
                </div>
                <button onClick={() => setShowTutorial(false)} className="p-1.5 hover:bg-white/20 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Barra de progresso */}
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-white transition-all"
                  style={{ width: `${((tutorialStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Conteúdo */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#002776] to-[#009C3B] flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {TUTORIAL_STEPS[tutorialStep].step}
                </div>
                <h2 className="text-lg font-bold text-gray-900">{TUTORIAL_STEPS[tutorialStep].title}</h2>
              </div>
              <p
                className="text-gray-600 leading-relaxed text-sm"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(TUTORIAL_STEPS[tutorialStep].content) }}
              />
            </div>

            {/* Navegação */}
            <div className="flex items-center justify-between p-5 border-t border-gray-100">
              <button
                onClick={() => setTutorialStep(s => Math.max(0, s - 1))}
                disabled={tutorialStep === 0}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-colors"
              >
                ← Anterior
              </button>

              {/* Índice rápido */}
              <div className="flex gap-1 flex-wrap justify-center max-w-[160px]">
                {TUTORIAL_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTutorialStep(i)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      i === tutorialStep ? 'bg-[#002776] w-4' : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  />
                ))}
              </div>

              {tutorialStep < TUTORIAL_STEPS.length - 1 ? (
                <button
                  onClick={() => setTutorialStep(s => s + 1)}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}
                >
                  Próximo →
                </button>
              ) : (
                <button
                  onClick={() => setShowTutorial(false)}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
                >
                  Concluir ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
