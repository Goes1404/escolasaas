/**
 * Extrai as imagens das questões de um PDF de prova e as sobe para o bucket
 * `question-images`, produzindo um manifesto `prova → nº da questão → URL`.
 *
 * Uso:
 *   npx tsx scripts/extract-pdf-images.ts --dir /tmp/etec --out /tmp/etec/imagens.json
 *   npx tsx scripts/extract-pdf-images.ts --dir /tmp/etec --out ... --only 2024-1
 *
 * Requer no .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * ── Por que um navegador de verdade ─────────────────────────────────────────
 * A extração já existe e está afinada em `src/lib/pdf-extract.ts`: acha as
 * imagens pela matriz de transformação do PDF, renderiza a página e recorta,
 * descarta logos/cabeçalhos por impressão digital, detecta layout de duas
 * colunas e pareia cada imagem com o número da questão pela ordem de leitura
 * (com regra especial para figura que serve de apoio à questão logo abaixo).
 *
 * Esse código depende de pdf.js + canvas, ou seja, de um navegador. Em vez de
 * reimplementar as heurísticas no servidor — e errar de um jeito novo —, este
 * script empacota o módulo com esbuild e o executa no Chromium headless que já
 * vem no ambiente (Playwright). É o mesmo código que roda no Motor de Provas.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import * as dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BUCKET = "question-images";

// Mesma versão que `src/lib/pdf-extract.ts` carrega em produção.
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";

/** Baixa uma vez e guarda em disco — o script roda várias provas seguidas. */
async function fetchCached(url: string, cacheName: string): Promise<string> {
  const cached = path.join(os.tmpdir(), cacheName);
  if (fs.existsSync(cached)) return fs.readFileSync(cached, "utf8");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  const body = await res.text();
  fs.writeFileSync(cached, body);
  return body;
}

// ─── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function strFlag(name: string, def = ""): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const DIR = strFlag("--dir");
const OUT = strFlag("--out");
const ONLY = strFlag("--only");
const DRY = args.includes("--dry-run");
/** Grava as imagens escolhidas em disco também, para conferência visual. */
const SAVE_DIR = strFlag("--save-dir");

// ─── Supabase ───────────────────────────────────────────────────────────────
let _db: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _db;
}

/** Manifesto: rótulo da prova → { número da questão → URL pública }. */
export type ImageManifest = Record<string, Record<number, string>>;

type ExtractedImage = { questionNumber: number | null; page: number; charsDentro: number; base64: string };
type ExtractResult = { text: string; images: ExtractedImage[] };

/**
 * Em que página cada questão começa, lido do texto que o extrator devolve
 * (ele marca as páginas com `--- PÁGINA n ---`).
 */
export function pageByQuestion(text: string): Map<number, number> {
  const out = new Map<number, number>();
  let page = 0;
  for (const line of text.split("\n")) {
    const pg = line.match(/---\s*P[ÁA]GINA\s+(\d+)\s*---/i);
    if (pg) { page = parseInt(pg[1], 10); continue; }
    const q = line.match(/quest[ãa]o\s+(\d{1,3})\b/i);
    if (q && page > 0) {
      const n = parseInt(q[1], 10);
      if (n >= 1 && n <= 200 && !out.has(n)) out.set(n, page);
    }
  }
  return out;
}

/**
 * Máximo de caracteres do PDF dentro do retângulo para a imagem ainda contar
 * como figura. Calibrado conferindo recortes um a um: figuras ficam em 0-72
 * (o que aparece é a legenda de fonte), enquanto caixas de texto de apoio dão
 * 330, 551, 620, 836, 885.
 */
const MAX_CHARS_FIGURA = 200;

/**
 * Proporção máxima largura/altura. Faixas do tipo "responda às questões 44 e
 * 45" têm texto curto demais para cair no filtro de caracteres, mas são tiras
 * de ~13:1. A figura mais alongada que encontrei conferindo os recortes foi uma
 * tirinha de quadrinhos, em 2,7:1.
 */
const MAX_PROPORCAO = 6;

/** Dimensões do PNG lidas do cabeçalho IHDR, sem decodificar a imagem. */
function pngSize(base64: string): { w: number; h: number } | null {
  const head = Buffer.from(base64.slice(0, 64), "base64");
  if (head.length < 24) return null;
  return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
}

/**
 * Escolhe a melhor imagem para cada questão.
 *
 * Três correções sobre o pareamento cru, todas encontradas conferindo os
 * recortes visualmente:
 *
 * 1. Só aceita imagem na mesma página em que a questão começa (ou na seguinte,
 *    para figura que transborda). Sem isso o logotipo da margem da capa era
 *    atribuído a uma questão do meio da prova.
 * 2. Descarta o que é caixa de texto, não figura. O vestibulinho desenha os
 *    textos de apoio dentro de um retângulo com fundo sombreado; esse fundo é
 *    uma imagem, então o recorte saía com o texto por cima — metade das
 *    "imagens" eram enunciados repetidos, ou banners do tipo "responda às
 *    questões 44 e 45".
 * 3. Havendo mais de uma candidata, fica com a maior.
 */
