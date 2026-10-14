import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Estado vazio padrão da plataforma: ícone, o que vai aparecer aqui e a
 * próxima ação. Substitui o texto cinza solto ("Nenhum evento agendado",
 * "Aguardando dados de performance") que fazia a tela parecer quebrada.
 *
 * Regra de texto: o título diz o que ainda não existe, em linguagem de gente
 * ("Você ainda não fez simulados"); a descrição diz o que vai aparecer e
 * como fazer aparecer. Sem jargão, sem caixa alta gritada.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondary,
  tone = 'light',
  compact = false,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void; icon?: LucideIcon };
  secondary?: { label: string; href?: string; onClick?: () => void };
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}) {
  const dark = tone === 'dark';
  const ActionIcon = action?.icon;
  const btn = cn(
    'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-control text-sm font-bold transition-colors',
    dark ? 'bg-white text-slate-900 hover:bg-white/90' : 'bg-primary text-white hover:bg-primary/90',
  );
  const btn2 = cn(
    'inline-flex items-center justify-center h-10 px-4 rounded-control text-sm font-bold transition-colors',
    dark ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground',
  );

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center text-center rounded-card border border-dashed',
        compact ? 'px-5 py-8' : 'px-6 py-12',
        dark ? 'border-white/15 bg-white/[0.03]' : 'border-border bg-card/60',
        className,
      )}
    >
      <div
        className={cn(
          'mb-4 flex items-center justify-center rounded-2xl',
          compact ? 'h-11 w-11' : 'h-14 w-14',
          dark ? 'bg-white/10 text-white' : 'bg-primary/10 text-primary',
        )}
      >
        <Icon className={compact ? 'h-5 w-5' : 'h-7 w-7'} strokeWidth={1.8} />
      </div>
      <p className={cn('font-bold leading-snug', compact ? 'text-sm' : 'text-base', dark ? 'text-white' : 'text-foreground')}>
        {title}
      </p>
      {description && (
        <p className={cn('mt-1.5 max-w-sm text-sm leading-relaxed', dark ? 'text-white/60' : 'text-muted-foreground')}>
          {description}
        </p>
      )}
      {(action || secondary) && (
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-2">
          {action && (action.href ? (
            <Link href={action.href} className={btn}>{ActionIcon && <ActionIcon className="h-4 w-4" />}{action.label}</Link>
          ) : (
            <button type="button" onClick={action.onClick} className={btn}>{ActionIcon && <ActionIcon className="h-4 w-4" />}{action.label}</button>
          ))}
          {secondary && (secondary.href ? (
            <Link href={secondary.href} className={btn2}>{secondary.label}</Link>
          ) : (
            <button type="button" onClick={secondary.onClick} className={btn2}>{secondary.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
