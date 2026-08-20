/**
 * Recorta o fundo da arte do bichinho e grava o arquivo final.
 *
 *   node scripts/recortar-mascote.mjs <entrada.png> <arquetipo>
 *   node scripts/recortar-mascote.mjs ~/lobinho.png lobinho
 *
 * Grava `public/mascotes/<arquetipo>.webp`, que e onde o app procura.
 *
 * ── Por que este script existe ─────────────────────────────────────────────
 *
 * Pedir "fundo transparente" a um gerador de imagem costuma devolver o
 * quadriculado de transparencia DESENHADO como pixels, sem canal alfa nenhum.
 * A arena precisa de recorte de verdade: ela desenha o proprio cenario, troca a
 * iluminacao conforme o humor e faz o bicho pular, inclinar e rodopiar por
 * cima. Fundo colado pularia junto.
 *
 * ── Por que nao basta filtrar por cor ──────────────────────────────────────
 *
 * O xadrez e cinza e branco — e o husky tambem. Filtrar por cor fura o bicho.
 * O que separa um do outro e a ESTRUTURA, em tres etapas:
 *
 *   1. Julga CELULA, nao pixel: quadro de fundo e liso e neutro; pelo tem
 *      textura. A cor de cada celula e medida, nao prevista pela paridade da
 *      grade — a fase do xadrez deriva ao longo da imagem.
 *   2. Regiao cercada pelo bicho (o vao dentro da cauda) so vira fundo se
 *      provar que e xadrez: varias celulas e as duas cores alternando. Sem
 *      isso, uma area lisa e branca da testa abria buraco no bicho.
 *   3. Cresce por CONECTIVIDADE a partir do fundo ja conhecido. E o que
 *      protege barriga e patas brancas: estao cercadas de pelo sombreado, o
 *      preenchimento nunca chega nelas.
 *
 * Se a arte vier com fundo chapado de verdade (branco liso, sem xadrez), este
 * script nao e o certo — ali `sharp().flatten()` com chroma key resolve.
 */

import sharp from 'sharp';
import { statSync } from 'node:fs';

const [ENTRADA, ARQUETIPO] = process.argv.slice(2);
if (!ENTRADA || !ARQUETIPO) {
  console.error('uso: node scripts/recortar-mascote.mjs <entrada.png> <arquetipo>');
  process.exit(1);
}
const SAIDA = `public/mascotes/${ARQUETIPO}.webp`;
const N = 1024;

const { data, info } = await sharp(ENTRADA).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const LADO = 20.5, ESCURO = 196, CLARO = 255;
const NX = Math.ceil(W / LADO), NY = Math.ceil(H / LADO);

// ── Etapa 1: MEDIR a cor de cada celula, nao prever ───────────────────────
// Prever a cor por paridade da grade falha: a fase do xadrez deriva ao longo
// da imagem (na direita ela ja esta invertida), e celulas de fundo legitimo
// eram reprovadas. Medir dispensa a fase.
//
// O que denuncia o bicho e a UNIFORMIDADE: quadro de fundo e liso, pelo tem
// textura. Um tufo branco liso ainda poderia passar, mas so viraria fundo se
// houvesse caminho ate a moldura — e o contorno do bicho e texturizado.
const cor = new Int8Array(NX * NY).fill(-1);   // 0 = escuro, 1 = claro
const pura = new Uint8Array(NX * NY);
for (let cy = 0; cy < NY; cy++) for (let cx = 0; cx < NX; cx++) {
  const x0 = Math.round(cx * LADO) + 4, x1 = Math.min(W, Math.round((cx + 1) * LADO) - 4);
  const y0 = Math.round(cy * LADO) + 4, y1 = Math.min(H, Math.round((cy + 1) * LADO) - 4);
  if (x1 <= x0 || y1 <= y0) continue;
  let mn = 255, mx = 0, soma = 0, n = 0, satMax = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * W + x) * C, r = data[i], g = data[i + 1], b = data[i + 2];
    satMax = Math.max(satMax, Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    mn = Math.min(mn, r); mx = Math.max(mx, r); soma += r; n++;
  }
  const media = soma / n;
  const c = cy * NX + cx;
  if (Math.abs(media - ESCURO) <= 12) cor[c] = 0;
  else if (Math.abs(media - CLARO) <= 12) cor[c] = 1;
  pura[c] = (cor[c] >= 0 && mx - mn <= 12 && satMax <= 10) ? 1 : 0;
}

