'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthProvider';
import { supabase } from '@/app/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy, Medal, Crown, Flame, Star,
  Loader2, RefreshCw, Zap, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { celebrateOnce } from '@/lib/celebrate';

type RankEntry = {
  student_id:  string;
  full_name:   string;
  avatar_url:  string | null;
  exam_target: string | null;
  weekly_xp:   number;
  total_xp:    number;
  position:    number;
};

/** Pódio congelado da leva anterior (`ranking_last_podium`). */
type PodiumWinner = {
  position:    number;
  student_id:  string;
  full_name:   string;
  avatar_url:  string | null;
  xp:          number;
  cycle_label: string | null;
};

function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-16 w-16 text-xl' : size === 'md' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs';
  const initials = name?.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
  if (url) return (
    <img src={url} alt={name} className={`${sz} rounded-full object-cover border-2 border-foreground shrink-0`} />
  );
  // Fundo chapado da paleta (era um gradiente violeta→roxo, fora do produto).
  return (
    <div className={`${sz} rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black border-2 border-foreground shrink-0`}>
      {initials}
    </div>
  );
}

/**
 * Degrau do pódio em NÍVEL ALTO: cor chapada da paleta + sombra dura, no lugar
 * do gradiente ouro/prata/bronze com glow. As três posições usam as três cores
 * do produto — é o que amarra esta tela à landing sem copiá-la.
 */
function PodiumCard({ entry, place }: { entry: RankEntry; place: 1 | 2 | 3 }) {
  const configs = {
    1: {
      height: 'h-32 sm:h-36',
      bg: 'bg-accent',                 // amarelo #EDE04C
      text: 'text-accent-foreground',
      icon: <Crown className="h-5 w-5" />,
      label: '1º',
      avatarSize: 'lg' as const,
    },
    2: {
      height: 'h-24',
      bg: 'bg-primary',                // ciano #4CCCED
      text: 'text-primary-foreground',
      icon: <Medal className="h-4 w-4" />,
      label: '2º',
      avatarSize: 'md' as const,
    },
    3: {
      height: 'h-20',
      bg: 'bg-brand-pink',             // rosa #ED3474
      text: 'text-white',
      icon: <Trophy className="h-4 w-4" />,
      label: '3º',
      avatarSize: 'md' as const,
    },
  } as const;

  const c = configs[place];

  return (
    <div
      className={`flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 ${
        place === 1 ? 'order-2 duration-700' : place === 2 ? 'order-1 duration-500' : 'order-3 duration-[900ms]'
      }`}
    >
      <div className="flex flex-col items-center gap-1.5">
        <div className={`relative rounded-full ${place === 1 ? 'ring-4 ring-accent' : ''}`}>
          <Avatar name={entry.full_name} url={entry.avatar_url} size={c.avatarSize} />
          <div className={`absolute -bottom-1 -right-1 ${c.bg} ${c.text} rounded-full p-1 border-2 border-foreground`}>
            {c.icon}
          </div>
        </div>
        <p className="text-xs font-bold text-center max-w-[84px] leading-tight truncate">
          {entry.full_name?.split(' ')[0]}
        </p>
        <div className="flex items-center gap-1 border-2 border-foreground bg-card rounded-control px-2 py-0.5">
          <Zap className="h-3 w-3 text-accent-foreground fill-accent" />
          <span className="u-num text-[11px]">{entry.weekly_xp}</span>
          <span className="u-label !text-[8px] !tracking-[0.2em]">XP</span>
        </div>
      </div>

      {/* Degrau: bloco chapado com sombra dura e a posição em display */}
      <div
        className={`w-[86px] sm:w-24 ${c.height} ${c.bg} ${c.text} rounded-t-card border-2 border-foreground border-b-0 shadow-hard flex items-end justify-center pb-3`}
      >
        <span className="u-num text-3xl">{c.label}</span>
      </div>
    </div>
  );
}

