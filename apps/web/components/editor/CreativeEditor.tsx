'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Download, ChevronUp, ChevronDown } from 'lucide-react'

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
type Format = 'santinho' | 'story' | 'banner'

const FORMATS: Record<Format, { label: string; w: number; h: number }> = {
  santinho: { label: 'Santinho (A5)', w: 420, h: 594 },
  story:    { label: 'Story (9:16)',  w: 405, h: 720 },
  banner:   { label: 'Banner (16:9)', w: 720, h: 405 },
}

interface Props {
  name?: string | null
  number?: string | null
  position?: string | null
  party?: string | null
  photo?: string | null
  city?: string | null
  state?: string | null
  slogan?: string | null
  onExport?: (dataUrl: string, filename: string) => void
}

/* ─── Paletas de cores ───────────────────────────────────────────────────── */
const PALETTES = [
  { key: 'brasil',   label: 'Brasil',   bg1: '#002776', bg2: '#001a55', accent: '#FFDF00', text: '#FFFFFF', sub: '#FFDF00',   numBg: '#FFDF00',   numTxt: '#002776' },
  { key: 'verde',    label: 'Vitória',  bg1: '#005c20', bg2: '#003d15', accent: '#7dff6b', text: '#FFFFFF', sub: '#7dff6b',   numBg: '#7dff6b',   numTxt: '#003d15' },
  { key: 'dourado',  label: 'Dourado',  bg1: '#1a0a00', bg2: '#3d1f00', accent: '#f5a623', text: '#FFFFFF', sub: '#f5d070',   numBg: '#f5a623',   numTxt: '#1a0a00' },
  { key: 'vermelho', label: 'Força',    bg1: '#5c0000', bg2: '#8b0000', accent: '#ff4444', text: '#FFFFFF', sub: '#ffaaaa',   numBg: '#ff4444',   numTxt: '#FFFFFF' },
  { key: 'roxo',     label: 'Noturno',  bg1: '#0d0022', bg2: '#1e0044', accent: '#a855f7', text: '#FFFFFF', sub: '#d8b4fe',   numBg: '#a855f7',   numTxt: '#FFFFFF' },
  { key: 'branco',   label: 'Limpo',    bg1: '#f0f4ff', bg2: '#dde8ff', accent: '#002776', text: '#002776', sub: '#003d99',   numBg: '#002776',   numTxt: '#FFFFFF' },
]

type Palette = typeof PALETTES[0]

