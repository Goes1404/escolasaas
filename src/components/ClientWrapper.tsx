'use client';

import { usePathname } from 'next/navigation';
import { AccessibilityWidget } from './AccessibilityWidget';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthOrHome = ['/', '/login', '/register'].includes(pathname || '');

  // Sem fade de opacity no wrapper global: ele envolvia TODA página e segurava
  // o conteúdo (inclusive o elemento LCP) em opacity:0 por 700ms a cada
  // navegação — era a causa raiz do render delay de ~820ms medido no /login.
  // O paint agora é imediato em toda rota.
  return (
    <div className="w-full min-h-screen">
      {children}
      {!isAuthOrHome && <AccessibilityWidget />}
    </div>
  );
}
