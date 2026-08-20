import { supabase } from '@/app/lib/supabase';

/**
 * Espécies adotáveis.
 *
 * Os quatro primeiros são os arquétipos 3D; os quatro últimos são o legado —
 * já existem alunos com eles adotados, e tirar uma espécie da lista apagaria o
 * bicho de quem a escolheu. A arte de todos vive em `@/lib/mascote`.
 *
 * Precisa bater com o CHECK de `pets.especie` e com a validação de
 * `adotar_bichinho()` — quem recusa espécie inválida é o banco.
 */
export type Especie =
  | 'lobinho' | 'dragao' | 'dinossauro' | 'eletrico' | 'axolote' | 'ornitorrinco'
  | 'capivara' | 'coruja' | 'gato' | 'tucano';
export type Humor = 'novo' | 'feliz' | 'com_fome' | 'triste' | 'dormindo';

export interface Bichinho {
  existe: boolean;
  especie: Especie | null;
  nome: string | null;
  /**
   * O nome que o aluno deu a cada espécie, não só à atual.
   *
   * Sem isso, trocar de dragão "Fumaça" para lobinho e voltar apagava
   * "Fumaça" — a troca reaproveitava sempre o nome da espécie anterior, porque
   * só existia um campo de nome no banco. Agora cada espécie lembra o próprio
   * nome, e `nome` é só o apelido ativo (o da espécie corrente).
   */
  apelidos: Partial<Record<Especie, string>>;
  nivel: number;
  humor: Humor;
  dias_estudo: number;
  dias_proximo_nivel: number | null;
  ofensiva: number;
  protecoes: number;
  dias_sem_estudar: number | null;
  /** XP disponível para gastar: acumulado de vida menos o já gasto. */
  saldo: number;
  preco_protecao: number;
}

export const NIVEIS = [
  'Filhote', 'Curioso', 'Esperto', 'Estudioso',
  'Sábio', 'Mestre', 'Lendário', 'Imortal',
];

/**
 * Dias de estudo acumulados que abrem cada nível.
 *
 * Precisa bater com `c_niveis` em `meu_bichinho()` — quem calcula o nível é o
 * banco; aqui só se desenha a barra de progresso.
 */
export const DIAS_POR_NIVEL = [0, 3, 7, 14, 25, 40, 60, 90];

/**
 * O que o bicho sente e o que ele pede.
 *
 * Nenhum estado é definitivo e nenhum culpa o aluno: quem sumiu duas semanas já
 * sabe que sumiu, e ouvir isso do aplicativo é o que faz desinstalar. O bicho
 * dorme, não morre — e acorda com uma questão.
 */
export const HUMORES: Record<Humor, {
  rotulo: string;
  fala: (nome: string) => string;
  emoji: string;
  animacao: string;
}> = {
  novo: {
    rotulo: 'Esperando você',
    fala: () => 'Responda uma questão para começarmos!',
    emoji: '✨',
    animacao: 'animate-bounce',
  },
  feliz: {
    rotulo: 'Feliz',
    fala: nome => `${nome} está animado — você estudou hoje!`,
    emoji: '💛',
    animacao: 'animate-bounce',
  },
  com_fome: {
    rotulo: 'Com fome',
    fala: nome => `${nome} está esperando você estudar hoje.`,
    emoji: '🍎',
    animacao: 'animate-pulse',
  },
  triste: {
    rotulo: 'Sentindo sua falta',
    fala: nome => `${nome} sente sua falta. Uma questão já anima ele.`,
    emoji: '💧',
    animacao: '',
  },
  dormindo: {
    rotulo: 'Dormindo',
    fala: nome => `${nome} foi dormir esperando. Estude hoje para acordar ele.`,
    emoji: '💤',
    animacao: '',
  },
};

export async function getBichinho(): Promise<Bichinho | null> {
  const { data, error } = await supabase.rpc('meu_bichinho');
  if (error || !data) {
    if (error) console.warn('[bichinho]', error.message);
    return null;
  }
  return data as unknown as Bichinho;
}

export async function adotarBichinho(especie: Especie, nome: string): Promise<Bichinho> {
  const { data, error } = await supabase.rpc('adotar_bichinho', {
    p_especie: especie,
    p_nome: nome,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Bichinho;
}

export async function comprarProtecao(): Promise<Bichinho> {
  const { data, error } = await supabase.rpc('comprar_protecao');
  if (error) throw new Error(error.message);
  return data as unknown as Bichinho;
}

/**
 * O nome que o aluno já deu a essa espécie, se algum dia deu.
 *
 * É o que permite a tela de troca pré-preencher "Fumaça" quando o aluno volta
 * para o dragão, em vez de abrir o campo em branco de novo.
 */
export function apelidoDe(bicho: Pick<Bichinho, 'apelidos'>, especie: Especie): string {
  return bicho.apelidos?.[especie] ?? '';
}

export function nomeDoNivel(nivel: number): string {
  return NIVEIS[Math.min(nivel, NIVEIS.length) - 1] ?? NIVEIS[0];
}

/** Quanto falta, em dias de estudo, para o próximo nível. */
export function progressoDoNivel(b: Bichinho): { pct: number; faltam: number | null } {
  if (b.dias_proximo_nivel == null) return { pct: 100, faltam: null };
  const faltam = Math.max(0, b.dias_proximo_nivel - b.dias_estudo);
  // A régua vai do início do nível ATUAL até o próximo, não de zero — medindo
  // desde zero, o aluno de nível 6 veria a barra quase cheia o tempo todo.
  const inicio = DIAS_POR_NIVEL[b.nivel - 1] ?? 0;
  const total = b.dias_proximo_nivel - inicio;
  const feito = b.dias_estudo - inicio;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((feito / total) * 100))) : 0;
  return { pct, faltam };
}
