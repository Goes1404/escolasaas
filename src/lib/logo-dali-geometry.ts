/**
 * Geometria do símbolo do Dalí — fonte única.
 *
 * O desenho vive aqui, e não dentro do componente, porque ele é consumido em
 * dois lugares que não se falam: o `LogoDali` em React (nav, preloader, rodapé)
 * e o `scripts/gen-icons.ts`, que rasteriza os PNGs do PWA com sharp. Quando as
 * duas cópias existiam, bastava ajustar o traço num lado para o ícone da tela de
 * início do celular ficar diferente do logo do site — e ninguém percebe isso até
 * um aluno instalar o app.
 *
 * Sistema de coordenadas: viewBox 0 0 64 64.
 */

/** O corpo da letra. `fill-rule="evenodd"` é o que abre o buraco do "D". */
export const PATH_D =
  'M12 10h20c12.7 0 22 8.9 22 20s-9.3 20-22 20H12V10Zm11 10v20h9c6.6 0 11-4.5 11-10s-4.4-10-11-10h-9Z';

/** O pingo que escorre da base, ainda preso à letra. */
export const PATH_DRIP =
  'M26 44c0 6 .6 13 1.8 16.2.8 2.2 3.6 2.2 4.4 0C33.4 57 34 50 34 44v-2H26v2Z';

/** A gota já solta: é ela que diz "isto derrete" quando o logo é minúsculo. */
export const DROP = { cx: 47, cy: 57, rx: 3, ry: 3.8 } as const;

/**
 * Centro real do desenho (ocupa x 12→54, y 10→60.8). Não é 32,32 — quem
 * centraliza o símbolo num quadro precisa corrigir esse desvio, senão ele
 * nasce encostado à esquerda e alto.
 */
export const MARK_CENTER = { x: 33, y: 35.4 } as const;
