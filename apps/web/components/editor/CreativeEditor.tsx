'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Download, RefreshCw, Wand2 } from 'lucide-react'

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
type Format = 'santinho' | 'story' | 'banner'
type TemplateKey = 'brasil' | 'verde' | 'dourado' | 'vermelho' | 'escuro' | 'bandeira'

const FORMATS: Record<Format, { label: string; w: number; h: number }> = {
  santinho: { label: 'Santinho (A5)', w: 420, h: 594 },
  story:    { label: 'Story (9:16)',  w: 405, h: 720 },
  banner:   { label: 'Banner (16:9)', w: 720, h: 405 },
}

interface CandidateData {
  name?: string | null
  number?: string | null
  position?: string | null
  party?: string | null
  photo?: string | null
  city?: string | null
  state?: string | null
}

interface Props extends CandidateData {
  onExport?: (dataUrl: string, filename: string) => void
}

/* ─── Templates visuais ──────────────────────────────────────────────────── */
const TEMPLATES: Record<TemplateKey, { label: string; preview: string }> = {
  brasil:   { label: 'Brasil',    preview: 'linear-gradient(135deg,#002776,#009C3B)' },
  verde:    { label: 'Vitória',   preview: 'linear-gradient(135deg,#005c20,#00a651)' },
  dourado:  { label: 'Dourado',   preview: 'linear-gradient(135deg,#7c4a00,#f5a623)' },
  vermelho: { label: 'Força',     preview: 'linear-gradient(135deg,#8b0000,#e63329)' },
  escuro:   { label: 'Noturno',   preview: 'linear-gradient(135deg,#0a0a1a,#1a1a3e)' },
  bandeira: { label: 'Bandeira',  preview: 'linear-gradient(135deg,#002776 33%,#009C3B 33%,#009C3B 66%,#FFDF00 66%)' },
}

