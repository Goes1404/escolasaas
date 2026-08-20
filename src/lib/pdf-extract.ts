/**
 * Extração client-side de texto + imagens de PDFs de prova (pdf.js).
 *
 * Estratégia de imagens: em vez de decodificar os bytes crus de cada XObject
 * (frágil — RGB vs RGBA, CMYK, masks, JPEG2000…), rastreamos a matriz de
 * transformação (CTM) na operator list para descobrir ONDE cada imagem foi
 * pintada, renderizamos a página inteira uma única vez e recortamos o
 * retângulo correspondente. Sempre produz a imagem exatamente como aparece
 * no PDF.
 *
 * Cada imagem sai anotada com a página e o número da questão mais próxima
 * acima dela ("QUESTÃO 12" / "12."), permitindo pareamento determinístico
 * com as questões extraídas pela IA.
 */

type Matrix = [number, number, number, number, number, number];

export interface ExtractedPdfImage {
  id: string;
  file: File;
  url: string;
  page: number;
  /** Topo da imagem em coordenadas PDF (y cresce para cima). */
  y: number;
  /** Número da questão impressa mais próxima acima da imagem, se detectado. */
  questionNumber: number | null;
  /**
   * Retângulo ocupado pela imagem, em coordenadas PDF. Permite a quem consome
   * saber o que mais existe naquela região da página — por exemplo, distinguir
   * uma figura de verdade de um retângulo decorativo que serve apenas de fundo
   * para um texto de apoio.
   */
  rect: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface PdfExtractionResult {
  text: string;
  images: ExtractedPdfImage[];
}

interface QuestionMarker {
  page: number;
  x: number;
  y: number;
  column: 0 | 1;
  number: number;
}

interface ImagePlacement {
  /** Bounding box em coordenadas PDF do espaço do usuário. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';

/** Menor lado aceito (em pontos PDF) — descarta ícones/bullets. */
const MIN_SIZE_PT = 40;
/** Imagens cobrindo mais que isso da página são fundo/marca d'água. */
const MAX_PAGE_AREA_RATIO = 0.85;

let pdfJsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_URL;
    script.type = 'module';
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error('pdf.js não expôs pdfjsLib.')); return; }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Falha ao carregar pdf.js.'));
    document.head.appendChild(script);
  });
  return pdfJsPromise;
}

/** Composição de matrizes PDF: aplica `t` e depois `m` (equivale ao operador `cm`). */
function composeMatrix(m: Matrix, t: Matrix): Matrix {
  return [
    m[0] * t[0] + m[2] * t[1],
    m[1] * t[0] + m[3] * t[1],
    m[0] * t[2] + m[2] * t[3],
    m[1] * t[2] + m[3] * t[3],
    m[0] * t[4] + m[2] * t[5] + m[4],
    m[1] * t[4] + m[3] * t[5] + m[5],
  ];
}

function applyPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Bbox do quadrado unitário (espaço de imagem) transformado pela CTM. */
function unitSquareBBox(ctm: Matrix): ImagePlacement {
  const corners: ReadonlyArray<[number, number]> = [
    applyPoint(ctm, 0, 0), applyPoint(ctm, 1, 0),
    applyPoint(ctm, 0, 1), applyPoint(ctm, 1, 1),
  ];
  const xs = corners.map(c => c[0]);
  const ys = corners.map(c => c[1]);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys),
  };
}

/** Varre a operator list rastreando save/restore/transform e coleta bboxes de imagens pintadas. */
function collectImagePlacements(ops: { fnArray: number[]; argsArray: unknown[][] }, OPS: Record<string, number>): ImagePlacement[] {
  const paintOps = new Set<number>([
    OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject,
  ].filter((v): v is number => typeof v === 'number'));

  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const placements: ImagePlacement[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) {
      stack.push([...ctm] as Matrix);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      const a = ops.argsArray[i] as number[];
      ctm = composeMatrix(ctm, [a[0], a[1], a[2], a[3], a[4], a[5]]);
    } else if (paintOps.has(fn)) {
      placements.push(unitSquareBBox(ctm));
    }
  }
  return placements;
}

/** Fingerprint barato (12×12 quantizado) para deduplicar logos repetidos em todas as páginas. */
function canvasFingerprint(source: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number): string {
  const c = document.createElement('canvas');
  c.width = 12; c.height = 12;
  const ctx = c.getContext('2d');
  if (!ctx) return Math.random().toString(36);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 12, 12);
  const data = ctx.getImageData(0, 0, 12, 12).data;
  let out = '';
  for (let i = 0; i < data.length; i += 4) {
    out += ((data[i] >> 5) * 64 + (data[i + 1] >> 5) * 8 + (data[i + 2] >> 5)).toString(36);
  }
  return out;
}

