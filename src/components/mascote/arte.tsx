/**
 * A arte do bichinho, em peças separadas.
 *
 * ── Por que não three.js ───────────────────────────────────────────────────
 *
 * A opção óbvia para "quero ele 3D" seria `three` + `react-three-fiber`. Custa
 * ~600 KB de JS e exige um `.glb` por arquétipo — modelos que não existem e que
 * alguém teria de esculpir. Numa plataforma que roda no celular de aluno de
 * cursinho, com a maioria em rede móvel, isso é caro demais para um enfeite.
 *
 * O que está aqui é um rig 2.5D: o bicho é desenhado em nove camadas, cada uma
 * numa profundidade diferente, e a rotação desloca as camadas horizontalmente
 * em `profundidade * sen(θ)`. É paralaxe de verdade — ao girar, o focinho
 * atravessa o rosto, as orelhas trocam de lado e a cauda contorna o corpo.
 * Passando de 90°, entra a arte de costas. Dá volta completa, pesa alguns KB e
 * anima em transform puro (sem layout, sem repaint).
 *
 * ── Uma peça por variante, não uma por bicho ───────────────────────────────
 *
 * São oito arquétipos e não oito desenhos: o que muda entre um lobo e um tucano
 * é orelha, focinho, cauda e paleta. Cada variante é uma função aqui, e o
 * arquétipo em `@/lib/mascote` só diz quais combinar.
 */

import type {
  CaudaVariante, EfeitoVariante, Expressao, FocinhoVariante,
  OrelhaVariante, Paleta,
} from '@/lib/mascote';

export type Vista = 'frente' | 'costas';

/**
 * As camadas, do fundo para a frente, com a profundidade que cada uma ocupa.
 *
 * Os valores estão em unidades do viewBox (200×200) e são o que produz a
 * paralaxe: a cauda a -46 corre para o lado oposto do focinho a +30 quando o
 * bicho gira, que é exatamente o que o olho lê como profundidade.
 */
export const CAMADAS = [
  'cauda', 'asas', 'orelhas', 'corpo', 'acessorio', 'cabeca', 'chapeu', 'focinho', 'olhos', 'efeito',
] as const;

export type Camada = (typeof CAMADAS)[number];

/**
 * A profundidade de cada camada.
 *
 * A regra que faz o rig funcionar: **peça grudada em outra tem a profundidade
 * dela.** Orelha e chapéu andam com a cabeça; a bandana anda com o peito. Foi o
 * que a primeira versão errou — orelha a -8 contra cabeça a +16 abria um vão de
 * 24 unidades, e a 45° as orelhas descolavam e flutuavam ao lado do bicho.
 *
 * Só protuberância de verdade ganha profundidade própria: focinho e olhos
 * projetam para a frente da cabeça, cauda e asas para trás do corpo. É essa
 * diferença que produz a paralaxe.
 */
export const PROFUNDIDADE: Record<Camada, number> = {
  cauda: -46,
  asas: -30,
  corpo: 0,
  acessorio: 8,   // bandana, no peito
  orelhas: 16,    // com a cabeça
  cabeca: 16,
  chapeu: 18,     // com a cabeça
  olhos: 24,
  focinho: 30,
  efeito: 44,
};

interface PecaProps {
  p: Paleta;
  uid: string;
}

// ── Cauda ──────────────────────────────────────────────────────────────────

