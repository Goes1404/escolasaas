"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  Loader2, ArrowRight, RotateCcw, Users, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { txt } from "@/lib/format";
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
      toast({ title: `${data.updated} alunos atualizados` });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const highCount  = matches.filter((m) => m.confidence === "high").length;
  const lowCount   = matches.filter((m) => m.confidence === "low").length;
  const noneCount  = matches.filter((m) => m.confidence === "none").length;

  const confidenceBadge = (c: MatchResult["confidence"]) => {
    if (c === "high") return <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> Confirmado</Badge>;
    if (c === "low") return <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> Parcial</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-none font-bold text-[10px]"><XCircle className="h-3 w-3 mr-1" /> Ignorado</Badge>;
  };
  const origin = (m: MatchResult) =>
    [txt(m.row.institution, ""), m.row.sala ? `Sala ${m.row.sala}` : ""].filter(Boolean).join(" · ") || "—";

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho */}
      <div>
        <p className="u-label flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5" /> Secretaria · importação</p>
        <h1 className="u-page-title text-3xl mt-1">Importar simulado</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Envie a planilha de resultados do simulado ENEM. Sala, colégio e nota são
          atualizados no perfil de cada aluno encontrado.
        </p>
      </div>

      {/* Etapa: envio */}
      {step === "upload" && (
        <div className="space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/60 hover:bg-muted/30 rounded-card p-8 sm:p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors"
          >
            <div className="h-14 w-14 rounded-control bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-bold text-base">Arraste o arquivo Excel aqui</p>
              <p className="text-sm text-muted-foreground mt-1">
                ou clique para escolher · .xlsx ou .xls
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
          <Card className="rounded-card shadow-none bg-muted/30">
            <CardContent className="p-5">
              <p className="u-label mb-3">Formato esperado</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border">
                      {["Estudantes", "Colégio", "Sala", "Nota"].map((h) => (
                        <th key={h} className="text-left py-1.5 pr-4 font-bold text-[11px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr><td className="py-1 pr-4">Maria Eduarda Polito</td><td className="pr-4">Tom Jobim</td><td className="pr-4">7</td><td>54</td></tr>
                    <tr><td className="py-1 pr-4">Arthur Alexandre Vieira</td><td className="pr-4">Aldônio</td><td className="pr-4">8</td><td>46</td></tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-border rounded-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold"><span className="u-num">{rows.length}</span> alunos carregados</p>
                  <p className="u-label mt-0.5">Prontos para verificação</p>
                </div>
              </div>
              <Button
                variant="arcade"
                onClick={handlePreview}
                disabled={loading}
                className="h-11 px-6 font-bold rounded-control"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                Verificar correspondências
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Etapa: conferência */}
      {step === "preview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-card shadow-none"><CardContent className="p-4">
              <p className="u-label !text-emerald-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Confirmados</span></p>
              <p className="u-num text-2xl mt-2 text-emerald-600">{highCount}</p>
            </CardContent></Card>
            <Card className="rounded-card shadow-none"><CardContent className="p-4">
              <p className="u-label !text-amber-700 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Parciais</span></p>
              <p className="u-num text-2xl mt-2 text-amber-700">{lowCount}</p>
            </CardContent></Card>
            <Card className="rounded-card shadow-none"><CardContent className="p-4">
              <p className="u-label !text-red-600 flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Não encontrados</span></p>
              <p className="u-num text-2xl mt-2 text-red-600">{noneCount}</p>
            </CardContent></Card>
          </div>

          {/* Celular: cartões */}
          <div className="sm:hidden space-y-2 max-h-[60vh] overflow-y-auto">
            {matches.map((m, i) => (
              <div key={i} className="rounded-control border border-border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm min-w-0 truncate">{txt(m.row.name)}</p>
                  {confidenceBadge(m.confidence)}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  No sistema: {m.profileName ? <span className="text-foreground">{m.profileName}</span> : <span className="text-red-600">não encontrado</span>}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground truncate">{origin(m)}</p>
                  <span className="u-num text-sm shrink-0">{txt(m.row.nota, "0")}/60</span>
                </div>
              </div>
            ))}
          </div>

          {/* Telas maiores: tabela */}
          <Card className="hidden sm:block rounded-card shadow-none overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr className="h-11">
                      {["Planilha", "Aluno no sistema", "Colégio · sala", "Nota", "Status"].map((h) => (
                        <th key={h} className="px-4 text-left u-label font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, i) => (
                      <tr key={i} className="h-14 border-b border-border last:border-0">
                        <td className="px-4">
                          <p className="font-semibold text-sm truncate max-w-[200px]">{txt(m.row.name)}</p>
                        </td>
                        <td className="px-4">
                          {m.profileName ? (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{m.profileName}</p>
                          ) : (
                            <span className="text-xs font-semibold text-red-600">Não encontrado</span>
                          )}
                        </td>
                        <td className="px-4">
                          <p className="text-xs text-muted-foreground truncate">{origin(m)}</p>
                        </td>
                        <td className="px-4">
                          <span className="u-num text-sm">{txt(m.row.nota, "0")}/60</span>
                        </td>
                        <td className="px-4">{confidenceBadge(m.confidence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {noneCount > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-control text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm font-semibold">
                {noneCount} aluno(s) não foram encontrados no sistema e serão ignorados.
                Confira se os nomes na planilha batem com os cadastros.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={reset}
              className="h-11 px-6 rounded-control font-bold"
            >
              <RotateCcw className="h-4 w-4 mr-2" /> Recomeçar
            </Button>
            <Button
              variant="arcade"
              onClick={handleApply}
              disabled={loading || highCount + lowCount === 0}
              className="flex-1 h-11 font-bold rounded-control whitespace-normal"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Confirmar e importar {highCount + lowCount} alunos
            </Button>
          </div>
        </div>
      )}

      {/* Etapa: concluído */}
      {step === "done" && result && (
        <div className="space-y-5">
          <Card className="rounded-card shadow-none">
            <CardContent className="p-5 sm:p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-control bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="u-label">Importação concluída</p>
                <p className="text-lg font-bold mt-0.5">
                  <span className="u-num text-2xl text-emerald-600">{result.updated}</span> alunos atualizados
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {result.skipped} ignorados · {result.errors.length} {result.errors.length === 1 ? "erro" : "erros"}
                </p>
              </div>
            </CardContent>
          </Card>

          {result.errors.length > 0 && (
            <Card className="rounded-card shadow-none bg-red-50 border-red-100">
              <CardContent className="p-5 space-y-2">
                <p className="u-label !text-red-600">Erros</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-sm text-red-700">{e}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="border border-border rounded-card p-5 space-y-2">
            <p className="font-bold text-sm">O que foi feito para cada aluno encontrado:</p>
            <ul className="ml-5 text-sm text-muted-foreground space-y-0.5 list-disc">
              <li>Colégio atualizado no perfil</li>
              <li>Sala do cursinho atualizada no perfil</li>
              <li>Nota do Simulado ENEM 2026 registrada (aparece na tela de Simulados do aluno)</li>
            </ul>
          </div>

          <Button onClick={reset} variant="outline" className="h-11 px-8 rounded-control font-bold w-full sm:w-auto">
            <Upload className="h-4 w-4 mr-2" /> Importar outra planilha
          </Button>
        </div>
      )}
    </div>
  );
}
