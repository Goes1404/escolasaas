'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/app/lib/supabase';
import { extractPdfContent, ExtractedPdfImage } from '@/lib/pdf-extract';
import {
  ArrowLeft, CheckCircle2, ImageIcon, Loader2, ScanSearch,
  Sparkles, Trash2, AlertTriangle, Save,
} from 'lucide-react';

interface ExamInfo {
  id: string;
  title: string;
  pdf_url: string | null;
}

interface ExamQuestion {
  id: string;
  order_index: number;
  question_text: string;
  supporting_text: string | null;
  image_url: string | null;
  printedNumber: number | null;
}

type Phase = 'loading' | 'ready' | 'extracting' | 'review' | 'applying' | 'done' | 'error';

function parsePrintedNumber(questionText: string, supportingText: string | null): number | null {
  const text = `${questionText} ${supportingText ?? ''}`;
  const m = text.match(/quest[ãa]o\s*(\d{1,3})/i) || questionText.match(/^\s*(\d{1,3})\s*[.)-]\s/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 200) return n;
  }
  return null;
}

export default function RepairExamImagesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const examId = params.id;

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [images, setImages] = useState<ExtractedPdfImage[]>([]);
  /** questionId → image id proposta (null = sem proposta) */
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [applyProgress, setApplyProgress] = useState<{ current: number; total: number } | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);

  // ---- Carrega prova + questões ----
  useEffect(() => {
    const load = async (): Promise<void> => {
      const { data: examData, error: examErr } = await supabase
        .from('exams')
        .select('id, title, pdf_url')
        .eq('id', examId)
        .maybeSingle();
      if (examErr || !examData) {
        setErrorMsg('Prova não encontrada.');
        setPhase('error');
        return;
      }
      setExam(examData as ExamInfo);

      const { data: links, error: linkErr } = await supabase
        .from('exam_questions')
        .select('order_index, questions(id, question_text, supporting_text, image_url)')
        .eq('exam_id', examId)
        .order('order_index', { ascending: true });
      if (linkErr) {
        setErrorMsg('Erro ao carregar as questões da prova.');
        setPhase('error');
        return;
      }

      const qs: ExamQuestion[] = (links ?? [])
        .map((l: any) => {
          const q = Array.isArray(l.questions) ? l.questions[0] : l.questions;
          if (!q) return null;
          return {
            id: q.id as string,
            order_index: l.order_index as number,
            question_text: q.question_text as string,
            supporting_text: (q.supporting_text ?? null) as string | null,
            image_url: (q.image_url ?? null) as string | null,
            printedNumber: parsePrintedNumber(q.question_text, q.supporting_text ?? null),
          };
        })
        .filter((q): q is ExamQuestion => q !== null);

      setQuestions(qs);
      setPhase('ready');
    };
    void load();
  }, [examId]);

  // ---- Extrai imagens do PDF armazenado ----
  const handleExtract = useCallback(async (): Promise<void> => {
    if (!exam?.pdf_url) return;
    setPhase('extracting');
    try {
      const resp = await fetch(exam.pdf_url);
      if (!resp.ok) throw new Error('Não foi possível baixar o PDF do storage.');
      const blob = await resp.blob();
      const file = new File([blob], 'prova.pdf', { type: 'application/pdf' });
      const { images: extracted } = await extractPdfContent(file, exam.title);

      if (extracted.length === 0) {
        setErrorMsg('Nenhuma imagem encontrada no PDF (o arquivo pode ser só texto ou escaneado como página inteira).');
        setPhase('error');
        return;
      }
      setImages(extracted);

      // Pareamento automático: número da questão ↔ número detectado no PDF.
      // O número da questão vem do texto impresso ("QUESTÃO 12"); quando o banco
      // não guarda isso (provas importadas guardam só "(ENEM ...)"), usamos o
      // order_index — que, para provas geradas a partir de PDF, é a mesma ordem
      // do documento. Só propõe para questões SEM imagem; cada imagem é usada uma vez.
      const usedImages = new Set<string>();
      const proposal: Record<string, string | null> = {};
      for (const q of questions) {
        if (q.image_url) { proposal[q.id] = null; continue; }
        const targetNumber = q.printedNumber ?? q.order_index;
        // Quando mais de uma imagem cai na mesma questão (ex.: alternativas em
        // fórmula que viraram imagem + a figura real), prefere a MAIOR — a figura
        // de apoio é sempre bem maior que um recorte incidental.
        const match = extracted
          .filter(img => img.questionNumber === targetNumber && !usedImages.has(img.id))
          .sort((a, b) => b.file.size - a.file.size)[0];
        if (match) {
          usedImages.add(match.id);
          proposal[q.id] = match.id;
        } else {
          proposal[q.id] = null;
        }
      }
      setAssignments(proposal);
      setPhase('review');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Falha na extração.');
      setPhase('error');
    }
  }, [exam, questions]);

  const imageById = useMemo(() => {
    const map = new Map<string, ExtractedPdfImage>();
    images.forEach(img => map.set(img.id, img));
    return map;
  }, [images]);

  const usedImageIds = useMemo(
    () => new Set(Object.values(assignments).filter((v): v is string => v !== null)),
    [assignments]
  );

  const proposedCount = usedImageIds.size;
  const pendingQuestions = questions.filter(q => !q.image_url);

  const setAssignment = (questionId: string, imageId: string | null): void => {
    setAssignments(prev => {
      const next = { ...prev };
      if (imageId) {
        // remove a imagem de qualquer outra questão para não duplicar
        for (const [qid, iid] of Object.entries(next)) {
          if (iid === imageId) next[qid] = null;
        }
      }
      next[questionId] = imageId;
      return next;
    });
  };

  // ---- Aplica: sobe imagens no bucket e grava via API autenticada ----
  const handleApply = useCallback(async (): Promise<void> => {
    const entries = Object.entries(assignments).filter((e): e is [string, string] => e[1] !== null);
    if (entries.length === 0) return;
    setPhase('applying');
    setApplyProgress({ current: 0, total: entries.length });

    const updates: Array<{ questionId: string; imageUrl: string }> = [];
    let uploadFails = 0;

    for (let i = 0; i < entries.length; i++) {
      const [questionId, imageId] = entries[i];
      const img = imageById.get(imageId);
      if (!img) continue;
      const path = `questions/repair_${examId}_${questionId}.png`;
      const { error: upErr } = await supabase.storage
        .from('question-images')
        .upload(path, img.file, { upsert: true });
      if (upErr) { uploadFails++; continue; }
      const { data: urlData } = supabase.storage.from('question-images').getPublicUrl(path);
      updates.push({ questionId, imageUrl: urlData.publicUrl });
      setApplyProgress({ current: i + 1, total: entries.length });
    }

    if (updates.length === 0) {
      setErrorMsg('Nenhuma imagem pôde ser enviada ao storage.');
      setPhase('error');
      return;
    }

    try {
      const res = await fetch('/api/teacher/repair-question-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, updates }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gravar.');
      setAppliedCount(data.updated as number);
      setPhase('done');
      toast({
        title: `${data.updated} questões atualizadas!`,
        description: uploadFails > 0 ? `${uploadFails} uploads falharam.` : 'Imagens vinculadas com sucesso.',
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro ao aplicar.');
      setPhase('error');
    }
  }, [assignments, imageById, examId, toast]);

  // ---------------------------------------------------------------

  if (phase === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-60" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/teacher/exams')}
          className="h-11 w-11 rounded-2xl shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl -rotate-3 shrink-0">
          <ScanSearch className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black text-primary italic leading-none truncate">Reparar Imagens</h1>
          <p className="text-muted-foreground font-medium italic text-sm truncate">{exam?.title}</p>
        </div>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-none shadow-lg rounded-[2rem] bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-2xl font-black text-primary">{questions.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Questões</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg rounded-[2rem] bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-2xl font-black text-amber-500">{pendingQuestions.length}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Sem imagem</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg rounded-[2rem] bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-2xl font-black text-green-600">{phase === 'done' ? appliedCount : proposedCount}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
              {phase === 'done' ? 'Aplicadas' : 'Propostas'}
            </p>
          </CardContent>
        </Card>
      </div>

      {phase === 'ready' && (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white">
          <CardContent className="p-8 text-center space-y-4">
            {exam?.pdf_url ? (
              <>
                <Sparkles className="h-10 w-10 text-primary mx-auto" />
                <p className="font-black text-lg text-primary italic">Extrair imagens do PDF desta prova</p>
                <p className="text-sm text-muted-foreground font-medium max-w-md mx-auto">
                  O PDF já salvo no sistema será analisado; cada imagem encontrada é associada
                  automaticamente à questão pelo número impresso. Você revisa tudo antes de aplicar.
                </p>
                <Button onClick={() => void handleExtract()} className="h-12 px-8 rounded-2xl font-black shadow-xl">
                  <ScanSearch className="h-5 w-5 mr-2" /> Analisar PDF
                </Button>
              </>
            ) : (
              <>
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                <p className="font-black text-lg text-amber-600 italic">Esta prova não tem PDF</p>
                <p className="text-sm text-muted-foreground font-medium">
                  Envie o PDF na tela de Provas primeiro e volte aqui.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {phase === 'extracting' && (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white">
          <CardContent className="p-10 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="font-black text-primary italic">Analisando o PDF…</p>
            <p className="text-xs text-muted-foreground font-medium">Renderizando páginas e recortando imagens. Pode levar alguns segundos.</p>
          </CardContent>
        </Card>
      )}

      {(phase === 'review' || phase === 'applying') && (
        <>
          <Card className="border-none shadow-lg rounded-[2rem] bg-blue-50">
            <CardContent className="p-5 flex items-start gap-3">
              <ImageIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 font-medium">
                {images.length} imagens extraídas do PDF. Revise as propostas abaixo — você pode trocar
                ou remover cada associação. Questões que já têm imagem não são alteradas.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {pendingQuestions.map(q => {
              const assignedId = assignments[q.id] ?? null;
              const assigned = assignedId ? imageById.get(assignedId) : undefined;
              const availableImages = images.filter(img => !usedImageIds.has(img.id) || img.id === assignedId);
              return (
                <Card key={q.id} className={`border-none shadow-lg rounded-[2rem] overflow-hidden ${assigned ? 'bg-white' : 'bg-slate-50'}`}>
                  <CardContent className="p-5 flex flex-col md:flex-row gap-4 md:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge className="bg-primary/10 text-primary border-none font-black text-[10px]">
                          Questão {q.printedNumber ?? q.order_index}
                        </Badge>
                        {!assigned && <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px] uppercase">Sem proposta</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium line-clamp-2">
                        {q.question_text.replace('[IMAGEM_PENDENTE]', '').trim()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {assigned && (
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 bg-white shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={assigned.url} alt="Proposta" className="w-full h-full object-contain" />
                          <span className="absolute bottom-1 left-1 bg-primary text-white text-[8px] font-black px-1.5 py-0.5 rounded">
                            pág. {assigned.page}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <Select
                          value={assignedId ?? 'none'}
                          onValueChange={v => setAssignment(q.id, v === 'none' ? null : v)}
                          disabled={phase === 'applying'}
                        >
                          <SelectTrigger className="w-40 h-9 rounded-xl text-xs font-bold">
                            <SelectValue placeholder="Escolher imagem" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs">— Nenhuma —</SelectItem>
                            {availableImages.map(img => (
                              <SelectItem key={img.id} value={img.id} className="text-xs">
                                {img.questionNumber !== null ? `Q${img.questionNumber}` : 'Sem nº'} · pág. {img.page}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {assigned && (
                          <Button variant="ghost" size="sm" disabled={phase === 'applying'}
                            onClick={() => setAssignment(q.id, null)}
                            className="h-7 rounded-lg text-[10px] font-black text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3 w-3 mr-1" /> Remover
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="sticky bottom-4 z-20">
            <Button
              onClick={() => void handleApply()}
              disabled={proposedCount === 0 || phase === 'applying'}
              className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-2xl"
            >
              {phase === 'applying' ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Aplicando… {applyProgress ? `${applyProgress.current}/${applyProgress.total}` : ''}</>
              ) : (
                <><Save className="h-5 w-5 mr-2" /> Aplicar {proposedCount} imagem(ns)</>
              )}
            </Button>
          </div>
        </>
      )}

      {phase === 'done' && (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
          <div className="h-2 bg-green-400" />
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-xl font-black text-primary italic">{appliedCount} questões atualizadas!</p>
            <p className="text-sm text-muted-foreground font-medium">
              Os alunos já veem as imagens ao fazer esta prova no simulado.
            </p>
            <Button onClick={() => router.push('/dashboard/teacher/exams')} className="rounded-2xl font-black h-11 px-8">
              Voltar às Provas
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === 'error' && (
        <Card className="border-none shadow-lg rounded-[2rem] bg-red-50">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-black text-red-700 text-sm">Algo deu errado</p>
              <p className="text-xs text-red-600 font-medium mt-1">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => setPhase('ready')} className="mt-3 rounded-xl font-black text-xs">
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