export function Cauda({ variante, p, uid, vista }: PecaProps & { variante: CaudaVariante; vista: Vista }) {
  // De costas a cauda aparece inteira e mais alta — é o que o olho espera de um
  // bicho visto por trás.
  const dy = vista === 'costas' ? -6 : 0;

  switch (variante) {
    case 'felpuda':
      return (
        <g transform={`translate(0 ${dy})`}>
          <path
            d="M138 128 C168 126 184 104 178 82 C174 66 158 60 148 70 C140 78 146 90 156 88 C164 86 166 96 158 104 C148 114 140 118 134 120 Z"
            fill={p.primaria}
          />
          <path
            d="M150 118 C170 110 178 94 174 82 C171 72 162 68 156 74 C166 80 168 96 156 106 Z"
            fill={p.secundaria}
            opacity="0.75"
          />
        </g>
      );

    case 'espinhosa':
      return (
        <g transform={`translate(0 ${dy})`}>
          <path d="M136 132 C160 132 178 120 186 100 L176 96 C170 114 156 122 134 122 Z" fill={p.primaria} />
          <path d="M150 124 l6 -12 6 12 Z M164 118 l6 -12 5 13 Z M176 106 l7 -10 3 12 Z" fill={p.detalhe} />
        </g>
      );

    case 'grossa':
      return (
        <g transform={`translate(0 ${dy})`}>
          <path d="M134 134 C162 136 182 124 192 106 C184 100 176 100 170 106 C160 116 148 122 132 122 Z" fill={p.primaria} />
          <path d="M140 128 C160 128 174 120 182 110" stroke={p.sombra} strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" />
        </g>
      );

    case 'raio':
      return (
        <g transform={`translate(0 ${dy})`}>
          <path d="M134 130 L162 126 L150 108 L182 100 L156 96 L172 78 L140 92 L136 118 Z" fill={p.primaria} stroke={p.sombra} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M148 118 L166 112 L158 102" stroke={p.secundaria} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
        </g>
      );

    case 'fina':
      return (
        <g transform={`translate(0 ${dy})`}>
          <path
            d="M136 132 C166 134 182 116 178 96 C176 84 164 80 158 88"
            stroke={p.primaria}
            strokeWidth="13"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M160 86 C166 82 172 86 172 94" stroke={p.secundaria} strokeWidth="9" fill="none" strokeLinecap="round" />
        </g>
      );

    case 'penas':
      return (
        <g transform={`translate(0 ${dy})`}>
          {[0, 1, 2].map(i => (
            <ellipse
              key={i}
              cx={152 + i * 9}
              cy={140 - i * 5}
              rx="22"
              ry="9"
              fill={i === 1 ? p.secundaria : p.primaria}
              transform={`rotate(${-14 - i * 9} ${152 + i * 9} ${140 - i * 5})`}
            />
          ))}
        </g>
      );

    default:
      return null;
  }
}

// ── Asas (só o dragão) ─────────────────────────────────────────────────────

export function Asas({ p, uid }: PecaProps) {
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-asa`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.secundaria} />
          <stop offset="100%" stopColor={p.primaria} />
        </linearGradient>
      </defs>
      {[-1, 1].map(lado => (
        <g key={lado} transform={`translate(100 108) scale(${lado} 1)`}>
          <path
            d="M6 -6 C26 -34 56 -40 62 -24 C58 -22 54 -18 52 -12 C60 -10 64 -4 60 6 C50 16 26 14 6 -6 Z"
            fill={`url(#${uid}-asa)`}
            stroke={p.sombra}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M20 -12 L44 -20 M24 -2 L52 -6" stroke={p.sombra} strokeWidth="1.6" opacity="0.4" />
        </g>
      ))}
    </g>
  );
}

// ── Orelhas ────────────────────────────────────────────────────────────────

