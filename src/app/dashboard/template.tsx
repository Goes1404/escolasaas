// O Next remonta o template a cada navegação (o layout, não): é o gancho para
// a transição entre telas sem uma linha de JS no cliente — a animação é a
// `.route-enter` do globals.css. Server component de propósito.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-enter flex-1 flex flex-col min-h-0">{children}</div>;
}