function cropToBlob(source: HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number): Promise<Blob | null> {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw));
  c.height = Math.max(1, Math.round(sh));
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise(resolve => c.toBlob(resolve, 'image/png', 0.92));
}

const QUESTION_LINE_RE = /quest[ãa]o\s*(\d{1,3})/i;
const NUMBERED_LINE_RE = /^\s*(\d{1,3})\s*[.)-]\s+\S/;

function parseMarkerNumber(line: string): number | null {
  const q = line.match(QUESTION_LINE_RE);
  if (q) {
    const n = parseInt(q[1], 10);
    if (n >= 1 && n <= 200) return n;
  }
  const d = line.match(NUMBERED_LINE_RE);
  if (d) {
    const n = parseInt(d[1], 10);
    if (n >= 1 && n <= 200) return n;
  }
  return null;
}

/** Heurística: página em duas colunas se boa parte das linhas começa após 52% da largura. */
function detectTwoColumns(lineStartXs: number[], pageWidth: number): boolean {
  if (lineStartXs.length < 8) return false;
  const rightStarts = lineStartXs.filter(x => x > pageWidth * 0.52).length;
  return rightStarts / lineStartXs.length > 0.3;
}

/**
 * Extrai texto corrido + imagens posicionadas de um PDF de prova.
 * O texto mantém o mesmo formato do fluxo anterior (páginas marcadas),
 * para não alterar o comportamento da extração por IA.
 */
