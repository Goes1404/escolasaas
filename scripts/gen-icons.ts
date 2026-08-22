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
import { Buffer } from 'node:buffer';
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
/**
 * Empacota PNGs num container .ico.
 *
 * O `sharp` não escreve .ico, e o formato aceita PNG embutido desde o Vista —
 * então basta montar o cabeçalho à mão. Vale o trabalho: o Next serve
 * `src/app/favicon.ico` e o declara ANTES dos outros ícones, então é ele que o
 * navegador escolhe para a aba. Um .ico velho ali anula todo o resto.
 */
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo 1 = ícone
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries: Buffer[] = [];
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 significa 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);  // cores da paleta (0 = truecolor)
    e.writeUInt8(0, 3);  // reservado
    e.writeUInt16LE(1, 4);   // planos
    e.writeUInt16LE(32, 6);  // bits por pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main() {
  await Promise.all([
    png(tile, 192, 'public/icons/icon-192.png'),
    png(tile, 512, 'public/icons/icon-512.png'),
    png(maskable, 512, 'public/icons/icon-maskable-512.png'),
    png(tile, 180, 'public/icons/apple-touch-icon.png'),
    png(badge, 96, 'public/icons/badge-96.png'),
  ]);
  // Favicon clássico: 16/32/48 no mesmo arquivo, para a aba ficar nítida em
  // qualquer densidade de tela.
  const buf = (size: number) =>
    sharp(Buffer.from(tile)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  const ico = buildIco(
    await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await buf(size) })))
  );
  writeFileSync('src/app/favicon.ico', ico);

  console.log('ícones gerados a partir de src/lib/logo-dali-geometry.ts');
}

main();
