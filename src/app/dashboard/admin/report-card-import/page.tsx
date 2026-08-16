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
        toast({ title: "Erro ao ler planilha", variant: "destructive" });
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
      toast({ title: `✅ ${data.inserted} boletins enviados para aprovação!` });
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 px-1">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary italic leading-none">Importar Boletim</h1>
          <p className="text-muted-foreground font-medium italic text-sm">
            Carregue a planilha de notas. Os boletins entram como <strong>pendentes</strong> — o
            casamento com o aluno e a publicação acontecem em Boletins Pendentes.
          </p>
        </div>
        <Button variant="outline" asChild className="rounded-xl font-black text-xs uppercase border-slate-200 shrink-0">
          <Link href="/dashboard/admin/report-card-approvals">
            <FileCheck className="h-4 w-4 mr-2" /> Ver Boletins Pendentes
          </Link>
        </Button>
      </div>

      {step === "upload" && (
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-slate-50">
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vestibulinho</p>
                <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                  {(["enem", "etec"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTrack(t); setRows([]); }}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase transition-all ${track === t ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      {t === "enem" ? "ENEM" : "ETEC"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Semestre</p>
                <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                  {([1, 2] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSemester(s)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase transition-all ${semester === s ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      {s}º Semestre
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
            className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/2 hover:bg-primary/5 rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group"
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

          <Card className="border-none shadow-sm rounded-2xl bg-slate-50">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Colunas Reconhecidas ({track === "enem" ? "ENEM" : "ETEC"})</p>
              <div className="flex flex-wrap gap-2">
                {templateColumns(track).map((h) => (
                  <span key={h} className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1">{h}</span>
                ))}
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-3">
                A primeira linha precisa ser o cabeçalho. Colunas não reconhecidas ficam em branco no boletim.
              </p>
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
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Prontos para envio</p>
                </div>
              </div>
              <Button
                onClick={handleImport}
                disabled={loading}
                className="h-11 px-6 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-primary/30"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Enviar para Aprovação
              </Button>
            </div>
          )}
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-5">
          <div className="relative bg-[#0d0d0f] rounded-[2.5rem] p-8 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(76,204,237,0.25) 0%, transparent 65%)" }} />
            <div className="relative z-10 flex items-center gap-5">
              <div className="h-16 w-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Importação Concluída</p>
                <h2 className="text-3xl font-black italic text-white leading-none">
                  {result.inserted} <span className="text-primary">boletins</span> pendentes
                </h2>
                <p className="text-sm font-medium text-white/60 mt-1">
                  {result.errors.length > 0 ? `${result.errors.length} linha(s) ignorada(s)` : "Todas as linhas foram importadas"}
                </p>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <Card className="border-none shadow-sm rounded-2xl bg-red-50 border border-red-100">
              <CardContent className="p-5 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Avisos</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs font-medium text-red-700">{e}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="font-black text-emerald-700">Próximo passo</p>
            </div>
            <p className="ml-7 text-xs text-emerald-700 font-medium">
              Acesse <Link href="/dashboard/admin/report-card-approvals" className="underline font-bold">Boletins Pendentes</Link> para
              confirmar o aluno de cada linha importada e aprovar antes que fiquem visíveis para os alunos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={reset} variant="outline" className="h-12 px-8 rounded-xl font-black text-xs uppercase border-slate-200">
              <Upload className="h-4 w-4 mr-2" /> Importar Outra Planilha
            </Button>
            <Button asChild className="h-12 px-8 rounded-xl font-black text-xs uppercase bg-primary text-white shadow-lg shadow-primary/30">
              <Link href="/dashboard/admin/report-card-approvals">
                <FileCheck className="h-4 w-4 mr-2" /> Ir para Boletins Pendentes
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
