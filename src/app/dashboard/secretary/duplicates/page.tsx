"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Download, Loader2, Search, UserCheck, Users } from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { exportToCsv } from "@/lib/export-csv";
import { fmtDate, VAZIO } from "@/lib/format";

/**
 * Contas duplicadas de alunos — SÓ CONSULTA.
 *
 * Em 11/08/2026 a base tinha ~201 alunos com mais de uma conta, porque a regra
 * que gera o login a partir do nome mudou com o tempo. Fundir contas é decisão
 * da secretaria (CLAUDE.md): o histórico do aluno está espalhado entre elas e
 * escolher qual sobrevive é uma escolha sobre esse histórico. Esta tela não
 * altera nada — mostra os grupos, sugere qual manter e exporta a planilha.
 *
 * Fonte: a função `relatorio_duplicatas_alunos` (traz último acesso, que só o
 * Auth conhece). Se ela não existir no banco, cai para os perfis + contagem de
 * provas e linhas de boletim, sem o último acesso.
 */

type Conta = {
  nome: string;
  email: string;
  criada: string | null;
  ultimo_acesso: string | null;
  provas: number;
  boletim: number;
};

function normalizar(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Sugestão, não decisão: quem já acessou vence; depois mais histórico; depois a mais antiga. */
function principalDe(contas: Conta[]) {
  return [...contas].sort(
    (a, b) =>
      Number(Boolean(b.ultimo_acesso)) - Number(Boolean(a.ultimo_acesso)) ||
      b.provas + b.boletim - (a.provas + a.boletim) ||
      String(a.criada ?? "").localeCompare(String(b.criada ?? "")),
  )[0];
}

async function contarPor(tabela: string, coluna: string, ids: string[]) {
  const mapa = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from(tabela).select(coluna).in(coluna, ids.slice(i, i + 150));
    (data as Record<string, string>[] | null)?.forEach((r) => mapa.set(r[coluna], (mapa.get(r[coluna]) ?? 0) + 1));
  }
  return mapa;
}

async function carregar(): Promise<{ contas: Conta[]; temAcesso: boolean }> {
  const rpc = await supabase.rpc("relatorio_duplicatas_alunos");
  if (!rpc.error && Array.isArray(rpc.data)) {
    return { contas: rpc.data as Conta[], temAcesso: true };
  }

  const { data: perfis, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "student")
    .limit(5000);
  if (error) throw error;

  const grupos = new Map<string, typeof perfis>();
  for (const p of perfis ?? []) {
    if (!p.full_name) continue;
    const k = normalizar(p.full_name);
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }
  const envolvidos = [...grupos.values()].filter((g) => g.length > 1).flat();
  const ids = envolvidos.map((p) => p.id);
  const [provas, boletim] = await Promise.all([
    contarPor("exam_attempts", "user_id", ids),
    contarPor("report_card_entries", "student_id", ids),
  ]);
  return {
    temAcesso: false,
    contas: envolvidos.map((p) => ({
      nome: p.full_name,
      email: p.email ?? VAZIO,
      criada: p.created_at,
      ultimo_acesso: null,
      provas: provas.get(p.id) ?? 0,
      boletim: boletim.get(p.id) ?? 0,
    })),
  };
}

