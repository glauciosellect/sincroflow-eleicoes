import { PwaInstallBanner } from './pwa-banner'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-root">
      {/* Painel esquerdo com identidade visual — só desktop */}
      {/* TODO: substituir por arte/imagem oficial do SyncroFlowEleições */}
      <div className="auth-left" style={{ background: 'linear-gradient(160deg, #002776, #009C3B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>SyncroFlowEleições</h1>
          <p style={{ marginTop: '0.75rem', color: '#FFDF00', fontWeight: 500 }}>
            Tecnologia a serviço da democracia
          </p>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          {/* Logo visível só no mobile */}
          {/* TODO: substituir por logo oficial do SyncroFlowEleições */}
          <div className="auth-mobile-logo">
            <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#002776' }}>SyncroFlowEleições</span>
          </div>
          {children}
          <PwaInstallBanner />
        </div>
      </div>
    </div>
  )
}
