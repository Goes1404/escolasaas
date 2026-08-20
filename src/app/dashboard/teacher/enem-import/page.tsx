
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
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
      <header className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl -rotate-3">
          <Download className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-primary italic leading-none">Importar ENEM</h1>
          <p className="text-muted-foreground font-medium italic">Importa questões oficiais da API pública enem.dev</p>
        </div>
      </header>

      <Card className="border-none shadow-lg rounded-[2rem] bg-blue-50 border-blue-100">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2 text-blue-700 font-black text-sm">
            <Zap className="h-4 w-4" /> Como funciona
          </div>
          <ul className="space-y-1.5 text-xs text-blue-800 font-medium">
            <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Busca até 200 questões do ENEM do ano selecionado via API pública</li>
            <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Cria automaticamente a prova no sistema com as questões vinculadas</li>
            <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Questões marcadas com <Badge className="bg-blue-200 text-blue-800 border-none text-[9px] font-black">ENEM</Badge> para filtro separado</li>
            <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Seguro: re-importar o mesmo ano não cria duplicatas</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl rounded-[2.5rem] bg-white">
        <CardContent className="p-8 space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Selecione o ano</label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {AVAILABLE_YEARS.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`h-12 rounded-2xl font-black text-sm transition-all border-2
                    ${selectedYear === year
                      ? 'bg-primary text-white border-primary shadow-lg scale-105'
                      : 'bg-slate-50 text-slate-500 border-transparent hover:border-primary/20 hover:bg-slate-100'
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
            className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl hover:scale-[1.01] transition-all"
          >
            {importing ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Importando ENEM {selectedYear}...</>
            ) : (
              <><Download className="h-5 w-5 mr-2" /> Importar ENEM {selectedYear}</>
            )}
          </Button>

          {importing && (
            <div className="text-center space-y-2 py-4">
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground font-medium italic">Buscando questões na API do ENEM... pode levar alguns segundos.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden animate-in fade-in duration-500">
          <div className="h-2 bg-green-400" />
          <CardContent className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
              <div>
                <p className="text-xl font-black text-primary italic">ENEM {result.year} importado com sucesso!</p>
                <p className="text-xs text-muted-foreground font-medium">A prova já aparece na lista de Provas Completas</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-primary">{result.total}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-1">Questões na API</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-green-600">{result.inserted}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-1">Inseridas</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-amber-600">{result.skipped}</p>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-1">Ignoradas</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium bg-slate-50 rounded-xl p-3">
              <Database className="h-4 w-4 shrink-0" />
              ID da prova: <code className="font-mono text-primary">{result.examId}</code>
            </div>
            <Button
              variant="outline"
              onClick={() => setResult(null)}
              className="w-full rounded-2xl font-black h-11"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Importar outro ano
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-none shadow-lg rounded-[2rem] bg-red-50">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-red-700 text-sm">Erro na importação</p>
              <p className="text-xs text-red-600 font-medium mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm rounded-[2rem] bg-white/60">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
            <BookOpen className="h-3.5 w-3.5" /> Anos disponíveis na API
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            A API enem.dev cobre de 2010 a {new Date().getFullYear() - 1}. Nem todos os anos têm gabarito oficial disponível.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
