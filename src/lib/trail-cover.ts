/**
 * Deterministic, title-aware trail cover images.
 * Uses a DJB2 hash of the title to pick from a curated pool so:
 * - Same trail always gets the same image
 * - Different trails in the same category get variety
 * - Images are topically relevant to the subject
 */

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[djb2(seed) % arr.length];
}

function u(id: string) {
  return `https://images.unsplash.com/photo-${id}?q=80&w=800&auto=format&fit=crop`;
}

// ── Topic pools: title keyword → images ───────────────────────────────────────

const TOPIC_POOLS: Array<{ keywords: string[]; pool: string[] }> = [
  // Matemática — subtopics
  {
    keywords: ["função", "funções", "funcao", "funcoes", "grafico", "gráfico", "parábola"],
    pool: [
      u("1518133910820-d799d1f6507b"),
      u("1518531933037-91b2f5f229cc"),
      u("1509228468518-180dd4864904"),
    ],
  },
  {
    keywords: ["geometria", "trigonometria", "angulo", "ângulo", "triangulo", "triângulo", "circunferencia"],
    pool: [
      u("1509228627372-d12e2d30e14b"),
      u("1560958689-d02d11bd2cb9"),
      u("1509228468518-180dd4864904"),
    ],
  },
  {
    keywords: ["algebra", "álgebra", "equacao", "equação", "polinomio", "polinômio"],
    pool: [
      u("1571260898890-5d900d4d08c8"),
      u("1509228468518-180dd4864904"),
      u("1606326608606-aa0b62935f2b"),
    ],
  },
  {
    keywords: ["estatistica", "estatística", "probabilidade", "media", "média", "variancia"],
    pool: [
      u("1551288049-bebda4e38f71"),
      u("1608222351212-18fe0d7a4d91"),
      u("1509228468518-180dd4864904"),
    ],
  },
  {
    keywords: ["calculo", "cálculo", "derivada", "integral", "limite"],
    pool: [
      u("1635070041078-e363dbe005cb"),
      u("1509228468518-180dd4864904"),
    ],
  },
  {
    keywords: ["logaritmo", "logaritmos", "progressao", "progressão"],
    pool: [
      u("1596495577886-d920f1fb7238"),
      u("1509228468518-180dd4864904"),
    ],
  },
  // Física — subtopics
  {
    keywords: ["eletricidade", "eletromagnetismo", "circuito", "eletron", "elétron", "corrente"],
    pool: [
      u("1581093450021-4a7360e9a6b5"),
      u("1451187580459-43490279c0fa"),
      u("1518770660439-4636190af475"),
    ],
  },
  {
    keywords: ["mecanica", "mecânica", "cinematica", "cinemática", "velocidade", "aceleracao"],
    pool: [
      u("1635070041078-e363dbe005cb"),
      u("1564329857230-84ab818c78e0"),
    ],
  },
  {
    keywords: ["ondas", "acustica", "acústica", "som", "optica", "óptica", "luz", "refração"],
    pool: [
      u("1557682250-33bd709cbe85"),
      u("1488998009610-be7b5a2aef0c"),
    ],
  },
  {
    keywords: ["termodinamica", "termodinâmica", "calor", "temperatura", "gas", "gás"],
    pool: [
      u("1518770660439-4636190af475"),
      u("1635070041078-e363dbe005cb"),
    ],
  },
  {
    keywords: ["nuclear", "nucleo", "núcleo", "radioatividade", "fissão", "fusão"],
    pool: [
      u("1498049200459-53e4f902e1ab"),
      u("1451187580459-43490279c0fa"),
    ],
  },
  {
    keywords: ["astro", "universo", "cosmos", "estrela", "planeta", "gravitacao", "gravitação", "astronomia"],
    pool: [
      u("1462331940025-496dfbfc7564"),
      u("1454789548928-9efd52dc4031"),
      u("1516339901601-2e1b62dc0c45"),
    ],
  },
  // Química — subtopics
  {
    keywords: ["organica", "orgânica", "carbono", "hidrocarboneto", "alcool", "álcool", "cetona"],
    pool: [
      u("1532094349884-543648cdbd8e"),
      u("1564325724739-bae0bd08762c"),
    ],
  },
  {
    keywords: ["periodica", "periódica", "elemento", "atomo", "átomo", "molecula", "molécula"],
    pool: [
      u("1532094349884-543648cdbd8e"),
      u("1576086213369-31c54e8a5b96"),
    ],
  },
  {
    keywords: ["reacao", "reação", "oxido", "óxido", "acido", "ácido", "base", "sal", "solucao", "solução"],
    pool: [
      u("1605722905765-96d58e1c5c1d"),
      u("1576086213369-31c54e8a5b96"),
    ],
  },
  // Biologia — subtopics
  {
    keywords: ["genetica", "genética", "dna", "gene", "cromossomo", "hereditariedade", "mendelismo"],
    pool: [
      u("1559757148-5e9d0a5f6a35"),
      u("1576319155264-99536e0be1ee"),
    ],
  },
  {
    keywords: ["celula", "célula", "mitose", "meiose", "organela", "membrana"],
    pool: [
      u("1576319155264-99536e0be1ee"),
      u("1576319155264-99536e0be1ee"),
    ],
  },
  {
    keywords: ["evolucao", "evolução", "darwin", "selecao", "seleção", "filogenia"],
    pool: [
      u("1518531933037-91b2f5f229cc"),
      u("1576319155264-99536e0be1ee"),
    ],
  },
  {
    keywords: ["ecologia", "ecossistema", "bioma", "biodiversidade", "floresta", "amazonia", "amazônia"],
    pool: [
      u("1552475342-971c97b12d1e"),
      u("1448375240586-882707db888b"),
      u("1467579824650-aee8f32cf72b"),
    ],
  },
  {
    keywords: ["anatomia", "corpo", "fisiologia", "sistema", "orgao", "órgão", "nervoso", "cardiovascular"],
    pool: [
      u("1576319155264-99536e0be1ee"),
      u("1576319155264-99536e0be1ee"),
    ],
  },
  {
    keywords: ["botanica", "botânica", "planta", "fotossintese", "fotossíntese", "vegetal"],
    pool: [
      u("1448375240586-882707db888b"),
      u("1501004318641-b39e6451bec6"),
    ],
  },
  // História — subtopics
  {
    keywords: ["guerra", "batalha", "conflito", "militar"],
    pool: [
      u("1487022059861-fff3bf91c6ab"),
      u("1461360370896-922624d12aa1"),
    ],
  },
  {
    keywords: ["grego", "romana", "antiguidade", "antiga", "grecia", "grécia", "rome", "romano"],
    pool: [
      u("1461360370896-922624d12aa1"),
      u("1503754215593-3db9c27d26c4"),
    ],
  },
  {
    keywords: ["medieval", "feud", "cruzada", "seculo", "século", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"],
    pool: [
      u("1540539234-c14a20fb7c7b"),
      u("1461360370896-922624d12aa1"),
    ],
  },
  {
    keywords: ["revolucao", "revolução", "francesa", "industrial", "americana", "independencia", "independência"],
    pool: [
      u("1565060170695-1d6d12c2fa8a"),
      u("1503754215593-3db9c27d26c4"),
    ],
  },
  {
    keywords: ["brasil", "brasileiro", "colonia", "colônia", "imperial", "republica", "república"],
    pool: [
      u("1556742049-0cfed4f6a45d"),
      u("1565060170695-1d6d12c2fa8a"),
    ],
  },
  {
    keywords: ["africa", "africana", "escravidao", "escravidão", "colonialismo"],
    pool: [
      u("1547471080-7cc2caa01a7e"),
      u("1461360370896-922624d12aa1"),
    ],
  },
  {
    keywords: ["contemporanea", "contemporânea", "moderna", "xvi", "xvii", "xviii", "xix", "xx"],
    pool: [
      u("1565060170695-1d6d12c2fa8a"),
      u("1503754215593-3db9c27d26c4"),
    ],
  },
  // Geografia — subtopics
  {
    keywords: ["climatologia", "clima", "atmosfera", "tempo", "meteorologia"],
    pool: [
      u("1504711434969-e33886168f5c"),
      u("1524661135-423995f22d0b"),
    ],
  },
  {
    keywords: ["relevo", "geomorfologia", "tectonica", "tectônica", "placa", "vulcao", "vulcão"],
    pool: [
      u("1494774157365-9e04c6720e47"),
      u("1446776811953-b23d57bd21aa"),
    ],
  },
  {
    keywords: ["hidro", "hidrografia", "rio", "oceano", "mar", "lago"],
    pool: [
      u("1500534314209-a25ddb2bd429"),
      u("1446776811953-b23d57bd21aa"),
    ],
  },
  {
    keywords: ["populacao", "população", "urbanizacao", "urbanização", "cidade", "metropole", "metrópole"],
    pool: [
      u("1477959858617-67f85cf4f1df"),
      u("1524661135-423995f22d0b"),
    ],
  },
  {
    keywords: ["globalizacao", "globalização", "geopolitica", "geopolítica", "fronteira"],
    pool: [
      u("1446776811953-b23d57bd21aa"),
      u("1524661135-423995f22d0b"),
    ],
  },
  // Redação / Escrita
  {
    keywords: ["redacao", "redação", "dissertacao", "dissertação", "argumentacao", "argumentação", "texto"],
    pool: [
      u("1455390582262-044cdead277a"),
      u("1455602990-37ee9082dab9"),
      u("1481556432650-c2e5f2b93c92"),
    ],
  },
  // Literatura
  {
    keywords: ["literatura", "literario", "literário", "obra", "autor", "poeta", "poema", "conto", "romance"],
    pool: [
      u("1495640388908-05fa85288e61"),
      u("1524995997946-a1180da4e2e0"),
      u("1456513080510-7bf3a84b82f8"),
    ],
  },
  // Filosofia
  {
    keywords: ["filosofia", "filosofico", "filosófico", "kant", "plato", "aristoteles", "socrates", "nietzsche", "etica", "ética"],
    pool: [
      u("1507679799987-c73779587ccf"),
      u("1544716278-ca5e3f4abd8c"),
      u("1548802673-380d62f63b2e"),
    ],
  },
  // Sociologia
  {
    keywords: ["sociologia", "sociologico", "sociológico", "sociedade", "cultura", "marxismo", "weber", "durkheim"],
    pool: [
      u("1582213782179-e0d53f98f2ca"),
      u("1529156069898-49953e39b3ac"),
    ],
  },
  // ENEM/Vestibular
  {
    keywords: ["enem", "vestibular", "simulado", "gabarito", "prova", "exame"],
    pool: [
      u("1434030216411-0b793f4b4173"),
      u("1471107191679-f26174d2b994"),
      u("1523050854058-8df90110c9f1"),
    ],
  },
  // Inglês / Language
  {
    keywords: ["ingles", "inglês", "english", "language", "idioma", "lingua", "língua"],
    pool: [
      u("1546410531-bb4caa6b424d"),
      u("1456513080510-7bf3a84b82f8"),
    ],
  },
];

// ── Category fallback pools ────────────────────────────────────────────────────

const CATEGORY_POOLS: Record<string, string[]> = {
  "Matemática": [
    u("1509228468518-180dd4864904"),
    u("1518133910820-d799d1f6507b"),
    u("1606326608606-aa0b62935f2b"),
    u("1596495577886-d920f1fb7238"),
    u("1571260898890-5d900d4d08c8"),
  ],
  "Física": [
    u("1635070041078-e363dbe005cb"),
    u("1564325724739-bae0bd08762c"),
    u("1581093450021-4a7360e9a6b5"),
    u("1518770660439-4636190af475"),
    u("1498049200459-53e4f902e1ab"),
  ],
  "Química": [
    u("1532094349884-543648cdbd8e"),
    u("1576086213369-31c54e8a5b96"),
    u("1532094349884-543648cdbd8e"),
    u("1605722905765-96d58e1c5c1d"),
    u("1564325724739-bae0bd08762c"),
  ],
  "Biologia": [
    u("1576319155264-99536e0be1ee"),
    u("1559757148-5e9d0a5f6a35"),
    u("1552475342-971c97b12d1e"),
    u("1448375240586-882707db888b"),
    u("1576319155264-99536e0be1ee"),
  ],
  "História": [
    u("1461360370896-922624d12aa1"),
    u("1565060170695-1d6d12c2fa8a"),
    u("1503754215593-3db9c27d26c4"),
    u("1487022059861-fff3bf91c6ab"),
    u("1540539234-c14a20fb7c7b"),
  ],
  "Geografia": [
    u("1524661135-423995f22d0b"),
    u("1446776811953-b23d57bd21aa"),
    u("1494774157365-9e04c6720e47"),
    u("1504711434969-e33886168f5c"),
    u("1477959858617-67f85cf4f1df"),
  ],
  "Português": [
    u("1455390582262-044cdead277a"),
    u("1495640388908-05fa85288e61"),
    u("1524995997946-a1180da4e2e0"),
    u("1456513080510-7bf3a84b82f8"),
    u("1481556432650-c2e5f2b93c92"),
  ],
  "Linguagens": [
    u("1455390582262-044cdead277a"),
    u("1495640388908-05fa85288e61"),
    u("1524995997946-a1180da4e2e0"),
    u("1456513080510-7bf3a84b82f8"),
    u("1481556432650-c2e5f2b93c92"),
  ],
  "Literatura": [
    u("1495640388908-05fa85288e61"),
    u("1524995997946-a1180da4e2e0"),
    u("1456513080510-7bf3a84b82f8"),
    u("1433878455-93f2ae57b64e"),
    u("1481556432650-c2e5f2b93c92"),
  ],
  "Filosofia": [
    u("1507679799987-c73779587ccf"),
    u("1544716278-ca5e3f4abd8c"),
    u("1548802673-380d62f63b2e"),
    u("1455390582262-044cdead277a"),
  ],
  "Sociologia": [
    u("1582213782179-e0d53f98f2ca"),
    u("1529156069898-49953e39b3ac"),
    u("1477959858617-67f85cf4f1df"),
    u("1460472178825-e5240f4d6b39"),
  ],
  "Atualidades": [
    u("1504711434969-e33886168f5c"),
    u("1477959858617-67f85cf4f1df"),
    u("1451187580459-43490279c0fa"),
    u("1589578527966-fdac0f44566c"),
  ],
  "Inglês": [
    u("1546410531-bb4caa6b424d"),
    u("1456513080510-7bf3a84b82f8"),
    u("1495640388908-05fa85288e61"),
  ],
  "Informática": [
    u("1517694712202-14dd9538aa97"),
    u("1555066931-bf19f8fd1085"),
    u("1518770660439-4636190af475"),
  ],
  "Artes": [
    u("1452802447250-470a88ac82bc"),
    u("1513364776144-60329532bd91"),
    u("1536924940926-3b1e5048e0c9"),
  ],
  "Educação Física": [
    u("1517649763962-0c623066013b"),
    u("1571019614242-c5c5dee9f50b"),
    u("1526506118085-60ce8714f8c5"),
  ],
};

const DEFAULT_POOL = [
  u("1434030216411-0b793f4b4173"),
  u("1471107191679-f26174d2b994"),
  u("1523050854058-8df90110c9f1"),
  u("1581093450021-4a7360e9a6b5"),
  u("1490730161690-1af2f4da04ff"),
];

/** Returns a deterministic, topically-relevant Unsplash URL for a trail. */
export function getTrailCoverUrl(title: string, category: string): string {
  const normalized = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // 1. Check title keywords against topic pools
  for (const { keywords, pool } of TOPIC_POOLS) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return pick(pool, title);
    }
  }

  // 2. Fall back to category pool
  const catPool = CATEGORY_POOLS[category];
  if (catPool) return pick(catPool, title);

  // 3. Try partial category match
  for (const [cat, pool] of Object.entries(CATEGORY_POOLS)) {
    if (normalized.includes(cat.toLowerCase()) || cat.toLowerCase().includes(normalized.slice(0, 6))) {
      return pick(pool, title);
    }
  }

  // 4. Generic education fallback
  return pick(DEFAULT_POOL, title);
}

/** True if the URL is a random placeholder that should be replaced. */
export function isPlaceholderImage(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.includes("picsum.photos") || url.includes("pixabay.com");
}
