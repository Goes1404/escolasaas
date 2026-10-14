'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Sigma, BookOpen, PenLine, Atom, FlaskConical, Leaf, Landmark, Globe2,
  Brain, Languages, Music, Dumbbell, Calculator, GraduationCap, PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Capa de conteúdo (trilha, material, livro, aula). Ordem de preferência:
 *
 * 1. A imagem cadastrada pelo professor.
 * 2. Vídeo do YouTube → a miniatura oficial do próprio vídeo (i.ytimg.com).
 * 3. Capa da matéria: cor + ícone + padrão da marca, desenhada em CSS —
 *    zero requisição, nunca quebra, mesma cara em todo o catálogo.
 *
 * Se a imagem (1 ou 2) falhar ao carregar, cai para a capa da matéria.
 */

type Tema = { from: string; to: string; ink: string; icon: LucideIcon };

const TEMAS: Array<{ match: RegExp; tema: Tema }> = [
  { match: /matem|álgebra|algebra|geometr|estat/i, tema: { from: '#4CCCED', to: '#1E8FB0', ink: '#ffffff', icon: Sigma } },
  { match: /reda[cç]/i, tema: { from: '#EDE04C', to: '#D9B92E', ink: '#1f1d0c', icon: PenLine } },
  { match: /portug|linguag|literat|gram[aá]t|interpreta/i, tema: { from: '#ED3474', to: '#B81F57', ink: '#ffffff', icon: BookOpen } },
  { match: /f[ií]sic/i, tema: { from: '#3B5BDB', to: '#22379E', ink: '#ffffff', icon: Atom } },
  { match: /qu[ií]mic/i, tema: { from: '#7C9A3D', to: '#55702A', ink: '#ffffff', icon: FlaskConical } },
  { match: /biolog|ci[eê]ncia/i, tema: { from: '#2FA36B', to: '#1D7349', ink: '#ffffff', icon: Leaf } },
  { match: /hist[oó]r/i, tema: { from: '#E08A3C', to: '#B0611F', ink: '#ffffff', icon: Landmark } },
  { match: /geograf/i, tema: { from: '#1FA5A0', to: '#147371', ink: '#ffffff', icon: Globe2 } },
  { match: /filosof|sociolog|atualidade/i, tema: { from: '#475569', to: '#1E293B', ink: '#ffffff', icon: Brain } },
  { match: /ingl|espanh|l[ií]ngua estrangeira/i, tema: { from: '#C2457E', to: '#8E2A5A', ink: '#ffffff', icon: Languages } },
  { match: /arte|m[uú]sica/i, tema: { from: '#9B5DE5', to: '#6A35B5', ink: '#ffffff', icon: Music } },
  { match: /educa[cç][aã]o f[ií]sica/i, tema: { from: '#F15A3A', to: '#B83A1F', ink: '#ffffff', icon: Dumbbell } },
  { match: /exata|c[aá]lculo/i, tema: { from: '#4CCCED', to: '#1E8FB0', ink: '#ffffff', icon: Calculator } },
];
const PADRAO: Tema = { from: '#1f2937', to: '#0b0f17', ink: '#ffffff', icon: GraduationCap };

export function temaDaMateria(materia?: string | null, titulo?: string | null): Tema {
  const alvo = `${materia ?? ''} ${titulo ?? ''}`;
  return TEMAS.find((t) => t.match.test(alvo))?.tema ?? PADRAO;
}

/** Id do vídeo de qualquer link do YouTube; null se não for YouTube. */
export function youtubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function youtubeThumb(url?: string | null): string | null {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function imagemValida(url?: string | null) {
  if (!url) return false;
  const u = url.trim();
  // Fotos aleatórias usadas como "capa reserva" não contam como capa de verdade.
  if (!u || /picsum\.photos|placeholder|via\.placeholder/i.test(u)) return false;
  return /^(https?:)?\/\//.test(u) || u.startsWith('/') || u.startsWith('data:image');
}

export function ContentCover({
  imageUrl,
  videoUrl,
  subject,
  title,
  className,
  label,
  showPlay,
  imgClassName,
}: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  subject?: string | null;
  title?: string | null;
  className?: string;
  /** Texto pequeno na capa da matéria (ex.: a matéria). */
  label?: string | null;
  /** Mostra o ícone de play sobre miniatura de vídeo. */
  showPlay?: boolean;
  imgClassName?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const src = !falhou ? (imagemValida(imageUrl) ? imageUrl! : youtubeThumb(videoUrl)) : null;
  const tema = temaDaMateria(subject, title);
  const Icon = tema.icon;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {src ? (
        <>
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFalhou(true)}
            className={cn('absolute inset-0 h-full w-full object-cover', imgClassName)}
          />
          {showPlay && youtubeId(videoUrl) && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
              <PlayCircle className="h-12 w-12 text-white drop-shadow-lg" strokeWidth={1.5} />
            </span>
          )}
        </>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: `linear-gradient(140deg, ${tema.from} 0%, ${tema.to} 100%)`, color: tema.ink }}
        >
          {/* padrão sutil de pontos da marca */}
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.2px)', backgroundSize: '16px 16px' }}
          />
          <Icon className="absolute -right-4 -bottom-4 h-[62%] w-auto opacity-[0.16]" strokeWidth={1.25} />
          <div className="absolute inset-0 flex flex-col items-start justify-end p-4">
            <Icon className="h-7 w-7 mb-2 opacity-95" strokeWidth={1.8} />
            {(label || subject) && (
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-85">{label || subject}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
