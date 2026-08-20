/**
 * MascotEngine — a especificação do bichinho em 3D.
 *
 * O bichinho existia como um emoji de 7rem dentro de um cartão colorido. Este
 * módulo é a camada que falta entre o dado do banco (`meu_bichinho()`) e o
 * boneco 3D: traduz nível, humor e dias de estudo em CP, HP, iluminação e
 * estado de animação — o vocabulário de Pokémon GO que o aluno já conhece.
 *
 * ── Duas regras que valem para tudo aqui ──────────────────────────────────
 *
 * 1. **Nenhum número é inventado.** CP sai de nível + dias de estudo, que só
 *    crescem; HP sai do humor, que é reversível. Se o CP caísse porque o aluno
 *    gastou XP na loja, a loja viraria castigo — o mesmo erro que a migration
 *    do bichinho tomou o cuidado de evitar ao não debitar `xp_points`.
 *
 * 2. **Nada some por falta de dado.** Espécie nula, humor desconhecido e nível
 *    fora da escada caem em padrão válido. Esta engine desenha a tela inteira;
 *    ela não pode ser a razão de a tela sumir.
 */

import type { Bichinho, Especie, Humor } from '@/lib/bichinho';

// ── Arquétipos ─────────────────────────────────────────────────────────────
//
// O pedido trouxe quatro arquétipos novos (lobinho, dragão, dinossauro,
// elétrico). Os quatro antigos continuam aqui porque já existem alunos com
// eles adotados: uma engine que não sabe desenhar metade dos bichos em
// produção não serve. Todos rodam no mesmo rig paramétrico — o que muda entre
// um lobo e um tucano é orelha, focinho, cauda e paleta.

export type Arquetipo = Especie;

export type Textura = 'fur' | 'scales' | 'smooth_skin' | 'glowing_fur';

export type OrelhaVariante =
  | 'pontuda' | 'chifre' | 'pequena' | 'longa' | 'tufo' | 'guelras' | 'nenhuma';

export type FocinhoVariante =
  | 'focinho' | 'bico' | 'bico_grande' | 'bico_pato' | 'mandibula' | 'dragao' | 'bochecha';

export type CaudaVariante =
  | 'felpuda' | 'espinhosa' | 'grossa' | 'raio' | 'fina' | 'penas' | 'nenhuma';

export type EfeitoVariante = 'fogo' | 'faisca' | 'folha' | 'pena' | 'nenhum';

/**
 * Estados de animação.
 *
 * Os quatro primeiros são os do pedido. `carinho` e `soneca` foram acrescentados
 * porque o pedido também pede carinho explicitamente, e porque o humor
 * `dormindo` existe no banco desde a primeira migration — sem um estado para
 * ele, o bicho dormindo pularia de alegria.
 */
export type EstadoAnimacao =
  | 'idle_bounce' | 'happy_jump' | 'ar_capture_ring' | 'power_up'
  | 'carinho' | 'soneca';

export type Expressao = 'normal' | 'feliz' | 'fome' | 'triste' | 'dormindo' | 'amado';

export type Iluminacao = 'sunny_park' | 'neon_city' | 'sunset';

export type CorAnel = 'green' | 'yellow' | 'red';

export interface Paleta {
  /** Cor dominante do corpo. */
  primaria: string;
  /** Barriga, focinho, pontas — a cor clara que dá volume. */
  secundaria: string;
  /** Detalhe de destaque: bandana, chifre, bochecha. */
  detalhe: string;
  /** Sombra própria, usada nas faces que ficam de costas para a luz. */
  sombra: string;
  /** Íris. */
  olho: string;
}

export interface DefinicaoArquetipo {
  id: Arquetipo;
  nome: string;
  emoji: string;
  /** Uma linha que o aluno lê na hora de escolher. */
  tagline: string;
  textura: Textura;
  paleta: Paleta;
  orelha: OrelhaVariante;
  focinho: FocinhoVariante;
  cauda: CaudaVariante;
  efeito: EfeitoVariante;
  /** Dragão tem asas; o resto não. */
  asas: boolean;
  /** Multiplicador de escala do boneco inteiro. */
  escala: number;
  /** Termos de arte usados no prompt de geração de imagem. */
  descricaoEn: string;
  /** Introduzido no pedido dos arquétipos 3D — separa o novo do legado na UI. */
  novo: boolean;
}

