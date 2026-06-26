import { PwaInstallBanner } from './pwa-banner'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-root">
      {/* Painel esquerdo com identidade visual — só desktop */}
      <div className="auth-left" style={{ background: 'linear-gradient(160deg, #002776, #009C3B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#FFFFFF', textAlign: 'center', padding: '2rem' }}>
          <img src="/logo-eleicoes.png" alt="SyncroFlowEleições" style={{ height: 64, marginBottom: '1.5rem' }} />
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FFDF00' }}>
            Tecnologia a serviço da democracia
          </p>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          {/* Logo visível só no mobile */}
          <div className="auth-mobile-logo">
            <img src="/logo-eleicoes.png" alt="SyncroFlowEleições" style={{ height: 40 }} />
          </div>
          {children}
          <PwaInstallBanner />
        </div>
      </div>
    </div>
  )
}
