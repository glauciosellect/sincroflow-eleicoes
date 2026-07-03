'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Download, ChevronUp, ChevronDown, Upload, X } from 'lucide-react'

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

interface Colors {
  bg1: string; bg2: string; accent: string
  text: string; sub: string; numBg: string; numTxt: string
}

/* ─── Paletas base ───────────────────────────────────────────────────────── */
const PALETTES: Array<{ key: string; label: string } & Colors> = [
  { key: 'brasil',   label: 'Brasil',   bg1: '#002776', bg2: '#001a55', accent: '#FFDF00', text: '#FFFFFF', sub: '#FFDF00', numBg: '#FFDF00', numTxt: '#002776' },
  { key: 'verde',    label: 'Vitória',  bg1: '#005c20', bg2: '#003d15', accent: '#7dff6b', text: '#FFFFFF', sub: '#7dff6b', numBg: '#7dff6b', numTxt: '#003d15' },
  { key: 'dourado',  label: 'Dourado',  bg1: '#1a0a00', bg2: '#3d1f00', accent: '#f5a623', text: '#FFFFFF', sub: '#f5d070', numBg: '#f5a623', numTxt: '#1a0a00' },
  { key: 'forca',    label: 'Força',    bg1: '#5c0000', bg2: '#8b0000', accent: '#ff4444', text: '#FFFFFF', sub: '#ffaaaa', numBg: '#ff4444', numTxt: '#FFFFFF' },
  { key: 'noturno',  label: 'Noturno',  bg1: '#0d0022', bg2: '#1e0044', accent: '#a855f7', text: '#FFFFFF', sub: '#d8b4fe', numBg: '#a855f7', numTxt: '#FFFFFF' },
  { key: 'limpo',    label: 'Limpo',    bg1: '#f0f4ff', bg2: '#dde8ff', accent: '#002776', text: '#002776', sub: '#003d99', numBg: '#002776', numTxt: '#FFFFFF' },
]