export const ARQUETIPOS: DefinicaoArquetipo[] = [
  {
    id: 'lobinho',
    nome: 'Lobinho',
    emoji: '🐺',
    tagline: 'Pelagem felpuda, orelhas sempre alertas.',
    textura: 'fur',
    paleta: {
      primaria: '#94A3B8', secundaria: '#F1F5F9', detalhe: '#2563EB',
      sombra: '#64748B', olho: '#0EA5E9',
    },
    orelha: 'pontuda', focinho: 'focinho', cauda: 'felpuda', efeito: 'nenhum',
    asas: false, escala: 1,
    descricaoEn: 'a fluffy grey husky wolf pup with bright blue eyes, alert pointed ears and a huge curled fluffy tail',
    novo: true,
  },
  {
    id: 'dragao',
    nome: 'Dragão',
    emoji: '🐲',
    tagline: 'Escamas macias, asas pequenas e um brilho de fogo.',
    textura: 'scales',
    paleta: {
      primaria: '#8B5CF6', secundaria: '#DDD6FE', detalhe: '#FB923C',
      sombra: '#6D28D9', olho: '#FDE047',
    },
    orelha: 'chifre', focinho: 'dragao', cauda: 'espinhosa', efeito: 'fogo',
    asas: true, escala: 1.02,
    descricaoEn: 'a chubby baby dragon with soft violet scales, small rounded horns, tiny bat wings on its back and a warm ember glow',
    novo: true,
  },
  {
    id: 'dinossauro',
    nome: 'Dinossauro',
    emoji: '🦖',
    tagline: 'Bebê T-Rex rechonchudo, dentes arredondados.',
    textura: 'smooth_skin',
    paleta: {
      primaria: '#34D399', secundaria: '#FDE68A', detalhe: '#F59E0B',
      sombra: '#059669', olho: '#0F172A',
    },
    orelha: 'pequena', focinho: 'mandibula', cauda: 'grossa', efeito: 'folha',
    asas: false, escala: 1.04,
    descricaoEn: 'a chubby baby T-Rex with rubbery mint green skin, a pale yellow belly, big round eyes and small rounded teeth',
    novo: true,
  },
  {
    id: 'eletrico',
    nome: 'Elétrico',
    emoji: '⚡',
    tagline: 'Bochechas que brilham e faíscas no ar.',
    textura: 'glowing_fur',
    paleta: {
      primaria: '#FACC15', secundaria: '#FEF9C3', detalhe: '#EF4444',
      sombra: '#CA8A04', olho: '#1E293B',
    },
    orelha: 'longa', focinho: 'bochecha', cauda: 'raio', efeito: 'faisca',
    asas: false, escala: 0.98,
    descricaoEn: 'a small yellow electric rodent creature with long black-tipped ears, glowing red cheeks and a lightning-bolt tail crackling with sparks',
    novo: true,
  },
  {
    id: 'ornitorrinco',
    nome: 'Ornitorrinco',
    emoji: '🦫',
    tagline: 'Bico de pato, cauda de castor, nada como ninguém.',
    textura: 'fur',
    paleta: {
      primaria: '#8B5E3C', secundaria: '#D9B99B', detalhe: '#64748B',
      sombra: '#5C3D26', olho: '#1C1917',
    },
    orelha: 'nenhuma', focinho: 'bico_pato', cauda: 'grossa', efeito: 'nenhum',
    asas: false, escala: 1.02,
    descricaoEn: 'a chubby baby platypus with soft brown fur, a wide flat grey duck bill, dark round eyes and a broad beaver tail',
    novo: true,
  },
  {
    id: 'axolote',
    nome: 'Axolote',
    emoji: '🦎',
    tagline: 'Guelras cor-de-rosa e um sorriso que não sai.',
    textura: 'smooth_skin',
    paleta: {
      primaria: '#F9A8D4', secundaria: '#FCE7F3', detalhe: '#EC4899',
      sombra: '#DB7BAF', olho: '#1E293B',
    },
    orelha: 'guelras', focinho: 'focinho', cauda: 'fina', efeito: 'nenhum',
    asas: false, escala: 1,
    descricaoEn: 'a cute pink axolotl with feathery pink external gills, big dark eyes, a permanent smile and smooth glossy skin',
    novo: true,
  },
  // ── Legado: já existem alunos com estes adotados ─────────────────────────
  {
    id: 'capivara',
    nome: 'Capivara',
    emoji: '🦫',
    tagline: 'Calma como ninguém, e nunca desiste.',
    textura: 'fur',
    paleta: {
      primaria: '#A97155', secundaria: '#E7CBA9', detalhe: '#65A30D',
      sombra: '#7C4A2D', olho: '#1C1917',
    },
    orelha: 'pequena', focinho: 'focinho', cauda: 'nenhuma', efeito: 'folha',
    asas: false, escala: 1.05,
    descricaoEn: 'a chubby friendly capybara with warm brown fur, tiny round ears and a calm smile',
    novo: false,
  },
  {
    id: 'coruja',
    nome: 'Coruja',
    emoji: '🦉',
    tagline: 'Olhos enormes, estuda de madrugada.',
    textura: 'fur',
    paleta: {
      primaria: '#B08968', secundaria: '#F5E6D3', detalhe: '#F59E0B',
      sombra: '#8A6A4F', olho: '#F59E0B',
    },
    orelha: 'tufo', focinho: 'bico', cauda: 'penas', efeito: 'pena',
    asas: false, escala: 0.98,
    descricaoEn: 'a round fluffy owlet with huge amber eyes, feather tufts and a small orange beak',
    novo: false,
  },
  {
    id: 'gato',
    nome: 'Gato',
    emoji: '🐱',
    tagline: 'Dorme no caderno, mas sempre volta.',
    textura: 'fur',
    paleta: {
      primaria: '#FB923C', secundaria: '#FFF7ED', detalhe: '#0EA5E9',
      sombra: '#EA580C', olho: '#22C55E',
    },
    orelha: 'pontuda', focinho: 'focinho', cauda: 'fina', efeito: 'nenhum',
    asas: false, escala: 0.97,
    descricaoEn: 'a small orange tabby kitten with pointed ears, green eyes and a thin curved tail',
    novo: false,
  },
  {
    id: 'tucano',
    nome: 'Tucano',
    emoji: '🦜',
    tagline: 'Bico grande, anuncia cada conquista.',
    textura: 'fur',
    paleta: {
      primaria: '#1F2937', secundaria: '#FEF3C7', detalhe: '#FBBF24',
      sombra: '#0F172A', olho: '#FACC15',
    },
    orelha: 'nenhuma', focinho: 'bico_grande', cauda: 'penas', efeito: 'pena',
    asas: false, escala: 0.98,
    descricaoEn: 'a cartoon toucan chick with glossy black feathers, a cream chest and an oversized bright yellow beak',
    novo: false,
  },
];

