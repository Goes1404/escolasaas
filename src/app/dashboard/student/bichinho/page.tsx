'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Flame, Shield, Trophy, Loader2, ArrowRight, Sparkles, Calendar, Info, Wand2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { estadoOfensiva } from '@/lib/streak';
import {
  getBichinho, adotarBichinho, comprarProtecao,
  HUMORES, DIAS_POR_NIVEL, NIVEIS,
  apelidoDe, nomeDoNivel, progressoDoNivel,
  type Bichinho, type Especie,
} from '@/lib/bichinho';
import { arquetipo } from '@/lib/mascote';
import { ArenaMascote } from '@/components/mascote/ArenaMascote';
import { SeletorArquetipo } from '@/components/mascote/SeletorArquetipo';
import { celebrate } from '@/lib/celebrate';

/**
 * A casa do bichinho.
 *
 * Nasceu de uma falha de projeto minha: o bichinho existia só como um cartão
 * espremido entre outros sete na home, sem link em lugar nenhum. Dava para
 * adotar e nunca mais achar — o aluno não tinha para onde ir. Uma criatura que
 * o aluno deve querer visitar precisa de endereço próprio.
 *
 * Aqui cabe o que não cabia no cartão: a escada de níveis inteira, a explicação
 * de como o bicho se alimenta e a compra de proteção com espaço para dizer o
 * que ela faz.
 */
const CHAVE_NIVEL = 'pet:ultimo-nivel';

