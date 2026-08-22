/**
 * Gera os ícones do Dalí (favicon, PWA, apple-touch, badge de notificação) a
 * partir da MESMA geometria que o componente React desenha.
 *
 *     npx tsx scripts/gen-icons.ts
 *
 * Rodar sempre que o traço em `src/lib/logo-dali-geometry.ts` mudar — o ícone
 * da tela de início do celular não se atualiza sozinho, e um logo diferente do
 * site parece app pirata.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { DROP, MARK_CENTER, PATH_D, PATH_DRIP } from '../src/lib/logo-dali-geometry';

const INK = '#09090f';
const PINK = '#ED3474';

/**
 * `scale` < 1 encolhe o símbolo dentro do quadro. É assim que se respeita a
 * zona segura do ícone maskable, que o Android recorta em círculo.
 */
function mark(color: string, scale = 1): string {
  const t = `translate(${32 - MARK_CENTER.x * scale} ${32 - MARK_CENTER.y * scale}) scale(${scale})`;
  return `<g transform="${t}" fill="${color}">` +
    `<path d="${PATH_D}" fill-rule="evenodd"/>` +
    `<path d="${PATH_DRIP}"/>` +
    `<ellipse cx="${DROP.cx}" cy="${DROP.cy}" rx="${DROP.rx}" ry="${DROP.ry}"/>` +
    `</g>`;
}

const svg = (inner: string, bg: string | null) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">` +
  (bg ? `<rect width="64" height="64" fill="${bg}"/>` : '') + inner + `</svg>`;

/* Símbolo solto — é o que o sidebar carrega por `tenants.branding.logoUrl`. */
writeFileSync('public/logo-dali.svg', svg(mark(PINK), null) + '\n');
/* Ladrilho com fundo — favicon vetorial do navegador. */
writeFileSync('public/icon.svg', svg(mark(PINK, 0.88), INK) + '\n');

const png = (source: string, size: number, out: string) =>
  sharp(Buffer.from(source)).resize(size, size).png({ compressionLevel: 9 }).toFile(out);

const tile = svg(mark(PINK, 0.72), INK);
const maskable = svg(mark(PINK, 0.56), INK); // zona segura do Android
const badge = svg(mark('#FFFFFF', 0.8), null); // notificação Android: só o alfa conta

// Envolto numa função porque o tsx compila este script para CJS, onde
// `await` de topo não existe.
async function main() {
  await Promise.all([
    png(tile, 192, 'public/icons/icon-192.png'),
    png(tile, 512, 'public/icons/icon-512.png'),
    png(maskable, 512, 'public/icons/icon-maskable-512.png'),
    png(tile, 180, 'public/icons/apple-touch-icon.png'),
    png(badge, 96, 'public/icons/badge-96.png'),
  ]);
  console.log('ícones gerados a partir de src/lib/logo-dali-geometry.ts');
}

main();