/* ─── Gerador HTML ───────────────────────────────────────────────────────── */
function buildHTML(
  fmt: { w: number; h: number },
  pal: Palette,
  photo: string | null,
  name: string,
  number: string,
  position: string,
  party: string,
  slogan: string,
  location: string,
  photoY: number, // 0-100 (posição vertical da foto)
  showNumber: boolean,
): string {
  const { w, h } = fmt
  const isLandscape = w > h

  const photoEl = photo
    ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;object-position:center ${photoY}%;display:block;" />`
    : `<div style="width:100%;height:100%;background:#bbb;display:flex;align-items:center;justify-content:center;">
         <svg width="60" height="60" viewBox="0 0 24 24" fill="#888"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
       </div>`

  if (!isLandscape) {
    /* ── VERTICAL ─────────────────────────────────────────────────────── */
    const topBarH  = Math.round(h * 0.07)
    const photoH   = Math.round(h * 0.50)
    const infoTop  = topBarH + photoH
    const infoH    = h - infoTop
    const fs = {
      vote:     Math.round(h * 0.028),
      name:     Math.round(w * 0.075),
      sub:      Math.round(w * 0.036),
      slogan:   Math.round(w * 0.040),
      num:      Math.round(w * 0.110),
      loc:      Math.round(w * 0.030),
    }

    return `<div style="width:${w}px;height:${h}px;background:linear-gradient(180deg,${pal.bg1} 0%,${pal.bg2} 100%);position:relative;overflow:hidden;font-family:Arial,sans-serif;">

  <!-- Círculos BG -->
  <div style="position:absolute;width:${w*1.2}px;height:${w*1.2}px;border-radius:50%;background:${pal.accent};opacity:0.04;top:-${w*0.4}px;right:-${w*0.4}px;"></div>
  <div style="position:absolute;width:${w*0.8}px;height:${w*0.8}px;border-radius:50%;background:${pal.accent};opacity:0.04;bottom:-${w*0.2}px;left:-${w*0.2}px;"></div>

  <!-- Barra topo: VOTE -->
  <div style="position:absolute;top:0;left:0;right:0;height:${topBarH}px;background:${pal.accent};display:flex;align-items:center;justify-content:center;z-index:5;">
    <span style="font-size:${fs.vote}px;font-weight:900;color:${pal.numTxt};letter-spacing:4px;font-family:'Arial Black',Arial,sans-serif;">▶ VOTE ${number} ◀</span>
  </div>

  <!-- Foto -->
  <div style="position:absolute;top:${topBarH}px;left:0;right:0;height:${photoH}px;overflow:hidden;">
    ${photoEl}
    <!-- gradiente inferior sobre a foto -->
    <div style="position:absolute;bottom:0;left:0;right:0;height:${Math.round(photoH*0.45)}px;background:linear-gradient(transparent,${pal.bg1});"></div>
  </div>

  <!-- Linha divisória accent -->
  <div style="position:absolute;top:${infoTop-3}px;left:0;right:0;height:4px;background:linear-gradient(90deg,transparent,${pal.accent},transparent);z-index:5;"></div>

  <!-- Bloco info -->
  <div style="position:absolute;top:${infoTop}px;left:0;right:0;height:${infoH}px;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;padding:${Math.round(infoH*0.04)}px ${Math.round(w*0.04)}px ${Math.round(infoH*0.05)}px;box-sizing:border-box;">

    <!-- Nome -->
    <div style="text-align:center;line-height:1.05;">
      <div style="font-size:${fs.name}px;font-weight:900;color:${pal.text};letter-spacing:0.5px;font-family:'Arial Black',Arial,sans-serif;text-shadow:0 2px 6px rgba(0,0,0,0.5);">${name}</div>
      <div style="font-size:${fs.sub}px;font-weight:700;color:${pal.sub};letter-spacing:2px;margin-top:3px;font-family:Arial,sans-serif;">${position}${party ? ' · ' + party : ''}</div>
      ${location ? `<div style="font-size:${fs.loc}px;color:${pal.text};opacity:0.6;margin-top:2px;">📍 ${location}</div>` : ''}
    </div>

    <!-- Slogan -->
    <div style="text-align:center;border-top:2px solid ${pal.accent};border-bottom:2px solid ${pal.accent};padding:${Math.round(infoH*0.04)}px ${Math.round(w*0.04)}px;width:90%;box-sizing:border-box;">
      <div style="font-size:${fs.slogan}px;font-weight:700;font-style:italic;color:${pal.text};line-height:1.25;font-family:Arial,sans-serif;">"${slogan}"</div>
    </div>

    <!-- Número grande -->
    ${showNumber ? `<div style="background:${pal.numBg};color:${pal.numTxt};font-size:${fs.num}px;font-weight:900;padding:${Math.round(infoH*0.025)}px ${Math.round(w*0.08)}px;border-radius:8px;letter-spacing:5px;font-family:'Arial Black',Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.35);">${number}</div>` : ''}

  </div>
</div>`

  } else {
    /* ── BANNER 16:9 ─────────────────────────────────────────────────── */
    const photoW = Math.round(w * 0.40)
    const fs = {
      name:   Math.round(h * 0.115),
      sub:    Math.round(h * 0.058),
      slogan: Math.round(h * 0.058),
      num:    Math.round(h * 0.165),
      loc:    Math.round(h * 0.042),
      vote:   Math.round(h * 0.045),
    }

    return `<div style="width:${w}px;height:${h}px;background:linear-gradient(135deg,${pal.bg1} 0%,${pal.bg2} 100%);position:relative;overflow:hidden;font-family:Arial,sans-serif;display:flex;">

  <!-- Foto esquerda -->
  <div style="width:${photoW}px;height:${h}px;flex-shrink:0;position:relative;overflow:hidden;">
    ${photoEl}
    <div style="position:absolute;top:0;right:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,${pal.bg1});"></div>
  </div>

  <!-- Barra vertical accent -->
  <div style="width:5px;background:${pal.accent};flex-shrink:0;"></div>

  <!-- Conteúdo direita -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:${Math.round(h*0.07)}px ${Math.round(h*0.07)}px;box-sizing:border-box;gap:${Math.round(h*0.02)}px;">
    <div style="font-size:${fs.sub}px;font-weight:700;color:${pal.sub};letter-spacing:3px;font-family:Arial,sans-serif;">${party} · ${position}</div>
    <div style="font-size:${fs.name}px;font-weight:900;color:${pal.text};line-height:1;font-family:'Arial Black',Arial,sans-serif;text-shadow:0 2px 8px rgba(0,0,0,0.4);">${name}</div>
    <div style="font-size:${fs.slogan}px;font-weight:600;font-style:italic;color:${pal.text};opacity:0.85;font-family:Arial,sans-serif;">"${slogan}"</div>
    ${location ? `<div style="font-size:${fs.loc}px;color:${pal.text};opacity:0.55;">📍 ${location}</div>` : ''}
    <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
      <div style="height:3px;width:30px;background:${pal.accent};border-radius:2px;"></div>
      ${showNumber ? `<div style="background:${pal.numBg};color:${pal.numTxt};font-size:${fs.num}px;font-weight:900;padding:4px 20px;border-radius:8px;letter-spacing:4px;font-family:'Arial Black',Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.3);">${number}</div>` : ''}
      <div style="height:3px;flex:1;background:${pal.accent};opacity:0.3;border-radius:2px;"></div>
    </div>
  </div>

  <!-- Faixas topo/rodapé -->
  <div style="position:absolute;top:0;left:0;right:0;height:5px;background:${pal.accent};"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:5px;background:${pal.accent};"></div>
</div>`
  }
}

