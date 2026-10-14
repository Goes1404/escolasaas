/**
 * Monitoramento de erros do servidor (Next 15: `onRequestError`).
 *
 * Toda exceção não tratada em rota de API, página renderizada no servidor,
 * server action ou middleware cai aqui e vira uma linha estruturada nos logs
 * da Vercel (Projeto › Logs, filtre por `server.request_error`). Os erros do
 * navegador vão para a telemetria (Admin › Uso › "O que está falhando") e,
 * para quem não está logado, para `/api/client-error` — que também loga aqui.
 *
 * Sem PII: só rota, método, tipo de rota e a mensagem/stack do erro (o logger
 * já remove campos sensíveis). Nada de corpo da requisição nem cookies.
 */
export async function register() {
  // Nada a inicializar: o logger é estático.
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[] | undefined> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  try {
    const { log } = await import('@/lib/logger');
    const e = err as Error & { digest?: string };
    log.error('server.request_error', e, {
      path: request.path?.split('?')[0],
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      digest: e?.digest,
      requestId: request.headers?.['x-request-id'],
    });
  } catch {
    // Monitoramento nunca derruba a requisição.
  }
}
