"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, UserRound, X, ArrowRight } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

interface StudentHit {
  id: string;
  name: string | null;
  email: string | null;
  course: string | null;
  institution: string | null;
}

/**
 * Busca global de alunos para a secretaria. Digite o nome → resultados ao vivo
 * → clique vai direto ao perfil 360°. Mobile-first: input grande, dropdown
 * rolável, fecha ao tocar fora.
 */
export function StudentQuickSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StudentHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar/tocar fora.
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // .ilike() do builder é parametrizado (seguro contra injeção PostgREST);
    // removemos apenas curingas LIKE para não distorcer a busca.
    const safe = q.replace(/[%_]/g, " ");
    const { data } = await supabase
      .from("profiles")
      .select("id, name, email, course, institution")
      .eq("role", "student")
      .ilike("name", `%${safe}%`)
      .order("name")
      .limit(8);
    setResults(data || []);
    setLoading(false);
  }, []);

  // Debounce de 250ms.
  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => runSearch(term), 250);
    return () => clearTimeout(t);
  }, [term, runSearch]);

  const go = (id: string) => {
    setOpen(false);
    setTerm("");
    setResults([]);
    router.push(`/dashboard/secretary/students/${id}`);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
        <input
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar aluno por nome…"
          className="w-full h-[52px] pl-12 pr-12 rounded-2xl bg-white border border-slate-200 shadow-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none font-bold text-sm text-slate-800 placeholder:text-slate-400 placeholder:font-medium transition-all"
        />
        {term && (
          <button
            onClick={() => { setTerm(""); setResults([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            aria-label="Limpar busca"
          >
            <X className="h-3.5 w-3.5 text-slate-500" />
          </button>
        )}
      </div>

      {open && term.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Buscando…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-xs font-bold text-slate-400 italic">
              Nenhum aluno encontrado para “{term.trim()}”.
            </div>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left border-b border-slate-50 last:border-0 group"
              >
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm italic shrink-0">
                  {s.name?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 truncate italic">{s.name || "Sem nome"}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                    {s.course || "Sem turma"} · {s.institution || "Sem polo"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
