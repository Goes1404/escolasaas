'use client';

import { useEffect, useState } from 'react';
import type { Humor } from '@/lib/bichinho';
import type { Arquetipo, EstadoAnimacao, Expressao } from '@/lib/mascote';
import type { MascoteControle } from './controle';
import { Mascote3D } from './Mascote3D';
import { MascoteRenderizado } from './MascoteRenderizado';
import { useImagemDoMascote } from './useImagemDoMascote';

/**
 * O bichinho — decide sozinho como se desenhar.
 *
 * Existe arte renderizada em `/public/mascotes/<arquetipo>.webp`? Usa a arte.
 * Não existe? Usa o rig em SVG. Quem chama não precisa saber de nada disso: os
 * dois expõem o mesmo `MascoteControle`, então a arena manda "girar" e "fazer
 * carinho" do mesmo jeito nos dois casos.
 *
 * ── A ordem importa ────────────────────────────────────────────────────────
 *
 * O vetor entra primeiro, sempre, e a imagem substitui quando termina de
 * carregar. É o contrário do intuitivo (esperar a imagem e só então desenhar),
 * e é de propósito: numa rede móvel ruim a espera seria uma arena vazia por
 * segundos, e se a imagem nunca chegar, vazia para sempre. Assim o aluno vê o
 * bichinho na hora, e ele fica mais bonito quando dá.
 */

export interface MascoteProps {
  especie: Arquetipo | null;
  nivel: number;
  expressao: Expressao;
  estado: EstadoAnimacao;
  interativo?: boolean;
  onCarinho?: (fala: string) => void;
  humorParaFala?: Humor;
  controle?: React.RefObject<MascoteControle | null>;
  className?: string;
}

export function Mascote(props: MascoteProps) {
  const imagem = useImagemDoMascote(props.especie);
  // A sondagem já provou que a imagem carrega, mas entre a prova e o `<img>` o
  // cache pode ter sido despejado. Sem esta saída, o que sobraria na tela seria
  // o ícone de imagem quebrada.
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [imagem]);

  if (!imagem || falhou) return <Mascote3D {...props} />;

  // `expressao` e `nivel` não passam adiante: a arte renderizada é uma pose só,
  // e não há camada de olho para trocar nem peça de chapéu para acrescentar. O
  // humor continua legível pela iluminação da arena, pela barra de HP e pelo
  // estado de animação — que valem para as duas implementações.
  const { especie, estado, interativo, onCarinho, humorParaFala, controle, className } = props;
  return (
    <MascoteRenderizado
      src={imagem}
      especie={especie}
      estado={estado}
      interativo={interativo}
      onCarinho={onCarinho}
      humorParaFala={humorParaFala}
      controle={controle}
      onFalha={() => setFalhou(true)}
      className={className}
    />
  );
}
