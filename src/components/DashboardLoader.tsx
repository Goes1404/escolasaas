import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton de carregamento do dashboard — CSS puro (só `animate-pulse`).
 *
 * Substituiu uma versão com framer-motion que disparava 24 animações
 * simultâneas (18 partículas + 6 anéis orbitais) exatamente na janela em que
 * a thread principal precisa hidratar o app pós-login. Um skeleton com o
 * formato do conteúdo real dá melhor percepção de velocidade e não compete
 * com a hidratação pela CPU. A prop `message` é mantida por compatibilidade.
 */
export function DashboardLoader({ message }: { message?: string }) {
  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300" aria-busy="true" aria-label={message ?? "Carregando"}>
      {/* Herói */}
      <Skeleton className="h-40 w-full rounded-[2rem] md:h-48" />

      {/* Ações rápidas */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl md:h-24" />
        ))}
      </div>

      {/* Cartões de métrica */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>

      {/* Área de widgets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-[2.5rem] lg:col-span-2" />
        <Skeleton className="h-72 rounded-[2.5rem]" />
      </div>
    </div>
  );
}
