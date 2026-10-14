"use client";

import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload, FileSpreadsheet, CheckCircle2, Loader2, ArrowRight, RotateCcw, Users, GraduationCap, FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import Link from "next/link";
import { fmtNumber } from "@/lib/format";
import type { ReportCardImportRow, ReportCardImportResponse, ReportCardTrack } from "@/app/api/admin/report-card-import/route";
import { parseReportCardSheet, templateColumns } from "./report-card-import-lib";

type Step = "upload" | "done";

export default function ReportCardImportPage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [track, setTrack] = useState<ReportCardTrack>("enem");
  const [semester, setSemester] = useState<1 | 2>(1);

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportCardImportRow[]>([]);
  const [result, setResult] = useState<ReportCardImportResponse | null>(null);

  const reset = () => {
    setStep("upload");
    setRows([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const parseExcel = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const parsed = parseReportCardSheet(raw, track);
        if (parsed.length === 0) {
          toast({ title: "Planilha vazia ou sem coluna de nome reconhecida", variant: "destructive" });
          return;
        }
        setRows(parsed);
        toast({ title: `${parsed.length} alunos carregados da planilha` });
      } catch {
        toast({ title: "Não foi possível ler a planilha", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  }, [toast, track]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseExcel(file);
  }, [parseExcel]);

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/report-card-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, track, semester }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: ReportCardImportResponse = await res.json();
      setResult(data);
      setStep("done");
      toast({ title: `${fmtNumber(data.inserted, 0, "0")} boletins enviados para aprovação` });
    } catch (err: any) {
      toast({ title: "Não foi possível importar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const segBtn = (active: boolean) =>
    `flex-1 rounded-control px-3 py-2 text-xs font-bold uppercase transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`;

  return (
    <div className="space-y-6 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="u-label flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5" /> Coordenação · boletins</p>
          <h1 className="u-page-title text-3xl mt-1">Importar boletim</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Carregue a planilha de notas. Os boletins entram como <strong>pendentes</strong> — a
            confirmação do aluno e a publicação acontecem em Boletins pendentes.
          </p>
        </div>
        <Button variant="outline" asChild className="rounded-control font-bold shrink-0">
          <Link href="/dashboard/admin/report-card-approvals">
            <FileCheck className="h-4 w-4 mr-2" /> Ver boletins pendentes
          </Link>
        </Button>
      </div>

      {step === "upload" && (
        <div className="space-y-5">
          <Card className="rounded-card bg-muted/30">
            <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="u-label">Vestibular</p>
                <div className="flex rounded-control border bg-card p-1">
                  {(["enem", "etec"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={track === t}
                      onClick={() => { setTrack(t); setRows([]); }}
                      className={segBtn(track === t)}
                    >
                      {t === "enem" ? "ENEM" : "ETEC"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="u-label">Semestre</p>
                <div className="flex rounded-control border bg-card p-1">
                  {([1, 2] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={semester === s}
                      onClick={() => setSemester(s)}
                      className={segBtn(semester === s)}
                    >
                      {s}º semestre
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 rounded-card p-8 sm:p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors"
          >
            <div className="h-14 w-14 rounded-control bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground text-base">Arraste o arquivo Excel aqui</p>
              <p className="text-sm text-muted-foreground mt-1">
                ou toque para escolher · .xlsx / .xls
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

          <Card className="rounded-card bg-muted/30">
            <CardContent className="p-4 sm:p-5">
              <p className="u-label mb-3">Colunas reconhecidas ({track === "enem" ? "ENEM" : "ETEC"})</p>
              <div className="flex flex-wrap gap-2">
                {templateColumns(track).map((h) => (
                  <span key={h} className="text-[11px] font-semibold text-muted-foreground bg-card border rounded-control px-2.5 py-1">{h}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                A primeira linha precisa ser o cabeçalho. Colunas não reconhecidas ficam em branco no boletim.
              </p>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border rounded-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground"><span className="u-num tabular-nums">{rows.length}</span> alunos carregados</p>
                  <p className="u-label mt-0.5">Prontos para envio</p>
                </div>
              </div>
              <Button
                variant="arcade"
                onClick={handleImport}
                disabled={loading}
                className="h-11 px-6 font-bold rounded-control"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Enviar para aprovação
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-5">
          <Card className="rounded-card">
            <CardContent className="p-5 sm:p-8 flex items-center gap-4 sm:gap-5">
              <div className="h-14 w-14 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="u-label mb-1">Importação concluída</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                  <span className="u-num tabular-nums">{fmtNumber(result.inserted, 0, "0")}</span> boletins pendentes
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.errors.length > 0 ? `${result.errors.length} linha(s) ignorada(s)` : "Todas as linhas foram importadas"}
                </p>
              </div>
            </CardContent>
          </Card>

          {result.errors.length > 0 && (
            <Card className="rounded-card bg-red-50 border-red-100">
              <CardContent className="p-5 space-y-2">
                <p className="u-label !text-red-600">Avisos</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-sm text-red-700 break-words">{e}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="bg-card border rounded-card p-5 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="font-bold text-foreground">Próximo passo</p>
            </div>
            <p className="ml-7 text-sm text-muted-foreground">
              Abra <Link href="/dashboard/admin/report-card-approvals" className="underline font-semibold text-foreground">Boletins pendentes</Link> para
              confirmar o aluno de cada linha importada e aprovar antes que os boletins fiquem visíveis para os alunos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={reset} variant="outline" className="h-11 px-6 rounded-control font-bold">
              <Upload className="h-4 w-4 mr-2" /> Importar outra planilha
            </Button>
            <Button variant="arcade" asChild className="h-11 px-6 rounded-control font-bold">
              <Link href="/dashboard/admin/report-card-approvals">
                <FileCheck className="h-4 w-4 mr-2" /> Ir para boletins pendentes
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
