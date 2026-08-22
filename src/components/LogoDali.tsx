/**
 * Logo do Dalí — desenho próprio.
 *
 * A referência é o surrealismo como LINGUAGEM (a matéria que amolece e escorre),
 * não a obra de Salvador Dalí: nada de relógio derretido, elefante de pernas
 * longas, gaveta no corpo ou o rosto do artista. Aqueles são trabalhos
 * específicos, protegidos até 2060, e a fundação defende nome e imagem.
 * Aqui o que derrete é a própria letra D — original, e não confundível com
 * nenhum quadro.
 *
 * Desenhado em traço pesado e forma chapada para casar com o resto do sistema
 * (Boldonse, borda de 2px, sombra dura) e continuar legível em favicon 32px.
 *
 * A geometria mora em `src/lib/logo-dali-geometry.ts` porque os PNGs do PWA são
 * gerados dos mesmos paths (`scripts/gen-icons.ts`).
 */

import { DROP, PATH_D, PATH_DRIP } from '@/lib/logo-dali-geometry';

interface LogoDaliProps {
  className?: string;
  /** Cor do miolo. Padrão: currentColor, para herdar do contexto. */
  fill?: string;
  /** Cor do contorno. Sem valor, o traço some (útil sobre fundo colorido). */
  stroke?: string;
  title?: string;
}

export function LogoDali({
  className,
  fill = 'currentColor',
  stroke,
  title = 'Dalí',
}: LogoDaliProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* O D fica ÍNTEGRO — esticar a haste fazia a letra ler como "P". O que
          derrete é um pingo pendurado no meio da base, ainda preso à letra. */}
      <path
        d={PATH_D}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 2.5 : 0}
        strokeLinejoin="round"
        fillRule="evenodd"
      />
      <path
        d={PATH_DRIP}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? 2.5 : 0}
        strokeLinejoin="round"
      />
      {/* A gota que já se soltou: é ela que diz "isto está derretendo" mesmo
          quando o logo aparece minúsculo. */}
      <ellipse {...DROP} fill={fill} stroke={stroke} strokeWidth={stroke ? 2.5 : 0} />
    </svg>
  );
}

/** Logo + palavra, para cabeçalhos. O nome usa a display do sistema. */
export function LogoDaliLockup({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <LogoDali className={compact ? 'h-5 w-5' : 'h-7 w-7'} />
      <span className={`u-display leading-none ${compact ? 'text-base' : 'text-xl'}`}>Dalí</span>
    </span>
  );
}
