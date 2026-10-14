
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { fmtNumber } from '@/lib/format';
import {
  Download, Loader2, CheckCircle2, AlertCircle, BookOpen,
  Zap, ChevronRight, Database, RefreshCw
} from 'lucide-react';

const AVAILABLE_YEARS = Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => 2010 + i).reverse();

type ImportResult = {
  year: number;
  total: number;
  inserted: number;
  skipped: number;
  examId: string;
};

export default function TeacherEnemImportPage() {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() - 1);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    setError('');

    try {
      const res = await fetch('/api/enem-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro desconhecido.');
      }

      setResult(data);
      toast({ title: `ENEM ${selectedYear} importado!`, description: `${data.inserted} questões adicionadas ao banco.` });
    } catch (err: any) {
      setError(err.message);
      toast({ title: 'Falha na importação', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6 pb-24">
      <header>
        <p className="u-label flex items-center gap-2"><Download className="h-3.5 w-3.5" /> Professor · banco de questões</p>
        <h1 className="u-page-title text-3xl mt-1">Importar ENEM</h1>
        <p className="text-muted-foreground text-sm mt-2">Traz as questões oficiais de um ano do ENEM pela API pública enem.dev.</p>
      </header>

      <Card className="rounded-card">
        <CardContent className="p-5 space-y-3">
          <p className="u-label flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Como funciona</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0" /> Busca até 200 questões do ENEM do ano escolhido.</li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0" /> Cria a prova no sistema já com as questões vinculadas.</li>
            <li className="flex items-start gap-2 flex-wrap"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0" /> As questões ganham a marca <Badge variant="outline" className="text-[10px] font-semibold rounded-control">ENEM</Badge> para filtrar depois.</li>
            <li className="flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-0.5 shrink-0" /> Importar o mesmo ano de novo não cria questões repetidas.</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardContent className="p-5 md:p-6 space-y-5">
          <div className="space-y-3">
            <label className="u-label">Escolha o ano</label>
            <div className="grid grid-cols-3 min-[400px]:grid-cols-4 sm:grid-cols-6 gap-2">
              {AVAILABLE_YEARS.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  aria-pressed={selectedYear === year}
                  className={`h-11 rounded-control u-num text-sm transition-colors border
                    ${selectedYear === year
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                    }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleImport}
            disabled={importing}
            variant="arcade"
            className="w-full h-12 rounded-control font-bold"
          >
            {importing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando ENEM {selectedYear}…</>
            ) : (
              <><Download className="h-4 w-4 mr-2" /> Importar ENEM {selectedYear}</>
            )}
          </Button>

          {importing && (
            <p className="text-sm text-muted-foreground text-center">Buscando as questões… pode levar alguns segundos.</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="rounded-card overflow-hidden">
          <CardContent className="p-5 md:p-6 space-y-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-bold text-foreground">ENEM {result.year} importado.</p>
                <p className="text-sm text-muted-foreground">A prova já aparece na lista de provas completas.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="border border-border rounded-control p-3 sm:p-4">
                <p className="u-label">Na API</p>
                <p className="u-num text-2xl mt-1.5">{fmtNumber(result.total)}</p>
              </div>
              <div className="border border-border rounded-control p-3 sm:p-4">
                <p className="u-label !text-emerald-600">Inseridas</p>
                <p className="u-num text-2xl mt-1.5 text-emerald-600">{fmtNumber(result.inserted)}</p>
              </div>
              <div className="border border-border rounded-control p-3 sm:p-4">
                <p className="u-label">Já existiam</p>
                <p className="u-num text-2xl mt-1.5">{fmtNumber(result.skipped)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-control p-3 min-w-0">
              <Database className="h-4 w-4 shrink-0" />
              <span className="shrink-0">ID da prova:</span> <code className="font-mono text-foreground truncate">{result.examId}</code>
            </div>
            <Button
              variant="outline"
              onClick={() => setResult(null)}
              className="w-full rounded-control font-semibold h-11"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Importar outro ano
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="rounded-card border-red-500/30">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-red-600 text-sm">Não foi possível importar</p>
              <p className="text-sm text-muted-foreground mt-1 break-words">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="px-1">
        <p className="u-label flex items-center gap-1.5 mb-1.5"><BookOpen className="h-3.5 w-3.5" /> Anos disponíveis</p>
        <p className="text-sm text-muted-foreground">
          A API enem.dev cobre de 2010 a {new Date().getFullYear() - 1}. Nem todos os anos têm gabarito oficial.
        </p>
      </div>
    </div>
  );
}