const PADRAO = ARQUETIPOS[0];

export function arquetipo(id: Arquetipo | null | undefined): DefinicaoArquetipo {
  return ARQUETIPOS.find(a => a.id === id) ?? PADRAO;
}

/**
 * Os quatro que cabem no cartão da home.
 *
 * O cartão não tem altura para os dez, e quem quiser ver todos toca nele e cai
 * na página do bichinho. São os quatro primeiros da lista — a ordem de
 * `ARQUETIPOS` é a ordem de destaque.
 */
export const ARQUETIPOS_DESTAQUE = ARQUETIPOS.slice(0, 4);

// ── Combate de mentirinha, dados de verdade ────────────────────────────────

/**
 * CP — o número grande no topo da arena.
 *
 * Só sobe. Sai de nível e dias de estudo, as duas grandezas que a migration
 * garantiu monotônicas (`total_study_days` "só cresce"). Ofensiva ficou de
 * fora de propósito: ela zera, e um CP que despenca depois de um fim de semana
 * mal dado transforma o boneco em cobrança.
 *
 * Escala: nível 1 sem estudo nenhum = 165; nível 8 com 90 dias = 1200.
 */
export function calcularCP(b: Pick<Bichinho, 'nivel' | 'dias_estudo'>): number {
  const nivel = Number.isFinite(b.nivel) ? Math.max(1, Math.trunc(b.nivel)) : 1;
  const dias = Number.isFinite(b.dias_estudo) ? Math.max(0, Math.trunc(b.dias_estudo)) : 0;
  return 120 + nivel * 45 + dias * 8;
}

/** Quanto o humor preenche a barra de HP. */
const VIGOR: Record<Humor, number> = {
  novo: 1, feliz: 1, com_fome: 0.7, triste: 0.4, dormindo: 0.15,
};

export function calcularHP(b: Pick<Bichinho, 'nivel' | 'humor'>): { hp: number; hpMax: number } {
  const nivel = Number.isFinite(b.nivel) ? Math.max(1, Math.trunc(b.nivel)) : 1;
  const hpMax = 50 + nivel * 10;
  const vigor = VIGOR[b.humor] ?? 1;
  // Nunca zero: HP a zero é a linguagem de "desmaiado", e o bicho não morre.
  return { hp: Math.max(1, Math.round(hpMax * vigor)), hpMax };
}

