'use client'
import { useState, useRef, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTutorialStore } from '@/store/tutorial.store'
import { TUTORIAL_INTRO, TUTORIAL_STEPS } from './tutorial-data'

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}

const SIZE_NORMAL = { width: 420, height: 560 }
const SIZE_LARGE = { width: 620, height: 720 }

// STEP_INDEX_INTRO = -1 representa a tela de introdução (venda + como usar o
// tutorial), antes do passo 1. TUTORIAL_STEPS[0] é o passo 1.
const STEP_INDEX_INTRO = -1

export function TutorialPanel() {
  const isOpen = useTutorialStore((s) => s.isOpen)
  const close = useTutorialStore((s) => s.close)
  const [stepIndex, setStepIndex] = useState(STEP_INDEX_INTRO)
  const [large, setLarge] = useState(false)

  // Posição arrastável — começa centralizado, guardada mesmo se o painel fechar
  // e abrir de novo (mas não persiste entre reloads, de propósito: sempre volta
  // a um lugar visível, evitando "sumir" fora da tela em telas menores).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)

  const size = large ? SIZE_LARGE : SIZE_NORMAL

  useEffect(() => {
    if (isOpen && !pos) {
      setPos({
        x: Math.max(16, (window.innerWidth - size.width) / 2),
        y: Math.max(16, (window.innerHeight - size.height) / 2),
      })
    }
  }, [isOpen])

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if (!pos) return
    dragging.current = true
    hasMoved.current = false
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      hasMoved.current = true
      const x = Math.min(Math.max(0, e.clientX - dragOffset.current.x), window.innerWidth - 80)
      const y = Math.min(Math.max(0, e.clientY - dragOffset.current.y), window.innerHeight - 40)
      setPos({ x, y })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  if (!isOpen || !pos) return null

  const isIntro = stepIndex === STEP_INDEX_INTRO
  const step = isIntro ? null : TUTORIAL_STEPS[stepIndex]
  const totalScreens = TUTORIAL_STEPS.length + 1 // +1 pela introdução
  const currentScreenNumber = stepIndex + 2 // intro = 1, passo 1 = 2, ...

  const goNext = () => setStepIndex((s) => Math.min(TUTORIAL_STEPS.length - 1, s + 1))
  const goPrev = () => setStepIndex((s) => Math.max(STEP_INDEX_INTRO, s - 1))

  return (
    <div
      className="fixed z-[70] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height, transition: dragging.current ? 'none' : 'width .2s, height .2s' }}
    >
      {/* Header arrastável */}
      <div
        onMouseDown={onHeaderMouseDown}
        className="flex items-center gap-3 p-4 text-white shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}
      >
        <GripHorizontal className="w-4 h-4 opacity-60 shrink-0" />
        <img src="/mascote-eleicoes.png" alt="" className="w-9 h-9 rounded-full object-cover object-top border-2 border-white/30 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Tutorial SyncroFlowEleições</div>
          <div className="text-xs text-white/70">
            {isIntro ? 'Introdução' : `Passo ${step!.step} de ${TUTORIAL_STEPS.length}`}
          </div>
        </div>
        <button
          onClick={() => setLarge((l) => !l)}
          className="p-1.5 hover:bg-white/20 rounded-full transition-colors shrink-0"
          title={large ? 'Diminuir janela' : 'Aumentar janela'}
        >
          {large ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <button onClick={close} className="p-1.5 hover:bg-white/20 rounded-full transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-gray-100 h-1 shrink-0">
        <div
          className="h-1 transition-all"
          style={{ width: `${(currentScreenNumber / totalScreens) * 100}%`, background: 'linear-gradient(90deg, #002776, #009C3B)' }}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-6">
        {isIntro ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{TUTORIAL_INTRO.title}</h2>
            <p
              className="text-gray-600 leading-relaxed text-sm whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(TUTORIAL_INTRO.content) }}
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#002776] to-[#009C3B] flex items-center justify-center text-white font-bold text-lg shrink-0">
                {step!.step}
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#009C3B]">{step!.menu}</div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{step!.title}</h2>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Para que serve</div>
                <p className="text-gray-700 leading-relaxed">{step!.whatIsItFor}</p>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Como configurar</div>
                <p
                  className="text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(step!.howToConfigure) }}
                />
              </div>

              {step!.tip && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">💡 Dica</div>
                  <p
                    className="text-amber-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(step!.tip) }}
                  />
                </div>
              )}

              {step!.moreDetails && (
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Saiba mais</div>
                  <p
                    className="text-gray-600 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(step!.moreDetails) }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between p-4 border-t border-gray-100 shrink-0">
        <button
          onClick={goPrev}
          disabled={isIntro}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>

        <div className="flex gap-1 flex-wrap justify-center max-w-[140px]">
          <button
            onClick={() => setStepIndex(STEP_INDEX_INTRO)}
            className={cn('w-2 h-2 rounded-full transition-all', isIntro ? 'bg-[#002776] w-4' : 'bg-gray-200 hover:bg-gray-300')}
            title="Introdução"
          />
          {TUTORIAL_STEPS.map((s, i) => (
            <button
              key={s.step}
              onClick={() => setStepIndex(i)}
              className={cn('w-2 h-2 rounded-full transition-all', stepIndex === i ? 'bg-[#002776] w-4' : 'bg-gray-200 hover:bg-gray-300')}
              title={s.title}
            />
          ))}
        </div>

        {stepIndex < TUTORIAL_STEPS.length - 1 ? (
          <button
            onClick={goNext}
            className="flex items-center gap-1 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #002776, #009C3B)' }}
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={close}
            className="px-4 py-2 text-sm font-semibold text-white rounded-xl"
            style={{ background: 'linear-gradient(135deg, #009C3B, #002776)' }}
          >
            Concluir ✓
          </button>
        )}
      </div>
    </div>
  )
}
