'use client';

import { ErrorScreen } from '@/components/ErrorScreen';

// Erro dentro do dashboard: o menu e o cabeçalho continuam de pé, só o
// conteúdo da tela vira a mensagem amigável.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
