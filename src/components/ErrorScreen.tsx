'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';
import { trackFalha, normalizarRota } from '@/lib/telemetry';

/**
 * Tela única de "algo deu errado". Substitui a tela branca / "Application
 * error" do Next quando um componente quebra: o aluno vê o que aconteceu em
 * português, tenta de novo sem perder a sessão, e a falha vai para a
 * telemetria (tabela app_events, painel Admin › Uso › Falhas).
 */
export function ErrorScreen({
  error,
  reset,
  compact = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  compact?: boolean;
}) {
  useEffect(() => {
    trackFalha('tela_quebrou', error, { digest: error?.digest ?? null });
    // Também nos logs do servidor (alcança quem não está logado).
    try {
      const route = normalizarRota(window.location.pathname);
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ route, name: error?.name, message: error?.message, digest: error?.digest }),
      }).catch(() => {});
    } catch {}
  }, [error]);

  return (
    <div className={`flex items-center justify-center ${compact ? 'py-16' : 'min-h-[70vh]'} px-4`}>
      <div className="w-full max-w-md text-center anim-rise">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-brand-yellow/30 text-foreground flex items-center justify-center">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <p className="u-label mb-2">Algo saiu do lugar</p>
        <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
          Não conseguimos abrir esta tela agora
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Seus dados estão salvos. Tente de novo — se continuar, avise a coordenação
          {error?.digest ? <> informando o código <span className="font-mono text-foreground">{error.digest}</span></> : null}.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-control bg-primary text-white font-bold text-sm shadow-hard"
          >
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-control border border-border bg-card font-bold text-sm text-foreground"
          >
            <Home className="h-4 w-4" /> Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
