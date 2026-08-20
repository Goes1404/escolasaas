'use client';

/**
 * Onde o aluno para.
 *
 * Responde três perguntas que hoje só se responde com SQL na mão:
 *   1. Quantos alunos chegam a cada etapa do funil?
 *   2. Que telas eles abrem — e quais ninguém abre?
 *   3. O que está falhando agora?
 *
 * A terceira é a razão principal desta tela existir. Os dois defeitos que
 * mataram a redação (o CHECK que limitava a nota a 100 e o tema pré-preenchido
 * que anulava por fuga) falhavam sem erro visível e levaram dois meses para
 * aparecer, por acaso.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle, MonitorSmartphone, Users, Timer, BrainCircuit } from 'lucide-react';

type Funil = {
  base_real: number;
  sem_acesso: number;
  contas_de_importacao: number;
  ja_entraram: number;
  ativos_30d: number;
  ativos_7d: number;
  responderam_questao: number;
  enviaram_redacao: number;
  usaram_flashcard: number;
};

type Linha = { chave: string; alunos: number; ocorrencias: number };

type EventoBruto = {
  kind: string;
  name: string;
  screen: string | null;
  user_id: string | null;
  props: Record<string, any> | null;
};

type IncidenteIA = { rota: string; tipo: string; criado_em: string; detalhe: string | null };

/** Quantos alunos conseguem receber notificacao — e o que barra os outros. */
type AlcancePush = {
  rotulo: string;
  alunos: number;
  cor: string;
  nota?: string;
};

type Lentidao = {
  operacao: string;
  amostras: number;
  medianaMs: number;
  piorMs: number;
  travadas: number;
};

function rotuloTipoIA(tipo: string): string {
  switch (tipo) {
    case 'sem_credito':    return 'sem crédito na OpenAI';
    case 'limite_uso':     return 'limite de uso atingido';
    case 'chave_invalida': return 'chave de API inválida';
    case 'indisponivel':   return 'serviço instável';
    default:               return tipo;
  }
}

/** Mediana: a média é distorcida por um único caso extremo de rede ruim. */
function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const s = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 ? s[meio] : Math.round((s[meio - 1] + s[meio]) / 2);
}

/**
 * Junta o que é lento e o que travou, por operação.
 *
 * `acao_lenta` e `tela_lenta` são conclusões que demoraram; `acao_travada` é a
 * operação que nunca respondeu e foi cortada pelo timeout. As duas contam a
 * mesma história do ponto de vista do aluno — ele esperou — mas só a segunda
 * termina em tela de erro.
 */
function resumirLentidao(eventos: EventoBruto[]): Lentidao[] {
  const mapa = new Map<string, { duracoes: number[]; travadas: number }>();

  for (const e of eventos) {
    const ms = Number(e.props?.ms ?? e.props?.lcp_ms ?? 0);
    const chave = String(e.props?.operacao ?? e.props?.tela ?? e.name);

    if (e.name === 'acao_lenta' || e.name === 'tela_lenta' || e.name === 'desempenho_tela') {
      if (!Number.isFinite(ms) || ms <= 0) continue;
      const atual = mapa.get(chave) ?? { duracoes: [], travadas: 0 };
      atual.duracoes.push(ms);
      mapa.set(chave, atual);
    } else if (e.name === 'acao_travada') {
      const atual = mapa.get(chave) ?? { duracoes: [], travadas: 0 };
      atual.travadas++;
      mapa.set(chave, atual);
    }
  }

  return [...mapa.entries()]
    .map(([operacao, v]) => ({
      operacao,
      amostras: v.duracoes.length,
      medianaMs: mediana(v.duracoes),
      piorMs: v.duracoes.length ? Math.max(...v.duracoes) : 0,
      travadas: v.travadas,
    }))
    // Travamento vem primeiro: é pior que lentidão, mesmo sendo mais raro.
    .sort((a, b) => (b.travadas - a.travadas) || (b.medianaMs - a.medianaMs));
}

/** Agrupa eventos por uma chave, contando alunos distintos e ocorrências. */
/**
 * Resume o funil de notificacao a partir dos eventos `push_estado`.
 *
 * Ate 12/08 so se sabia quem CONSEGUIU se inscrever — 68 alunos. Quem esbarrava
 * em alguma barreira era invisivel, e foi assim que o iPhone passou meses sem
 * aparecer: das 68 inscricoes, UMA era de iOS, porque no iPhone o Web Push so
 * existe com o site instalado na tela de inicio e a tela simplesmente sumia.
 */