/* ─── Gerador de HTML do template ───────────────────────────────────────── */
function buildTemplateHTML(
  fmt: { w: number; h: number },
  tplKey: TemplateKey,
  data: CandidateData,
  slogan: string,
  photoBase64: string | null,
): string {
  const name    = (data.name    || 'NOME DO CANDIDATO').toUpperCase()
  const number  = data.number  || '00000'
  const position= (data.position|| 'CARGO').toUpperCase()
  const party   = (data.party  || 'PARTIDO').toUpperCase()
  const location= [data.city, data.state].filter(Boolean).join(' - ') || ''
  const w = fmt.w, h = fmt.h
  const isBanner = w > h

  // Paletas por template
  const palettes: Record<TemplateKey, {
    bg1: string; bg2: string; bg3: string
    accent: string; text: string; textSub: string
    numBg: string; numText: string
    overlay: string
  }> = {
    brasil:   { bg1:'#002776', bg2:'#003d99', bg3:'#001a55', accent:'#FFDF00', text:'#FFFFFF', textSub:'#FFDF00', numBg:'#FFDF00', numText:'#002776', overlay:'rgba(0,39,118,0.55)' },
    verde:    { bg1:'#005c20', bg2:'#007a2b', bg3:'#003d15', accent:'#b8f064', text:'#FFFFFF', textSub:'#b8f064', numBg:'#b8f064', numText:'#003d15', overlay:'rgba(0,92,32,0.60)' },
    dourado:  { bg1:'#5c3100', bg2:'#7c4a00', bg3:'#3d2000', accent:'#f5a623', text:'#FFFFFF', textSub:'#f5d623', numBg:'#f5a623', numText:'#3d2000', overlay:'rgba(92,49,0,0.60)' },
    vermelho: { bg1:'#8b0000', bg2:'#cc0000', bg3:'#5c0000', accent:'#ff6b6b', text:'#FFFFFF', textSub:'#ffcccc', numBg:'#ff3333', numText:'#FFFFFF', overlay:'rgba(139,0,0,0.60)' },
    escuro:   { bg1:'#0a0a1a', bg2:'#1a1a3e', bg3:'#050510', accent:'#7c6fff', text:'#FFFFFF', textSub:'#a89eff', numBg:'#7c6fff', numText:'#FFFFFF', overlay:'rgba(10,10,26,0.65)' },
    bandeira: { bg1:'#002776', bg2:'#009C3B', bg3:'#FFDF00', accent:'#FFDF00', text:'#FFFFFF', textSub:'#FFDF00', numBg:'#FFDF00', numText:'#002776', overlay:'rgba(0,39,118,0.50)' },
  }
  const p = palettes[tplKey]

  const photoSection = photoBase64
    ? `<img src="${photoBase64}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" />`
    : `<div style="width:100%;height:100%;background:linear-gradient(180deg,#cccccc,#999999);display:flex;align-items:center;justify-content:center;">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="#666"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
       </div>`

  if (!isBanner) {
    // ── VERTICAL (santinho / story) ──────────────────────────────────────
    const photoH = Math.round(h * 0.52)
    const numSize = Math.round(w * 0.12)
    const nameSize = Math.round(w * 0.072)
    const subSize = Math.round(w * 0.038)
    const sloganSize = Math.round(w * 0.042)
    const starSize = Math.round(w * 0.05)

    return `
<div style="
  width:${w}px;height:${h}px;
  background:linear-gradient(180deg,${p.bg1} 0%,${p.bg2} 50%,${p.bg3} 100%);
  font-family:'Arial Black',Arial,sans-serif;
  position:relative;overflow:hidden;
">
  <!-- Círculos decorativos de fundo -->
  <div style="position:absolute;top:-${Math.round(w*0.3)}px;right:-${Math.round(w*0.2)}px;width:${Math.round(w*0.7)}px;height:${Math.round(w*0.7)}px;border-radius:50%;background:${p.accent};opacity:0.07;"></div>
  <div style="position:absolute;bottom:-${Math.round(w*0.2)}px;left:-${Math.round(w*0.15)}px;width:${Math.round(w*0.5)}px;height:${Math.round(w*0.5)}px;border-radius:50%;background:${p.accent};opacity:0.07;"></div>

  <!-- Faixa topo com número -->
  <div style="
    position:absolute;top:0;left:0;right:0;
    height:${Math.round(h*0.07)}px;
    background:${p.accent};
    display:flex;align-items:center;justify-content:center;
    z-index:10;
  ">
    <span style="font-size:${Math.round(h*0.032)}px;font-weight:900;color:${p.numText};letter-spacing:3px;font-family:'Arial Black',Arial,sans-serif;">
      VOTE ${number}
    </span>
  </div>

  <!-- Foto do candidato -->
  <div style="
    position:absolute;
    top:${Math.round(h*0.07)}px;left:0;right:0;
    height:${photoH}px;
    overflow:hidden;
  ">
    ${photoSection}
    <!-- Gradiente sobre a foto -->
    <div style="position:absolute;bottom:0;left:0;right:0;height:${Math.round(photoH*0.4)}px;background:linear-gradient(180deg,transparent,${p.bg1});"></div>
  </div>

  <!-- Faixa diagonal decorativa -->
  <div style="
    position:absolute;
    top:${Math.round(h*0.07 + photoH - 4)}px;left:0;right:0;
    height:8px;
    background:linear-gradient(90deg,${p.accent},transparent,${p.accent});
  "></div>

  <!-- Bloco de informações -->
  <div style="
    position:absolute;
    top:${Math.round(h*0.07 + photoH + 8)}px;
    left:0;right:0;bottom:0;
    display:flex;flex-direction:column;align-items:center;justify-content:space-between;
    padding:${Math.round(h*0.015)}px ${Math.round(w*0.05)}px ${Math.round(h*0.02)}px;
    box-sizing:border-box;
  ">
    <!-- Nome -->
    <div style="text-align:center;">
      <div style="
        font-size:${nameSize}px;font-weight:900;color:${p.text};
        line-height:1.1;letter-spacing:1px;
        font-family:'Arial Black',Arial,sans-serif;
        text-shadow:2px 2px 8px rgba(0,0,0,0.5);
      ">${name}</div>
      <div style="
        margin-top:${Math.round(h*0.008)}px;
        font-size:${subSize}px;font-weight:700;color:${p.textSub};
        letter-spacing:2px;font-family:Arial,sans-serif;
      ">${position} · ${party}</div>
      ${location ? `<div style="font-size:${Math.round(subSize*0.85)}px;color:${p.text};opacity:0.7;margin-top:3px;font-family:Arial,sans-serif;">${location}</div>` : ''}
    </div>

    <!-- Slogan -->
    <div style="
      text-align:center;
      background:rgba(255,255,255,0.1);
      border-left:4px solid ${p.accent};
      border-right:4px solid ${p.accent};
      padding:${Math.round(h*0.012)}px ${Math.round(w*0.06)}px;
      border-radius:4px;
      width:100%;box-sizing:border-box;
    ">
      <div style="
        font-size:${sloganSize}px;font-weight:700;
        color:${p.text};font-style:italic;
        line-height:1.3;font-family:Arial,sans-serif;
        text-shadow:1px 1px 4px rgba(0,0,0,0.4);
      ">"${slogan || 'Sua voz, nossa força!'}"</div>
    </div>

    <!-- Rodapé com número grande -->
    <div style="display:flex;align-items:center;justify-content:center;gap:${Math.round(w*0.03)}px;">
      <div style="width:${Math.round(w*0.08)}px;height:2px;background:${p.accent};"></div>
      <div style="
        background:${p.numBg};
        color:${p.numText};
        font-size:${numSize}px;font-weight:900;
        padding:${Math.round(h*0.008)}px ${Math.round(w*0.06)}px;
        border-radius:6px;
        font-family:'Arial Black',Arial,sans-serif;
        letter-spacing:4px;
        box-shadow:0 4px 15px rgba(0,0,0,0.3);
      ">${number}</div>
      <div style="width:${Math.round(w*0.08)}px;height:2px;background:${p.accent};"></div>
    </div>
  </div>

  <!-- Estrelas decorativas -->
  <div style="position:absolute;top:${Math.round(h*0.07 + photoH * 0.05)}px;left:${Math.round(w*0.03)}px;font-size:${starSize}px;opacity:0.6;">★</div>
  <div style="position:absolute;top:${Math.round(h*0.07 + photoH * 0.05)}px;right:${Math.round(w*0.03)}px;font-size:${starSize}px;opacity:0.6;">★</div>
</div>`

  } else {
    // ── HORIZONTAL (banner 16:9) ─────────────────────────────────────────
    const photoW = Math.round(w * 0.38)
    const nameSize = Math.round(h * 0.11)
    const subSize = Math.round(h * 0.055)
    const numSize = Math.round(h * 0.16)
    const sloganSize = Math.round(h * 0.062)

    return `
<div style="
  width:${w}px;height:${h}px;
  background:linear-gradient(135deg,${p.bg1} 0%,${p.bg2} 60%,${p.bg3} 100%);
  font-family:'Arial Black',Arial,sans-serif;
  position:relative;overflow:hidden;
  display:flex;
">
  <!-- Círculo decorativo -->
  <div style="position:absolute;top:-${Math.round(h*0.5)}px;left:${Math.round(w*0.25)}px;width:${Math.round(h*1.5)}px;height:${Math.round(h*1.5)}px;border-radius:50%;background:${p.accent};opacity:0.05;"></div>

  <!-- Foto esquerda -->
  <div style="width:${photoW}px;height:${h}px;overflow:hidden;flex-shrink:0;position:relative;">
    ${photoSection}
    <div style="position:absolute;top:0;right:0;bottom:0;width:${Math.round(photoW*0.35)}px;background:linear-gradient(90deg,transparent,${p.bg1});"></div>
  </div>

  <!-- Faixa vertical accent -->
  <div style="width:6px;background:${p.accent};flex-shrink:0;"></div>

  <!-- Conteúdo direita -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:${Math.round(h*0.06)}px ${Math.round(h*0.06)}px;box-sizing:border-box;">
    <div style="font-size:${subSize}px;font-weight:700;color:${p.textSub};letter-spacing:3px;margin-bottom:${Math.round(h*0.02)}px;font-family:Arial,sans-serif;">${party} · ${position}</div>
    <div style="font-size:${nameSize}px;font-weight:900;color:${p.text};line-height:1;letter-spacing:1px;font-family:'Arial Black',Arial,sans-serif;text-shadow:2px 2px 8px rgba(0,0,0,0.4);">${name}</div>
    <div style="margin:${Math.round(h*0.03)}px 0;font-size:${sloganSize}px;font-weight:700;color:${p.text};font-style:italic;font-family:Arial,sans-serif;opacity:0.9;">"${slogan || 'Sua voz, nossa força!'}"</div>
    <div style="display:flex;align-items:center;gap:${Math.round(h*0.02)}px;margin-top:${Math.round(h*0.02)}px;">
      <div style="height:3px;width:${Math.round(h*0.1)}px;background:${p.accent};border-radius:2px;"></div>
      <div style="background:${p.numBg};color:${p.numText};font-size:${numSize}px;font-weight:900;padding:${Math.round(h*0.01)}px ${Math.round(h*0.04)}px;border-radius:6px;font-family:'Arial Black',Arial,sans-serif;letter-spacing:4px;box-shadow:0 4px 15px rgba(0,0,0,0.3);">${number}</div>
      <div style="height:3px;flex:1;background:${p.accent};opacity:0.4;border-radius:2px;"></div>
    </div>
    ${location ? `<div style="margin-top:${Math.round(h*0.02)}px;font-size:${Math.round(subSize*0.85)}px;color:${p.text};opacity:0.6;font-family:Arial,sans-serif;">📍 ${location}</div>` : ''}
  </div>

  <!-- Faixa topo -->
  <div style="position:absolute;top:0;left:0;right:0;height:${Math.round(h*0.06)}px;background:${p.accent};opacity:0.15;"></div>
  <!-- Faixa rodapé -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:${Math.round(h*0.06)}px;background:${p.accent};opacity:0.15;"></div>
</div>`
  }
}

