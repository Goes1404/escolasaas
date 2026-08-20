/**
 * Gera os ícones do PWA a partir do logo.
 *
 *   npx tsx scripts/gerar-icones-pwa.ts
 *
 * Por que existe: em 12/08/2026, ao preparar o pedido para os alunos
 * instalarem o app, os "ícones" do projeto eram **JPEG com extensão .png**:
 *
 *   public/images/logocompromisso.png  → JPEG 428x299
 *   public/icons/icon-192x192.png      → JPEG 1024x1024 (512 KB)
 *   public/icons/icon-512x512.png      → JPEG 1024x1024 (arquivo idêntico)
 *
 * E o manifesto declarava o logo de 428x299 como se fosse 192x192 e 512x512,
 * com `type: 'image/png'`. O Chrome exige um ícone quadrado de 192px+ para
 * oferecer a instalação; um arquivo que não bate com o declarado põe o convite
 * em risco justamente na hora em que mil alunos seriam orientados a instalar.
 *
 * Regras que este script respeita:
 *  · PNG de verdade, quadrado, no tamanho anunciado;
 *  · fundo branco sólido — o logo é escuro e o iOS não lida bem com
 *    transparência, que ele preenche de preto;
 *  · versão `maskable` com o logo dentro da zona segura (círculo central de
 *    80%), senão o Android recorta as bordas do logo;
 *  · `apple-touch-icon` de 180px, que é de onde o iPhone tira o ícone da tela
 *    de início — sem ele, o iOS usa uma miniatura da página.
 */
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import path from 'path';

const ORIGEM = path.join(process.cwd(), 'public/images/logocompromisso.png');
const DESTINO = path.join(process.cwd(), 'public/icons');
const FUNDO = { r: 255, g: 255, b: 255, alpha: 1 };

/** Proporção do logo, para calcular quanto cabe em cada zona segura. */
const LARGURA_LOGO = 428;
const ALTURA_LOGO = 299;
const DIAGONAL = Math.hypot(LARGURA_LOGO, ALTURA_LOGO);

/**
 * Desenha o logo centralizado num quadrado.
 *
 * `ocupacao` é a fração do lado que o logo pode usar. Para `maskable` o limite
 * não é o lado e sim a diagonal, porque a máscara do Android é circular.
 */
async function gerar(tamanho: number, arquivo: string, ocupacao: number, circular = false) {
  const largura = circular
    ? Math.round((tamanho * ocupacao * LARGURA_LOGO) / DIAGONAL)
    : Math.round(tamanho * ocupacao);

  const logo = await sharp(ORIGEM)
    .resize({ width: largura, fit: 'inside' })
    .png()
    .toBuffer();

  const saida = path.join(DESTINO, arquivo);
  await sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: FUNDO },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(saida);

  const meta = await sharp(saida).metadata();
  console.log(`  ✓ ${arquivo.padEnd(26)} ${meta.width}x${meta.height} ${meta.format}`);
}

async function main() {
  await mkdir(DESTINO, { recursive: true });
  console.log('\nGerando ícones a partir de public/images/logocompromisso.png:\n');

  // Ícones comuns: o logo pode ocupar quase todo o quadrado.
  await gerar(192, 'icon-192.png', 0.86);
  await gerar(512, 'icon-512.png', 0.86);

  // Maskable: o Android recorta em círculo/quadrado arredondado. O logo precisa
  // caber no círculo central de 80% — medido pela diagonal, não pela largura.
  await gerar(512, 'icon-maskable-512.png', 0.8, true);

  // iOS: 180px é o tamanho que o iPhone usa na tela de início.
  await gerar(180, 'apple-touch-icon.png', 0.86);

  // Selo da notificação no Android: pequeno e monocromático por definição do
  // sistema. Aqui só importa não mandar 512 KB para desenhar 24 pixels.
  await gerar(96, 'badge-96.png', 0.9);

  console.log('\nPronto. Atualize o manifesto se algum nome mudou.\n');
}

main().catch(e => { console.error('\nErro:', e.message); process.exit(1); });
