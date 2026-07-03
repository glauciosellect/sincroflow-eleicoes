'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Type, Trash2, Image as ImageIcon, RotateCcw } from 'lucide-react'

type Format = 'santinho' | 'story' | 'banner'

const FORMATS: Record<Format, { label: string; w: number; h: number }> = {
  santinho: { label: 'Santinho (A5)', w: 420, h: 595 },
  story:    { label: 'Story (9:16)', w: 405, h: 720 },
  banner:   { label: 'Banner (16:9)', w: 720, h: 405 },
}

interface Template {
  key: string
  label: string
  bgColor: string
  accentColor: string
}

const TEMPLATES: Template[] = [
  { key: 'brasil',  label: 'Brasil',   bgColor: '#002776', accentColor: '#FFDF00' },
  { key: 'verde',   label: 'Verde',    bgColor: '#009C3B', accentColor: '#FFFFFF' },
  { key: 'limpo',   label: 'Limpo',    bgColor: '#FFFFFF', accentColor: '#002776' },
  { key: 'escuro',  label: 'Escuro',   bgColor: '#1a1a2e', accentColor: '#FFD700' },
]

interface Props {
  candidateName?: string
  candidateNumber?: string
  candidatePosition?: string
  candidateParty?: string
  candidatePhoto?: string | null
  onExport?: (dataUrl: string, filename: string) => void
}