const alcancada = new Uint8Array(NX * NY);
const fila = [];
const pushC = (cx, cy) => {
  if (cx < 0 || cy < 0 || cx >= NX || cy >= NY) return;
  const c = cy * NX + cx;
  if (alcancada[c] || !pura[c]) return;
  alcancada[c] = 1; fila.push(c);
};
for (let cx = 0; cx < NX; cx++) { pushC(cx, 0); pushC(cx, NY - 1); }
for (let cy = 0; cy < NY; cy++) { pushC(0, cy); pushC(NX - 1, cy); }
for (let k = 0; k < fila.length; k++) {
  const c = fila[k], cx = c % NX, cy = (c / NX) | 0;
  pushC(cx + 1, cy); pushC(cx - 1, cy); pushC(cx, cy + 1); pushC(cx, cy - 1);
}

// Celula pura cercada pelo bicho tambem pode ser fundo — e o caso do vao
// dentro da cauda enrolada, que a moldura nao alcanca. Mas aceitar toda celula
// pura fura o bicho: uma area lisa e branca da testa bate exatamente com 255 e
// passa no teste.
//
// O que separa os dois casos e o XADREZ. Fundo de verdade vem em mancha com
// varias celulas e as DUAS cores alternando; coincidencia no pelo e uma celula
// ou duas, de uma cor so. Entao a regiao precisa provar que xadrezada.
const rotulo = new Int32Array(NX * NY).fill(-1);
let nRot = 0;
for (let c0 = 0; c0 < NX * NY; c0++) {
  if (!pura[c0] || rotulo[c0] >= 0) continue;
  const membros = [c0]; rotulo[c0] = nRot;
  for (let k = 0; k < membros.length; k++) {
    const c = membros[k], cx = c % NX, cy = (c / NX) | 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= NX || ny >= NY) continue;
      const n = ny * NX + nx;
      if (pura[n] && rotulo[n] < 0) { rotulo[n] = nRot; membros.push(n); }
    }
  }
  const temEscuro = membros.some(c => cor[c] === 0);
  const temClaro  = membros.some(c => cor[c] === 1);
  if (membros.length >= 4 && temEscuro && temClaro) {
    for (const c of membros) alcancada[c] = 1;
  }
  nRot++;
}

// ── Etapa 2: afinar a borda ───────────────────────────────────────────────
// Numa celula mista a cor do xadrez sai da paridade LOCAL: vizinho ortogonal
// de fundo tem a cor oposta. Local, exato, e imune a deriva de fase.
// Paridade local: vizinho ortogonal de fundo tem a cor oposta. O diagonal tem
// a MESMA cor. Sem isso sobravam fiapos de xadrez no contorno, onde a celula
// so tinha vizinho na diagonal.
const espLocal = (cx, cy) => {
  for (const [dx, dy, oposto] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,0],[-1,-1,0],[1,-1,0],[-1,1,0]]) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= NX || ny >= NY) continue;
    const c = ny * NX + nx;
    if (alcancada[c]) {
      const mesma = cor[c] === 0 ? ESCURO : CLARO;
      const outra = cor[c] === 0 ? CLARO : ESCURO;
      return oposto ? outra : mesma;
    }
  }
  return -1;
};
const alfa0 = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const cx = Math.floor(x / LADO), cy = Math.floor(y / LADO), c = cy * NX + cx;
  let transp = false;
  if (alcancada[c]) transp = true;
  else {
    const esp = espLocal(cx, cy);
    if (esp >= 0) {
      const i = (y * W + x) * C, r = data[i], g = data[i + 1], b = data[i + 2];
      const sat = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      transp = Math.abs(r - esp) <= 22 && sat <= 12;
    }
  }
  alfa0[y * W + x] = transp ? 0 : 255;
}

