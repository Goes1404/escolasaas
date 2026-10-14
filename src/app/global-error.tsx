'use client';

import { useEffect } from 'react';

// Último recurso: o próprio layout raiz quebrou. Sem CSS do app garantido,
// então o estilo é inline e mínimo.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.error('[global-error]', error?.digest || error?.message);
    } catch {}
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f6f7f9', color: '#0f172a' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>A plataforma não carregou</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#475569', margin: '0 0 20px' }}>
              Pode ser a conexão. Tente de novo em instantes.
              {error?.digest ? <> Código: <code>{error.digest}</code></> : null}
            </p>
            <button
              onClick={reset}
              style={{ height: 44, padding: '0 20px', borderRadius: 10, border: 0, background: '#4CCCED', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
