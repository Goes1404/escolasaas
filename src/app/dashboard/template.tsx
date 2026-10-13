// O Next remonta o template a cada navegação (o layout, não): é o gancho para
// a transição entre telas sem uma linha de JS no cliente — a animação é a
// `.route-enter` do globals.css. Server component de propósito.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  // `min-w-0` nos filhos: item de flex não encolhe abaixo do próprio conteúdo,
  // e uma única linha larga (carrossel, pílula sem quebra) alargava a página
  // inteira além da tela — era o "arrastar para o lado" no celular. `w-full`
  // porque `mx-auto` desliga o stretch e o filho voltaria a medir pelo conteúdo
  // (o `max-w-*` de cada página continua limitando no desktop).
  return <div className="route-enter flex-1 flex flex-col min-h-0 min-w-0 [&>*]:min-w-0 [&>*]:w-full">{children}</div>;
}