/* ─── Componente principal ───────────────────────────────────────────────── */
export default function CreativeEditor({
  name, number, position, party, photo, city, state, onExport,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [format, setFormat]   = useState<Format>('santinho')
  const [tplKey, setTplKey]   = useState<TemplateKey>('brasil')
  const [slogan, setSlogan]   = useState('Sua voz, nossa força!')
  const [photoB64, setPhotoB64] = useState<string | null>(null)
  const [loading, setLoading]  = useState(false)
  const [exporting, setExporting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  const fmt = FORMATS[format]
  const data: CandidateData = { name, number, position, party, city, state }

  // Converte foto para base64 uma vez
  useEffect(() => {
    if (!photo) return
    const url = photo.split('?')[0]
    setLoading(true)
    fetch(url)
      .then(r => r.blob())
      .then(blob => new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result as string)
        fr.onerror = rej
        fr.readAsDataURL(blob)
      }))
      .then(b64 => setPhotoB64(b64))
      .catch(() => setPhotoB64(null))
      .finally(() => setLoading(false))
  }, [photo])

  // Gera preview HTML
  useEffect(() => {
    setPreviewHtml(buildTemplateHTML(fmt, tplKey, data, slogan, photoB64))
  }, [format, tplKey, slogan, photoB64, name, number, position, party, city, state])

  const exportPng = useCallback(async () => {
    const el = containerRef.current?.querySelector('[data-template]') as HTMLElement
    if (!el) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: fmt.w,
        height: fmt.h,
        logging: false,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const filename = `santinho-${format}-${Date.now()}.png`
      if (onExport) {
        onExport(dataUrl, filename)
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = filename
        a.click()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setExporting(false)
    }
  }, [fmt, format, onExport])

  // Escala para caber na tela
  const maxW = 500
  const scale = Math.min(1, maxW / fmt.w)

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Painel de controles */}
      <div className="lg:w-60 shrink-0 space-y-5">

        {/* Formato */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Formato</p>
          {(Object.entries(FORMATS) as [Format, any][]).map(([k, v]) => (
            <button key={k} onClick={() => setFormat(k)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${format === k ? 'bg-[#002776] text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Template */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Template</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(TEMPLATES) as [TemplateKey, any][]).map(([k, v]) => (
              <button key={k} onClick={() => setTplKey(k)}
                className={`h-10 rounded-lg text-xs font-bold text-white transition-all border-2 ${tplKey === k ? 'border-white scale-105 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'}`}
                style={{ background: v.preview }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Slogan */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Slogan</p>
          <textarea
            value={slogan}
            onChange={e => setSlogan(e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#002776]"
            placeholder="Sua voz, nossa força!"
          />
        </div>

        {/* Ações */}
        <div className="space-y-2 pt-2 border-t">
          <Button onClick={exportPng} disabled={exporting || loading}
            className="w-full gap-2 bg-[#009C3B] hover:bg-[#007a2f] text-white">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Gerando PNG...' : 'Exportar PNG'}
          </Button>
          <p className="text-xs text-gray-400 text-center">{fmt.w}×{fmt.h}px · exportado em 2× ({fmt.w*2}×{fmt.h*2}px)</p>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex flex-col items-center" ref={containerRef}>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#002776]" />
            <p className="text-sm">Carregando foto...</p>
          </div>
        ) : (
          <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `${(fmt.h * scale) - fmt.h}px`,
          }}>
            <div
              data-template
              style={{ width: fmt.w, height: fmt.h, overflow: 'hidden', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
