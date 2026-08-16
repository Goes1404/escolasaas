import { AuthProvider } from '@/lib/AuthProvider';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Sora } from 'next/font/google';
import { ClientWrapper } from '@/components/ClientWrapper';
import { Suspense } from 'react';
import { LoadingShell } from '@/components/LoadingShell';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/react"
import { headers } from 'next/headers';
import { TenantProvider } from '@/components/TenantProvider';
import { getTenantForHost } from '@/lib/get-tenant';

// Sora é a única fonte de fato renderizada (sempre 1ª no stack `sans`). Inter
// era carregada mas nunca pintava — removida (4 woff2 a menos). Pesos alinhados
// ao uso: 300 (light) tinha 0 usos e saiu. 800 é o mais pesado que o Sora
// oferece (não existe 900), então `font-black` sintetiza a partir dele.
const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sora',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = {
  title: 'Plataforma EAD | Sistema de Ensino para Escolas e Cursinhos',
  description: 'Plataforma de gestão educacional e aprendizado adaptativo: simulados, correção de redação com IA e mentoria para preparação de vestibulares e exames.',
  keywords: 'plataforma educacional, sistema de ensino, simulados online, correção de redação com IA',
  // manifest gerado por src/app/manifest.ts (/manifest.webmanifest). Não
  // declarar aqui também — evita <link rel="manifest"> duplicado.
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // O iPhone tira o ícone da tela de início DAQUI, não do manifesto. Sem
    // esta linha ele usa uma miniatura da página — o aluno instala e fica com
    // um retângulo borrado no lugar do logo, o que faz parecer que deu errado.
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: "Plataforma EAD",
    // Era "black-translucent": no iPhone isso faz o conteúdo subir para trás
    // da barra de status, e o topo da tela fica ilegível sobre o fundo claro.
    statusBarStyle: "default"
  }
};

export const viewport = {
  themeColor: '#1E40AF',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const tenant = await getTenantForHost(headersList.get('host'));

  return (
    <html lang="pt-BR" className={`${sora.variable} font-sans`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  if (savedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (_) {}
              })();
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    // Force immediate update check so the fixed SW (no fetch handler)
                    // replaces any broken cached SW as quickly as possible.
                    reg.update().catch(function() {});

                    // When a new SW takes control, reload once to ensure all
                    // in-flight requests go through the updated SW.
                    var reloading = false;
                    navigator.serviceWorker.addEventListener('controllerchange', function() {
                      if (!reloading) { reloading = true; window.location.reload(); }
                    });
                  }).catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-background">
        <TenantProvider initialTenant={tenant}>
          <AuthProvider>
            <Suspense fallback={<LoadingShell />}>
              <ClientWrapper>
                {children}
              </ClientWrapper>
            </Suspense>
            <Toaster />
            <SpeedInsights />
            <Analytics />
          </AuthProvider>
        </TenantProvider>
      </body>
    </html>
  );
}