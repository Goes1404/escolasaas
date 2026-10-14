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
import { EmptyState } from '@/components/EmptyState';

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
        description: uploadFails > 0 ? `${uploadFails} imagens não puderam ser enviadas.` : 'Imagens vinculadas às questões.',
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro ao aplicar.');
      setPhase('error');
    }
  }, [assignments, imageById, examId, toast]);

  // ---------------------------------------------------------------

  if (phase === 'loading') {
    return (
      <div className="flex flex-col justify-center items-center min-h-[50vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="u-label">Carregando prova…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6 pb-24">
      {/* Cabeçalho (nível médio) */}
      <header className="flex items-start gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push('/dashboard/teacher/exams')}
          className="h-9 w-9 rounded-control shrink-0 mt-1" aria-label="Voltar para as provas">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><ScanSearch className="h-3.5 w-3.5" /> Professor · provas</p>
          <h1 className="u-page-title text-2xl md:text-3xl mt-1">Imagens da prova</h1>
          {exam?.title && <p className="text-muted-foreground text-sm mt-1 break-words">{exam.title}</p>}
        </div>
      </header>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="rounded-card">
          <CardContent className="p-3 sm:p-5">
            <p className="u-label">Questões</p>
            <p className="u-num text-xl sm:text-2xl mt-1.5">{questions.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-card">
          <CardContent className="p-3 sm:p-5">
            <p className="u-label">Sem imagem</p>
            <p className="u-num text-xl sm:text-2xl mt-1.5">{pendingQuestions.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-card">
          <CardContent className="p-3 sm:p-5">
            <p className="u-label !text-emerald-600">{phase === 'done' ? 'Aplicadas' : 'Propostas'}</p>
            <p className="u-num text-xl sm:text-2xl mt-1.5 text-emerald-600">{phase === 'done' ? appliedCount : proposedCount}</p>
          </CardContent>
        </Card>
      </div>

      {phase === 'ready' && (
        exam?.pdf_url ? (
          <Card className="rounded-card">
            <CardContent className="p-5 sm:p-8 text-center space-y-4">
              <Sparkles className="h-8 w-8 text-primary mx-auto" />
              <p className="font-bold text-base text-foreground">Extrair as imagens do PDF desta prova</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                O PDF salvo no sistema é analisado e cada imagem encontrada é ligada à questão pelo
                número impresso. Você revisa tudo antes de aplicar.
              </p>
              <Button onClick={() => void handleExtract()} variant="arcade" className="h-11 px-6 rounded-control font-bold">
                <ScanSearch className="h-4 w-4 mr-2" /> Analisar PDF
              </Button>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title="Esta prova ainda não tem PDF"
            description="Envie o PDF na tela de provas e volte aqui para extrair as imagens."
            action={{ label: 'Ir para as provas', href: '/dashboard/teacher/exams', icon: ArrowLeft }}
          />
        )
      )}

      {phase === 'extracting' && (
        <Card className="rounded-card">
          <CardContent className="p-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="font-bold text-foreground">Analisando o PDF…</p>
            <p className="text-sm text-muted-foreground">Lendo as páginas e recortando as imagens. Pode levar alguns segundos.</p>
          </CardContent>
        </Card>
      )}

      {(phase === 'review' || phase === 'applying') && (
        <>
          <div className="u-surface p-4 flex items-start gap-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{images.length}</span> {images.length === 1 ? 'imagem encontrada' : 'imagens encontradas'} no PDF.
              Revise as propostas abaixo — dá para trocar ou remover cada uma. Questões que já têm imagem não são alteradas.
            </p>
          </div>

          {pendingQuestions.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Todas as questões já têm imagem"
              description="Não há nada para aplicar nesta prova."
              action={{ label: 'Voltar para as provas', href: '/dashboard/teacher/exams', icon: ArrowLeft }}
            />
          ) : (
            <div className="space-y-2">
              {pendingQuestions.map(q => {
                const assignedId = assignments[q.id] ?? null;
                const assigned = assignedId ? imageById.get(assignedId) : undefined;
                const availableImages = images.filter(img => !usedImageIds.has(img.id) || img.id === assignedId);
                return (
                  <Card key={q.id} className={`rounded-card overflow-hidden ${assigned ? '' : 'bg-muted/30'}`}>
                    <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge variant="outline" className="font-semibold text-[10px] rounded-control tabular-nums">
                            Questão {q.printedNumber ?? q.order_index}
                          </Badge>
                          {!assigned && <span className="text-[11px] font-semibold text-muted-foreground">Sem proposta</span>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                          {q.question_text.replace('[IMAGEM_PENDENTE]', '').trim()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {assigned && (
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-control overflow-hidden border border-border bg-white shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img loading="lazy" decoding="async" src={assigned.url} alt="Imagem proposta" className="w-full h-full object-contain" />
                            <span className="absolute bottom-1 left-1 bg-foreground text-background text-[9px] font-semibold px-1.5 py-0.5 rounded-control tabular-nums">
                              pág. {assigned.page}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5 flex-1 md:flex-none min-w-0">
                          <Select
                            value={assignedId ?? 'none'}
                            onValueChange={v => setAssignment(q.id, v === 'none' ? null : v)}
                            disabled={phase === 'applying'}
                          >
                            <SelectTrigger className="w-full md:w-44 h-9 rounded-control text-xs">
                              <SelectValue placeholder="Escolher imagem" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Nenhuma</SelectItem>
                              {availableImages.map(img => (
                                <SelectItem key={img.id} value={img.id} className="text-xs">
                                  {img.questionNumber !== null ? `Questão ${img.questionNumber}` : 'Sem número'} · pág. {img.page}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {assigned && (
                            <Button variant="ghost" size="sm" disabled={phase === 'applying'}
                              onClick={() => setAssignment(q.id, null)}
                              className="h-8 rounded-control text-xs font-semibold text-red-600 hover:text-red-600 hover:bg-red-500/10">
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {pendingQuestions.length > 0 && (
            <div className="sticky bottom-4 z-20">
              <Button
                onClick={() => void handleApply()}
                disabled={proposedCount === 0 || phase === 'applying'}
                variant="arcade"
                className="w-full h-12 rounded-control font-bold"
              >
                {phase === 'applying' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aplicando… {applyProgress ? `${applyProgress.current}/${applyProgress.total}` : ''}</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" /> Aplicar {proposedCount} {proposedCount === 1 ? 'imagem' : 'imagens'}</>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {phase === 'done' && (
        <Card className="rounded-card overflow-hidden">
          <CardContent className="p-6 sm:p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
            <p className="text-base font-bold text-foreground">
              <span className="tabular-nums">{appliedCount}</span> {appliedCount === 1 ? 'questão atualizada' : 'questões atualizadas'}.
            </p>
            <p className="text-sm text-muted-foreground">
              Os alunos já veem as imagens ao fazer esta prova.
            </p>
            <Button onClick={() => router.push('/dashboard/teacher/exams')} variant="outline" className="rounded-control font-semibold h-11 px-6">
              Voltar para as provas
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === 'error' && (
        <Card className="rounded-card border-red-500/30">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-600 text-sm">Algo deu errado</p>
              <p className="text-sm text-muted-foreground mt-1 break-words">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => setPhase('ready')} className="mt-3 rounded-control font-semibold text-xs">
                Tentar de novo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
