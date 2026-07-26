import { PwaInstallBanner } from './pwa-banner'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-root">
      {/* Painel esquerdo com identidade visual — só desktop */}
      <div
        className="auth-left"
        style={{
          backgroundColor: '#002776',
          backgroundImage: 'url(/capa-entrada.png)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      />

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
