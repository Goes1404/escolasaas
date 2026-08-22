"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  Loader2, ArrowRight, RotateCcw, Users, Trophy, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import type { ImportRow, MatchResult, PreviewResponse, ApplyResponse } from "@/app/api/admin/import-simulado/route";

type Step = "upload" | "preview" | "done";

export default function SimuladoImportPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [examId, setExamId] = useState<string>("");
  const [result, setResult] = useState<ApplyResponse | null>(null);

  const reset = () => {
    setStep("upload");
    setRows([]);
    setMatches([]);
    setExamId("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headerRow = raw[0] || [];
        const normalizeHeader = (h: any) =>
          String(h ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const getColIndex = (keywords: string[], defaultIdx: number) => {
          const idx = headerRow.findIndex((h) => {
            const nh = normalizeHeader(h);
            return keywords.some((kw) => nh.includes(kw));
          });
          return idx !== -1 ? idx : defaultIdx;
        };

        const nameIdx = getColIndex(["nome", "estudante", "aluno", "student", "name"], 0);
        const instIdx = getColIndex(["colegio", "escola", "instituicao", "institution", "school"], 1);
        const salaIdx = getColIndex(["sala", "turma", "class", "room"], 2);
        const notaIdx = getColIndex(["nota", "acertos", "pontos", "score", "points", "grade"], 3);

        const parsed: ImportRow[] = raw
          .slice(1)
          .filter((r) => r[nameIdx] && r[notaIdx] !== undefined && r[notaIdx] !== "")
          .map((r) => ({
            name: String(r[nameIdx]).trim(),
            institution: String(r[instIdx] ?? "").trim(),
            sala: String(r[salaIdx] ?? "").trim(),
            nota: Number(r[notaIdx]) || 0,
          }));

        if (parsed.length === 0) {
          toast({ title: "Planilha vazia ou formato inválido", variant: "destructive" });
          return;
        }
        setRows(parsed);
        toast({ title: `${parsed.length} alunos carregados da planilha`, description: "Clique em Verificar para continuar." });
      } catch {
        toast({ title: "Erro ao ler planilha", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  }, [toast]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseExcel(file);
  }, [parseExcel]);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import-simulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", rows }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: PreviewResponse = await res.json();
      setMatches(data.matches);
      setExamId(data.examId);
      setStep("preview");
    } catch (err: any) {
      toast({ title: "Erro ao verificar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/import-simulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", matches, examId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ApplyResponse = await res.json();
      setResult(data);
      setStep("done");
      toast({ title: `✅ ${data.updated} alunos atualizados com sucesso!` });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const highCount  = matches.filter((m) => m.confidence === "high").length;
  const lowCount   = matches.filter((m) => m.confidence === "low").length;
  const noneCount  = matches.filter((m) => m.confidence === "none").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      {/* ── Header ── */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-primary italic leading-none">
          Importar Simulado ENEM
        </h1>
        <p className="text-muted-foreground font-medium italic text-sm">
          Carregue a planilha de resultados. Os dados de sala, colégio e nota serão
          atualizados nos perfis dos alunos automaticamente.
        </p>
      </div>

      {/* ── Step: Upload ── */}
      {step === "upload" && (
        <div className="space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/2 hover:bg-primary/5 rounded-card p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group"
          >
            <div className="h-16 w-16 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-black text-primary italic text-lg">Arraste o arquivo Excel aqui</p>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                ou clique para selecionar · .xlsx / .xls
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) parseExcel(e.target.files[0]); }}
            />
          </div>

          {/* Formato esperado */}
          <Card className="border-none shadow-sm rounded-2xl bg-slate-50">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Formato Esperado</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {["Estudantes", "Colégio", "Sala", "Nota"].map((h) => (
                        <th key={h} className="text-left py-1.5 pr-4 font-black text-slate-600 text-[10px] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-slate-500">
                    <tr><td className="py-1 pr-4">Maria Eduarda Polito</td><td className="pr-4">Tom Jobim</td><td className="pr-4">7</td><td>54</td></tr>
                    <tr><td className="py-1 pr-4">Arthur Alexandre Vieira</td><td className="pr-4">Aldônio</td><td className="pr-4">8</td><td>46</td></tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-black text-primary italic">{rows.length} alunos carregados</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Prontos para verificação</p>
                </div>
              </div>
              <Button
                onClick={handlePreview}
                disabled={loading}
                className="h-11 px-6 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-primary/30"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                Verificar Correspondências
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === "preview" && (
        <div className="space-y-5">
          {/* Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-2xl font-black text-emerald-700 leading-none">{highCount}</p>
                <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wide mt-0.5">Match certeiro</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-2xl font-black text-amber-700 leading-none">{lowCount}</p>
                <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wide mt-0.5">Match parcial</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
              <XCircle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="text-2xl font-black text-red-700 leading-none">{noneCount}</p>
                <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-wide mt-0.5">Não encontrado</p>
              </div>
            </div>
          </div>

          {/* Tabela de matches */}
          <Card className="border-none shadow-2xl rounded-card bg-white overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="h-11">
                      {["Planilha", "Aluno no Sistema", "Colégio → Sala", "Nota", "Status"].map((h) => (
                        <th key={h} className="px-4 text-left font-black text-[10px] uppercase tracking-widest text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, i) => (
                      <tr key={i} className={`h-14 border-b border-slate-50 last:border-0 ${
                        m.confidence === "none" ? "bg-red-50/40" :
                        m.confidence === "low"  ? "bg-amber-50/40" : ""
                      }`}>
                        <td className="px-4">
                          <p className="font-bold text-sm text-slate-800 truncate max-w-[200px]">{m.row.name}</p>
                        </td>
                        <td className="px-4">
                          {m.profileName ? (
                            <p className="font-semibold text-sm text-slate-600 truncate max-w-[200px] italic">{m.profileName}</p>
                          ) : (
                            <span className="text-xs font-bold text-red-400 italic">Não encontrado</span>
                          )}
                        </td>
                        <td className="px-4">
                          <p className="text-xs font-bold text-slate-500 truncate">{m.row.institution} · Sala {m.row.sala}</p>
                        </td>
                        <td className="px-4">
                          <Badge className="font-black bg-primary/10 text-primary border-none text-xs">
                            {m.row.nota}/60
                          </Badge>
                        </td>
                        <td className="px-4">
                          {m.confidence === "high"  && <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[9px] uppercase">✓ Confirmado</Badge>}
                          {m.confidence === "low"   && <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[9px] uppercase">⚠ Parcial</Badge>}
                          {m.confidence === "none"  && <Badge className="bg-red-100 text-red-700 border-none font-bold text-[9px] uppercase">✗ Ignorado</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {noneCount > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs font-bold">
                {noneCount} aluno(s) não foram encontrados no sistema e serão ignorados.
                Verifique se os nomes na planilha correspondem exatamente aos cadastros.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={reset}
              className="h-12 px-6 rounded-xl font-black text-xs uppercase border-slate-200"
            >
              <RotateCcw className="h-4 w-4 mr-2" /> Recomeçar
            </Button>
            <Button
              onClick={handleApply}
              disabled={loading || highCount + lowCount === 0}
              className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-primary/30"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Confirmar e Importar {highCount + lowCount} Alunos
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === "done" && result && (
        <div className="space-y-5">
          {/* Hero de sucesso */}
          <div className="relative bg-[#0d0d0f] rounded-card p-8 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(76,204,237,0.25) 0%, transparent 65%)" }} />
            <div className="relative z-10 flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Importação Concluída</p>
                <h2 className="text-3xl font-black italic text-white leading-none">
                  {result.updated} <span className="text-primary">alunos</span> atualizados
                </h2>
                <p className="text-sm font-medium text-white/60 mt-1">
                  {result.skipped} ignorados · {result.errors.length} erros
                </p>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <Card className="border-none shadow-sm rounded-2xl bg-red-50 border border-red-100">
              <CardContent className="p-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Erros</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs font-medium text-red-700">{e}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="font-black text-emerald-700">O que foi feito para cada aluno encontrado:</p>
            </div>
            <ul className="ml-7 text-xs text-emerald-700 space-y-0.5 font-medium list-disc">
              <li>Colégio (institution) atualizado no perfil</li>
              <li>Sala do cursinho (sala) atualizada no perfil</li>
              <li>Nota do Simulado ENEM 2026 registrada (visível na tela de Simulados do aluno)</li>
            </ul>
          </div>

          <Button onClick={reset} variant="outline" className="h-12 px-8 rounded-xl font-black text-xs uppercase border-slate-200">
            <Upload className="h-4 w-4 mr-2" /> Importar Outra Planilha
          </Button>
        </div>
      )}
    </div>
  );
}
