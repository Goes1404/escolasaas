'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, Shield, Trophy, Loader2, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { estadoOfensiva } from '@/lib/streak';
import {
  getBichinho, adotarBichinho, comprarProtecao,
  HUMORES, nomeDoNivel, progressoDoNivel,
  type Bichinho, type Especie,
} from '@/lib/bichinho';
import { ARQUETIPOS_DESTAQUE, arquetipo, calcularCP, expressaoDoHumor } from '@/lib/mascote';
import { MascoteRetrato } from '@/components/mascote/MascoteRetrato';

/**
 * Bichinho de estimação — e, junto, a ofensiva.
 *
 * Substitui o `StreakWidget` em vez de somar mais um cartão: a home já tinha
 * oito, e enfiar o bicho como nono empurraria tudo para fora da primeira tela
 * justamente no aparelho onde o aluno estuda. Ofensiva e bicho contam a mesma
 * história — quantos dias seguidos —, então ocupam o mesmo espaço.
 */
export function BichinhoWidget() {
  const { toast } = useToast();
  const [bicho, setBicho] = useState<Bichinho | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [especie, setEspecie] = useState<Especie>('lobinho');
  const [nome, setNome] = useState('');

  useEffect(() => {
    let vivo = true;
    getBichinho()
      .then(b => { if (vivo) setBicho(b); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  async function adotar() {
    const escolhido = nome.trim();
    if (!escolhido) {
      toast({ title: 'Dê um nome a ele', description: 'É o seu bichinho — escolha como quer chamá-lo.' });
      return;
    }
    setSalvando(true);
    try {
      setBicho(await adotarBichinho(especie, escolhido));
      toast({
        title: `${escolhido} é seu! ${arquetipo(especie).emoji}`,
        description: 'Ele cresce a cada dia que você estuda.',
      });
    } catch (e) {
      toast({
        title: 'Não deu para adotar agora',
        description: e instanceof Error ? e.message : 'Tente de novo.',
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  }

  async function comprar() {
    setSalvando(true);
    try {
      setBicho(await comprarProtecao());
      toast({ title: 'Proteção comprada 🛡️', description: 'Ela segura sua ofensiva num dia que você faltar.' });
    } catch (e) {
      toast({
        title: 'Não foi possível comprar',
        description: e instanceof Error ? e.message : 'Tente de novo.',
        variant: 'destructive',
      });
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <div className="h-64 rounded-card bg-muted/20 animate-pulse" />;
  }

  // Sumir em silêncio era exatamente o defeito: qualquer falha na chamada
  // fazia o cartão desaparecer da home, sem erro e sem explicação — o aluno
  // concluía que o bichinho não existe. Melhor um convite que leva à página,
  // onde o erro aparece por extenso e há um botão de tentar de novo.
  if (!bicho) {
    return (
      <Link
        href="/dashboard/student/bichinho"
        className="block rounded-card bg-slate-100 border border-slate-200 p-6 text-center active:scale-[0.99] transition-transform"
      >
        <p className="text-3xl mb-1" aria-hidden>🐾</p>
        <p className="text-sm font-black italic text-slate-700">Seu bichinho</p>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">
          Não carregou agora — toque para abrir.
        </p>
      </Link>
    );
  }

  // ── Adoção ───────────────────────────────────────────────────────────────
  if (!bicho.existe) {
    return (
      <div className="gradient-border bg-white rounded-card shadow-xl overflow-hidden">
        <div className="p-6 space-y-4 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 text-white">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Novo</p>
            <p className="text-xl font-black italic leading-tight">Escolha seu bichinho</p>
            <p className="text-[11px] font-bold text-white/70 mt-1">
              Ele sobe de nível a cada dia que você estuda — e nunca morre se você sumir.
            </p>
          </div>

          {/* Só quatro aqui: o cartão da home não tem altura para os dez
              arquétipos, e a página do bichinho mostra todos. */}
          <div className="grid grid-cols-4 gap-2">
            {ARQUETIPOS_DESTAQUE.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setEspecie(a.id)}
                aria-pressed={especie === a.id}
                className={`rounded-2xl p-1.5 border transition-all ${
                  especie === a.id
                    ? 'bg-white/25 border-white/50 scale-105'
                    : 'bg-white/10 border-white/10 hover:bg-white/15'
                }`}
              >
                <MascoteRetrato
                  especie={a.id}
                  expressao={especie === a.id ? 'feliz' : 'normal'}
                  className="w-full h-12"
                />
                <span className="text-[9px] font-black uppercase tracking-wide block mt-0.5">{a.nome}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="nome-bichinho" className="text-[10px] font-black uppercase tracking-widest text-white/60 block">
              Como ele se chama?
            </label>
            <input
              id="nome-bichinho"
              value={nome}
              onChange={ev => setNome(ev.target.value)}
              maxLength={20}
              placeholder="Ex.: Tobias"
              className="w-full rounded-2xl bg-white/15 border border-white/20 px-4 py-2.5 text-sm font-bold placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            />
            <button
              type="button"
              onClick={adotar}
              disabled={salvando}
              className="w-full rounded-2xl bg-white text-indigo-700 font-black py-2.5 text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Adotar {arquetipo(especie).nome}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Bicho adotado ────────────────────────────────────────────────────────
  const humor = HUMORES[bicho.humor];
  const apelido = bicho.nome ?? 'Seu bichinho';
  const { pct, faltam } = progressoDoNivel(bicho);
  const animado = bicho.humor === 'feliz' || bicho.humor === 'novo';
  const podeComprar = bicho.protecoes < 2 && bicho.saldo >= bicho.preco_protecao;

  // O humor vem do banco e conta os dias parados; o estado da ofensiva diz se
  // esses dias foram cobertos por proteção. É a diferença entre "você perdeu"
  // e "quase perdeu, mas a proteção segurou" — e só a segunda dá vontade de
  // voltar.
  const ofensiva = estadoOfensiva({
    dias_sem_estudar: bicho.dias_sem_estudar,
    current_streak: bicho.ofensiva,
    protections: bicho.protecoes,
  });

  return (
    <Link href="/dashboard/student/bichinho" className="block gradient-border bg-white rounded-card shadow-xl overflow-hidden active:scale-[0.99] transition-transform">
      <div className={`p-6 space-y-4 relative text-white ${
        animado
          ? 'bg-gradient-to-br from-orange-500 via-rose-500 to-red-600'
          : bicho.humor === 'com_fome'
            ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600'
            : 'bg-gradient-to-br from-slate-700 to-slate-900'
      }`}>
        <div className="flex items-start gap-4">
          {/* Retrato parado, não o rig 3D: o cartão é um `Link`, e arrastar para
              girar brigaria com a navegação. O boneco que gira e recebe carinho
              está na página, a um toque daqui. */}
          <div className={`shrink-0 w-20 ${bicho.humor === 'dormindo' ? 'opacity-60' : ''}`}>
            <MascoteRetrato
              especie={bicho.especie}
              nivel={bicho.nivel}
              expressao={expressaoDoHumor(bicho.humor)}
              className={`w-20 h-20 ${humor.animacao}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
              Nível {bicho.nivel} · {nomeDoNivel(bicho.nivel)} · CP {calcularCP(bicho)}
            </p>
            <p className="text-xl font-black italic leading-tight truncate">{apelido}</p>
            <p className="text-[11px] font-bold text-white/75 leading-tight mt-1">
              {humor.emoji} {humor.fala(apelido)}
            </p>
          </div>
          {/* O cartão precisa levar a algum lugar: sem isto o aluno adotava o
              bichinho e não tinha para onde ir depois. */}
          <ChevronRight className="h-5 w-5 text-white/40 shrink-0 mt-1" aria-hidden />
        </div>

        {/* Progresso de nível — dias acumulados, que nunca voltam atrás. */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-[10px] font-black uppercase tracking-widest text-white/60">
            <span>{bicho.dias_estudo} {bicho.dias_estudo === 1 ? 'dia estudado' : 'dias estudados'}</span>
            <span>{faltam == null ? 'Nível máximo' : `Faltam ${faltam} para o nível ${bicho.nivel + 1}`}</span>
          </div>
          <div className="h-2 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-2xl p-2.5 border border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5 flex items-center gap-1">
              <Flame className="h-2.5 w-2.5" /> Ofensiva
            </p>
            <p className="text-2xl font-black tabular-nums">{bicho.ofensiva}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5 border border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5 flex items-center gap-1">
              <Shield className="h-2.5 w-2.5" /> Proteções
            </p>
            <p className="text-2xl font-black tabular-nums">{bicho.protecoes}</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-2.5 border border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5 flex items-center gap-1">
              <Trophy className="h-2.5 w-2.5" /> Saldo
            </p>
            <p className="text-2xl font-black tabular-nums">{bicho.saldo}</p>
          </div>
        </div>

        {ofensiva === 'protegida' && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-400/15 border border-emerald-300/25">
            <Shield className="h-4 w-4 text-emerald-200 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold leading-tight text-emerald-50">
              Você faltou, mas uma proteção segurou sua ofensiva de {bicho.ofensiva}{' '}
              {bicho.ofensiva === 1 ? 'dia' : 'dias'}. Estude hoje para seguir de onde parou.
            </p>
          </div>
        )}

        {ofensiva === 'ultimo_dia' && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-yellow-400/20 border border-yellow-300/30">
            <Flame className="h-4 w-4 text-yellow-200 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold leading-tight text-yellow-50">
              Hoje é o último dia para manter sua ofensiva de {bicho.ofensiva}{' '}
              {bicho.ofensiva === 1 ? 'dia' : 'dias'}.
            </p>
          </div>
        )}

        {bicho.protecoes < 2 && (
          <button
            type="button"
            // Dentro de um Link: sem isto o clique no botao navegaria para a
            // pagina em vez de comprar.
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void comprar(); }}
            disabled={!podeComprar || salvando}
            className="w-full rounded-2xl bg-white/15 border border-white/20 py-2.5 text-[11px] font-black uppercase tracking-wide disabled:opacity-50 hover:bg-white/25 transition-colors flex items-center justify-center gap-2"
          >
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {podeComprar
              ? `Comprar proteção · ${bicho.preco_protecao} XP`
              : `Proteção custa ${bicho.preco_protecao} XP — faltam ${bicho.preco_protecao - bicho.saldo}`}
          </button>
        )}
      </div>
    </Link>
  );
}