export default function CreativeEditor({
  candidateName = 'Nome do Candidato',
  candidateNumber = '00',
  candidatePosition = 'Cargo',
  candidateParty = 'Partido',
  candidatePhoto,
  onExport,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<any>(null)
  const [format, setFormat] = useState<Format>('santinho')
  const [template, setTemplate] = useState<Template>(TEMPLATES[0])
  const [loading, setLoading] = useState(true)
  const [addingText, setAddingText] = useState(false)
  const [newText, setNewText] = useState('')
  const [selectedObj, setSelectedObj] = useState<any>(null)
  const [bgColor, setBgColor] = useState(TEMPLATES[0].bgColor)

  const fmt = FORMATS[format]

  const buildTemplate = useCallback(async (canvas: any, fabric: any) => {
    canvas.clear()
    canvas.setWidth(fmt.w)
    canvas.setHeight(fmt.h)
    canvas.setBackgroundColor(bgColor, canvas.renderAll.bind(canvas))

    // Faixa inferior de destaque
    const stripe = new fabric.Rect({
      left: 0, top: fmt.h * 0.72,
      width: fmt.w, height: fmt.h * 0.28,
      fill: template.accentColor,
      selectable: false, evented: false,
    })
    canvas.add(stripe)

    // Foto do candidato (se existir)
    if (candidatePhoto) {
      await new Promise<void>(resolve => {
        fabric.Image.fromURL(candidatePhoto, (img: any) => {
          const scale = Math.min((fmt.w * 0.7) / img.width!, (fmt.h * 0.7) / img.height!)
          img.set({
            left: fmt.w / 2 - (img.width! * scale) / 2,
            top: fmt.h * 0.03,
            scaleX: scale, scaleY: scale,
            selectable: true,
          })
          canvas.add(img)
          resolve()
        }, { crossOrigin: 'anonymous' })
      })
    } else {
      // Placeholder da foto
      const photoRect = new fabric.Rect({
        left: fmt.w * 0.15, top: fmt.h * 0.05,
        width: fmt.w * 0.7, height: fmt.h * 0.6,
        fill: '#cccccc', rx: 8, ry: 8,
        selectable: false, evented: false,
      })
      const photoLabel = new fabric.Text('Foto do candidato', {
        left: fmt.w / 2, top: fmt.h * 0.35,
        originX: 'center', originY: 'center',
        fontSize: Math.round(fmt.w * 0.04),
        fill: '#888888', selectable: false, evented: false,
      })
      canvas.add(photoRect, photoLabel)
    }

    // Nome
    const nameText = new fabric.Text(candidateName.toUpperCase(), {
      left: fmt.w / 2, top: fmt.h * 0.745,
      originX: 'center', originY: 'center',
      fontSize: Math.round(fmt.w * 0.055),
      fontWeight: 'bold', fill: bgColor,
      selectable: true,
    })
    canvas.add(nameText)

    // Número e partido
    const subText = new fabric.Text(`${candidateNumber} • ${candidatePosition} • ${candidateParty}`, {
      left: fmt.w / 2, top: fmt.h * 0.82,
      originX: 'center', originY: 'center',
      fontSize: Math.round(fmt.w * 0.033),
      fill: bgColor, selectable: true,
    })
    canvas.add(subText)

    // Slogan padrão
    const slogan = new fabric.IText('Clique aqui para editar o slogan', {
      left: fmt.w / 2, top: fmt.h * 0.9,
      originX: 'center', originY: 'center',
      fontSize: Math.round(fmt.w * 0.028),
      fill: bgColor, fontStyle: 'italic',
      selectable: true, editable: true,
    })
    canvas.add(slogan)

    canvas.renderAll()
  }, [fmt, template, bgColor, candidateName, candidateNumber, candidatePosition, candidateParty, candidatePhoto])

  useEffect(() => {
    let canvas: any
    setLoading(true)

    import('fabric').then(({ Canvas, Rect, Text, IText, Image: FabricImage }) => {
      if (!canvasRef.current) return

      if (fabricRef.current) {
        fabricRef.current.dispose()
      }

      canvas = new Canvas(canvasRef.current!, {
        width: fmt.w,
        height: fmt.h,
        selection: true,
      })
      fabricRef.current = canvas

      canvas.on('selection:created', (e: any) => setSelectedObj(e.selected?.[0] ?? null))
      canvas.on('selection:updated', (e: any) => setSelectedObj(e.selected?.[0] ?? null))
      canvas.on('selection:cleared', () => setSelectedObj(null))

      const fabric = { Canvas, Rect, Text, IText, Image: FabricImage }
      buildTemplate(canvas, fabric).then(() => setLoading(false))
    })

    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [format, template, bgColor])

  const addText = () => {
    if (!newText.trim() || !fabricRef.current) return
    import('fabric').then(({ IText }) => {
      const text = new IText(newText, {
        left: fmt.w / 2, top: fmt.h / 2,
        originX: 'center', originY: 'center',
        fontSize: Math.round(fmt.w * 0.04),
        fill: template.accentColor === '#FFFFFF' ? '#000000' : template.accentColor,
        selectable: true, editable: true,
      })
      fabricRef.current.add(text)
      fabricRef.current.setActiveObject(text)
      fabricRef.current.renderAll()
      setNewText('')
      setAddingText(false)
    })
  }

  const deleteSelected = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const active = canvas.getActiveObject()
    if (active) { canvas.remove(active); canvas.renderAll(); setSelectedObj(null) }
  }

  const exportPng = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    // Render em alta resolução (2x)
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
    const filename = `criativo-${format}-${Date.now()}.png`
    if (onExport) {
      onExport(dataUrl, filename)
    } else {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      a.click()
    }
  }

  const resetTemplate = () => {
    setTemplate(template) // força re-render via useEffect
    // trigger buildTemplate again
    if (fabricRef.current) {
      import('fabric').then(({ Canvas, Rect, Text, IText, Image: FabricImage }) => {
        buildTemplate(fabricRef.current, { Canvas, Rect, Text, IText, Image: FabricImage })
      })
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Painel de controles */}
      <div className="lg:w-64 shrink-0 space-y-5">
        {/* Formato */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Formato</Label>
          <div className="space-y-1">
            {(Object.entries(FORMATS) as [Format, { label: string; w: number; h: number }][]).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${format === key ? 'bg-[#002776] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Template */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Template</Label>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.key}
                onClick={() => setTemplate(t)}
                className={`h-10 rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all ${template.key === t.key ? 'border-[#002776] scale-105' : 'border-transparent'}`}
                style={{ background: t.bgColor, color: t.accentColor }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cor de fundo personalizada */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cor de fundo</Label>
          <input
            type="color"
            value={bgColor}
            onChange={e => setBgColor(e.target.value)}
            className="h-10 w-full rounded-md border cursor-pointer"
          />
        </div>

        {/* Adicionar texto */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Adicionar texto</Label>
          {addingText ? (
            <div className="space-y-2">
              <Input
                value={newText}
                onChange={e => setNewText(e.target.value)}
                placeholder="Digite o texto..."
                onKeyDown={e => e.key === 'Enter' && addText()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addText} className="flex-1 bg-[#002776] text-white text-xs">Adicionar</Button>
                <Button size="sm" variant="outline" onClick={() => setAddingText(false)} className="flex-1 text-xs">Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAddingText(true)} className="w-full gap-2 text-xs">
              <Type className="w-3.5 h-3.5" />Novo texto
            </Button>
          )}
        </div>

        {/* Ações sobre seleção */}
        {selectedObj && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Selecionado</Label>
            <Button size="sm" variant="outline" onClick={deleteSelected} className="w-full gap-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" />Remover elemento
            </Button>
          </div>
        )}

        {/* Ações gerais */}
        <div className="space-y-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={resetTemplate} className="w-full gap-2 text-xs">
            <RotateCcw className="w-3.5 h-3.5" />Resetar template
          </Button>
          <Button
            size="sm"
            onClick={exportPng}
            disabled={loading}
            className="w-full gap-2 text-xs bg-[#009C3B] hover:bg-[#007a2f] text-white"
          >
            <Download className="w-3.5 h-3.5" />Exportar PNG
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col items-center">
        <p className="text-xs text-gray-400 mb-3">Clique em qualquer elemento para editar. Dê duplo-clique no texto para alterar.</p>
        <div className="relative border rounded-xl overflow-hidden shadow-lg" style={{ maxWidth: '100%' }}>
          {loading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#002776]" />
            </div>
          )}
          <div style={{ transform: 'scale(1)', transformOrigin: 'top left' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">{fmt.w} × {fmt.h}px · exportado em 2× ({fmt.w * 2}×{fmt.h * 2}px)</p>
      </div>
    </div>
  )
}
