import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'SyncroFlowEleições — Assistente Virtual de Campanha',
  description: 'Plataforma de assistente virtual com IA para campanhas eleitorais. WhatsApp, e-mail e mais, em conformidade com o TSE.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SyncroFlowEleições',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Facebook JS SDK — usado pelo Embedded Signup do WhatsApp (Meta Cloud API) */}
        {META_APP_ID && (
          <>
            <Script id="facebook-jssdk-init" strategy="afterInteractive">{`
              window.fbAsyncInit = function() {
                FB.init({ appId: '${META_APP_ID}', xfbml: false, version: 'v21.0' });
              };
            `}</Script>
            <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="afterInteractive" />
          </>
        )}
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