export async function extractPdfContent(file: File, fileLabel: string): Promise<PdfExtractionResult> {
  const pdfjsLib = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(new Uint8Array(buffer)).promise;

  let fullText = `\n\n--- ARQUIVO: ${fileLabel} ---\n\n`;
  const markers: QuestionMarker[] = [];
  const rawImages: Array<{
    blob: Blob; page: number; yTop: number; yBase: number; centerX: number; column: 0 | 1;
    rect: { minX: number; minY: number; maxX: number; maxY: number };
  }> = [];
  const seenFingerprints = new Map<string, number>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const pageWidth: number = baseViewport.width;
    const pageArea = baseViewport.width * baseViewport.height;

    // ---- Texto + marcadores de questão (com posição) ----
    const tc = await page.getTextContent();
    const items = tc.items as Array<{ str: string; transform: number[] }>;
    let lastY = -1;
    let pageText = '';
    let lineBuf = '';
    let lineX = 0;
    let lineY = 0;
    const lineStartXs: number[] = [];

    const flushLine = (): void => {
      if (!lineBuf.trim()) { lineBuf = ''; return; }
      lineStartXs.push(lineX);
      const num = parseMarkerNumber(lineBuf);
      if (num !== null) {
        markers.push({ page: pageNum, x: lineX, y: lineY, column: 0, number: num });
      }
      lineBuf = '';
    };

    for (const item of items) {
      const y = item.transform[5];
      if (lastY !== -1 && Math.abs(y - lastY) > 5) {
        pageText += '\n';
        flushLine();
      }
      if (!lineBuf) { lineX = item.transform[4]; lineY = y; }
      pageText += item.str + ' ';
      lineBuf += item.str + ' ';
      lastY = y;
    }
    flushLine();
    fullText += `--- PÁGINA ${pageNum} ---\n${pageText}\n\n`;

    const twoCols = detectTwoColumns(lineStartXs, pageWidth);
    if (twoCols) {
      for (const m of markers) {
        if (m.page === pageNum) m.column = m.x >= pageWidth * 0.5 ? 1 : 0;
      }
    }

    // ---- Imagens: localizar via CTM, renderizar a página, recortar ----
    let placements: ImagePlacement[] = [];
    try {
      const ops = await page.getOperatorList();
      placements = collectImagePlacements(ops, pdfjsLib.OPS);
    } catch {
      continue;
    }

    const valid = placements.filter(p => {
      const w = p.maxX - p.minX;
      const h = p.maxY - p.minY;
      return w >= MIN_SIZE_PT && h >= MIN_SIZE_PT && w * h <= pageArea * MAX_PAGE_AREA_RATIO;
    });
    if (valid.length === 0) continue;

    const scale = Math.min(2.5, Math.max(1.2, 1600 / pageWidth));
    const viewport = page.getViewport({ scale });
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);
    const pageCtx = pageCanvas.getContext('2d');
    if (!pageCtx) continue;
    try {
      await page.render({ canvasContext: pageCtx, viewport }).promise;
    } catch {
      continue;
    }

    for (const p of valid) {
      const [vx1, vy1] = viewport.convertToViewportPoint(p.minX, p.minY);
      const [vx2, vy2] = viewport.convertToViewportPoint(p.maxX, p.maxY);
      const sx = Math.max(0, Math.min(vx1, vx2));
      const sy = Math.max(0, Math.min(vy1, vy2));
      const sw = Math.min(pageCanvas.width - sx, Math.abs(vx2 - vx1));
      const sh = Math.min(pageCanvas.height - sy, Math.abs(vy2 - vy1));
      if (sw < 24 || sh < 24) continue;

      const fp = canvasFingerprint(pageCanvas, sx, sy, sw, sh);
      const count = (seenFingerprints.get(fp) ?? 0) + 1;
      seenFingerprints.set(fp, count);
      if (count > 1) continue; // logo/cabeçalho repetido

      const blob = await cropToBlob(pageCanvas, sx, sy, sw, sh);
      if (!blob) continue;
      const centerX = (p.minX + p.maxX) / 2;
      rawImages.push({
        blob,
        page: pageNum,
        yTop: p.maxY,
        yBase: p.minY,
        centerX,
        column: twoCols && centerX >= pageWidth * 0.5 ? 1 : 0,
        rect: { minX: p.minX, minY: p.minY, maxX: p.maxX, maxY: p.maxY },
      });
    }
  }

  // ---- Atribuição da imagem à questão ----
  // Provas usam duas convenções, e a geometria distingue as duas:
  //   • exatas: "12." → enunciado → figura ABAIXO do número (às vezes a figura
  //     transborda para o topo da 2ª coluna / página seguinte);
  //   • literatura/humanas: texto ou imagem de APOIO logo ACIMA do "12.".
  // Regra: por padrão, a última questão na ORDEM DE LEITURA antes da imagem
  // (respeita transbordo de coluna/página). Exceção: se houver um "NN." na
  // mesma coluna colado logo abaixo da imagem (gap pequeno), é apoio-antes —
  // a imagem pertence a essa questão de baixo.
  const orderedMarkers = [...markers].sort((a, b) =>
    a.page - b.page || a.column - b.column || b.y - a.y
  );

  // Gap máximo (pt) entre a base da imagem e o número logo abaixo para tratar
  // como apoio-antes-do-número. Enunciados de exatas separam figura e próximo
  // número pelas alternativas (gap >> este valor), então não há colisão.
  const SUPPORT_GAP = 45;

  const findQuestionFor = (
    img: { page: number; yTop: number; yBase: number; column: 0 | 1 }
  ): number | null => {
    // (1) apoio-antes-do-número: "NN." na mesma coluna, coladinho abaixo da imagem.
    const below = markers
      .filter(m =>
        m.page === img.page && m.column === img.column &&
        m.y < img.yBase && img.yBase - m.y <= SUPPORT_GAP)
      .sort((a, b) => b.y - a.y);
    if (below.length > 0) return below[0].number;

    // (2) padrão: última questão na ordem de leitura em/ acima da imagem.
    let best: QuestionMarker | null = null;
    for (const m of orderedMarkers) {
      const before =
        m.page < img.page ||
        (m.page === img.page && (m.column < img.column ||
          (m.column === img.column && m.y >= img.yTop - 4)));
      if (before) best = m;
      else if (m.page > img.page) break;
    }
    return best?.number ?? null;
  };

  const images: ExtractedPdfImage[] = rawImages
    .sort((a, b) => a.page - b.page || a.column - b.column || b.yTop - a.yTop)
    .map((img, idx) => {
      const questionNumber = findQuestionFor(img);
      const name = questionNumber !== null
        ? `q${questionNumber}_p${img.page}_${idx}.png`
        : `img_p${img.page}_${idx}.png`;
      const f = new File([img.blob], name, { type: 'image/png' });
      return {
        id: Math.random().toString(36).substring(2, 11),
        file: f,
        url: URL.createObjectURL(img.blob),
        page: img.page,
        y: img.yTop,
        questionNumber,
        rect: img.rect,
      };
    });

  return { text: fullText, images };
}