export function Orelhas({ variante, p, vista }: PecaProps & { variante: OrelhaVariante; vista: Vista }) {
  if (variante === 'nenhuma') return null;
  // Vista de costas: só a casca externa, sem o miolo claro.
  const miolo = vista === 'costas' ? null : p.secundaria;

  return (
    <g>
      {[-1, 1].map(lado => (
        <g key={lado} transform={`translate(100 52) scale(${lado} 1)`}>
          {variante === 'pontuda' && (
            <>
              <path d="M12 6 L20 -34 L44 -2 Z" fill={p.primaria} stroke={p.sombra} strokeWidth="2" strokeLinejoin="round" />
              {miolo && <path d="M20 2 L24 -22 L36 -2 Z" fill={miolo} />}
            </>
          )}

          {variante === 'chifre' && (
            <>
              <path d="M14 2 C16 -18 28 -28 38 -22 C32 -14 32 -4 26 4 Z" fill={p.detalhe} stroke={p.sombra} strokeWidth="2" strokeLinejoin="round" />
              <circle cx="36" cy="-22" r="5" fill={p.detalhe} stroke={p.sombra} strokeWidth="2" />
            </>
          )}

          {variante === 'pequena' && (
            <>
              <ellipse cx="28" cy="-2" rx="12" ry="11" fill={p.primaria} stroke={p.sombra} strokeWidth="2" />
              {miolo && <ellipse cx="29" cy="-1" rx="6" ry="5.5" fill={miolo} />}
            </>
          )}

          {variante === 'longa' && (
            <>
              <path d="M14 4 C14 -22 22 -48 34 -52 C44 -54 44 -30 32 -6 Z" fill={p.primaria} stroke={p.sombra} strokeWidth="2" strokeLinejoin="round" />
              <path d="M28 -38 C36 -42 40 -48 36 -52 C28 -52 24 -46 22 -38 Z" fill={p.sombra} />
              {miolo && <path d="M20 0 C20 -18 26 -34 32 -38" stroke={miolo} strokeWidth="5" fill="none" strokeLinecap="round" />}
            </>
          )}

          {variante === 'tufo' && (
            <path d="M16 4 C14 -14 22 -28 34 -26 C30 -18 30 -6 26 2 Z" fill={p.primaria} stroke={p.sombra} strokeWidth="2" strokeLinejoin="round" />
          )}

          {/* Guelras do axolote: três plumas por lado, é a silhueta inteira do
              bicho. Vão para fora e para cima, não para trás como orelha. */}
          {variante === 'guelras' && [0, 1, 2].map(i => (
            <g key={i} transform={`translate(${18 + i * 4} ${-2 - i * 12}) rotate(${-18 - i * 16})`}>
              <path d="M0 0 L34 -4" stroke={p.detalhe} strokeWidth="3.5" strokeLinecap="round" />
              {[8, 16, 24, 30].map(d => (
                <g key={d}>
                  <path d={`M${d} ${-d * 0.12} l4 -7`} stroke={p.detalhe} strokeWidth="2.6" strokeLinecap="round" />
                  <path d={`M${d} ${-d * 0.12} l4 7`} stroke={p.detalhe} strokeWidth="2.6" strokeLinecap="round" />
                </g>
              ))}
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

// ── Corpo ──────────────────────────────────────────────────────────────────

export function Corpo({ p, uid, vista }: PecaProps & { vista: Vista }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}-corpo`} cx="0.36" cy="0.28" r="0.85">
          <stop offset="0%" stopColor={p.secundaria} stopOpacity="0.55" />
          <stop offset="55%" stopColor={p.primaria} />
          <stop offset="100%" stopColor={p.sombra} />
        </radialGradient>
      </defs>

      {/* Patas de trás, antes do tronco. */}
      {[68, 116].map(x => (
        <rect key={x} x={x} y={148} width="20" height="32" rx="10" fill={p.sombra} />
      ))}

      <ellipse cx="100" cy="130" rx="43" ry="37" fill={`url(#${uid}-corpo)`} />

      {vista === 'frente' ? (
        <ellipse cx="100" cy="140" rx="27" ry="25" fill={p.secundaria} opacity="0.95" />
      ) : (
        /* De costas o volume vem de uma faixa de sombra na espinha. */
        <path d="M100 96 C112 112 112 148 100 166 C88 148 88 112 100 96 Z" fill={p.sombra} opacity="0.35" />
      )}

      {/* Patas da frente, depois do tronco. */}
      {[76, 106].map(x => (
        <g key={x}>
          <rect x={x} y={152} width="20" height="30" rx="10" fill={p.primaria} />
          <ellipse cx={x + 10} cy={178} rx="10" ry="5.5" fill={vista === 'frente' ? p.secundaria : p.sombra} />
        </g>
      ))}
    </g>
  );
}

// ── Cabeça ─────────────────────────────────────────────────────────────────

export function Cabeca({ p, uid, vista }: PecaProps & { vista: Vista }) {
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}-cabeca`} cx="0.34" cy="0.26" r="0.86">
          <stop offset="0%" stopColor={p.secundaria} stopOpacity="0.6" />
          <stop offset="52%" stopColor={p.primaria} />
          <stop offset="100%" stopColor={p.sombra} />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="74" rx="40" ry="37" fill={`url(#${uid}-cabeca)`} />
      {vista === 'frente' && (
        /* Testa clara: é o que separa a cabeça do corpo quando as duas têm a
           mesma cor. */
        <ellipse cx="100" cy="88" rx="27" ry="20" fill={p.secundaria} opacity="0.45" />
      )}
      <ellipse cx="86" cy="56" rx="13" ry="9" fill="#FFFFFF" opacity="0.28" transform="rotate(-22 86 56)" />
    </g>
  );
}

// ── Focinho ────────────────────────────────────────────────────────────────

export function Focinho({ variante, p, expressao }: PecaProps & { variante: FocinhoVariante; expressao: Expressao }) {
  const sorrindo = expressao === 'feliz' || expressao === 'amado';
  const boca = expressao === 'triste'
    ? 'M92 100 C96 96 104 96 108 100'          // canto para baixo
    : sorrindo
      ? 'M88 94 C94 106 106 106 112 94'        // sorriso aberto
      : 'M92 95 C96 100 104 100 108 95';       // neutro

  switch (variante) {
    case 'focinho':
    case 'bochecha':
      return (
        <g>
          <ellipse cx="100" cy="92" rx="21" ry="16" fill={p.secundaria} />
          <ellipse cx="100" cy="84" rx="7.5" ry="6" fill={p.sombra} />
          <path d={boca} stroke={p.sombra} strokeWidth="2.6" fill={sorrindo ? '#BE185D' : 'none'} strokeLinecap="round" />
          {sorrindo && <ellipse cx="100" cy="101" rx="5" ry="3" fill="#FB7185" />}
          {variante === 'bochecha' && (
            /* As bochechas do arquétipo elétrico: elas que "brilham". */
            <>
              <circle cx="64" cy="90" r="11" fill={p.detalhe} opacity="0.9" />
              <circle cx="136" cy="90" r="11" fill={p.detalhe} opacity="0.9" />
              <circle cx="61" cy="87" r="4" fill="#FFFFFF" opacity="0.6" />
              <circle cx="133" cy="87" r="4" fill="#FFFFFF" opacity="0.6" />
            </>
          )}
        </g>
      );

    // Bico de coruja: pequeno e triangular. A versão larga que existia aqui
    // cobria a cara inteira e lia como focinho de cavalo.
    case 'bico':
      return (
        <g>
          <path d="M100 76 C110 76 116 82 114 88 L100 106 L86 88 C84 82 90 76 100 76 Z" fill={p.detalhe} stroke={p.sombra} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M88 88 L112 88" stroke={p.sombra} strokeWidth="1.6" opacity="0.5" />
          {/* Disco facial — é ele que faz a coruja parecer coruja. */}
          <ellipse cx="78" cy="72" rx="22" ry="24" fill={p.secundaria} opacity="0.4" />
          <ellipse cx="122" cy="72" rx="22" ry="24" fill={p.secundaria} opacity="0.4" />
        </g>
      );

    // Bico de tucano: grande e para o lado, que é a silhueta inteira do bicho.
    case 'bico_grande':
      return (
        <g>
          <path
            d="M98 80 C132 76 170 86 178 96 C170 108 130 112 98 104 Z"
            fill={p.detalhe}
            stroke={p.sombra}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M150 82 C166 86 174 91 178 96 C174 101 166 105 152 108 Z" fill="#EA580C" opacity="0.85" />
          <path d="M98 93 C130 97 160 97 178 96" stroke={p.sombra} strokeWidth="2" fill="none" opacity="0.6" />
        </g>
      );

    // Bico de pato do ornitorrinco: largo, chato e arredondado na ponta.
    case 'bico_pato':
      return (
        <g>
          <path
            d="M100 76 C126 76 142 84 142 94 C142 106 122 114 100 114 C78 114 58 106 58 94 C58 84 74 76 100 76 Z"
            fill={p.detalhe}
            stroke={p.sombra}
            strokeWidth="2"
          />
          <path d="M60 94 C78 100 122 100 140 94" stroke={p.sombra} strokeWidth="2.2" fill="none" opacity="0.55" />
          <ellipse cx="86" cy="86" rx="3.4" ry="2.4" fill={p.sombra} />
          <ellipse cx="114" cy="86" rx="3.4" ry="2.4" fill={p.sombra} />
        </g>
      );

    case 'mandibula':
      return (
        <g>
          <path d="M70 86 C70 76 130 76 130 86 C130 104 116 112 100 112 C84 112 70 104 70 86 Z" fill={p.secundaria} />
          <path d="M72 92 C86 100 114 100 128 92" stroke={p.sombra} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          {/* Dentes arredondados — nada de presa, é um bebê dino. */}
          {[80, 92, 108, 120].map(x => (
            <circle key={x} cx={x} cy={95} r="4" fill="#FFFFFF" />
          ))}
          <ellipse cx="88" cy="82" rx="3.5" ry="2.6" fill={p.sombra} />
          <ellipse cx="112" cy="82" rx="3.5" ry="2.6" fill={p.sombra} />
        </g>
      );

    case 'dragao':
      return (
        <g>
          <path d="M76 84 C76 76 124 76 124 84 C124 100 112 110 100 110 C88 110 76 100 76 84 Z" fill={p.secundaria} />
          <ellipse cx="90" cy="84" rx="4" ry="3" fill={p.sombra} />
          <ellipse cx="110" cy="84" rx="4" ry="3" fill={p.sombra} />
          <path d={boca} stroke={p.sombra} strokeWidth="2.6" fill={sorrindo ? '#BE185D' : 'none'} strokeLinecap="round" />
          {sorrindo && <path d="M88 98 l5 8 5 -8 Z" fill="#FFFFFF" />}
        </g>
      );

    default:
      return null;
  }
}

// ── Olhos ──────────────────────────────────────────────────────────────────

export function Olhos({ p, expressao }: PecaProps & { expressao: Expressao }) {
  const OLHOS = [{ x: 82 }, { x: 118 }];

  // Fechados e curvados para cima: é a cara de quem está recebendo carinho.
  if (expressao === 'amado' || expressao === 'feliz') {
    return (
      <g>
        {OLHOS.map(o => (
          <path
            key={o.x}
            d={`M${o.x - 10} 70 C${o.x - 4} 60 ${o.x + 4} 60 ${o.x + 10} 70`}
            stroke="#1E293B"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />
        ))}
        {expressao === 'amado' && (
          <>
            <ellipse cx="62" cy="80" rx="9" ry="5" fill="#FB7185" opacity="0.55" />
            <ellipse cx="138" cy="80" rx="9" ry="5" fill="#FB7185" opacity="0.55" />
          </>
        )}
      </g>
    );
  }

  if (expressao === 'dormindo') {
    return (
      <g>
        {OLHOS.map(o => (
          <path
            key={o.x}
            d={`M${o.x - 10} 68 C${o.x - 4} 76 ${o.x + 4} 76 ${o.x + 10} 68`}
            stroke="#1E293B"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </g>
    );
  }

  // Olho aberto: esclera, íris grande, pupila e dois brilhos. Os brilhos são o
  // que tira a cara de boneco morto.
  const olhar = expressao === 'triste' ? 4 : 0;
  return (
    <g>
      {OLHOS.map(o => (
        <g key={o.x}>
          <ellipse cx={o.x} cy={68} rx="13" ry="14.5" fill="#FFFFFF" />
          <circle cx={o.x} cy={68 + olhar} r="9.5" fill={p.olho} />
          <circle cx={o.x} cy={68 + olhar} r="5" fill="#0F172A" />
          <circle cx={o.x - 3.5} cy={64 + olhar} r="3.2" fill="#FFFFFF" />
          <circle cx={o.x + 4} cy={72 + olhar} r="1.8" fill="#FFFFFF" opacity="0.75" />
          {expressao === 'triste' && (
            <path d={`M${o.x - 12} 56 L${o.x + 2} 60`} stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
          )}
          {expressao === 'fome' && (
            <path d={`M${o.x - 11} 54 C${o.x - 4} 50 ${o.x + 4} 51 ${o.x + 11} 56`} stroke="#1E293B" strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
        </g>
      ))}
      {expressao === 'triste' && (
        <path d="M124 82 C128 88 132 92 128 96 C124 98 120 94 124 82 Z" fill="#38BDF8" opacity="0.9" />
      )}
    </g>
  );
}

// ── Acessório ──────────────────────────────────────────────────────────────

/** A bandana da casa — o mesmo detalhe azul que o mascote usa na referência. */
export function Acessorio({ p, vista }: PecaProps & { vista: Vista }) {
  if (vista === 'costas') {
    return <path d="M76 104 C88 114 112 114 124 104 L120 114 C110 120 90 120 80 114 Z" fill={p.detalhe} opacity="0.85" />;
  }
  return (
    <g>
      <path d="M74 104 C86 114 114 114 126 104 L120 116 C112 122 88 122 80 116 Z" fill={p.detalhe} />
      <path d="M94 116 L108 138 L100 136 L94 142 Z" fill={p.detalhe} />
    </g>
  );
}

/**
 * Capelo, a partir do nível 4.
 *
 * Camada própria porque ele pertence à cabeça, não ao peito: junto com a
 * bandana, um dos dois descolaria ao girar.
 */
export function Chapeu({ nivel }: { nivel: number }) {
  if (nivel < 4) return null;
  return (
    <g transform="translate(100 40)">
      <rect x="-9" y="-4" width="18" height="10" rx="3" fill="#1E293B" />
      <path d="M-22 -6 L0 -14 L22 -6 L0 2 Z" fill="#0F172A" />
      <path d="M18 -5 L20 10" stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="11" r="3" fill="#FBBF24" />
    </g>
  );
}

// ── Efeitos ────────────────────────────────────────────────────────────────

export function Efeito({ variante, p }: PecaProps & { variante: EfeitoVariante }) {
  if (variante === 'nenhum') return null;

  // Posições fixas, animadas por CSS na camada de cima: sortear aqui faria a
  // partícula pular de lugar a cada render.
  //
  // Todas ficam com folga da borda do viewBox. As que encostavam apareciam
  // cortadas pela metade no retrato pequeno, e um pedaço de chama grudado no
  // topo do quadro lê como falha de renderização, não como efeito.
  const pontos = [
    { x: 46, y: 66, s: 1 }, { x: 154, y: 58, s: 0.7 }, { x: 40, y: 122, s: 0.8 },
    { x: 162, y: 116, s: 0.9 }, { x: 66, y: 44, s: 0.6 }, { x: 140, y: 148, s: 0.75 },
  ];

  return (
    <g>
      {pontos.map((pt, i) => (
        <g
          key={i}
          transform={`translate(${pt.x} ${pt.y}) scale(${pt.s})`}
          style={{ animation: `mascote-particula 2.6s ease-in-out ${i * 0.34}s infinite` }}
        >
          {variante === 'fogo' && (
            <path d="M0 -9 C6 -3 6 4 0 9 C-6 4 -6 -3 0 -9 Z" fill="#FB923C">
              <animate attributeName="fill" values="#FB923C;#FDE047;#FB923C" dur="1.4s" repeatCount="indefinite" />
            </path>
          )}
          {variante === 'faisca' && (
            <path d="M-3 -10 L4 -2 L0 -1 L4 10 L-4 1 L0 0 Z" fill="#FDE047" stroke="#FACC15" strokeWidth="1" />
          )}
          {variante === 'folha' && (
            <path d="M0 -7 C7 -4 7 4 0 7 C-7 4 -7 -4 0 -7 Z" fill="#4ADE80" opacity="0.85" />
          )}
          {variante === 'pena' && (
            <ellipse rx="7" ry="3" fill={p.secundaria} opacity="0.8" transform="rotate(-25)" />
          )}
        </g>
      ))}
    </g>
  );
}
