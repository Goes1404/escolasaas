'use client';

import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { getBichinho, type Bichinho } from '@/lib/bichinho';
import { MascoteRetrato } from '@/components/mascote/MascoteRetrato';

/**
 * O rosto da Aurora.
 *
 * Quem tem bichinho adotado passa a ver o próprio bicho no lugar do ícone
 * genérico de robô — nos três lugares onde a Aurora aparece (a lista de
 * conversas, o cabeçalho do chat e o mentor de sala de aula). É um detalhe
 * pequeno de propósito: a mentoria de IA e o bichinho já são as duas faces do
 * mesmo incentivo (estudar), e aqui elas se encontram sem precisar de texto
 * novo explicando por quê.
 *
 * Quem não tem bicho — ou ainda está carregando — continua vendo o robô. Ele
 * nunca é substituído por um estado de carregamento visível: como o bicho
 * troca o `Bot` só quando a foto está pronta, a primeira pintura da tela é
 * sempre a mesma, sem piscar.
 */
export function AuroraAvatar({ className = 'h-full w-full' }: { className?: string }) {
  const [bicho, setBicho] = useState<Bichinho | null>(null);

  useEffect(() => {
    let vivo = true;
    getBichinho().then(b => { if (vivo) setBicho(b); });
    return () => { vivo = false; };
  }, []);

  if (bicho?.existe && bicho.especie) {
    return (
      <MascoteRetrato
        especie={bicho.especie}
        nivel={bicho.nivel}
        expressao="feliz"
        className={className}
      />
    );
  }
  return <Bot className={className} />;
}