/**
 * A cor do anel de captura.
 *
 * Em Pokémon GO o anel diz o quanto vai ser difícil capturar. Aqui ele diz o
 * quanto o bicho precisa de você: verde é "tudo em dia", vermelho é "ele está
 * te esperando há dias". Mesma gramática visual, significado que serve ao
 * aluno.
 */
export function corDoAnel(humor: Humor): CorAnel {
  if (humor === 'feliz' || humor === 'novo') return 'green';
  if (humor === 'com_fome') return 'yellow';
  return 'red';
}

export function iluminacaoDoHumor(humor: Humor): Iluminacao {
  if (humor === 'feliz' || humor === 'novo') return 'sunny_park';
  if (humor === 'dormindo') return 'neon_city';
  return 'sunset';
}

export function expressaoDoHumor(humor: Humor): Expressao {
  switch (humor) {
    case 'feliz': return 'feliz';
    case 'novo': return 'normal';
    case 'com_fome': return 'fome';
    case 'triste': return 'triste';
    case 'dormindo': return 'dormindo';
    default: return 'normal';
  }
}

export function animacaoDoHumor(humor: Humor): EstadoAnimacao {
  switch (humor) {
    case 'novo': return 'ar_capture_ring';
    case 'feliz': return 'happy_jump';
    case 'dormindo': return 'soneca';
    default: return 'idle_bounce';
  }
}

/** Gradientes de fundo da arena, um por iluminação. */
export const CENARIOS: Record<Iluminacao, { ceu: string; chao: string; luz: string; rotulo: string }> = {
  sunny_park: {
    ceu: 'linear-gradient(180deg,#7DD3FC 0%,#BAE6FD 42%,#86EFAC 42%,#4ADE80 100%)',
    chao: '#4ADE80',
    luz: '#FEF9C3',
    rotulo: 'Parque ensolarado',
  },
  sunset: {
    ceu: 'linear-gradient(180deg,#FB923C 0%,#FDBA74 40%,#FCD34D 40%,#F59E0B 100%)',
    chao: '#F59E0B',
    luz: '#FFEDD5',
    rotulo: 'Fim de tarde',
  },
  neon_city: {
    ceu: 'linear-gradient(180deg,#1E1B4B 0%,#312E81 44%,#4C1D95 44%,#1E1B4B 100%)',
    chao: '#4C1D95',
    luz: '#A5B4FC',
    rotulo: 'Cidade à noite',
  },
};

// ── A especificação (o JSON do pedido) ─────────────────────────────────────

export interface EspecificacaoMascote {
  mascot_id: string;
  name: string;
  archetype: Arquetipo;
  cp: number;
  hp: number;
  visual_properties: {
    primary_color_hex: string;
    secondary_color_hex: string;
    texture_type: Textura;
    size_scale: number;
    accessories: string[];
  };
  animation_state: EstadoAnimacao;
  ar_ui: {
    catch_ring_color: CorAnel;
    environment_lighting: Iluminacao;
    overlay_text: string;
  };
  image_gen_prompt: string;
}

/**
 * Iluminação, não cenário.
 *
 * A arena desenha o próprio fundo (céu, chão, bokeh) e ainda o troca conforme o
 * humor. Uma imagem com parque embutido brigaria com isso: o bicho pula, se
 * inclina com o dedo e dá pirueta, e um parque colado nele pularia junto. Então
 * o que o prompt pede do ambiente é só a luz que bate no bicho.
 */
const ILUMINACAO_EN: Record<Iluminacao, string> = {
  sunny_park: 'warm midday sunlight from above, soft dappled highlights',
  sunset: 'warm golden-hour rim light from the side',
  neon_city: 'cool blue and violet rim light, dim ambient',
};

const ANIMACAO_EN: Record<EstadoAnimacao, string> = {
  idle_bounce: 'standing still and breathing gently',
  happy_jump: 'mid-jump, ears up, beaming with joy',
  ar_capture_ring: 'looking straight at the camera, curious and expectant',
  power_up: 'glowing with energy as it levels up, light swirling around it',
  carinho: 'eyes closed, leaning happily into a gentle head pat',
  soneca: 'curled up asleep, peaceful',
};

/**
 * Monta o prompt em inglês para gerar a arte do bichinho.
 *
 * ── O resultado precisa ser um recorte, não uma cena ───────────────────────
 *
 * A parte mais importante deste prompt é o fim: fundo transparente, sem chão e
 * sem sombra. A arena já desenha céu, chão e bokeh, e ainda os troca conforme o
 * humor do bicho; o boneco por cima pula, se inclina com o dedo e dá pirueta.
 * Uma imagem com parque embutido tornaria tudo isso impossível — o parque
 * pularia junto, e o sistema de iluminação por humor viraria enfeite morto.
 *
 * Por isso o ambiente entra só como direção de luz (`ILUMINACAO_EN`), nunca
 * como paisagem.
 */
