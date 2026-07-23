// Página existe só para "ancorar" o domínio eleicoes-connect.syncroflow.io no App
// da Meta (campo URL da Política de Privacidade), permitindo que o JS SDK reconheça
// esse subdomínio como autorizado para o Embedded Signup — ver
// app/embedded-signup-bridge/page.tsx para o contexto completo dessa ponte.
export default function EmbeddedSignupBridgePrivacyPolicy() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
      <h1>Política de Privacidade</h1>
      <p>
        Esta página faz parte da plataforma SyncroFlowEleições. Para a Política de Privacidade
        completa, acesse{' '}
        <a href="https://www.syncrofloweleicoes.com.br/privacidade.html">
          syncrofloweleicoes.com.br/privacidade
        </a>.
      </p>
    </div>
  )
}