// Cresce o fundo a partir do que ja e transparente, por conectividade.
//
// O criterio e frouxo de proposito — neutro e claro — porque a costura entre
// dois quadros vale 230 e nao bate com nenhuma das duas cores; sem deixa-la
// passar, o preenchimento nao atravessa de um quadro para o outro e o bloco ao
// redor da cauda fica.
//
// O que impede esse criterio frouxo de comer o bicho e a CONECTIVIDADE: barriga
// e patas brancas estao cercadas de pelo sombreado, entao o preenchimento nunca
// chega nelas. Ele so encosta onde branco toca fundo de verdade — as pontas da
// cauda —, e ali apara alguns pixels de fiapo. E o cambio certo: fiapo de pelo
// aparado nao se ve; bloco de xadrez na arena se ve.
{
  const naFila = new Uint8Array(W * H);
  let atual = [];
  for (let p = 0; p < W * H; p++) if (alfa0[p] === 0) { naFila[p] = 1; atual.push(p); }
  while (atual.length) {
    const prox = [];
    for (const p of atual) {
      const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (naFila[q]) continue;
        const i = q * C, r = data[i], g = data[i + 1], b = data[i + 2];
        if (Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b)) > 6) continue;
        if (r < 190) continue;
        naFila[q] = 1; alfa0[q] = 0; prox.push(q);
      }
    }
    atual = prox;
  }
}

// Fiapos de xadrez sobram no contorno, onde a celula mista tinha pixel fora de
// tolerancia. Sao manchas minusculas e soltas; o bicho e uma mancha so, enorme.
// Descartar componente opaco pequeno limpa sem encostar nele.
{
  const rot = new Int32Array(W * H).fill(-1);
  const pilha = new Int32Array(W * H);
  for (let p0 = 0; p0 < W * H; p0++) {
    if (alfa0[p0] === 0 || rot[p0] >= 0) continue;
    let n = 0, top = 0; const membros = [];
    pilha[top++] = p0; rot[p0] = 1;
    while (top > 0) {
      const p = pilha[--top]; membros.push(p); n++;
      const x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (alfa0[q] !== 0 && rot[q] < 0) { rot[q] = 1; pilha[top++] = q; }
      }
    }
    if (n < 4000) for (const p of membros) alfa0[p] = 0;
  }
}

// Alfa suavizado. `toColourspace('b-w')` e obrigatorio: sem ele o sharp promove
// o raw de 1 canal para 3 (sRGB), e ler o alfa com passo de 1 byte num buffer
// RGB intercalado produz mascara listrada.
const { data: alfa, info: iA } = await sharp(alfa0, { raw: { width: W, height: H, channels: 1 } })
  .blur(0.7).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
if (iA.channels !== 1) throw new Error('alfa voltou com ' + iA.channels + ' canais');

const rgba = Buffer.alloc(W * H * 4);
let opacos = 0;
for (let p = 0; p < W * H; p++) {
  rgba[p * 4] = data[p * C]; rgba[p * 4 + 1] = data[p * C + 1]; rgba[p * 4 + 2] = data[p * C + 2];
  rgba[p * 4 + 3] = alfa[p];
  if (alfa[p] > 128) opacos++;
}
// Guarda nos dois extremos. Quase nada removido = a imagem nao tinha xadrez
// (fundo chapado, ou ja transparente); quase tudo removido = o recorte comeu o
// bicho. Nos dois casos e melhor falhar do que gravar um arquivo ruim que so
// vai aparecer torto na arena depois.
const pctOpaco = 100 * opacos / (W * H);
if (pctOpaco > 95) throw new Error(`nada foi recortado (${pctOpaco.toFixed(1)}% opaco) — esta imagem nao tem fundo quadriculado desenhado`);
if (pctOpaco < 5) throw new Error(`o recorte comeu quase tudo (${pctOpaco.toFixed(1)}% opaco) — confira a imagem de entrada`);

const recortado = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();

// A arena apoia o bicho pelo pe: patas na borda de baixo, folga em cima e nas
// laterais. Sem isso ele flutua ou encosta na moldura.
const corte = await sharp(recortado).trim({ threshold: 1 }).png().toBuffer();
const m = await sharp(corte).metadata();
const escala = Math.min((N * 0.92) / m.width, (N * 0.94) / m.height);
const w = Math.round(m.width * escala), h = Math.round(m.height * escala);
const redim = await sharp(corte).resize(w, h).png().toBuffer();

await sharp({ create: { width: N, height: N, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: redim, left: Math.round((N - w) / 2), top: N - h - Math.round(N * 0.02) }])
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile(SAIDA);

const kb = statSync(SAIDA).size / 1024;
console.log(`${SAIDA}  ${N}x${N}  ${kb.toFixed(0)} KB  (opaco: ${pctOpaco.toFixed(1)}%)`);
if (kb > 150) console.warn('AVISO: acima de 150 KB — o alvo e o celular do aluno em rede movel.');
