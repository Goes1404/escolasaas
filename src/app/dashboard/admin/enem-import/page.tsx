
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Download, Loader2, CheckCircle2, AlertCircle, BookOpen,
  Zap, ChevronRight, Database, RefreshCw
} from 'lucide-react';
import { fmtNumber, txt } from '@/lib/format';

const AVAILABLE_YEARS = Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => 2010 + i).reverse();

type ImportResult = {
  year: number;
  total: number;
  inserted: number;
  skipped: number;
  examId: string;
};

export default function EnemImportPage() {
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
      toast({ title: `ENEM ${selectedYear} importado`, description: `${fmtNumber(data.inserted, 0, '0')} questões adicionadas ao banco.` });
    } catch (err: any) {
      setError(err.message);
      toast({ title: 'Não foi possível importar', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <header>
        <p className="u-label flex items-center gap-2"><Download className="h-3.5 w-3.5" /> Coordenação · banco de questões</p>
        <h1 className="u-page-title text-3xl mt-1">Importar ENEM</h1>
        <p className="text-muted-foreground text-sm mt-2">Importa as questões oficiais pela API pública enem.dev.</p>
      </header>

      {/* Info card */}
      <Card className="rounded-card bg-muted/30">
        <CardContent className="p-5 space-y-3">
          <div className="u-label flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" /> Como funciona
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0" /> Busca até 200 questões do ENEM do ano escolhido pela API pública</li>
            <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0" /> Cria a prova no sistema já com as questões vinculadas</li>
            <li className="flex items-start gap-2 flex-wrap"><ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0" /> As questões recebem a marca <Badge variant="outline" className="text-[10px] font-bold">ENEM</Badge> para filtrar separado</li>
            <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0" /> Importar o mesmo ano de novo não cria questões duplicadas</li>
          </ul>
        </CardContent>
      </Card>

      {/* Year selector */}
      <Card className="rounded-card">
        <CardContent className="p-5 sm:p-8 space-y-6">
          <div className="space-y-3">
            <label className="u-label">Escolha o ano</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {AVAILABLE_YEARS.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  aria-pressed={selectedYear === year}
                  className={`h-11 rounded-control font-bold text-sm tabular-nums transition-colors border
                    ${selectedYear === year
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border hover:bg-muted'
                    }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="arcade"
            onClick={handleImport}
            disabled={importing}
            className="w-full h-12 rounded-control font-bold text-base"
          >
            {importing ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Importando ENEM {selectedYear}…</>
            ) : (
              <><Download className="h-5 w-5 mr-2" /> Importar ENEM {selectedYear}</>
            )}
          </Button>

          {importing && (
            <p className="text-sm text-muted-foreground text-center">Buscando as questões na API do ENEM. Pode levar alguns segundos.</p>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="rounded-card overflow-hidden">
          <CardContent className="p-5 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
              <div>
                <p className="text-lg font-bold text-foreground">ENEM {result.year} importado</p>
                <p className="text-sm text-muted-foreground">A prova já aparece na lista de provas completas.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-control p-4 text-center">
                <p className="u-num text-2xl tabular-nums">{fmtNumber(result.total)}</p>
                <p className="u-label mt-1">Na API</p>
              </div>
              <div className="bg-muted/40 rounded-control p-4 text-center">
                <p className="u-num text-2xl tabular-nums text-emerald-600">{fmtNumber(result.inserted)}</p>
                <p className="u-label mt-1">Inseridas</p>
              </div>
              <div className="bg-muted/40 rounded-control p-4 text-center">
                <p className="u-num text-2xl tabular-nums">{fmtNumber(result.skipped)}</p>
                <p className="u-label mt-1">Já existiam</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-control p-3 min-w-0">
              <Database className="h-4 w-4 shrink-0" />
              <span className="shrink-0">ID da prova:</span> <code className="font-mono text-foreground truncate">{txt(result.examId)}</code>
            </div>
            <Button
              variant="outline"
              onClick={() => setResult(null)}
              className="w-full rounded-control font-bold h-11"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Importar outro ano
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="rounded-card border-red-200 bg-red-50">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-bold text-red-700 text-sm">Não foi possível importar</p>
              <p className="text-sm text-red-600 mt-1 break-words">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available years reference */}
      <Card className="rounded-card bg-transparent">
        <CardContent className="p-5">
          <div className="u-label flex items-center gap-2 mb-2">
            <BookOpen className="h-3.5 w-3.5" /> Anos disponíveis na API
          </div>
          <p className="text-sm text-muted-foreground">
            A API enem.dev cobre de 2010 a {new Date().getFullYear() - 1}. Nem todos os anos têm gabarito oficial.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