export default function RankingPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [ranking, setRanking]     = useState<RankEntry[]>([]);
  const [myEntry, setMyEntry]     = useState<RankEntry | null>(null);
  const [winners, setWinners]     = useState<PodiumWinner[]>([]);
  const [cycle, setCycle]         = useState<{ label: string | null; ends_at: string } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRanking = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Ranking único: ENEM e ETEC disputam juntos, sem filtro por trilha.
      const { data, error } = await supabase
        .from('weekly_ranking')
        .select('student_id, full_name, avatar_url, exam_target, weekly_xp, total_xp, position')
        .order('position', { ascending: true })
        .limit(50);

      if (error) throw error;

      const list = (data ?? []) as RankEntry[];
      setRanking(list);

      // Com trilha única a lista passou de dezenas para 1058 alunos, então a
      // maioria fica fora do top 50. Sem esta busca extra o aluno deixaria de
      // ver a própria posição — que é justamente o que o faz voltar.
      const naLista = list.find(r => r.student_id === user.id);
      if (naLista) {
        setMyEntry(naLista);
      } else {
        const { data: minha } = await supabase
          .from('weekly_ranking')
          .select('student_id, full_name, avatar_url, exam_target, weekly_xp, total_xp, position')
          .eq('student_id', user.id)
          .maybeSingle();
        setMyEntry((minha as RankEntry) ?? null);
      }

      // Vencedores da leva anterior. A falha silenciosa é proposital: se a view
      // ainda não existir no ambiente, o ranking da semana continua carregando.
      const { data: podio } = await supabase
        .from('ranking_last_podium')
        .select('position, student_id, full_name, avatar_url, xp, cycle_label')
        .order('position', { ascending: true });
      setWinners((podio as PodiumWinner[]) ?? []);

      // Janela real da disputa. Sem isto o cabeçalho anuncia "reseta toda
      // segunda" mesmo quando o ciclo vigente não é uma semana civil — a leva
      // atual, por exemplo, começou num sábado para não deixar buraco depois da
      // primeira premiação.
      const agora = new Date().toISOString();
      const { data: ciclo } = await supabase
        .from('ranking_cycles')
        .select('label, ends_at')
        .lte('starts_at', agora)
        .gte('ends_at', agora)
        .order('ends_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      setCycle((ciclo as { label: string | null; ends_at: string }) ?? null);

      setLastUpdated(new Date());
    } catch (e: any) {
      toast({ title: 'Erro ao carregar ranking', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const top3    = ranking.slice(0, 3);
  const rest    = ranking.slice(3);
  const myPos   = myEntry?.position ?? null;

  // Está no pódio? Festa — uma vez por aba, para não repetir a cada refresh.
  // A chave carrega a posição: subir de 3º para 1º celebra de novo, e é isso
  // que a gente quer premiar.
  useEffect(() => {
    if (!user || !myPos || myPos > 3) return;
    return celebrateOnce(`ranking:${user.id}:${myPos}`);
  }, [user, myPos]);

  const periodo = (() => {
    if (cycle) {
      const fim = new Date(cycle.ends_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
      return `${cycle.label ?? 'Leva atual'} · Vale até ${fim}`;
    }
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    const ini = mon.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    return `Semana de ${ini} · Reseta toda segunda-feira`;
  })();

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-6 pb-24 animate-in fade-in duration-700">

      {/* ── HERO (nível alto: cor chapada + sombra dura, sem glow difuso) ── */}
      <section className="aurora-dark relative overflow-hidden rounded-card p-6 sm:p-8 text-white border-2 border-foreground shadow-hard">
        {/* Sem blur difuso e sem bloco decorativo: o peso vem do título em
            display, do selo amarelo chapado e da sombra dura. Blocos soltos
            aqui colidiam com o selo (também amarelo) e liam como erro. */}
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none rounded-card" />

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="u-label !text-white/70 inline-flex items-center gap-1.5">
              <Trophy className="h-2.5 w-2.5" /> Ranking semanal
            </span>
            <h1 className="u-page-title text-[clamp(1.6rem,7vw,2.5rem)]">
              Tabela de<br />líderes
            </h1>
            <p className="text-white/50 text-xs font-medium">
              {periodo}
            </p>
          </div>

          {myPos && (
            <div className="shrink-0 text-center bg-accent text-accent-foreground rounded-card px-4 py-3 border-2 border-foreground">
              {/* tracking menor que o do u-label: em caixa estreita o padrão
                  (0.28em) quebrava "VOCÊ" e "LUGAR" em duas linhas. */}
              <p className="u-label !text-accent-foreground/70 !text-[8px] !tracking-[0.12em]">Você</p>
              <p className="u-num text-3xl leading-none">{myPos}º</p>
              <p className="u-label !text-accent-foreground/70 !text-[8px] !tracking-[0.12em] mt-0.5">lugar</p>
            </div>
          )}
        </div>

        {myEntry && (
          <div className="relative z-10 mt-5 flex items-center gap-3 bg-white/10 rounded-card px-4 py-3 border-2 border-white/25">
            <Avatar name={myEntry.full_name} url={myEntry.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{myEntry.full_name?.split(' ')[0]} (você)</p>
              <p className="u-label !text-white/50 !text-[9px] mt-0.5">
                <span className="u-num">{myEntry.weekly_xp}</span> XP esta semana
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Flame className="h-4 w-4 text-accent" />
              <span className="u-num text-sm">{myEntry.total_xp}</span>
              <span className="u-label !text-white/50 !text-[8px]">total</span>
            </div>
          </div>
        )}
      </section>

      {/* ── VENCEDORES DA LEVA ANTERIOR ── */}
      {winners.length > 0 && (
        <section className="rounded-card border-2 border-foreground bg-card p-6 shadow-hard">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Crown className="h-4 w-4 text-accent-foreground fill-accent" />
            <p className="u-label">Vencedores da leva anterior</p>
          </div>
          {winners[0]?.cycle_label && (
            <p className="text-center text-[10px] text-muted-foreground font-medium mb-4">
              {winners[0].cycle_label}
            </p>
          )}

          <div className="space-y-2">
            {winners.map((w) => {
              const isMe = w.student_id === user?.id;
              // Medalha por COR da paleta, não por emoji (1º amarelo, 2º ciano,
              // 3º rosa) — mesma leitura do pódio, e sem depender de emoji.
              const tom =
                w.position === 1 ? 'bg-accent text-accent-foreground'
                : w.position === 2 ? 'bg-primary text-primary-foreground'
                : w.position === 3 ? 'bg-brand-pink text-white'
                : 'bg-muted text-muted-foreground';
              return (
                <div
                  key={w.student_id}
                  className={`flex items-center gap-3 rounded-control border-2 px-4 py-2.5 ${
                    isMe ? 'border-foreground shadow-hard' : 'border-border bg-card'
                  }`}
                >
                  <span className={`u-num w-7 h-7 shrink-0 flex items-center justify-center rounded-full border-2 border-foreground text-xs ${tom}`}>
                    {w.position}
                  </span>
                  <Avatar name={w.full_name} url={w.avatar_url} size="sm" />
                  <p className="flex-1 min-w-0 truncate text-sm font-bold">
                    {w.full_name}
                    {isMe && <span className="ml-1.5 u-label !text-[8px] text-primary">(você)</span>}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <Zap className="h-3.5 w-3.5 text-accent-foreground fill-accent" />
                    <span className="u-num text-sm">{w.xp}</span>
                    <span className="u-label !text-[8px]">XP</span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-[10px] font-medium text-muted-foreground">
            A secretaria entra em contato com os premiados. A disputa recomeçou do zero — boa sorte!
          </p>
        </section>
      )}

      {/* Refresh */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="font-bold">{ranking.length} alunos no ranking</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRanking}
          disabled={loading}
          className="h-8 rounded-xl text-xs font-black text-muted-foreground hover:text-primary gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="py-20 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-slate-200" />
          <p className="u-page-title text-lg text-primary">Ranking ainda vazio</p>
          <p className="text-sm text-muted-foreground mt-1">
            Responda questões para aparecer aqui!
          </p>
        </div>
      ) : (
        <>
          {/* ── PÓDIO ── */}
          {top3.length >= 2 && (
            <div className="bg-card rounded-card border-2 border-foreground p-6 pb-0 shadow-hard overflow-hidden">
              <p className="u-label text-center mb-6">Top 3 da semana</p>
              <div className="flex items-end justify-center gap-3">
                {top3[1] && <PodiumCard entry={top3[1]} place={2} />}
                {top3[0] && <PodiumCard entry={top3[0]} place={1} />}
                {top3[2] && <PodiumCard entry={top3[2]} place={3} />}
              </div>
            </div>
          )}

          {/* ── LISTA ── */}
          {rest.length > 0 && (
            <div className="space-y-2">
              <p className="u-label px-1">Classificação geral</p>
              {rest.map((entry, idx) => {
                const isMe = entry.student_id === user?.id;
                return (
                  <div
                    key={entry.student_id}
                    // A SUA linha destaca por FORMA (borda grossa + sombra dura),
                    // não por um fundo de 5% de opacidade que some no celular.
                    className={`flex items-center gap-3 px-4 py-3 rounded-control border-2 transition-all ${
                      isMe
                        ? 'bg-primary/10 border-foreground shadow-hard'
                        : 'bg-card border-border hover:border-foreground/40'
                    }`}
                  >
                    <span className={`u-num w-8 text-center text-sm shrink-0 ${
                      isMe ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {entry.position}º
                    </span>

                    <Avatar name={entry.full_name} url={entry.avatar_url} size="sm" />

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? 'text-primary' : ''}`}>
                        {entry.full_name}
                        {isMe && <span className="u-label !text-[8px] ml-1.5 text-primary">(você)</span>}
                      </p>
                      <p className="u-label !text-[9px] mt-0.5">
                        <span className="u-num">{entry.total_xp}</span> XP total
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Zap className="h-3.5 w-3.5 text-accent-foreground fill-accent" />
                      <span className="u-num text-sm">{entry.weekly_xp}</span>
                      <span className="u-label !text-[8px]">XP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {lastUpdated && (
            <p className="text-center text-[9px] text-muted-foreground/40 font-medium">
              Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