export default function DuplicatesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [temAcesso, setTemAcesso] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    carregar()
      .then((r) => { setContas(r.contas); setTemAcesso(r.temAcesso); })
      .catch(() => setErro("Não foi possível carregar os cadastros agora. Tente de novo em instantes."))
      .finally(() => setLoading(false));
  }, []);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Conta[]>();
    for (const c of contas) {
      const k = normalizar(c.nome);
      mapa.set(k, [...(mapa.get(k) ?? []), c]);
    }
    const termo = normalizar(busca);
    return [...mapa.values()]
      .filter((g) => g.length > 1)
      .filter((g) => !termo || normalizar(g[0].nome).includes(termo) || g.some((c) => c.email.includes(termo)))
      .sort((a, b) => a[0].nome.localeCompare(b[0].nome, "pt-BR"));
  }, [contas, busca]);

  const excedentes = grupos.reduce((s, g) => s + g.length - 1, 0);

  function exportar() {
    const linhas = grupos.flatMap((g) => {
      const p = principalDe(g);
      return g.map((c) => ({ ...c, sugestao: c.email === p.email ? "MANTER" : "revisar" }));
    });
    exportToCsv("contas-duplicadas", linhas, [
      { header: "Nome", accessor: (r) => r.nome },
      { header: "Login", accessor: (r) => r.email },
      { header: "Criada em", accessor: (r) => fmtDate(r.criada) },
      { header: "Último acesso", accessor: (r) => fmtDate(r.ultimo_acesso) },
      { header: "Provas", accessor: (r) => r.provas },
      { header: "Linhas de boletim", accessor: (r) => r.boletim },
      { header: "Sugestão", accessor: (r) => r.sugestao },
    ]);
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="u-label">Secretaria · cadastros</p>
          <h1 className="u-page-title text-3xl sm:text-4xl mt-1">Contas duplicadas</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Alunos com mais de uma conta. Esta tela não altera nada: compare o histórico de cada conta e
            decida qual manter. A sugestão prioriza a conta já usada e com mais histórico.
          </p>
        </div>
        <button
          type="button"
          onClick={exportar}
          disabled={!grupos.length}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-control bg-primary text-white font-bold text-sm shadow-hard disabled:opacity-50 disabled:shadow-none shrink-0"
        >
          <Download className="h-4 w-4" /> Baixar planilha
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="u-surface rounded-card p-4">
          <p className="u-label">Alunos afetados</p>
          <p className="u-num text-2xl mt-1">{loading ? VAZIO : grupos.length}</p>
        </div>
        <div className="u-surface rounded-card p-4">
          <p className="u-label">Contas excedentes</p>
          <p className="u-num text-2xl mt-1">{loading ? VAZIO : excedentes}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou login…" className="pl-9 h-11 rounded-control" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10"><Loader2 className="h-4 w-4 animate-spin" /> Carregando cadastros…</div>
      ) : erro ? (
        <EmptyState icon={Users} title="Não deu para carregar" description={erro} action={{ label: "Tentar de novo", onClick: () => location.reload() }} />
      ) : grupos.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={busca ? "Nenhum aluno encontrado nessa busca" : "Nenhuma conta duplicada"}
          description={busca ? "Confira a grafia do nome ou do login." : "Cada aluno tem uma conta só. Ótimo sinal."}
          action={busca ? { label: "Limpar busca", onClick: () => setBusca("") } : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {grupos.map((g) => {
            const p = principalDe(g);
            return (
              <li key={g[0].nome + g.length} className="u-surface rounded-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-foreground min-w-0 truncate">{g[0].nome}</p>
                  <span className="u-label shrink-0">{g.length} contas</span>
                </div>
                <div className="mt-3 divide-y divide-border">
                  {g.map((c) => (
                    <div key={c.email} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm">
                      <div className="flex items-center gap-2 min-w-0 sm:flex-1">
                        <code className="font-mono text-[13px] truncate">{c.email}</code>
                        <button
                          type="button"
                          aria-label="Copiar login"
                          onClick={async () => { try { await navigator.clipboard.writeText(c.email); toast({ title: "Login copiado" }); } catch {} }}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {c.email === p.email && (
                          <span className="shrink-0 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5">Sugerida para manter</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Criada {fmtDate(c.criada)}</span>
                        {temAcesso && <span>Acesso {fmtDate(c.ultimo_acesso, "dd/MM/yyyy", "nunca")}</span>}
                        <span><span className="u-num text-foreground">{c.provas}</span> provas</span>
                        <span><span className="u-num text-foreground">{c.boletim}</span> no boletim</span>
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