/* ─── Gerador HTML ───────────────────────────────────────────────────────── */
function buildHTML(
  fmt: { w: number; h: number },
  c: Colors,
  photo: string | null,    // foto do candidato (sempre sobreposta)
  aiBg: string | null,     // fundo gerado por IA (fica ATRÁS de tudo)
  name: string,
  number: string,
  position: string,
  party: string,
  slogan: string,
  location: string,
  photoY: number,
  showNumber: boolean,
): string {
  const { w, h } = fmt
  const isLandscape = w > h

  const safePhoto = photo ? photo.replace(/"/g, '&quot;') : null
  const safeAiBg  = aiBg  ? aiBg.replace(/"/g, '&quot;')  : null

  // Fundo: imagem IA se disponível, senão gradiente de cor
  const bgStyle = safeAiBg
    ? `background:url("${safeAiBg}") center/cover no-repeat;`
    : `background:linear-gradient(180deg,${c.bg1} 0%,${c.bg2} 100%);`

  // Overlay escuro sobre fundo IA para garantir legibilidade do texto
  const aiBgOverlay = safeAiBg
    ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.45) 0%,rgba(0,0,0,0.65) 100%);pointer-events:none;z-index:1;"></div>`
    : ''

  const photoEl = safePhoto
    ? `<img src="${safePhoto}" style="width:100%;height:100%;object-fit:cover;object-position:center ${photoY}%;display:block;" crossorigin="anonymous" />`
    : `<div style="width:100%;height:100%;background:rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;">
         <svg width="48" height="48" viewBox="0 0 24 24" fill="#fff" opacity="0.5"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
         <span style="color:white;font-size:11px;opacity:0.6;font-family:Arial;">Sem foto</span>
       </div>`

  const sloganHtml = slogan.replace(/\n/g, '<br>')

  if (!isLandscape) {
    /* ── VERTICAL (santinho / story) ──────────────────────────────── */
    const topBarH = Math.round(h * 0.075)
    const photoH  = Math.round(h * 0.48)
    const infoTop = topBarH + photoH
    const infoH   = h - infoTop
    const fs = {
      vote:   Math.round(h * 0.028),
      name:   Math.round(w * 0.072),
      sub:    Math.round(w * 0.033),
      slogan: Math.round(w * 0.037),
      num:    Math.round(w * 0.105),
      loc:    Math.round(w * 0.028),
    }
    const pad = Math.round(w * 0.05)
    // Cor da área inferior: transparente se tiver fundo IA (overlay já escurece), cor sólida senão
    const infoBg = safeAiBg ? 'background:transparent;' : ''

    return `<div style="width:${w}px;height:${h}px;${bgStyle}position:relative;overflow:hidden;font-family:Arial,sans-serif;box-sizing:border-box;">

  ${aiBgOverlay}

  <!-- Decoração (só sem fundo IA) -->
  ${!safeAiBg ? `
  <div style="position:absolute;width:${w*1.3}px;height:${w*1.3}px;border-radius:50%;background:${c.accent};opacity:0.05;top:-${w*0.45}px;right:-${w*0.45}px;pointer-events:none;z-index:0;"></div>
  <div style="position:absolute;width:${w*0.9}px;height:${w*0.9}px;border-radius:50%;background:${c.accent};opacity:0.04;bottom:-${w*0.25}px;left:-${w*0.25}px;pointer-events:none;z-index:0;"></div>` : ''}

  <!-- Barra topo com número -->
  <div style="position:absolute;top:0;left:0;right:0;height:${topBarH}px;background:${c.accent};display:flex;align-items:center;justify-content:center;z-index:10;">
    <span style="font-size:${fs.vote}px;font-weight:900;color:${c.numTxt};letter-spacing:5px;font-family:'Arial Black',Arial,sans-serif;">▶ VOTE ${number} ◀</span>
  </div>

  <!-- Foto do candidato -->
  <div style="position:absolute;top:${topBarH}px;left:0;right:0;height:${photoH}px;overflow:hidden;z-index:2;">
    ${photoEl}
    <div style="position:absolute;bottom:0;left:0;right:0;height:${Math.round(photoH*0.5)}px;background:linear-gradient(transparent,${safeAiBg ? 'rgba(0,0,0,0.8)' : c.bg1});pointer-events:none;"></div>
  </div>

  <!-- Divisor brilhante -->
  <div style="position:absolute;top:${infoTop-2}px;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent 0%,${c.accent} 30%,${c.accent} 70%,transparent 100%);z-index:5;"></div>

  <!-- Bloco de informações -->
  <div style="position:absolute;top:${infoTop+4}px;left:0;right:0;bottom:0;${infoBg}display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;padding:${Math.round(infoH*0.03)}px ${pad}px ${Math.round(infoH*0.04)}px;box-sizing:border-box;gap:${Math.round(infoH*0.02)}px;z-index:5;">

    <div style="text-align:center;line-height:1.05;width:100%;">
      <div style="font-size:${fs.name}px;font-weight:900;color:${c.text};letter-spacing:0.3px;font-family:'Arial Black',Arial,sans-serif;text-shadow:0 2px 8px rgba(0,0,0,0.7);word-break:break-word;">${name}</div>
      <div style="font-size:${fs.sub}px;font-weight:700;color:${c.sub};letter-spacing:2px;margin-top:4px;font-family:Arial,sans-serif;text-transform:uppercase;text-shadow:0 1px 4px rgba(0,0,0,0.5);">${position}${party ? ' · ' + party : ''}</div>
      ${location ? `<div style="font-size:${fs.loc}px;color:${c.text};opacity:0.7;margin-top:3px;font-family:Arial,sans-serif;">📍 ${location}</div>` : ''}
    </div>

    <div style="text-align:center;border-top:2px solid ${c.accent};border-bottom:2px solid ${c.accent};padding:${Math.round(infoH*0.035)}px ${pad}px;width:88%;box-sizing:border-box;">
      <div style="font-size:${fs.slogan}px;font-weight:700;font-style:italic;color:${c.text};line-height:1.3;font-family:Arial,sans-serif;text-shadow:0 1px 4px rgba(0,0,0,0.5);">"${sloganHtml}"</div>
    </div>

    ${showNumber ? `<div style="background:${c.numBg};color:${c.numTxt};font-size:${fs.num}px;font-weight:900;padding:${Math.round(infoH*0.022)}px ${Math.round(w*0.07)}px;border-radius:10px;letter-spacing:6px;font-family:'Arial Black',Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.5);">${number}</div>` : ''}

  </div>
</div>`

  } else {
    /* ── BANNER 16:9 ──────────────────────────────────────────────── */
    const photoW = Math.round(w * 0.42)
    const fs = {
      party:  Math.round(h * 0.052),
      name:   Math.round(h * 0.105),
      slogan: Math.round(h * 0.052),
      num:    Math.round(h * 0.155),
      loc:    Math.round(h * 0.040),
    }
    const padH = Math.round(h * 0.07)
    const padV = Math.round(h * 0.06)
    const bannerBg = safeAiBg
      ? `background:url("${safeAiBg}") center/cover no-repeat;`
      : `background:linear-gradient(135deg,${c.bg1} 0%,${c.bg2} 100%);`

    return `<div style="width:${w}px;height:${h}px;${bannerBg}position:relative;overflow:hidden;font-family:Arial,sans-serif;display:flex;align-items:stretch;">

  ${safeAiBg ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);z-index:1;pointer-events:none;"></div>` : ''}
  ${!safeAiBg ? `<div style="position:absolute;width:${h*1.2}px;height:${h*1.2}px;border-radius:50%;background:${c.accent};opacity:0.04;top:-${h*0.4}px;right:${photoW - h*0.2}px;pointer-events:none;"></div>` : ''}

  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:${c.accent};z-index:10;"></div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:${c.accent};z-index:10;"></div>

  <!-- Foto candidato esquerda -->
  <div style="width:${photoW}px;flex-shrink:0;position:relative;overflow:hidden;z-index:2;">
    ${photoEl}
    <div style="position:absolute;top:0;right:0;bottom:0;width:50%;background:linear-gradient(90deg,transparent,${safeAiBg ? 'rgba(0,0,0,0.7)' : c.bg1});pointer-events:none;"></div>
  </div>

  <div style="width:4px;background:${c.accent};flex-shrink:0;z-index:2;"></div>

  <!-- Conteúdo texto -->
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:${padV}px ${padH}px;box-sizing:border-box;gap:${Math.round(h*0.018)}px;overflow:hidden;position:relative;z-index:2;">
    <div style="font-size:${fs.party}px;font-weight:700;color:${c.sub};letter-spacing:3px;font-family:Arial,sans-serif;text-transform:uppercase;text-shadow:0 1px 4px rgba(0,0,0,0.5);">${party}${party && position ? ' · ' : ''}${position}</div>
    <div style="font-size:${fs.name}px;font-weight:900;color:${c.text};line-height:1.0;font-family:'Arial Black',Arial,sans-serif;text-shadow:0 2px 10px rgba(0,0,0,0.6);word-break:break-word;">${name}</div>
    <div style="font-size:${fs.slogan}px;font-weight:600;font-style:italic;color:${c.text};opacity:0.9;font-family:Arial,sans-serif;line-height:1.25;text-shadow:0 1px 4px rgba(0,0,0,0.5);">"${sloganHtml}"</div>
    ${location ? `<div style="font-size:${fs.loc}px;color:${c.text};opacity:0.6;font-family:Arial,sans-serif;">📍 ${location}</div>` : ''}
    <div style="display:flex;align-items:center;gap:10px;margin-top:${Math.round(h*0.01)}px;">
      <div style="height:3px;width:24px;background:${c.accent};border-radius:2px;flex-shrink:0;"></div>
      ${showNumber ? `<div style="background:${c.numBg};color:${c.numTxt};font-size:${fs.num}px;font-weight:900;padding:3px 18px;border-radius:8px;letter-spacing:5px;font-family:'Arial Black',Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.4);">${number}</div>` : ''}
      <div style="height:3px;flex:1;background:${c.accent};opacity:0.3;border-radius:2px;"></div>
    </div>
  </div>
</div>`
  }
}

/* ─── Componente ─────────────────────────────────────────────────────────── */
export default function CreativeEditor({ name, number, position, party, photo, city, state, slogan: sloganProp, onExport }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)

  // Formato e visual
  const [format,    setFormat]    = useState<Format>('santinho')
  const [colors,    setColors]    = useState<Colors>({ ...PALETTES[0] })
  const [palIdx,    setPalIdx]    = useState(0)

  // Conteúdo editável
  const [nameEdit,  setNameEdit]  = useState(name || '')
  const [numEdit,   setNumEdit]   = useState(number || '')
  const [posEdit,   setPosEdit]   = useState(position || '')
  const [partyEdit, setPartyEdit] = useState(party || '')
  const [locEdit,   setLocEdit]   = useState([city, state].filter(Boolean).join(' - '))
  const [slogan,    setSlogan]    = useState(sloganProp || 'Sua voz, nossa força!')
  const [photoY,    setPhotoY]    = useState(30)
  const [showNum,   setShowNum]   = useState(true)

  // Foto
  const [photoB64,      setPhotoB64]      = useState<string | null>(null)
  const [uploadedB64,   setUploadedB64]   = useState<string | null>(null) // foto local enviada
  const [loadingPhoto,  setLoadingPhoto]  = useState(false)

  // UI
  const [exporting,     setExporting]     = useState(false)
  const [showColors,    setShowColors]    = useState(false)
  const [html,          setHtml]          = useState('')

  // Sync props → estado
  useEffect(() => { setNameEdit(name || '') },   [name])
  useEffect(() => { setNumEdit(number || '') },  [number])
  useEffect(() => { setPosEdit(position || '') }, [position])
  useEffect(() => { setPartyEdit(party || '') }, [party])
  useEffect(() => { setLocEdit([city, state].filter(Boolean).join(' - ')) }, [city, state])
  useEffect(() => { if (sloganProp) setSlogan(sloganProp) }, [sloganProp])

  // Carrega foto do perfil como base64 (evita CORS)
  useEffect(() => {
    if (!photo || uploadedB64) return
    setLoadingPhoto(true)
    const url = photo.split('?')[0]
    fetch(url)
      .then(r => r.blob())
      .then(blob => new Promise<string>((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob)
      }))
      .then(b64 => setPhotoB64(b64))
      .catch(() => setPhotoB64(null))
      .finally(() => setLoadingPhoto(false))
  }, [photo, uploadedB64])

  // Upload de foto local
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fr = new FileReader()
    fr.onload = () => {
      setUploadedB64(fr.result as string)
      setPhotoB64(fr.result as string)
    }
    fr.readAsDataURL(file)
    e.target.value = ''
  }

  const clearUploadedPhoto = () => {
    setUploadedB64(null)
    // volta para foto do perfil se existir
    if (photo) {
      const url = photo.split('?')[0]
      fetch(url).then(r => r.blob()).then(blob => new Promise<string>((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob)
      })).then(b64 => setPhotoB64(b64)).catch(() => setPhotoB64(null))
    } else {
      setPhotoB64(null)
    }
  }

  // Aplica paleta base
  const applyPalette = (idx: number) => {
    setPalIdx(idx)
    setColors({ ...PALETTES[idx] })
  }


  // Rebuild HTML — foto e fundo IA sempre separados
  useEffect(() => {
    const fmt = FORMATS[format]
    setHtml(buildHTML(fmt, colors, photoB64, null, nameEdit, numEdit, posEdit, partyEdit, slogan, locEdit, photoY, showNum))
  }, [format, colors, photoB64, nameEdit, numEdit, posEdit, partyEdit, slogan, locEdit, photoY, showNum])

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
  // preview: cabe na coluna direita, máximo 460px de largura
  const maxPreviewW = 460
  const scale = Math.min(1, maxPreviewW / fmt.w)
  const scaledW = fmt.w * scale
  const scaledH = fmt.h * scale

  const ColorPicker = ({ label, field }: { label: string; field: keyof Colors }) => (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-20 shrink-0">{label}</label>
      <div className="relative flex items-center gap-1.5 flex-1">
        <input type="color" value={colors[field]}
          onChange={e => setColors(prev => ({ ...prev, [field]: e.target.value }))}
          className="w-8 h-7 rounded cursor-pointer border border-gray-200 p-0.5" />
        <span className="text-xs font-mono text-gray-500">{colors[field]}</span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col xl:flex-row gap-6">

      {/* ── Painel de controles ──────────────────────────────────────── */}
      <div className="xl:w-72 shrink-0 space-y-4 text-sm overflow-y-auto max-h-[80vh] pr-1">

        {/* Formato */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Formato</p>
          <div className="flex gap-1.5">
            {(Object.entries(FORMATS) as [Format, any][]).map(([k, v]) => (
              <button key={k} onClick={() => setFormat(k)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all border-2 leading-tight px-1 ${format === k ? 'bg-[#002776] text-white border-[#002776]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Foto */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Foto</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#002776] hover:bg-[#002776]/5 transition-all text-xs font-medium text-gray-600">
              <Upload className="w-3.5 h-3.5" />
              {uploadedB64 ? 'Trocar foto' : 'Carregar foto'}
            </button>
            {uploadedB64 && (
              <button onClick={clearUploadedPhoto}
                className="px-3 py-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-500 text-xs font-medium flex items-center gap-1">
                <X className="w-3.5 h-3.5" />
                Remover
              </button>
            )}
          </div>
          {uploadedB64 && (
            <p className="text-[10px] text-green-600 mt-1">✓ Foto personalizada carregada</p>
          )}
          {!uploadedB64 && photo && (
            <p className="text-[10px] text-gray-400 mt-1">Usando foto do perfil · <button className="underline" onClick={() => fileInputRef.current?.click()}>usar outra</button></p>
          )}
        </div>

        {/* Cores */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cores</p>
            <button onClick={() => setShowColors(v => !v)}
              className="text-[10px] text-[#002776] font-semibold hover:underline">
              {showColors ? 'Paletas ↑' : 'Personalizar ↓'}
            </button>
          </div>

          {/* Paletas rápidas */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {PALETTES.map((p, i) => (
              <button key={p.key} onClick={() => applyPalette(i)}
                className={`h-8 rounded-lg text-[11px] font-bold transition-all border-2 ${palIdx === i && !showColors ? 'border-gray-800 scale-105 shadow-md' : 'border-transparent opacity-75 hover:opacity-100 hover:scale-105'}`}
                style={{ background: `linear-gradient(135deg,${p.bg1},${p.bg2})`, color: p.text }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Color pickers por elemento */}
          {showColors && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ajuste fino</p>
              <ColorPicker label="Fundo topo"   field="bg1" />
              <ColorPicker label="Fundo base"   field="bg2" />
              <ColorPicker label="Destaque"     field="accent" />
              <ColorPicker label="Texto"        field="text" />
              <ColorPicker label="Subtítulo"    field="sub" />
              <ColorPicker label="Nº fundo"     field="numBg" />
              <ColorPicker label="Nº texto"     field="numTxt" />
            </div>
          )}
        </div>

        {/* Conteúdo */}
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
              <label className="text-xs text-gray-500 font-medium">Slogan / Mensagem <span className="text-gray-300">(Enter = nova linha)</span></label>
              <textarea
                value={slogan}
                onChange={e => setSlogan(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-1.5 text-sm mt-0.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#002776] font-sans"
                placeholder="Sua mensagem aqui&#10;Pode usar Enter para nova linha"
              />
            </div>
          </div>
        </div>

        {/* Posição da foto */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Posição da foto</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPhotoY(v => Math.max(0, v - 5))}
              className="p-1.5 rounded-lg border hover:bg-gray-100 shrink-0"><ChevronUp className="w-3.5 h-3.5" /></button>
            <div className="flex-1 relative h-2 bg-gray-200 rounded-full">
              <div className="absolute inset-y-0 left-0 rounded-full bg-[#002776]" style={{ width: `${photoY}%` }} />
              <input type="range" min={0} max={100} value={photoY} onChange={e => setPhotoY(+e.target.value)}
                className="absolute inset-0 w-full opacity-0 cursor-pointer h-2" />
            </div>
            <button onClick={() => setPhotoY(v => Math.min(100, v + 5))}
              className="p-1.5 rounded-lg border hover:bg-gray-100 shrink-0"><ChevronDown className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-center">
            {photoY <= 15 ? '⬆ Topo' : photoY <= 35 ? '🎯 Rosto' : photoY <= 60 ? '📍 Busto' : '⬇ Corpo inteiro'}
          </p>
        </div>

        {/* Mostrar número */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showNum} onChange={e => setShowNum(e.target.checked)} className="w-4 h-4 rounded accent-[#002776]" />
          <span className="text-sm text-gray-700">Mostrar número grande</span>
        </label>

        {/* Exportar */}
        <div className="pt-2 border-t">
          <Button onClick={exportPng} disabled={exporting || loadingPhoto}
            className="w-full gap-2 bg-[#009C3B] hover:bg-[#007a2f] text-white font-bold py-2.5">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Gerando PNG...' : 'Exportar PNG'}
          </Button>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            {fmt.w}×{fmt.h}px · exportado em 2× ({fmt.w * 2}×{fmt.h * 2}px)
          </p>
        </div>
      </div>

      {/* ── Preview ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center min-w-0" ref={containerRef}>
        <p className="text-xs text-gray-400 mb-3">Preview em tempo real</p>
        {loadingPhoto ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#002776]" />
            <p className="text-sm">Carregando foto...</p>
          </div>
        ) : (
          /* wrapper com overflow para que o banner largo não quebre o layout */
          <div className="w-full overflow-x-auto flex justify-center">
            <div style={{
              width: scaledW,
              height: scaledH,
              flexShrink: 0,
            }}>
              <div style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: fmt.w,
                height: fmt.h,
              }}>
                <div data-tpl
                  style={{ width: fmt.w, height: fmt.h, overflow: 'hidden', borderRadius: 10, boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
