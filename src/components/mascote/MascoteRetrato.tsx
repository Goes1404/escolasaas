'use client';

import { arquetipo, type Arquetipo, type Expressao } from '@/lib/mascote';
import {
  Acessorio, Asas, Cabeca, Cauda, Chapeu, Corpo, Efeito, Focinho, Olhos, Orelhas,
} from './arte';
import { useImagemDoMascote } from './useImagemDoMascote';

/**
 * O bichinho parado — a arte renderizada quando existe, o vetor quando não.
 *
 * O `Mascote3D` monta nove camadas em nove SVGs e roda um rAF para girar. Isso
 * vale a pena no retrato grande, onde o aluno interage — mas a tela de adoção
 * mostra oito arquétipos de uma vez, e oito rigs seriam setenta e dois SVGs e
 * oito laços de animação disputando o mesmo frame no celular.
 *
 * Aqui é uma ilustração parada: serve para escolher, para o cartão da home e
 * para qualquer lugar onde o boneco não é brinquedo. Segue a mesma regra do
 * `Mascote` — se houver imagem em `/public/mascotes`, é ela que aparece, para o
 * aluno não escolher um desenho e receber outro.
 */
export function MascoteRetrato({
  especie, nivel = 1, expressao = 'feliz', className = '',
}: {
  especie: Arquetipo | null;
  nivel?: number;
  expressao?: Expressao;
  className?: string;
}) {
  const def = arquetipo(especie);
  const imagem = useImagemDoMascote(especie);

  if (imagem) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imagem}
        alt={def.nome}
        draggable={false}
        className={`object-contain ${className}`}
      />
    );
  }

  // Ids de gradiente precisam ser únicos por arquétipo: dois retratos na mesma
  // página compartilhariam o `<defs>` do primeiro e sairiam com a cor errada.
  const uid = `ret-${def.id}`;
  const p = def.paleta;
  const comum = { p, uid };

  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={def.nome}>
      <Cauda {...comum} variante={def.cauda} vista="frente" />
      {def.asas && <Asas {...comum} />}
      <Orelhas {...comum} variante={def.orelha} vista="frente" />
      <Corpo {...comum} vista="frente" />
      <Acessorio {...comum} vista="frente" />
      <Cabeca {...comum} vista="frente" />
      <Chapeu nivel={nivel} />
      <Olhos {...comum} expressao={expressao} />
      <Focinho {...comum} variante={def.focinho} expressao={expressao} />
      <Efeito {...comum} variante={def.efeito} />
    </svg>
  );
}