export default function BichinhoPage() {
  const { toast } = useToast();
  const [bicho, setBicho] = useState<Bichinho | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [especie, setEspecie] = useState<Especie>('lobinho');
  const [nome, setNome] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [nomeTroca, setNomeTroca] = useState('');

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const b = await getBichinho();
      // Erro silencioso era o defeito irmão: `getBichinho` devolve null quando
      // a chamada falha, e a tela simplesmente sumia sem dizer nada.
      if (!b) throw new Error('Não conseguimos carregar seu bichinho agora.');
      setBicho(b);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  /**
   * Festa quando o bicho SOBE de nível.
   *
   * O nível vem de `dias_estudo`, que só cresce — então comparar com o último
   * nível visto (guardado localmente) é o que separa "subiu agora" de "sempre
   * esteve nesse nível". Sem o guard do zero, toda primeira visita celebraria.
   */
  useEffect(() => {
    if (!bicho?.existe) return;
    let anterior = 0;
    try {
      anterior = Number(localStorage.getItem(CHAVE_NIVEL) ?? 0);
      localStorage.setItem(CHAVE_NIVEL, String(bicho.nivel));
    } catch {
      return; // storage bloqueado: sem histórico, sem festa falsa
    }
    if (anterior > 0 && bicho.nivel > anterior) return celebrate();
  }, [bicho?.existe, bicho?.nivel]);

  async function adotar() {
    const escolhido = nome.trim();
    if (!escolhido) {
      toast({ title: 'Dê um nome a ele', description: 'É o seu bichinho — escolha como quer chamá-lo.' });
      return;
    }
    setSalvando(true);
    try {
      setBicho(await adotarBichinho(especie, escolhido));
      celebrate();
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

  /**
   * Escolhe a espécie na troca — e junto o nome que ela já teve.
   *
   * Sem isso, ir de dragão "Fumaça" para lobinho abriria o campo em branco
   * mesmo que o aluno já tivesse um lobinho chamado "Lupo" antes: o nome mora
   * por espécie (`apelidos`), então trocar de espécie é trocar de campo, não
   * só de figurinha.
   */
  function escolherNaTroca(nova: Especie) {
    setEspecie(nova);
    setNomeTroca(bicho ? apelidoDe(bicho, nova) : '');
  }

  /**
   * Troca a aparência — e, se for a primeira vez com essa espécie, batiza.
   *
   * `adotar_bichinho` é upsert e já permitia trocar de espécie desde a primeira
   * migration; nível, ofensiva e XP não se movem porque nunca estiveram presos
   * à espécie.
   */
  async function trocar() {
    const escolhido = nomeTroca.trim();
    if (!escolhido) {
      toast({
        title: 'Dê um nome a ele',
        description: `Como você quer chamar ${arquetipo(especie).nome.toLowerCase()}?`,
      });
      return;
    }
    setSalvando(true);
    try {
      setBicho(await adotarBichinho(especie, escolhido));
      setTrocando(false);
      toast({
        title: `Agora é ${escolhido}, o ${arquetipo(especie).nome}! ✨`,
        description: 'Seu nível, sua ofensiva e seu XP continuam iguais.',
      });
    } catch (e) {
      toast({
        title: 'Não deu para trocar agora',
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
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <div className="h-80 rounded-card bg-muted/20 animate-pulse" />
      </div>
    );
  }

  if (erro || !bicho) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <div className="rounded-card border border-rose-100 bg-rose-50 p-8 text-center space-y-4">
          <p className="u-page-title text-lg text-rose-900">{erro ?? 'Erro ao carregar.'}</p>
          <p className="text-sm font-medium text-rose-700/70">
            Pode ser a conexão. Tente de novo em instantes.
          </p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="h-12 px-8 rounded-control bg-rose-600 hover:opacity-90 text-white border-2 border-foreground u-label !text-white"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  // ── Adoção ───────────────────────────────────────────────────────────────
  if (!bicho.existe) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="u-page-title text-[clamp(1.7rem,7vw,2.4rem)] text-primary">
            Escolha seu bichinho
          </h1>
          <p className="text-sm md:text-base font-medium text-muted-foreground leading-relaxed max-w-xl">
            Ele sobe de nível a cada dia que você estuda. <strong>Nunca morre</strong> e
            nunca perde nível — se você sumir, ele só fica esperando.
          </p>
        </header>

        <div className="rounded-card bg-card shadow-hard border-2 border-foreground p-8 space-y-7">
          <SeletorArquetipo valor={especie} onChange={setEspecie} />

          <div className="space-y-3">
            <label htmlFor="nome" className="u-label block">
              Como ele se chama?
            </label>
            <input
              id="nome"
              value={nome}
              onChange={ev => setNome(ev.target.value)}
              maxLength={20}
              placeholder="Ex.: Tobias"
              className="w-full rounded-control border-2 border-slate-100 px-5 py-4 text-base font-bold outline-none focus-visible:border-primary"
            />
            <button
              type="button"
              onClick={adotar}
              disabled={salvando}
              className="w-full h-14 rounded-control bg-primary text-primary-foreground border-2 border-foreground shadow-hard u-label !text-primary-foreground !text-xs disabled:opacity-60 flex items-center justify-center gap-2 transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
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
  const ofensiva = estadoOfensiva({
    dias_sem_estudar: bicho.dias_sem_estudar,
    current_streak: bicho.ofensiva,
    protections: bicho.protecoes,
  });

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6">
      {/* A arena: o boneco 3D, o CP e o HP. */}
      <ArenaMascote bicho={bicho} tamanho="pagina" controles className="max-w-md mx-auto" />

      {/* Nível, humor e progresso — o que a moldura da arena não comporta sem
          virar HUD de jogo. */}
      {/* Nível alto: cor CHAPADA da paleta em vez de gradiente, e o humor é
          que escolhe a cor — ciano quando o bicho está bem, amarelo quando
          está com fome, escuro quando o aluno sumiu. */}
      <div className={`rounded-card border-2 border-foreground shadow-hard overflow-hidden ${
        animado
          ? 'bg-primary text-primary-foreground'
          : bicho.humor === 'com_fome'
            ? 'bg-accent text-accent-foreground'
            : 'bg-foreground text-background'
      }`}>
        <div className="p-6 md:p-8 text-center space-y-4">
          <div className="space-y-1.5">
            <h1 className="u-page-title text-[clamp(1.6rem,7vw,2.4rem)]">{apelido}</h1>
            <p className="u-label !text-current opacity-70">
              Nível {bicho.nivel} · {nomeDoNivel(bicho.nivel)} · {humor.rotulo}
            </p>
          </div>
          <p className="text-sm font-bold opacity-90 max-w-sm mx-auto leading-relaxed">
            {humor.emoji} {humor.fala(apelido)}
          </p>

          <div className="pt-2 space-y-1.5 max-w-md mx-auto">
            <div className="flex items-baseline justify-between">
              <span className="u-label !text-current !text-[9px] opacity-70">
                <span className="u-num">{bicho.dias_estudo}</span> {bicho.dias_estudo === 1 ? 'dia' : 'dias'} de estudo
              </span>
              <span className="u-label !text-current !text-[9px] opacity-70">
                {faltam == null ? 'Nível máximo' : `Faltam ${faltam}`}
              </span>
            </div>
            {/* Barra com traço firme, no lugar do pill translúcido. */}
            <div className="h-3 rounded-control border-2 border-current overflow-hidden">
              <div className="h-full bg-current transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-t-2 border-current/25">
          {[
            { icone: <Flame className="h-3 w-3" />, rot: 'Ofensiva', val: bicho.ofensiva },
            { icone: <Shield className="h-3 w-3" />, rot: 'Proteções', val: bicho.protecoes },
            { icone: <Trophy className="h-3 w-3" />, rot: 'XP livre', val: bicho.saldo },
          ].map((c, i) => (
            <div key={c.rot} className={`p-4 md:p-5 text-center ${i < 2 ? 'border-r-2 border-current/25' : ''}`}>
              <p className="u-label !text-current !text-[8px] opacity-70 mb-1 flex items-center justify-center gap-1">
                {c.icone} {c.rot}
              </p>
              <p className="u-num text-2xl md:text-3xl">{c.val}</p>
            </div>
          ))}
        </div>
      </div>

      {ofensiva === 'protegida' && (
        <div className="rounded-card bg-emerald-50 border border-emerald-100 p-5 flex items-start gap-3">
          <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-emerald-900 leading-relaxed">
            Você faltou, mas uma proteção segurou sua ofensiva de {bicho.ofensiva}{' '}
            {bicho.ofensiva === 1 ? 'dia' : 'dias'}. Estude hoje para seguir de onde parou.
          </p>
        </div>
      )}

      {ofensiva === 'ultimo_dia' && (
        <div className="rounded-card bg-amber-50 border border-amber-100 p-5 flex items-start gap-3">
          <Flame className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-amber-900 leading-relaxed">
            Hoje é o último dia para manter sua ofensiva de {bicho.ofensiva}{' '}
            {bicho.ofensiva === 1 ? 'dia' : 'dias'}. Uma questão resolve.
          </p>
        </div>
      )}

      {/* Ação principal: o que alimenta o bicho é estudar. */}
      {/* CTA da tela: recebe a sombra dura (a assinatura só vale no primário). */}
      <Link
        href="/dashboard/student/simulados"
        className="flex items-center justify-between gap-4 rounded-card bg-brand-pink text-white p-6 border-2 border-foreground shadow-hard transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
      >
        <div>
          <p className="u-label !text-white/70 !text-[9px]">Alimentar</p>
          <p className="u-page-title text-lg mt-0.5">Responder uma questão</p>
          <p className="text-xs font-medium text-white/70 mt-1">
            É o que faz {apelido} crescer — e mantém sua ofensiva.
          </p>
        </div>
        <ArrowRight className="h-6 w-6 shrink-0" />
      </Link>

      {/* Loja */}
      <section className="rounded-card bg-card border-2 border-border p-7 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-foreground fill-accent" />
          <h2 className="u-label !text-xs">Loja</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-control bg-slate-50 p-5">
          <div className="min-w-0">
            <p className="text-base font-black text-slate-800 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" /> Proteção de ofensiva
            </p>
            <p className="text-xs font-medium text-slate-500 mt-1 leading-relaxed max-w-sm">
              Cobre um dia que você faltar, sem zerar a ofensiva. Você pode ter
              até 2 guardadas, e ganha uma de graça a cada 5 dias seguidos.
            </p>
          </div>
          <button
            type="button"
            onClick={comprar}
            disabled={!podeComprar || salvando}
            className="h-12 px-6 rounded-control bg-emerald-600 hover:opacity-90 text-white border-2 border-foreground font-black text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
          >
            {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {bicho.protecoes >= 2
              ? 'Máximo'
              : podeComprar
                ? `${bicho.preco_protecao} XP`
                : `Faltam ${bicho.preco_protecao - bicho.saldo} XP`}
          </button>
        </div>
      </section>

      {/* Troca de arquétipo.
          Existe porque os quatro bichos 3D chegaram depois: quem já tinha
          adotado uma capivara ficaria preso a ela sem nunca ver o boneco novo.
          Trocar não custa nada e não mexe em nível, ofensiva nem XP — a espécie
          nunca teve economia atrelada, e a migration original já dizia isso. */}
      <section className="rounded-card bg-card border-2 border-border p-7 space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-brand-pink" />
          <h2 className="u-label !text-xs">Trocar de bichinho</h2>
        </div>

        {trocando ? (
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-500 leading-relaxed">
              {bicho.dias_estudo} {bicho.dias_estudo === 1 ? 'dia' : 'dias'} de estudo, o
              nível e a ofensiva continuam do jeito que estão — só a espécie e o nome mudam.
              Cada bicho lembra o nome que você já deu a ele.
            </p>
            <SeletorArquetipo valor={especie} onChange={escolherNaTroca} />

            <div className="space-y-2">
              <label htmlFor="nome-troca" className="u-label block">
                Nome {especie === bicho.especie ? 'dele' : `do ${arquetipo(especie).nome.toLowerCase()}`}
              </label>
              <input
                id="nome-troca"
                value={nomeTroca}
                onChange={ev => setNomeTroca(ev.target.value)}
                maxLength={20}
                placeholder={apelidoDe(bicho, especie) ? undefined : 'Ainda sem nome — escolha um'}
                className="w-full rounded-control border-2 border-slate-100 px-5 py-3.5 text-base font-bold outline-none focus-visible:border-brand-pink"
              />
              {/* Só aparece quando o campo já veio preenchido pela memória —
                  é a prova de que trocar de volta não obriga a reinventar o
                  nome, que é o problema que essa tela veio resolver. */}
              {apelidoDe(bicho, especie) && (
                <p className="text-[11px] font-medium text-brand-pink">
                  Era assim que {arquetipo(especie).nome.toLowerCase()} se chamava da última vez.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTrocando(false)}
                className="h-12 px-6 rounded-control bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-widest"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={trocar}
                disabled={salvando || !nomeTroca.trim() || (especie === bicho.especie && nomeTroca.trim() === bicho.nome)}
                className="flex-1 h-12 rounded-control bg-brand-pink hover:opacity-90 text-white border-2 border-foreground font-black text-[11px] uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {especie === bicho.especie && nomeTroca.trim() === bicho.nome
                  ? 'Já é este'
                  : `Virar ${arquetipo(especie).nome}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-control bg-slate-50 p-5">
            <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-sm">
              Existem dez bichinhos diferentes. Trocar é de graça, não afeta seu
              progresso, e cada um guarda o próprio nome.
            </p>
            <button
              type="button"
              onClick={() => { escolherNaTroca(bicho.especie ?? 'lobinho'); setTrocando(true); }}
              className="h-12 px-6 rounded-control bg-brand-pink hover:opacity-90 text-white border-2 border-foreground font-black text-[11px] uppercase tracking-widest shrink-0"
            >
              Escolher outro
            </button>
          </div>
        )}
      </section>

      {/* Escada de níveis */}
      <section className="rounded-card bg-card border-2 border-border p-7 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <h2 className="u-label !text-xs">Níveis</h2>
        </div>
        <div className="space-y-1.5">
          {NIVEIS.map((rotulo, i) => {
            const nivel = i + 1;
            const alcancado = bicho.nivel >= nivel;
            const atual = bicho.nivel === nivel;
            return (
              <div
                key={rotulo}
                className={`flex items-center gap-3 rounded-control px-4 py-2.5 ${
                  atual ? 'bg-primary/10 border-2 border-foreground' : alcancado ? 'bg-muted/40' : ''
                }`}
              >
                <span className={`u-num text-xs w-6 ${alcancado ? 'text-primary' : 'text-muted-foreground/40'}`}>
                  {nivel}
                </span>
                <span className={`flex-1 text-sm font-bold ${alcancado ? 'text-slate-800' : 'text-slate-400'}`}>
                  {rotulo}
                </span>
                <span className={`text-xs font-medium ${alcancado ? 'text-slate-500' : 'text-slate-300'}`}>
                  {DIAS_POR_NIVEL[i]} {DIAS_POR_NIVEL[i] === 1 ? 'dia' : 'dias'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="rounded-card bg-slate-50 border border-slate-100 p-5 flex items-start gap-3">
        <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs font-medium text-slate-500 leading-relaxed">
          Os dias de estudo <strong>só aumentam</strong> — {apelido} nunca perde nível, mesmo
          que você fique um tempo sem aparecer. Entrar na plataforma não conta:
          o que alimenta ele é responder questão, fazer simulado, prova ou redação.
        </p>
      </div>
    </div>
  );
}
