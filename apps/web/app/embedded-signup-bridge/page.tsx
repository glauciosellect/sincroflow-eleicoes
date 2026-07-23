'use client'
import { useEffect, useRef, useState } from 'react'

// Ponte temporária para o Embedded Signup do WhatsApp. Existe porque
// app.syncrofloweleicoes.com.br ainda não pode ser cadastrado no App da Meta
// (compartilhado com o SyncroFlow comercial, hoje em análise para Instagram/
// Facebook — evitamos qualquer alteração de configuração nele). Como
// eleicoes-connect.syncroflow.io é um subdomínio de syncroflow.io (já
// autorizado no App), o JS SDK roda aqui — sem exigir login no painel — e
// devolve o resultado por postMessage para quem abriu esta página
// (window.opener, a aba de Configurações → Canais). Remover assim que o
// Eleições tiver App Meta próprio ou o domínio puder ser adicionado.
export default function EmbeddedSignupBridge() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'waiting' | 'done' | 'error'>('loading')
  const embeddedSignupDataRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({})

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com') return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          embeddedSignupDataRef.current = { wabaId: data.data?.waba_id, phoneNumberId: data.data?.phone_number_id }
        }
      } catch {}
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    const tryStart = () => {
      if (!(window as any).FB) {
        setTimeout(tryStart, 200)
        return
      }
      setStatus('ready')
      ;(window as any).FB.login((response: any) => {
        const code = response.authResponse?.code
        if (window.opener) {
          window.opener.postMessage(
            {
              source: 'syncroflow-embedded-signup-bridge',
              code: code || null,
              ...embeddedSignupDataRef.current,
            },
            '*',
          )
        }
        setStatus(code ? 'done' : 'error')
        setTimeout(() => window.close(), code ? 800 : 3000)
      }, {
        config_id: process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      })
    }
    tryStart()
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', flexDirection: 'column', gap: 12 }}>
      {status === 'loading' && <p>Carregando conexão com a Meta...</p>}
      {status === 'ready' && <p>Abrindo autorização da Meta...</p>}
      {status === 'waiting' && <p>Concluindo conexão...</p>}
      {status === 'done' && <p>Conectado! Você já pode fechar esta janela.</p>}
      {status === 'error' && <p>Conexão cancelada ou não concluída. Pode fechar esta janela e tentar novamente.</p>}
    </div>
  )
}