function resumirAlcance(eventos: EventoBruto[]): AlcancePush[] {
  const porAluno = new Map<string, EventoBruto>();
  for (const e of eventos) {
    if (e.name !== 'push_estado' || !e.user_id) continue;
    // Um registro por aluno: o mais recente conta.
    porAluno.set(e.user_id, e);
  }
  if (porAluno.size === 0) return [];

  const conta = { ativo: 0, pode: 0, bloqueado: 0, ios: 0, sem_suporte: 0 };
  for (const e of porAluno.values()) {
    const p = e.props ?? {};
    if (p.inscrito === true) conta.ativo++;
    else if (p.motivo === 'ios_precisa_instalar') conta.ios++;
    else if (p.permissao === 'denied') conta.bloqueado++;
    else if (p.permissao === 'unsupported') conta.sem_suporte++;
    else conta.pode++;
  }

  return [
    { rotulo: 'Recebendo notificacao', alunos: conta.ativo, cor: 'bg-emerald-500' },
    { rotulo: 'Ainda nao ativou', alunos: conta.pode, cor: 'bg-amber-400',
      nota: 'Ve o convite e pode ativar num toque.' },
    { rotulo: 'iPhone sem instalar', alunos: conta.ios, cor: 'bg-violet-500',
      nota: 'Precisa adicionar a tela de inicio; agora recebe as instrucoes.' },
    { rotulo: 'Bloqueou no navegador', alunos: conta.bloqueado, cor: 'bg-rose-500',
      nota: 'Agora ve como liberar de novo.' },
    { rotulo: 'Navegador sem suporte', alunos: conta.sem_suporte, cor: 'bg-slate-400' },
  ].filter(l => l.alunos > 0);
}