export function promptDeImagem(
  def: DefinicaoArquetipo,
  estado: EstadoAnimacao,
  luz: Iluminacao,
  acessorios: string[],
): string {
  const extras = acessorios.length ? `, wearing ${acessorios.join(' and ')}` : '';
  return [
    `3D rendered Pixar-style character render of ${def.descricaoEn}${extras}`,
    ANIMACAO_EN[estado],
    ILUMINACAO_EN[luz],
    'soft global illumination, subsurface scattering, chunky stylized proportions, big expressive eyes, mobile game creature',
    'full body, centered, feet at the bottom edge, isolated cutout on a fully transparent background',
    'no background, no scenery, no ground, no cast shadow, no text, no watermark',
    '--ar 1:1 --style raw',
  ].join(', ');
}

/**
 * Acessórios ganhos por progresso.
 *
 * Só o que o aluno conquistou aparece — o brinde da casa é a bandana, que todo
 * bicho adotado usa.
 */
export function acessoriosDe(b: Bichinho): string[] {
  const lista = ['a blue bandana'];
  if (b.nivel >= 4) lista.push('a small graduation cap');
  if (b.ofensiva >= 7) lista.push('a glowing flame charm');
  if (b.protecoes > 0) lista.push('a tiny shield pin');
  return lista;
}

/**
 * O estado completo do mascote, pronto para a arena — e serializável como o
 * JSON da especificação.
 *
 * `estadoForcado` existe para as animações que o aluno dispara com o dedo
 * (carinho, power-up ao subir de nível): elas não vêm do banco, vêm do toque.
 */
export function specDoMascote(
  b: Bichinho,
  opcoes: { mascotId?: string; estadoForcado?: EstadoAnimacao } = {},
): EspecificacaoMascote {
  const def = arquetipo(b.especie);
  const { hp } = calcularHP(b);
  const luz = iluminacaoDoHumor(b.humor);
  const estado = opcoes.estadoForcado ?? animacaoDoHumor(b.humor);
  const nome = b.nome?.trim() || def.nome;
  const acessorios = acessoriosDe(b);

  return {
    mascot_id: opcoes.mascotId ?? `${def.id}-n${b.nivel}`,
    name: nome,
    archetype: def.id,
    cp: calcularCP(b),
    hp,
    visual_properties: {
      primary_color_hex: def.paleta.primaria,
      secondary_color_hex: def.paleta.secundaria,
      texture_type: def.textura,
      // O bicho cresce de verdade conforme sobe de nível: 1.0 no filhote,
      // ~1.35 no imortal. É a recompensa que o aluno vê sem ler número nenhum.
      size_scale: Number((def.escala * (1 + (Math.max(1, b.nivel) - 1) * 0.05)).toFixed(2)),
      accessories: acessorios,
    },
    animation_state: estado,
    ar_ui: {
      catch_ring_color: corDoAnel(b.humor),
      environment_lighting: luz,
      overlay_text: `${nome.toUpperCase()} · CP ${calcularCP(b)}`,
    },
    image_gen_prompt: promptDeImagem(def, estado, luz, acessorios),
  };
}

// ── Carinho ────────────────────────────────────────────────────────────────

/**
 * O que o bicho responde quando recebe carinho.
 *
 * Uma frase por humor, sorteada, e nenhuma delas cobra. Quem sumiu duas semanas
 * já sabe que sumiu — é a mesma decisão que a migration registrou por escrito.
 */
const FALAS_CARINHO: Record<Humor, string[]> = {
  novo: ['Oi! 🐾', 'Vamos começar?', 'Que bom te ver!'],
  feliz: ['Aaah, isso! 💛', 'De novo, de novo!', 'Você voltou! 🎉', 'Ronrom… 😌'],
  com_fome: ['Que fome… 🍎', 'Uma questão só?', 'Tô te esperando 👀'],
  triste: ['Senti sua falta 💧', 'Você voltou…', 'Fica mais um pouco?'],
  dormindo: ['Zzz… 💤', 'Hmm…?', 'Só mais cinco minutos…'],
};

export function falaDeCarinho(humor: Humor): string {
  const lista = FALAS_CARINHO[humor] ?? FALAS_CARINHO.novo;
  return lista[Math.floor(Math.random() * lista.length)];
}
