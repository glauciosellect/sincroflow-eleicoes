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
    content: 'Na aba **Disclaimer**, defina a mensagem de apresentação do assistente. Por exigência da Resolução TSE, ele sempre se identifica como assistente virtual na primeira interação com cada eleitor.',
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
    content: 'Em **Chat** você vê todas as conversas em tempo real. Pode responder manualmente a qualquer momento (assumindo o atendimento), marcar uma conversa como **Urgente**, ou devolver para o assistente continuar.',
  },
  {
    step: 10,
    title: 'Acompanhar Solicitações',
    content: 'Em **Solicitações** você vê pedidos e reclamações que o assistente registrou automaticamente, cada um com um número de protocolo. Atualize o status conforme sua equipe resolve.',
  },
  {
    step: 11,
    title: 'Analisar Relatórios',
    content: 'Em **Relatórios** você acompanha conversas, temas mais perguntados, perguntas sem resposta (gaps de conteúdo), horários de pico e eleitores mais engajados. Use o botão **Baixar PDF** para exportar e enviar ao partido.',
  },
  {
    step: 12,
    title: 'Acompanhar Compliance TSE',
    content: 'Em **Configurações → Compliance TSE** você vê quando o assistente será desativado automaticamente (72h antes de cada turno), conforme exige a Resolução TSE nº 23.755/2026.',
  },
  {
    step: 13,
    title: 'Gerenciar Financeiro',
    content: 'Em **Configurações → Financeiro** você acompanha seu plano, compra linhas extras de WhatsApp, recarrega mensagens ativas, e — se for eleito — pode clicar em **Seguir Mandato** para continuar usando o sistema sem perder nada do seu histórico.',
  },
  {
    step: 14,
    title: 'Adicionar Equipe',
    content: 'Em **Equipe** convide colaboradores da sua campanha pelo e-mail. Cada pessoa tem seu próprio acesso, com papéis diferentes conforme a função na campanha.',
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
  { q: 'Como compro mais linhas de WhatsApp?', step: 13 },
  { q: 'Como adiciono minha equipe?', step: 14 },
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

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl overflow-hidden border-2 border-white hover:scale-110 transition-transform"
        title="Ajuda — SyncroFlowEleições"
      >
        <img src="/mascote-eleicoes.png" alt="Mascote SyncroFlowEleições" className="w-full h-full object-cover object-top" />
      </button>

      {/* Janela do assistente */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden" style={{ maxHeight: '560px' }}>
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