export function pickImages(
  images: ExtractedImage[],
  pageOf: Map<number, number>,
  minBytes = 4000
): Map<number, ExtractedImage> {
  const best = new Map<number, ExtractedImage>();
  for (const img of images) {
    const n = img.questionNumber;
    if (n === null) continue;
    const qPage = pageOf.get(n);
    if (qPage === undefined) continue;
    if (img.page !== qPage && img.page !== qPage + 1) continue;
    if (img.charsDentro > MAX_CHARS_FIGURA) continue;
    const dim = pngSize(img.base64);
    if (dim && dim.h > 0 && dim.w / dim.h > MAX_PROPORCAO) continue;
    const size = Buffer.from(img.base64, "base64").length;
    if (size < minBytes) continue;
    const atual = best.get(n);
    if (!atual || size > Buffer.from(atual.base64, "base64").length) best.set(n, img);
  }
  return best;
}

/** Empacota `src/lib/pdf-extract.ts` num IIFE que o navegador consegue carregar. */
function bundleExtractor(): string {
  const out = path.join(os.tmpdir(), `pdf-extract.bundle.${process.pid}.js`);
  execFileSync(
    path.resolve("node_modules/.bin/esbuild"),
    [
      path.resolve("src/lib/pdf-extract.ts"),
      "--bundle",
      "--format=iife",
      "--global-name=PdfExtract",
      "--platform=browser",
      `--outfile=${out}`,
    ],
    { stdio: "pipe" }
  );
  return out;
}

async function extractFromPdf(
  page: import("playwright").Page,
  pdfPath: string
): Promise<ExtractResult> {
  const bytes = fs.readFileSync(pdfPath);
  const label = path.basename(pdfPath, ".pdf");
  // Chama o wrapper injetado como script puro (ver WRAPPER_JS). Passar uma
  // função daqui não funciona: o transpilador do tsx injeta helpers próprios
  // (`__name`) que não existem dentro da página.
  return page.evaluate(
    `window.__extractForNode(${JSON.stringify(Array.from(bytes))}, ${JSON.stringify(label)})`
  ) as Promise<ExtractResult>;
}

/** JS puro injetado na página: ponte entre o Node e o extrator empacotado. */
const WRAPPER_JS = `
window.__extractForNode = async function (data, label) {
  var file = new File([new Uint8Array(data)], label + '.pdf', { type: 'application/pdf' });
  var res = await window.PdfExtract.extractPdfContent(file, label);
  function toBase64(blob) {
    return new Promise(function (resolve) {
      var r = new FileReader();
      r.onloadend = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.readAsDataURL(blob);
    });
  }
  // Quanto TEXTO do PDF cai dentro do retangulo de cada imagem. E o sinal que
  // separa figura de caixa decorativa: o vestibulinho desenha os textos de
  // apoio dentro de um retangulo com fundo sombreado, e esse fundo e uma
  // imagem -- o recorte sai com o texto por cima. Figura de verdade tem quase
  // nenhum caractere do PDF dentro da sua area.
  var doc = await window.pdfjsLib.getDocument(new Uint8Array(data)).promise;
  var charsPorPagina = {};
  for (var pg = 1; pg <= doc.numPages; pg++) {
    var pagina = await doc.getPage(pg);
    var tc = await pagina.getTextContent();
    var itens = [];
    for (var k = 0; k < tc.items.length; k++) {
      var it = tc.items[k];
      if (!it.str || !it.str.trim()) continue;
      itens.push({ x: it.transform[4], y: it.transform[5], n: it.str.trim().length });
    }
    charsPorPagina[pg] = itens;
  }

  var out = [];
  for (var i = 0; i < res.images.length; i++) {
    var img = res.images[i];
    var dentro = 0;
    var lista = charsPorPagina[img.page] || [];
    for (var j = 0; j < lista.length; j++) {
      var t = lista[j];
      if (t.x >= img.rect.minX && t.x <= img.rect.maxX &&
          t.y >= img.rect.minY && t.y <= img.rect.maxY) dentro += t.n;
    }
    out.push({
      questionNumber: img.questionNumber,
      page: img.page,
      charsDentro: dentro,
      base64: await toBase64(img.file),
    });
  }
  return { text: res.text, images: out };
};
`;

