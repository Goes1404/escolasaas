import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { sendPushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";
// Fan-out para dezenas de alunos com uma chamada Web Push cada.
export const maxDuration = 60;

/**
 * Lembrete diário de estudo.
 *
 * Chamada por `pg_cron` uma vez por dia. É o primeiro job de engajamento da
 * plataforma: até 12/08 nada acordava o aluno — o histórico tinha um disparo
 * de material em 15/06 e 23 mensagens de chat, e mais nada.
 *
 * Quem é escolhido e por quê fica em `alunos_para_lembrete()`, no banco. Aqui
 * só se decide o texto e se envia.
 */

type Segmento = "ultimo_dia" | "protegida" | "sumido" | "nunca_estudou";

interface Alvo {
  user_id: string;
  segmento: Segmento;
  ofensiva: number;
  protecoes: number;
  dias_parado: number;
  /** Nome do bichinho, quando o aluno já adotou um. */
  pet_nome: string | null;
}

/**
 * O texto de cada segmento.
 *
 * Regra de tom: cobrar o que dá para cumprir hoje e nunca culpar. O aluno que
 * sumiu duas semanas já sabe que sumiu — repetir isso é o que faz desinstalar.
 * Uma questão é um pedido pequeno o bastante para caber num intervalo de aula.
 *
 * Quem tem bichinho ouve a voz dele. É a diferença entre um sistema cobrando
 * uma métrica e alguém esperando por você — e era esse o ponto da ideia.
 */
function mensagem(a: Alvo): { title: string; body: string } {
  const pet = a.pet_nome;
  const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

  switch (a.segmento) {
    // Quem tem push mas nunca respondeu uma questão. São 35 pessoas — mais do
    // que todo o resto da lista somado. A mensagem da ofensiva seria mentira
    // para eles: não há ofensiva para perder nem bichinho para alimentar, e
    // cobrar algo que a pessoa nunca teve é o que faz desativar notificação.
    //
    // Estes recebem no máximo UM POR SEMANA (a regra está em
    // `alunos_para_lembrete`): quem nunca começou não muda de ideia por
    // insistência diária, muda por convite ocasional.
    case "nunca_estudou":
      return {
        title: "Seu bichinho está esperando 🐾",
        body: "Escolha o seu e responda 1 questão — leva um minuto e ele começa a crescer.",
      };
    case "ultimo_dia":
      return pet
        ? {
            title: `🍎 ${pet} está com fome`,
            body: `Sua ofensiva de ${dias(a.ofensiva)} termina hoje. Uma questão alimenta ele.`,
          }
        : {
            title: `🔥 Sua ofensiva de ${dias(a.ofensiva)} termina hoje`,
            body: "Responda 1 questão e ela continua de pé. Leva um minuto.",
          };
    case "protegida":
      // "Sua ofensiva de N dia(s)" em vez de "seus N dias guardados": com N=1 a
      // segunda forma vira "você tem 1 dia guardados", e concordância errada
      // numa mensagem automática soa como robô — justamente o oposto do tom.
      return pet
        ? {
            title: `🛡️ ${pet} segurou sua ofensiva`,
            body: `Sua ofensiva de ${dias(a.ofensiva)} continua de pé. Estude hoje para seguir de onde parou.`,
          }
        : {
            title: "🛡️ Uma proteção segurou sua ofensiva",
            body: `Sua ofensiva de ${dias(a.ofensiva)} continua de pé. Estude hoje para seguir de onde parou.`,
          };
    case "sumido":
      return pet
        ? {
            title: `💤 ${pet} foi dormir esperando você`,
            body: "Uma questão hoje acorda ele. Escolha a matéria que quiser.",
          }
        : {
            title: "Bora voltar? 👋",
            body: "Uma questão hoje já começa uma ofensiva nova. Escolha a matéria que quiser.",
          };
  }
}

/** Compara segredos sem vazar quanto do valor o chamador já acertou. */
function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * O segredo que autoriza esta chamada.
 *
 * Fonte da verdade é `configuracao_privada` no banco, e não uma variável de
 * ambiente. O motivo é prático: quem assina a chamada é o `pg_cron`, que roda
 * DENTRO do Postgres e só sabe ler dali. Guardar o mesmo valor também na Vercel
 * criaria duas cópias do mesmo segredo, que precisam ser trocadas juntas — e a
 * primeira vez que uma delas ficar para trás, o lembrete para de sair sem
 * ninguém entender por quê.
 *
 * A tabela tem RLS ligada e nenhuma policy: `anon` e `authenticated` não leem
 * uma linha sequer. Chegam nela apenas o `postgres` (que é quem o cron usa) e a
 * service role — que esta rota já precisa ter de qualquer modo para consultar
 * os alunos. Ou seja, nenhum acesso novo foi criado.
 *
 * `CRON_SECRET` continua sendo aceito e tem prioridade, para o dia em que
 * alguém quiser tirar o segredo do banco sem mexer em código.
 */
async function segredoEsperado(admin: SupabaseClient): Promise<string | null> {
  const doAmbiente = process.env.CRON_SECRET;
  if (doAmbiente && doAmbiente.length >= 16) return doAmbiente;

  const { data, error } = await admin
    .from("configuracao_privada")
    .select("valor")
    .eq("chave", "cron_secret")
    .maybeSingle();

  if (error || !data?.valor || data.valor.length < 16) return null;
  return data.valor;
}

export async function POST(req: NextRequest) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const esperado = await segredoEsperado(admin);
  if (!esperado) {
    // Falha fechada: sem segredo configurado a rota não roda, em vez de ficar
    // aberta para qualquer um disparar notificação para a base inteira.
    console.error("[cron/lembrete-diario] segredo ausente ou curto demais.");
    return NextResponse.json({ error: "Rota não configurada." }, { status: 503 });
  }

  const recebido = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!recebido || !segredoConfere(recebido, esperado)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const { data, error } = await admin.rpc("alunos_para_lembrete");
    if (error) throw new Error(error.message);

    const alvos = (data ?? []) as Alvo[];
    if (alvos.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0, porSegmento: {} });
    }

    // Simulação: mostra QUEM receberia e o QUE receberia, sem tocar em nada.
    //
    // Existe porque testar esta rota sem ela custa caro: `sendPushToUsers`
    // grava na caixa de avisos ANTES de tentar o push, então uma chamada de
    // teste deixa 21 mensagens reais na inbox de 21 alunos — e, pior, o limite
    // de um lembrete por dia passa a considerar o teste, silenciando o envio
    // de verdade daquele dia. Foi exatamente o que aconteceu em 12/08.
    if (new URL(req.url).searchParams.get("simular") === "1") {
      const porSegmento: Record<string, number> = {};
      for (const a of alvos) porSegmento[a.segmento] = (porSegmento[a.segmento] ?? 0) + 1;
      return NextResponse.json({
        ok: true,
        simulacao: true,
        alvos: alvos.length,
        porSegmento,
        comBichinho: alvos.filter(a => a.pet_nome).length,
        // Amostra dos textos, sem nome de aluno nem id.
        exemplos: [...new Map(alvos.map(a => [a.segmento, mensagem(a)])).values()],
      });
    }

    // Agrupa por texto: alunos do mesmo segmento e mesma ofensiva recebem a
    // mesma mensagem, e `sendPushToUsers` já faz fan-out de uma só vez.
    const grupos = new Map<string, { alvos: Alvo[]; texto: ReturnType<typeof mensagem> }>();
    for (const a of alvos) {
      const texto = mensagem(a);
      const chave = `${texto.title}|${texto.body}`;
      const g = grupos.get(chave);
      if (g) g.alvos.push(a);
      else grupos.set(chave, { alvos: [a], texto });
    }

    let enviados = 0;
    const porSegmento: Record<string, number> = {};

    for (const { alvos: doGrupo, texto } of grupos.values()) {
      const r = await sendPushToUsers(doGrupo.map(a => a.user_id), {
        ...texto,
        type: "ofensiva",
        // Quem nunca estudou cai na página do bichinho (o convite é adotar);
        // os demais caem direto onde se responde questão.
        url: doGrupo[0].segmento === "nunca_estudou"
          ? "/dashboard/student/bichinho"
          : "/dashboard/student/simulados",
        // `tag` faz a notificação nova substituir a anterior no aparelho, em
        // vez de empilhar lembretes de dias diferentes na bandeja.
        tag: "lembrete-estudo",
      });
      enviados += r.sent;
      for (const a of doGrupo) {
        porSegmento[a.segmento] = (porSegmento[a.segmento] ?? 0) + 1;
      }
    }

    // Sem nome nem e-mail: o log diz o volume, não quem.
    console.log(`[cron/lembrete-diario] ${alvos.length} alvos, ${enviados} push entregues`, porSegmento);

    return NextResponse.json({ ok: true, alvos: alvos.length, enviados, porSegmento });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno.";
    console.error("[cron/lembrete-diario]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