function agrupar(eventos: { name: string; screen: string | null; user_id: string | null }[], por: 'name' | 'screen'): Linha[] {
  const mapa = new Map<string, { alunos: Set<string>; n: number }>();
  for (const e of eventos) {
    const chave = (por === 'name' ? e.name : e.screen) ?? '(sem rota)';
    const atual = mapa.get(chave) ?? { alunos: new Set<string>(), n: 0 };
    if (e.user_id) atual.alunos.add(e.user_id);
    atual.n++;
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([chave, v]) => ({ chave, alunos: v.alunos.size, ocorrencias: v.n }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias);
}

function Barra({ valor, total, cor }: { valor: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-xs font-black text-slate-600">{pct}%</span>
    </div>
  );
}

export default function UsoPage() {
  const { toast } = useToast();
  const [funil, setFunil] = useState<Funil | null>(null);
  const [telas, setTelas] = useState<Linha[]>([]);
  const [falhas, setFalhas] = useState<Linha[]>([]);
  const [lentidao, setLentidao] = useState<Lentidao[]>([]);
  const [incidentesIA, setIncidentesIA] = useState<IncidenteIA[]>([]);
  const [acoes, setAcoes] = useState<Linha[]>([]);
  const [alcance, setAlcance] = useState<AlcancePush[]>([]);
  const [eventosTotal, setEventosTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      // Via RPC: a view perdeu o GRANT para `authenticated` porque números de
      // operação não precisam ser visíveis ao aluno. A função confere o papel.
      const { data: f, error: erroFunil } = await supabase.rpc('obter_funil_alunos');
      if (erroFunil) throw erroFunil;
      setFunil((Array.isArray(f) ? f[0] : f) as Funil);

      // Janela de 14 dias: o suficiente para ver o padrão da semana sem
      // arrastar o histórico inteiro para o navegador.
      const desde = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const { data: ev, error: erroEv } = await supabase
        .from('app_events')
        .select('kind, name, screen, user_id, props')
        .gte('created_at', desde)
        .limit(5000);
      if (erroEv) throw erroEv;

      const eventos = (ev ?? []) as EventoBruto[];
      setEventosTotal(eventos.length);
      setTelas(agrupar(eventos.filter(e => e.kind === 'tela'), 'screen'));
      setAcoes(agrupar(eventos.filter(e => e.kind === 'acao'), 'name'));
      setFalhas(agrupar(eventos.filter(e => e.kind === 'falha'), 'name'));
      setLentidao(resumirLentidao(eventos));
      setAlcance(resumirAlcance(eventos));

      // Incidentes de IA: é o alerta que faltou quando a chave ficou sem
      // crédito e quatro funcionalidades pararam por onze dias sem ninguém
      // perceber.
      const { data: ia } = await supabase
        .from('ia_incidentes')
        .select('rota, tipo, criado_em, detalhe')
        .gte('criado_em', desde)
        .order('criado_em', { ascending: false })
        .limit(200);
      setIncidentesIA((ia ?? []) as IncidenteIA[]);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const etapas = funil ? [
    { label: 'Contas reais (sem arquivados)', valor: funil.base_real, cor: 'bg-slate-400' },
    { label: 'Nunca entraram — falta entregar a senha', valor: funil.sem_acesso, cor: 'bg-rose-400' },
    { label: 'Já entraram alguma vez', valor: funil.ja_entraram, cor: 'bg-blue-500' },
    { label: 'Ativos nos últimos 30 dias', valor: funil.ativos_30d, cor: 'bg-indigo-500' },
    { label: 'Ativos nos últimos 7 dias', valor: funil.ativos_7d, cor: 'bg-violet-500' },
    { label: 'Já responderam questão', valor: funil.responderam_questao, cor: 'bg-emerald-500' },
    { label: 'Já usaram flashcard', valor: funil.usaram_flashcard, cor: 'bg-teal-500' },
    { label: 'Já enviaram redação', valor: funil.enviaram_redacao, cor: 'bg-orange-500' },
  ] : [];

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-6 pb-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter text-primary">Onde o aluno para</h1>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Funil de ativação e telemetria dos últimos 14 dias.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={carregar} disabled={loading}
          className="h-9 rounded-xl text-xs font-black gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
      ) : (
        <>
          {/* ── IA FORA DO AR ── */}
          {incidentesIA.length > 0 && (() => {
            const ultimo = incidentesIA[0];
            const horas = (Date.now() - new Date(ultimo.criado_em).getTime()) / 3_600_000;
            const agora = horas < 24;
            const porRota = new Map<string, number>();
            for (const i of incidentesIA) porRota.set(i.rota, (porRota.get(i.rota) ?? 0) + 1);

            return (
              <section className={`rounded-[2rem] border p-6 shadow-sm space-y-2 ${
                agora ? 'border-red-200 bg-red-50' : 'border-amber-100 bg-amber-50/40'
              }`}>
                <div className="flex items-center gap-2">
                  <BrainCircuit className={`h-4 w-4 ${agora ? 'text-red-600' : 'text-amber-600'}`} />
                  <h2 className={`text-sm font-black uppercase tracking-widest ${
                    agora ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    {agora ? 'A IA está falhando agora' : 'A IA falhou nos últimos 14 dias'}
                  </h2>
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  {incidentesIA.length} falha(s), a última{' '}
                  {horas < 1 ? 'há menos de uma hora' : `há ${Math.round(horas)}h`}.
                  Motivo mais recente: <strong>{rotuloTipoIA(ultimo.tipo)}</strong>.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[...porRota.entries()].map(([rota, n]) => (
                    <span key={rota} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                      {rota} · {n}
                    </span>
                  ))}
                </div>
                {ultimo.tipo === 'sem_credito' && (
                  <p className="text-[11px] font-bold text-red-700 pt-1">
                    Sem crédito na OpenAI. Enquanto isso, chat, resumo semanal, geração de tema e
                    correção de redação ficam indisponíveis para o aluno.
                  </p>
                )}
              </section>
            );
          })()}

          {/* ── FUNIL ── */}
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">Funil de ativação</h2>
            </div>

            <div className="space-y-3">
              {etapas.map(e => (
                <div key={e.label} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-slate-600">{e.label}</span>
                    <span className="text-sm font-black text-slate-800">{e.valor}</span>
                  </div>
                  <Barra valor={e.valor} total={funil?.base_real ?? 0} cor={e.cor} />
                </div>
              ))}
            </div>

            {(funil?.sem_acesso ?? 0) > 0 && (
              <p className="text-[11px] font-medium text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                Os <strong>{funil?.sem_acesso} alunos que nunca entraram</strong> não são contas para apagar:
                a maioria tem boletim e nota de prova presencial. O que falta a eles é a senha, não a matrícula.
                A lista está em <strong>Diretório → Status → “Nunca entraram”</strong>.
                {(funil?.contas_de_importacao ?? 0) > 0 && (
                  <> Destas, {funil?.contas_de_importacao} nasceram da importação de boletim de 14/07.</>
                )}
              </p>
            )}
          </section>

          {/* ── FALHAS ── */}
          <section className="rounded-[2rem] border border-red-100 bg-red-50/40 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-red-700">O que está falhando</h2>
            </div>

            {falhas.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">
                Nenhuma falha registrada em 14 dias.
                {eventosTotal === 0 && ' (Ainda não há telemetria — ela começa a chegar no próximo acesso de aluno.)'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {falhas.map(f => (
                  <div key={f.chave} className="flex items-center gap-3 rounded-xl border border-red-100 bg-white px-3 py-2">
                    <span className="flex-1 min-w-0 truncate text-xs font-black text-slate-700">{f.chave}</span>
                    <span className="text-[10px] font-bold text-slate-400">{f.alunos} aluno(s)</span>
                    <span className="w-10 text-right text-sm font-black text-red-600">{f.ocorrencias}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── DESEMPENHO ── */}
          <section className="rounded-[2rem] border border-amber-100 bg-amber-50/40 p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-black uppercase tracking-widest text-amber-700">Espera e travamento</h2>
            </div>
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
              Só aparece o que passou de 3 segundos. <strong>Travadas</strong> são operações que não responderam
              e foram cortadas — o aluno viu o botão girar e desistir.
            </p>

            {lentidao.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">
                Nada acima de 3 segundos em 14 dias.
                {eventosTotal === 0 && ' (Ainda não há telemetria.)'}
              </p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 px-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  <span className="flex-1">Operação</span>
                  <span className="w-14 text-right">Mediana</span>
                  <span className="w-14 text-right">Pior</span>
                  <span className="w-16 text-right">Travadas</span>
                </div>
                {lentidao.map(l => (
                  <div key={l.operacao} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white px-3 py-2">
                    <span className="flex-1 min-w-0 truncate text-xs font-black text-slate-700">{l.operacao}</span>
                    <span className="w-14 text-right text-xs font-bold text-slate-600">
                      {l.amostras ? `${(l.medianaMs / 1000).toFixed(1)}s` : '—'}
                    </span>
                    <span className="w-14 text-right text-xs font-bold text-slate-500">
                      {l.amostras ? `${(l.piorMs / 1000).toFixed(1)}s` : '—'}
                    </span>
                    <span className={`w-16 text-right text-sm font-black ${l.travadas > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {l.travadas || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── TELAS E AÇÕES ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">Telas mais abertas</h2>
              </div>
              {telas.length === 0 ? (
                <p className="text-xs font-medium text-slate-500">Sem dados ainda.</p>
              ) : telas.slice(0, 12).map(t => (
                <div key={t.chave} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate text-[11px] font-bold text-slate-600">{t.chave}</span>
                  <span className="text-[10px] font-bold text-slate-400">{t.alunos}</span>
                  <span className="w-8 text-right text-xs font-black text-slate-700">{t.ocorrencias}</span>
                </div>
              ))}
            </section>

            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-violet-600" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">Alcance da notificação</h2>
              </div>
              {alcance.length === 0 ? (
                <p className="text-xs font-medium text-slate-500">
                  Sem dados ainda — aparece conforme os alunos abrem o painel.
                </p>
              ) : alcance.map(l => {
                const total = alcance.reduce((s, x) => s + x.alunos, 0);
                return (
                  <div key={l.rotulo} className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 min-w-0 truncate text-[11px] font-bold text-slate-600">{l.rotulo}</span>
                      <span className="text-xs font-black text-slate-700 tabular-nums">{l.alunos}</span>
                    </div>
                    <Barra valor={l.alunos} total={total} cor={l.cor} />
                    {l.nota && <p className="text-[10px] font-medium text-slate-400 leading-tight">{l.nota}</p>}
                  </div>
                );
              })}
            </section>

            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">Ações concluídas</h2>
              </div>
              {acoes.length === 0 ? (
                <p className="text-xs font-medium text-slate-500">Sem dados ainda.</p>
              ) : acoes.slice(0, 12).map(a => (
                <div key={a.chave} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate text-[11px] font-bold text-slate-600">{a.chave}</span>
                  <span className="text-[10px] font-bold text-slate-400">{a.alunos}</span>
                  <span className="w-8 text-right text-xs font-black text-slate-700">{a.ocorrencias}</span>
                </div>
              ))}
            </section>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/60 font-medium">
            A telemetria não guarda nome, e-mail, telefone nem texto escrito pelo aluno — só rota, evento e números.
          </p>
        </>
      )}
    </div>
  );
}