/* ─── Componente ─────────────────────────────────────────────────────────── */
export default function CreativeEditor({ name, number, position, party, photo, city, state, slogan: sloganProp, onExport }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Estado dos controles
  const [format,     setFormat]     = useState<Format>('santinho')
  const [palIdx,     setPalIdx]     = useState(0)
  const [slogan,     setSlogan]     = useState(sloganProp || 'Sua voz, nossa força!')
  const [nameEdit,   setNameEdit]   = useState(name || '')
  const [numEdit,    setNumEdit]    = useState(number || '')
  const [posEdit,    setPosEdit]    = useState(position || '')
  const [partyEdit,  setPartyEdit]  = useState(party || '')
  const [locEdit,    setLocEdit]    = useState([city, state].filter(Boolean).join(' - '))
  const [photoY,     setPhotoY]     = useState(30) // 0=topo 100=baixo
  const [showNum,    setShowNum]    = useState(true)
  const [photoB64,   setPhotoB64]   = useState<string | null>(null)
  const [loadingPhoto, setLoadingPhoto] = useState(false)
  const [exporting,  setExporting]  = useState(false)
  const [html,       setHtml]       = useState('')

  // Atualiza campos quando props mudam
  useEffect(() => { setNameEdit(name || '') },     [name])
  useEffect(() => { setNumEdit(number || '') },    [number])
  useEffect(() => { setPosEdit(position || '') },  [position])
  useEffect(() => { setPartyEdit(party || '') },   [party])
  useEffect(() => { setLocEdit([city, state].filter(Boolean).join(' - ')) }, [city, state])

  // Carrega foto como base64
  useEffect(() => {
    if (!photo) { setPhotoB64(null); return }
    setLoadingPhoto(true)
    const url = photo.split('?')[0]
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
      .finally(() => setLoadingPhoto(false))
  }, [photo])

  // Rebuild HTML sempre que algo muda
  useEffect(() => {
    const fmt = FORMATS[format]
    const pal = PALETTES[palIdx]
    setHtml(buildHTML(fmt, pal, photoB64, nameEdit, numEdit, posEdit, partyEdit, slogan, locEdit, photoY, showNum))
  }, [format, palIdx, photoB64, nameEdit, numEdit, posEdit, partyEdit, slogan, locEdit, photoY, showNum])

  const exportPng = useCallback(async () => {
    const el = containerRef.current?.querySelector('[data-tpl]') as HTMLElement
    if (!el) return
    setExporting(true)
    try {
      const h2c = (await import('html2canvas')).default
      const canvas = await h2c(el, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: null, logging: false,
        width: FORMATS[format].w, height: FORMATS[format].h,
      })
      const dataUrl = canvas.toDataURL('image/png')
      const filename = `criativo-${format}-${Date.now()}.png`
      if (onExport) onExport(dataUrl, filename)
      else { const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click() }
    } catch (e) { console.error(e) }
    finally { setExporting(false) }
  }, [format, onExport])

  const fmt = FORMATS[format]
  const maxW = 440
  const scale = Math.min(1, maxW / fmt.w)
  const scaledH = fmt.h * scale

  const pal = PALETTES[palIdx]

  return (
    <div className="flex flex-col xl:flex-row gap-6">

      {/* ── Painel de controles ────────────────────────────────────────── */}
      <div className="xl:w-72 shrink-0 space-y-4 text-sm">

        {/* Formato */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Formato</p>
          <div className="flex gap-2">
            {(Object.entries(FORMATS) as [Format, any][]).map(([k, v]) => (
              <button key={k} onClick={() => setFormat(k)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border-2 ${format === k ? 'bg-[#002776] text-white border-[#002776]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Paleta */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Cores</p>
          <div className="grid grid-cols-3 gap-2">
            {PALETTES.map((p, i) => (
              <button key={p.key} onClick={() => setPalIdx(i)}
                className={`h-9 rounded-lg text-xs font-bold transition-all border-2 ${palIdx === i ? 'border-gray-800 scale-105 shadow-lg' : 'border-transparent opacity-75 hover:opacity-100'}`}
                style={{ background: `linear-gradient(135deg,${p.bg1},${p.bg2})`, color: p.text }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textos editáveis */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Conteúdo</p>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 font-medium">Nome do candidato</label>
              <input value={nameEdit} onChange={e => setNameEdit(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 font-medium">Número</label>
                <input value={numEdit} onChange={e => setNumEdit(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Partido</label>
                <input value={partyEdit} onChange={e => setPartyEdit(e.target.value)}
                  className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#002776]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Cargo</label>
              <input value={posEdit} onChange={e => setPosEdit(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Cidade / Estado</label>
              <input value={locEdit} onChange={e => setLocEdit(e.target.value)}
                className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Slogan</label>
              <textarea value={slogan} onChange={e => setSlogan(e.target.value)} rows={2}
                className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#002776]" />
            </div>
          </div>
        </div>

        {/* Ajuste da foto */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Posição da foto</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setPhotoY(v => Math.max(0, v - 5))}
              className="p-1.5 rounded-lg border hover:bg-gray-100"><ChevronUp className="w-4 h-4" /></button>
            <div className="flex-1 relative h-2 bg-gray-200 rounded-full">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#002776]" style={{ width: `${photoY}%` }} />
              <input type="range" min={0} max={100} value={photoY} onChange={e => setPhotoY(+e.target.value)}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-2" />
            </div>
            <button onClick={() => setPhotoY(v => Math.min(100, v + 5))}
              className="p-1.5 rounded-lg border hover:bg-gray-100"><ChevronDown className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">
            {photoY <= 20 ? '⬆ Topo' : photoY <= 45 ? '🎯 Rosto' : photoY <= 65 ? '📍 Centro' : '⬇ Rodapé'}
          </p>
        </div>

        {/* Mostrar número */}
        <div className="flex items-center gap-3">
          <input type="checkbox" id="showNum" checked={showNum} onChange={e => setShowNum(e.target.checked)}
            className="w-4 h-4 rounded" />
          <label htmlFor="showNum" className="text-sm text-gray-700">Mostrar número grande</label>
        </div>

        {/* Exportar */}
        <div className="pt-2 border-t">
          <Button onClick={exportPng} disabled={exporting || loadingPhoto}
            className="w-full gap-2 bg-[#009C3B] hover:bg-[#007a2f] text-white font-bold">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Gerando...' : 'Exportar PNG'}
          </Button>
          <p className="text-xs text-gray-400 text-center mt-1">
            {fmt.w}×{fmt.h}px · exportado em 2× ({fmt.w * 2}×{fmt.h * 2}px)
          </p>
        </div>
      </div>

      {/* ── Preview ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center" ref={containerRef}>
        <p className="text-xs text-gray-400 mb-3">Preview em tempo real</p>
        {loadingPhoto ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#002776]" />
            <p className="text-sm">Carregando foto...</p>
          </div>
        ) : (
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', height: scaledH, marginBottom: scaledH - fmt.h }}>
            <div data-tpl
              style={{ width: fmt.w, height: fmt.h, overflow: 'hidden', borderRadius: 10, boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