async function main() {
  if (!DIR || !OUT) {
    console.error(
      "Uso: npx tsx scripts/extract-pdf-images.ts --dir <pasta com .prova.pdf> --out <manifesto.json> [--only 2024-1] [--dry-run]"
    );
    process.exit(1);
  }
  if (!DRY && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error("❌ Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local");
    process.exit(1);
  }

  const pdfs = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".prova.pdf"))
    .map((f) => ({ label: f.replace(/\.prova\.pdf$/, ""), file: path.join(DIR, f) }))
    .filter((p) => !ONLY || p.label === ONLY)
    .sort((a, b) => a.label.localeCompare(b.label));

  if (pdfs.length === 0) {
    console.error(`Nenhum *.prova.pdf em ${DIR}`);
    process.exit(1);
  }

  console.log(`🖼  Extraindo imagens de ${pdfs.length} prova(s)${DRY ? "  (SIMULAÇÃO)" : ""}`);

  const bundlePath = bundleExtractor();
  const bundle = fs.readFileSync(bundlePath, "utf8");

  // O ambiente traz um Chromium pré-instalado que pode não bater com a versão
  // esperada pelo pacote playwright; aponta direto para ele quando existir.
  const preinstalled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const browser = await chromium.launch(
    fs.existsSync(preinstalled) ? { executablePath: preinstalled } : {}
  );
  const context = await browser.newContext();
  const page = await context.newPage();

  // O Chromium deste ambiente não tem saída para a internet, e `pdf-extract.ts`
  // buscaria o pdf.js num CDN. Baixamos a lib aqui no Node (que tem rede) e a
  // injetamos como `window.pdfjsLib`: `loadPdfJs()` a encontra pronta e devolve
  // na hora, sem tocar na rede de dentro da página.
  //
  // Usamos exatamente a 4.0.379, a mesma versão que o app carrega em produção.
  // A cópia local de `pdfjs-dist` é a 6.x, que além de mudar a assinatura de
  // `getDocument` depende de `Map.prototype.getOrInsertComputed`, ausente neste
  // Chromium. Fixar a versão de produção garante o mesmo comportamento de
  // pareamento que o professor vê no Motor de Provas.
  const [pdfjsSrc, workerSrc] = await Promise.all([
    fetchCached(PDFJS_URL, "pdfjs-4.0.379.mjs"),
    fetchCached(PDFJS_WORKER_URL, "pdfjs-worker-4.0.379.mjs"),
  ]);

  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: pdfjsSrc, type: "module" });
  await page.waitForFunction(() => !!(window as any).pdfjsLib, null, { timeout: 30_000 });
  await page.evaluate((src) => {
    const blob = new Blob([src], { type: "text/javascript" });
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  }, workerSrc);

  await page.addScriptTag({ content: bundle });
  await page.addScriptTag({ content: WRAPPER_JS });

  const manifest: ImageManifest = {};
  let totalImgs = 0;
  let semQuestao = 0;

  for (const p of pdfs) {
    let res: ExtractResult;
    try {
      res = await extractFromPdf(page, p.file);
    } catch (e: any) {
      console.error(`  ⚠️  ${p.label}: falha na extração — ${e.message}`);
      continue;
    }

    const imgs = res.images;
    const pageOf = pageByQuestion(res.text);
    const escolhidas = pickImages(imgs, pageOf);
    semQuestao += imgs.length - escolhidas.size;

    manifest[p.label] = {};
    let up = 0;
    for (const [n, img] of [...escolhidas.entries()].sort((a, b) => a[0] - b[0])) {
      const buf = Buffer.from(img.base64, "base64");
      if (SAVE_DIR) {
        fs.mkdirSync(SAVE_DIR, { recursive: true });
        fs.writeFileSync(path.join(SAVE_DIR, `${p.label}_q${n}.png`), buf);
      }

      if (DRY) {
        manifest[p.label][n] = `(simulação) ${p.label}/q${n}.png`;
        up++;
        continue;
      }

      const objectPath = `${p.label}/q${n}.png`;
      const { error } = await db()
        .storage.from(BUCKET)
        .upload(objectPath, buf, { contentType: "image/png", upsert: true });
      if (error) {
        console.error(`  ⚠️  upload ${objectPath}: ${error.message}`);
        continue;
      }
      const { data } = db().storage.from(BUCKET).getPublicUrl(objectPath);
      manifest[p.label][n] = data.publicUrl;
      up++;
    }

    totalImgs += up;
    console.log(`  ✔ ${p.label}: ${imgs.length} imagens · ${up} pareadas com questão`);
  }

  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  fs.unlinkSync(bundlePath);
  await browser.close();

  console.log(`\n🏁 ${totalImgs} imagens ${DRY ? "seriam enviadas" : "enviadas"} · ${semQuestao} sem questão identificada`);
  console.log(`   manifesto: ${OUT}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("\n❌", e.message);
    process.exit(1);
  });
}
