
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2, FilePlus, ListChecks, PlusCircle, Trash2, Database, BrainCircuit,
    Save, ArrowRight, Scroll, Upload, FileText, BookOpen, CheckCircle2,
    Sparkles, ImageIcon, X, History, ChevronDown, ChevronUp, ChevronLeft, ChevronRight as ChevronRightIcon, Download, AlertTriangle, Clock, ClipboardList
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
const QuestionsDashboard = dynamic(
    () => import('@/components/QuestionsDashboard').then(m => ({ default: m.QuestionsDashboard })),
    { ssr: false }
);
import { QuestionsList } from '@/components/QuestionsList';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/lib/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExtraction, ParsedQuestion, Subject, ImgItem, UploadRecord } from '@/lib/ExtractionContext';
import { extractPdfContent } from '@/lib/pdf-extract';
import { EXAM_TYPES } from '@/lib/exam-types';
import { parseAnswerKey, applyAnswerKey } from '@/lib/answer-key';
import { fmtLocale, pct } from '@/lib/format';

type MicroTopic = { id: string; name: string; subject_id?: string };
type QuestionOption = { key: string; text: string };

const ITEMS_PER_PAGE = 12;

export default function QuestionBankPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const {
        isAnalyzing, progress, extractedQuestions, setExtractedQuestions,
        rawText, setRawText, pdfUrl, setPdfUrl, pdfFile, setPdfFile, autoImageQueue, setAutoImageQueue,
        uploadHistory, clearExtraction, startExtraction, handleImageUpload,
    } = useExtraction();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Page-local state
    const [entryMode, setEntryMode] = useState<'bulk' | 'manual'>('bulk');
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState<{ current: number, total: number } | null>(null);
    const [isReadingFile, setIsReadingFile] = useState(false);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [filterMode, setFilterMode] = useState<'all' | 'needs_image' | 'no_subject' | 'dubious_answer' | 'needs_gabarito'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showHistory, setShowHistory] = useState(false);
    const [currentFilename, setCurrentFilename] = useState('Prova');

    const [draggedImgIndex, setDraggedImgIndex] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const [bulkSubjectId, setBulkSubjectId] = useState('');
    const [bulkTargetAudience, setBulkTargetAudience] = useState('all');
    const [microTopics, setMicroTopics] = useState<MicroTopic[]>([]);
    const [manualMicroTopics, setManualMicroTopics] = useState<MicroTopic[]>([]);
    // Todos os micro-tópicos (são ~133), para o seletor por questão na revisão
    // filtrar pela matéria de cada questão sem uma ida ao banco por card.
    const [allMicroTopics, setAllMicroTopics] = useState<MicroTopic[]>([]);

    const [showAnswerKeyPanel, setShowAnswerKeyPanel] = useState(false);
    const [answerKeyText, setAnswerKeyText] = useState('');

    const [manualQuestion, setManualQuestion] = useState({
        question_text: '', year: new Date().getFullYear(), subject_id: '',
        correct_answer: '', target_audience: 'all', explanation: '', micro_topic_id: '',
    });
    const [manualOptions, setManualOptions] = useState({ A: '', B: '', C: '', D: '', E: '' });

    const [createExam, setCreateExam] = useState(false);
    const [examTitle, setExamTitle] = useState('');
    const [examType, setExamType] = useState('enem');
    const [examYear, setExamYear] = useState(new Date().getFullYear());

    const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<{ existing: number, existingTexts: string[], newItems: ParsedQuestion[] } | null>(null);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // Reset page when filter or questions change
    useEffect(() => { setCurrentPage(1); }, [filterMode, extractedQuestions.length]);

    // Fetch subjects
    useEffect(() => {
        supabase.from('subjects').select('id, name').order('name').then(({ data }) => {
            if (data && data.length > 0) {
                setSubjects(data);
                const uncat = data.find(s => s.name === 'Não Categorizado') || data[0];
                if (uncat) {
                    setManualQuestion(prev => ({ ...prev, subject_id: uncat.id }));
                    setBulkSubjectId(uncat.id);
                }
            } else {
                toast({ title: 'Nenhuma matéria cadastrada', description: 'Cadastre as matérias antes de importar questões.', variant: 'destructive' });
            }
        });
    }, [toast]);

    // Fetch micro-topics for manual entry
    useEffect(() => {
        if (!manualQuestion.subject_id) { setManualMicroTopics([]); return; }
        supabase.from('micro_topics').select('id, name').eq('subject_id', manualQuestion.subject_id).order('name')
            .then(({ data }) => setManualMicroTopics(data ?? []));
    }, [manualQuestion.subject_id]);

    // Fetch micro-topics for bulk
    useEffect(() => {
        if (!bulkSubjectId) { setMicroTopics([]); return; }
        supabase.from('micro_topics').select('id, name').eq('subject_id', bulkSubjectId).order('name')
            .then(({ data }) => setMicroTopics(data ?? []));
    }, [bulkSubjectId]);

    // Todos os micro-tópicos, para o seletor por questão na revisão.
    useEffect(() => {
        supabase.from('micro_topics').select('id, name, subject_id').order('name')
            .then(({ data }) => setAllMicroTopics((data ?? []) as MicroTopic[]));
    }, []);

    // Auto-save timestamp
    useEffect(() => {
        if (extractedQuestions.length > 0) {
            setLastSaved(new Date());
        }
    }, [extractedQuestions]);

    // Micro-tópicos oferecidos na barra de lote: só fazem sentido se todas as
    // questões selecionadas forem da mesma matéria.
    const bulkSelectionMicroTopics = useMemo(() => {
        const subjectIds = new Set(
            extractedQuestions
                .filter(q => selectedQuestions.includes(q._tempId!))
                .map(q => q.subject_id)
                .filter(Boolean)
        );
        if (subjectIds.size !== 1) return [];
        const [only] = [...subjectIds];
        return allMicroTopics.filter(mt => mt.subject_id === only);
    }, [extractedQuestions, selectedQuestions, allMicroTopics]);

    // ---------- Gabarito em lote ----------
    const answerKeyPreview = useMemo(() => {
        if (!answerKeyText.trim() || extractedQuestions.length === 0) return null;
        const key = parseAnswerKey(answerKeyText);
        const { applied, leftover } = applyAnswerKey(extractedQuestions, key);
        return { mode: key.mode, total: key.total, applied, leftover };
    }, [answerKeyText, extractedQuestions]);

    const handleApplyAnswerKey = () => {
        const key = parseAnswerKey(answerKeyText);
        const { updated, appliedIndices, applied, unmatched } = applyAnswerKey(extractedQuestions, key);
        if (applied === 0) {
            toast({ title: 'Nenhuma questão casou com o gabarito', variant: 'destructive' });
            return;
        }
        // Só as que vieram do gabarito são marcadas como confirmadas; as demais
        // continuam visíveis nos filtros de revisão.
        const confirmed = new Set(appliedIndices);
        setExtractedQuestions(
            updated.map((q, i) => (confirmed.has(i) ? { ...q, _confirmed_answer: true } : q)) as ParsedQuestion[]
        );
        toast({
            title: `Gabarito aplicado a ${applied} questões`,
            description: unmatched > 0 ? `${unmatched} ficaram sem resposta — confira o filtro "Gabarito Pendente".` : undefined,
        });
    };

    const deleteImageFromStorage = async (url: string) => {
        try {
            const m = url.match(/question-images\/(.+)$/);
            if (m?.[1]) await supabase.storage.from('question-images').remove([m[1]]);
        } catch {
            // Limpeza de arquivo órfão no storage. Falhar aqui só deixa a
            // imagem ocupando espaço — a questão já foi removida do banco, e
            // interromper o fluxo do professor por isso seria pior.
        }
    };

    // ---------- File upload (reads file, feeds context) ----------
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setIsReadingFile(true);
        setAutoImageQueue([]);

        let combinedText = '';
        const tempImages: ImgItem[] = [];

        for (let idx = 0; idx < files.length; idx++) {
            const file = files[idx];
            setCurrentFilename(files.length === 1 ? file.name : `Lote de ${files.length} arquivos`);

            if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                if (files.length === 1) setPdfUrl(null);
                const text = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target?.result as string);
                    reader.readAsText(file, 'UTF-8');
                });
                combinedText += `\n\n--- ARQUIVO: ${file.name} ---\n\n` + text;
            } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                if (files.length === 1) {
                    setPdfUrl(URL.createObjectURL(file));
                    setPdfFile(file);
                }

                try {
                    // Extração posicional: texto + imagens recortadas da página renderizada,
                    // cada uma anotada com o número da questão detectada acima dela.
                    const { text, images } = await extractPdfContent(file, file.name);
                    combinedText += text;
                    tempImages.push(...images);
                } catch (err) {
                    toast({ title: `Erro no arquivo ${file.name}`, variant: 'destructive' });
                }
            }
        }

        if (combinedText.trim().length > 50) {
            setRawText((prev: string) => prev ? prev + '\n' + combinedText.trim() : combinedText.trim());
            setAutoImageQueue((prev: ImgItem[]) => [...prev, ...tempImages]);
            const imgMsg = tempImages.length > 0 ? ` ${tempImages.length} imagens detectadas.` : '';
            toast({ title: 'Arquivo lido', description: `${files.length} arquivo(s) lido(s).${imgMsg}` });
        } else {
            toast({ title: 'Pouco texto no arquivo', description: 'Não foi possível ler texto suficiente dos arquivos.', variant: 'destructive' });
        }

        setIsReadingFile(false);
        e.target.value = '';
    };

    const handlePreSave = () => {
        setShowSaveModal(true);
    };

    const handleDuplicateCheck = async () => {
        setIsSaving(true);
        try {
            const texts = extractedQuestions.map(q => q.question_text.trim());
            const { data: existing } = await supabase
                .from('questions')
                .select('question_text')
                .in('question_text', texts);

            if (existing && existing.length > 0) {
                setDuplicateWarning({
                    existing: existing.length,
                    existingTexts: existing.map(e => e.question_text),
                    newItems: extractedQuestions
                });
                setIsSaving(false);
                return;
            }
            await handleSaveProcessed(extractedQuestions);
        } catch (err) {
            setIsSaving(false);
            await handleSaveProcessed(extractedQuestions);
        }
    };

    // ---------- Save bulk ----------
    const handleSaveProcessed = async (itemsToProcess: ParsedQuestion[]) => {
        if (!user || itemsToProcess.length === 0) return;
        setIsSaving(true);
        try {
            const questionsWithoutAnswer = itemsToProcess.filter(q => !q.correct_answer);
            if (questionsWithoutAnswer.length > 0) {
                toast({
                    title: `${questionsWithoutAnswer.length} questão(ões) sem gabarito`,
                    description: 'Serão salvas sem resposta correta. Você pode editá-las depois.',
                });
            }

            const normalizeAnswer = (raw: string | null) => {
                if (!raw) return null;
                const m = raw.trim().match(/^([A-Ea-e])/);
                return m ? m[1].toUpperCase() : null;
            };

            let finalExamId = null;
            let uploadedPdfUrl = null;

            if (createExam) {
                // Upload PDF if exists
                if (pdfFile) {
                    setSaveProgress({ current: 0, total: itemsToProcess.length });
                    const fileExt = pdfFile.name.split('.').pop();
                    const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('exam_pdfs')
                        .upload(fileName, pdfFile);
                        
                    if (!uploadError && uploadData) {
                        const { data: publicUrlData } = supabase.storage.from('exam_pdfs').getPublicUrl(fileName);
                        uploadedPdfUrl = publicUrlData.publicUrl;
                    }
                }

                const { data: examData, error: examError } = await supabase.from('exams').insert({
                    title: examTitle || 'Prova sem título',
                    year: Number(examYear) || new Date().getFullYear(),
                    exam_type: examType || 'enem',
                    teacher_id: user?.id,
                    pdf_url: uploadedPdfUrl
                }).select('id').single();
                
                if (examError) throw examError;
                finalExamId = examData.id;
            }

            const itemsToInsert = itemsToProcess.map(q => {
                const item: any = {
                    question_text: q.question_text,
                    options: q.options,
                    correct_answer: normalizeAnswer(q.correct_answer),
                    year: Number(q.year) || new Date().getFullYear(),
                    subject_id: q.subject_id || bulkSubjectId,
                    teacher_id: user.id,
                };
                if (q.explanation) item.explanation = q.explanation;
                if (q.supporting_text) item.supporting_text = q.supporting_text;
                if (q.image_url) item.image_url = q.image_url;
                // Sem micro-tópico a questão fica fora do "Treino Específico".
                if (q.micro_topic_id) item.micro_topic_id = q.micro_topic_id;
                if (bulkTargetAudience !== 'all') item.target_audience = bulkTargetAudience;
                return item;
            });

            const inserted: { id: string }[] = [];
            const failed: { index: number; error: string }[] = [];
            setSaveProgress({ current: 0, total: itemsToInsert.length });
            for (let idx = 0; idx < itemsToInsert.length; idx++) {
                const { data, error: insertErr } = await supabase.from('questions').insert([itemsToInsert[idx]]).select('id').single();
                if (insertErr) failed.push({ index: idx, error: insertErr.message });
                else if (data) inserted.push(data);
                setSaveProgress({ current: idx + 1, total: itemsToInsert.length });
            }

            if (failed.length > 0 && inserted.length === 0)
                throw new Error(`Todas as questões falharam. Ex: ${failed[0].error}`);

            if (failed.length > 0) {
                const sample = failed.slice(0, 2).map(f => `Q${f.index + 1}: ${f.error}`).join(' | ');
                toast({ title: `${inserted.length} salvas, ${failed.length} com erro`, description: sample, variant: 'destructive' });
            }

            if (createExam && examTitle.trim() && inserted.length > 0) {
                const { data: examData, error: examErr } = await supabase
                    .from('exams').insert({ title: examTitle.trim(), year: examYear, exam_type: examType, teacher_id: user.id })
                    .select('id').single();
                if (examErr) throw examErr;
                const examQs = inserted.map((q, i) => ({ exam_id: examData.id, question_id: q.id, order_index: i }));
                await supabase.from('exam_questions').insert(examQs);
                toast({ title: 'Prova criada', description: `"${examTitle}" com ${inserted.length} questões.` });
            } else if (failed.length === 0) {
                toast({ title: 'Questões salvas', description: `${inserted.length} questões gravadas.` });
            }

            setExtractedQuestions([]);
            setRawText('');
            setCreateExam(false);
            setExamTitle('');
        } catch (e: any) {
            toast({ title: 'Erro ao gravar', description: e.message, variant: 'destructive' });
        } finally { setIsSaving(false); setSaveProgress(null); }
    };

    // ---------- Save single (manual) ----------
    const handleSaveSingle = async () => {
        if (!user || !manualQuestion.question_text || !manualQuestion.subject_id) return;
        setIsSaving(true);
        try {
            const options: QuestionOption[] = Object.entries(manualOptions)
                .filter(([_, t]) => t.trim() !== '').map(([key, text]) => ({ key, text }));
            const insertData: any = {
                question_text: manualQuestion.question_text,
                year: manualQuestion.year,
                subject_id: manualQuestion.subject_id,
                correct_answer: (manualQuestion.correct_answer || 'A').trim().toUpperCase().charAt(0),
                options, teacher_id: user.id,
            };
            if (manualQuestion.micro_topic_id) insertData.micro_topic_id = manualQuestion.micro_topic_id;
            if (manualQuestion.explanation) insertData.explanation = manualQuestion.explanation;
            if (manualQuestion.target_audience !== 'all') insertData.target_audience = manualQuestion.target_audience;
            const { error } = await supabase.from('questions').insert([insertData]);
            if (error) throw error;
            toast({ title: 'Questão salva' });
            setManualQuestion(prev => ({ ...prev, question_text: '', explanation: '', micro_topic_id: '' }));
            setManualOptions({ A: '', B: '', C: '', D: '', E: '' });
        } catch (err: any) {
            toast({ title: 'Falha ao salvar', description: err.message, variant: 'destructive' });
        } finally { setIsSaving(false); }
    };

    // ---------- Derived / computed ----------
    const filterCounts = {
        all: extractedQuestions.length,
        needs_image: extractedQuestions.filter(q => q.question_text.includes('[IMAGEM_PENDENTE]') || q.supporting_text?.includes('[IMAGEM_PENDENTE]')).length,
        no_subject: extractedQuestions.filter(q => !q.subject_id).length,
        dubious_answer: extractedQuestions.filter(q => !q.correct_answer || q.correct_answer.toUpperCase() === 'A').length,
        needs_gabarito: extractedQuestions.filter(q => !q.correct_answer).length,
    };

    const filteredQuestions = extractedQuestions.filter((q: ParsedQuestion) => {
        if (filterMode === 'needs_image') return q.question_text.includes('[IMAGEM_PENDENTE]') || q.supporting_text?.includes('[IMAGEM_PENDENTE]');
        if (filterMode === 'no_subject') return !q.subject_id;
        if (filterMode === 'dubious_answer') return !q.correct_answer || q.correct_answer.toUpperCase() === 'A';
        if (filterMode === 'needs_gabarito') return !q.correct_answer;
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
    const paginatedQuestions = filteredQuestions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const formatDate = (iso: string) => {
        try {
            return fmtLocale(iso, 'datetime', 'pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch { return iso; }
    };

    const statusColors: Record<UploadRecord['status'], string> = {
        completed: 'bg-green-100 text-green-700',
        partial: 'bg-amber-100 text-amber-700',
        error: 'bg-red-100 text-red-600',
    };

    // ---------- JSX ----------
    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-24 px-1">
            <header className="min-w-0">
                <p className="u-label flex items-center gap-2"><Database className="h-3.5 w-3.5" /> Professor · banco de questões</p>
                <h1 className="u-page-title text-3xl mt-1">Banco de questões</h1>
                <p className="text-sm text-muted-foreground mt-1">Importe provas, revise as questões e monte simulados.</p>
            </header>

            <QuestionsDashboard />

            <Card className="rounded-card overflow-hidden">
                <CardHeader className="border-b border-border p-4 md:p-6">
                    <div className="grid grid-cols-2 sm:inline-flex gap-1 bg-muted p-1 rounded-control w-full sm:w-fit">
                        <Button variant={entryMode === 'bulk' ? 'default' : 'ghost'} onClick={() => setEntryMode('bulk')}
                            className={`rounded-control font-semibold text-sm h-10 px-4 ${entryMode === 'bulk' ? '' : 'text-muted-foreground'}`}>
                            <ListChecks className="h-4 w-4 mr-2" /> Importar prova
                        </Button>
                        <Button variant={entryMode === 'manual' ? 'default' : 'ghost'} onClick={() => setEntryMode('manual')}
                            className={`rounded-control font-semibold text-sm h-10 px-4 ${entryMode === 'manual' ? '' : 'text-muted-foreground'}`}>
                            <PlusCircle className="h-4 w-4 mr-2" /> Uma questão
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-4 md:p-6">
                    {/* ---- BULK MODE ---- */}
                    {entryMode === 'bulk' && (
                        <div className="space-y-4">

                            {/* Upload history */}
                            {uploadHistory.length > 0 && (
                                <div className="rounded-control border border-border overflow-hidden">
                                    <button
                                        onClick={() => setShowHistory(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-2 u-label">
                                            <History className="h-4 w-4" />
                                            Arquivos enviados ({uploadHistory.length})
                                        </div>
                                        {showHistory ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                    </button>
                                    {showHistory && (
                                        <div className="px-4 pb-4 space-y-2">
                                            {uploadHistory.map(r => (
                                                <div key={r.id} className="flex items-center justify-between gap-3 bg-card rounded-control px-4 py-2.5 border border-border">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-foreground truncate max-w-[200px]">{r.filename}</p>
                                                        <p className="text-[10px] text-muted-foreground">{formatDate(r.timestamp)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-control whitespace-nowrap ${statusColors[r.status]}`}>
                                                            {r.questionCount} questões
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Upload hint */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-control border border-border bg-muted/40">
                                <FileText className="h-5 w-5 text-primary shrink-0 hidden sm:block" />
                                <p className="text-sm text-muted-foreground flex-1">
                                    Cole o texto da prova abaixo <span className="font-bold text-foreground">ou</span> envie um arquivo <span className="font-bold text-foreground">.txt / .pdf</span> com texto selecionável.
                                </p>
                                <input ref={fileInputRef} type="file" accept=".txt,.pdf,text/plain,application/pdf" className="hidden" multiple onChange={handleFileUpload} />
                                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isReadingFile}
                                    className="shrink-0 h-9 rounded-control font-bold text-xs">
                                    {isReadingFile ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Lendo...</> : <><Upload className="h-4 w-4 mr-1" />Enviar arquivo</>}
                                </Button>
                            </div>

                            {/* Text area + PDF preview side by side */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className={`${pdfUrl ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
                                    <div className="space-y-2">
                                        <Label className="u-label">Texto da prova</Label>
                                        <Textarea
                                            placeholder="Cole aqui o texto copiado de um PDF ou documento..."
                                            className="min-h-[250px] rounded-control p-4 text-sm leading-relaxed"
                                            value={rawText}
                                            onChange={e => setRawText(e.target.value)}
                                        />
                                        <div className="flex justify-between items-center gap-2 px-1">
                                            {rawText && (
                                                <p className="text-xs text-muted-foreground">
                                                    {rawText.length.toLocaleString('pt-BR')} caracteres · {rawText.split('\n').length} linhas
                                                </p>
                                            )}
                                            {rawText && (
                                                <Button variant="ghost" size="sm"
                                                    onClick={() => { clearExtraction(); setPdfUrl(null); }}
                                                    className="h-7 text-xs font-bold text-muted-foreground hover:text-red-600">
                                                    Limpar tudo
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => startExtraction({ text: rawText, imageQueue: autoImageQueue, subjects, bulkSubjectId, filename: currentFilename })}
                                        disabled={isAnalyzing || !rawText.trim()}
                                        variant="arcade"
                                        className="w-full h-12 rounded-control font-bold text-sm mt-2">
                                        {isAnalyzing
                                            ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Analisando com a Aurora IA...</>
                                            : <><BrainCircuit className="h-5 w-5 mr-2" />Extrair questões com a Aurora IA</>}
                                    </Button>
                                </div>

                                {/* PDF preview panel */}
                                {pdfUrl && (
                                    <div className="lg:col-span-5 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="u-label">PDF original</span>
                                            <Button variant="ghost" size="sm" onClick={() => setPdfUrl(null)}
                                                aria-label="Fechar PDF" className="h-8 w-8 p-0 rounded-control text-muted-foreground hover:text-red-600">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="h-[380px] bg-muted rounded-card overflow-hidden border border-border">
                                            <iframe src={pdfUrl} className="w-full h-full border-none" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Progress overlay */}
                            {isAnalyzing && (
                                <div className="mt-4 p-4 md:p-6 rounded-card border border-border space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                                            <Sparkles className="h-6 w-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground text-base leading-tight">A Aurora está analisando a prova...</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">Você pode navegar para outras páginas — a extração continua em segundo plano.</p>
                                        </div>
                                    </div>
                                    {progress.totalChunks > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center u-label">
                                                <span>Parte {progress.currentChunk} de {progress.totalChunks}</span>
                                                <span className="u-num">{pct(progress.currentChunk, progress.totalChunks)}%</span>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                                <div className="h-full rounded-full bg-primary transition-all duration-700"
                                                    style={{ width: `${Math.max(5, pct(progress.currentChunk, progress.totalChunks))}%` }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                        <div className="rounded-control border border-border p-3 text-center">
                                            <p className="u-num text-2xl">{progress.questionsFound}</p>
                                            <p className="u-label !tracking-[0.14em] mt-1">Questões encontradas</p>
                                        </div>
                                        <div className="rounded-control border border-border p-3 text-center">
                                            <p className="u-num text-2xl">{progress.totalChunks > 0 ? progress.totalChunks : '—'}</p>
                                            <p className="u-label !tracking-[0.14em] mt-1">Partes do texto</p>
                                        </div>
                                        <div className="rounded-control border border-border p-3 text-center">
                                            <p className="u-num text-2xl">{progress.elapsedSeconds}s</p>
                                            <p className="u-label !tracking-[0.14em] mt-1">Tempo decorrido</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Image gallery */}
                            {autoImageQueue.length > 0 && (
                                <div className="mt-6 p-4 md:p-6 rounded-card border border-dashed border-border">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div>
                                            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4 text-primary" /> Imagens encontradas ({autoImageQueue.length})
                                            </Label>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Arraste para reordenar ou solte uma imagem diretamente em uma questão.
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setAutoImageQueue([])}
                                            className="h-8 text-xs font-bold text-muted-foreground hover:bg-red-50 hover:text-red-600">
                                            <Trash2 className="h-3 w-3 mr-1" /> Limpar
                                        </Button>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto pb-4">
                                        {autoImageQueue.map((img, idx) => (
                                            <div key={img.id} draggable
                                                onDragStart={e => { setDraggedImgIndex(idx); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-auto-image', idx.toString()); }}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    if (draggedImgIndex === null || draggedImgIndex === idx) return;
                                                    const q = [...autoImageQueue]; const item = q[draggedImgIndex];
                                                    q.splice(draggedImgIndex, 1); q.splice(idx, 0, item);
                                                    setAutoImageQueue(q); setDraggedImgIndex(null);
                                                }}
                                                className="relative w-32 h-32 shrink-0 rounded-control overflow-hidden border-2 border-border hover:border-primary cursor-grab active:cursor-grabbing group bg-card">
                                                <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-control z-10">
                                                    {img.questionNumber != null ? `Q${img.questionNumber}` : `#${idx + 1}`}
                                                </div>
                                                <button onClick={() => setAutoImageQueue(prev => prev.filter((_, i) => i !== idx))}
                                                    aria-label="Remover imagem" className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-control opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                                <Image src={img.url} alt={`Img ${idx}`} fill className="object-contain p-2" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ---- MANUAL MODE ---- */}
                    {entryMode === 'manual' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="u-label">Enunciado</Label>
                                <Textarea placeholder="Digite o texto da pergunta..." className="rounded-control min-h-[80px] p-4 text-sm"
                                    value={manualQuestion.question_text} onChange={e => setManualQuestion(p => ({ ...p, question_text: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {['A', 'B', 'C', 'D', 'E'].map(key => (
                                    <div key={key} className="space-y-1.5">
                                        <Label className="u-label">Alternativa {key}</Label>
                                        <Input placeholder={`Texto da alternativa ${key}...`} className="h-10 rounded-control pl-4 text-sm"
                                            value={manualOptions[key as keyof typeof manualOptions]}
                                            onChange={e => setManualOptions(p => ({ ...p, [key]: e.target.value }))} />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                                <div className="space-y-1.5">
                                    <Label className="u-label">Gabarito</Label>
                                    <Select value={manualQuestion.correct_answer} onValueChange={val => setManualQuestion(p => ({ ...p, correct_answer: val }))}>
                                        <SelectTrigger className="h-10 rounded-control text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent className="rounded-control">
                                            {['A', 'B', 'C', 'D', 'E'].map(k => <SelectItem key={k} value={k} className="font-bold">Alternativa {k}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="u-label">Matéria</Label>
                                    <Select value={manualQuestion.subject_id} onValueChange={val => setManualQuestion(p => ({ ...p, subject_id: val }))}>
                                        <SelectTrigger className="h-10 rounded-control text-sm"><SelectValue placeholder="Matéria" /></SelectTrigger>
                                        <SelectContent className="rounded-control">
                                            {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-sm">{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {manualMicroTopics.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label className="u-label">Micro-tópico</Label>
                                        <Select value={manualQuestion.micro_topic_id || '_none'}
                                            onValueChange={val => setManualQuestion(p => ({ ...p, micro_topic_id: val === '_none' ? '' : val }))}>
                                            <SelectTrigger className="h-10 rounded-control text-sm"><SelectValue placeholder="Selecionar tópico" /></SelectTrigger>
                                            <SelectContent className="rounded-control">
                                                <SelectItem value="_none" className="font-bold text-sm">Nenhum (geral)</SelectItem>
                                                {manualMicroTopics.map(mt => <SelectItem key={mt.id} value={mt.id} className="font-bold text-sm">{mt.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label className="u-label">Público</Label>
                                    <Select value={manualQuestion.target_audience} onValueChange={val => setManualQuestion(p => ({ ...p, target_audience: val }))}>
                                        <SelectTrigger className="h-10 rounded-control text-sm"><SelectValue placeholder="Turma" /></SelectTrigger>
                                        <SelectContent className="rounded-control">
                                            <SelectItem value="all" className="font-bold text-sm">Todos</SelectItem>
                                            <SelectItem value="etec" className="font-bold text-sm">ETEC / FATEC</SelectItem>
                                            <SelectItem value="enem" className="font-bold text-sm">ENEM</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="u-label">Ano de referência</Label>
                                    <Input type="number" className="h-10 rounded-control text-center text-sm"
                                        value={manualQuestion.year} onChange={e => setManualQuestion(p => ({ ...p, year: parseInt(e.target.value, 10) }))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="u-label">Explicação da resposta (opcional)</Label>
                                <Textarea placeholder="Justifique a resposta correta..." className="rounded-control min-h-[60px] p-4 text-sm"
                                    value={manualQuestion.explanation}
                                    onChange={e => setManualQuestion(p => ({ ...p, explanation: e.target.value }))} />
                            </div>
                            <Button onClick={handleSaveSingle} disabled={isSaving || !manualQuestion.question_text}
                                variant="arcade"
                                className="w-full h-12 font-bold text-sm rounded-control mt-2">
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                                Salvar questão
                            </Button>
                        </div>
                    )}

                    {/* ---- CURATION AREA ---- */}
                    {extractedQuestions.length > 0 && (
                        <div className="mt-10 pt-10 border-t border-dashed border-border space-y-6">

                            {/* Curation controls (STICKY) */}
                            <div className="md:sticky md:top-4 z-40 bg-card p-4 md:p-6 rounded-card border border-border shadow-xl space-y-4 mb-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-foreground flex flex-wrap items-center gap-2">
                                            Revisão das questões <span className="u-num text-base">({extractedQuestions.length})</span>
                                            {lastSaved && <span className="text-[11px] font-semibold text-muted-foreground flex items-center bg-muted px-2 py-1 rounded-control"><Clock className="h-3 w-3 mr-1" /> Rascunho salvo às {fmtLocale(lastSaved, 'time', 'pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">A IA sugeriu as matérias. Ajuste se precisar.</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button variant="outline" size="sm" onClick={() => {
                                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(extractedQuestions, null, 2));
                                            const downloadNode = document.createElement('a');
                                            downloadNode.setAttribute("href", dataStr);
                                            downloadNode.setAttribute("download", `questoes_${new Date().getTime()}.json`);
                                            document.body.appendChild(downloadNode);
                                            downloadNode.click();
                                            downloadNode.remove();
                                        }} className="h-10 rounded-control font-bold text-xs">
                                            <Download className="h-4 w-4 mr-2" /> Exportar JSON
                                        </Button>
                                        <Select value={bulkTargetAudience} onValueChange={setBulkTargetAudience}>
                                            <SelectTrigger className="w-full md:w-40 h-10 rounded-control font-semibold text-xs"><SelectValue placeholder="Público" /></SelectTrigger>
                                            <SelectContent className="rounded-control">
                                                <SelectItem value="all" className="font-bold text-xs">Todos</SelectItem>
                                                <SelectItem value="etec" className="font-bold text-xs">ETEC/FATEC</SelectItem>
                                                <SelectItem value="enem" className="font-bold text-xs">ENEM</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="text-xs text-muted-foreground">Matéria padrão:</div>
                                        <Select value={bulkSubjectId} onValueChange={setBulkSubjectId}>
                                            <SelectTrigger className="w-full md:w-44 h-10 rounded-control font-semibold text-xs"><SelectValue placeholder="Matéria padrão" /></SelectTrigger>
                                            <SelectContent className="rounded-control">
                                                {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-xs">{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 rounded-control border border-dashed border-border">
                                    <Switch id="create-exam" checked={createExam} onCheckedChange={setCreateExam} />
                                    <Label htmlFor="create-exam" className="font-semibold text-sm text-foreground cursor-pointer flex items-center gap-2">
                                        <Scroll className="h-4 w-4 text-primary" /> Criar também como prova completa
                                    </Label>
                                </div>

                                {createExam && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="md:col-span-1 space-y-1">
                                            <Label className="u-label">Título da prova</Label>
                                            <Input placeholder="Ex.: ENEM 2023 — 1ª Aplicação" className="h-10 rounded-control font-semibold text-xs"
                                                value={examTitle} onChange={e => setExamTitle(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="u-label">Tipo</Label>
                                            <Select value={examType} onValueChange={setExamType}>
                                                <SelectTrigger className="h-10 rounded-control font-semibold text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-control">
                                                    {EXAM_TYPES.map(t => (
                                                        <SelectItem key={t} value={t} className="font-bold text-xs">{t.toUpperCase()}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="u-label">Ano</Label>
                                            <Input type="number" className="h-10 rounded-control text-center text-xs"
                                                value={examYear} onChange={e => setExamYear(parseInt(e.target.value, 10))} />
                                        </div>
                                    </div>
                                )}

                                <Button onClick={handlePreSave} disabled={isSaving || !bulkSubjectId || (createExam && !examTitle.trim())}
                                    className="w-full h-12 rounded-control font-bold relative overflow-hidden">
                                    {saveProgress && (
                                        <div 
                                            className="absolute top-0 left-0 h-full bg-accent transition-all duration-300 z-0" 
                                            style={{ width: `${pct(saveProgress.current, saveProgress.total)}%`, opacity: 0.2 }}
                                        />
                                    )}
                                    <div className="relative z-10 flex items-center justify-center">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        {saveProgress ? `Salvando... (${saveProgress.current}/${saveProgress.total})` : isSaving ? 'Verificando...' : `Revisar e salvar tudo (${extractedQuestions.length} questões)`}
                                    </div>
                                </Button>
                            </div>

                            {/* Gabarito em lote — provas como a da FUVEST publicam o gabarito
                                num PDF separado, então as questões saem da extração sem resposta. */}
                            <Card className="p-4 md:p-5 rounded-card">
                                <button
                                    type="button"
                                    onClick={() => setShowAnswerKeyPanel(v => !v)}
                                    className="w-full flex items-center justify-between gap-3 text-left"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-sm font-bold text-foreground">
                                            Aplicar gabarito em lote
                                        </span>
                                        {filterCounts.needs_gabarito > 0 && (
                                            <span className="shrink-0 rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-[11px] font-bold">
                                                {filterCounts.needs_gabarito} sem resposta
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRightIcon className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showAnswerKeyPanel ? 'rotate-90' : ''}`} />
                                </button>

                                {showAnswerKeyPanel && (
                                    <div className="mt-4 space-y-3">
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Cole o gabarito oficial. Entende <b>1-A 2-B 3-C</b>, <b>1. A</b>, <b>01) A</b> ou só as letras
                                            (<b>A B C D</b>). Com numeração, casa pelo número impresso da questão — questão faltando não desalinha.
                                        </p>
                                        <Textarea
                                            value={answerKeyText}
                                            onChange={e => setAnswerKeyText(e.target.value)}
                                            placeholder={"1-A 2-B 3-C 4-D 5-E ..."}
                                            className="min-h-[110px] rounded-control font-mono text-xs"
                                        />
                                        {answerKeyPreview && (
                                            <div className={`rounded-control p-3 text-xs font-semibold ${answerKeyPreview.applied > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-yellow/25 text-foreground'}`}>
                                                {answerKeyPreview.total === 0 ? (
                                                    <>Nenhuma resposta reconhecida no texto colado.</>
                                                ) : (
                                                    <>
                                                        {answerKeyPreview.total} respostas lidas
                                                        {answerKeyPreview.mode === 'numbered' ? ' (com numeração)' : ' (por ordem)'} ·{' '}
                                                        <b>{answerKeyPreview.applied}</b> de {extractedQuestions.length} questões serão preenchidas
                                                        {answerKeyPreview.leftover > 0 && <> · {answerKeyPreview.leftover} do gabarito sem questão correspondente</>}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        <Button
                                            onClick={handleApplyAnswerKey}
                                            disabled={!answerKeyPreview || answerKeyPreview.applied === 0}
                                            className="h-11 rounded-control font-bold text-sm"
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            Aplicar aos {answerKeyPreview?.applied ?? 0} itens
                                        </Button>
                                    </div>
                                )}
                            </Card>

                            {/* Filter toolbar */}
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { key: 'all' as const, label: 'Todas', count: filterCounts.all, color: 'bg-foreground text-background' },
                                    { key: 'needs_image' as const, label: 'Precisam de imagem', count: filterCounts.needs_image, color: 'bg-brand-yellow text-foreground' },
                                    { key: 'no_subject' as const, label: 'Sem matéria', count: filterCounts.no_subject, color: 'bg-red-600 text-white' },
                                    { key: 'dubious_answer' as const, label: 'Gabarito duvidoso', count: filterCounts.dubious_answer, color: 'bg-brand-yellow text-foreground' },
                                    { key: 'needs_gabarito' as const, label: 'Sem gabarito', count: filterCounts.needs_gabarito, color: 'bg-red-600 text-white' },
                                ] as const).map(f => (
                                    <button key={f.key} onClick={() => setFilterMode(f.key)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-control text-xs font-semibold transition-colors border ${filterMode === f.key ? `${f.color} border-transparent` : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
                                        {f.label}
                                        <span className={`text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${filterMode === f.key ? 'bg-black/10' : 'bg-muted'}`}>{f.count}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Questions grid (paginated) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                {paginatedQuestions.map((q: ParsedQuestion & { _confirmed_answer?: boolean }, i: number) => (
                                    <Card key={q._tempId}
                                        className={`p-4 md:p-6 rounded-card relative group transition-colors ${dragOverId === q._tempId ? 'ring-4 ring-primary bg-primary/5 z-10' : ''}`}
                                        onPaste={(e: React.ClipboardEvent) => {
                                            for (let j = 0; j < e.clipboardData.items.length; j++) {
                                                if (e.clipboardData.items[j].type.includes('image')) {
                                                    const blob = e.clipboardData.items[j].getAsFile();
                                                    if (blob) handleImageUpload(q._tempId!, blob);
                                                }
                                            }
                                        }}
                                        onDragEnter={() => setDragOverId(q._tempId || null)}
                                        onDragLeave={() => setDragOverId(null)}
                                        onDragOver={e => { e.preventDefault(); setDragOverId(q._tempId || null); }}
                                        onDrop={e => {
                                            e.preventDefault(); setDragOverId(null);
                                            const file = e.dataTransfer.files?.[0];
                                            if (file?.type.startsWith('image/')) { handleImageUpload(q._tempId!, file); return; }
                                            const autoIdx = e.dataTransfer.getData('application/x-auto-image');
                                            if (autoIdx) { const img = autoImageQueue[parseInt(autoIdx, 10)]; if (img) handleImageUpload(q._tempId!, img.file); }
                                        }}
                                    >
                                        <div className="absolute top-4 left-4 z-20">
                                            <Checkbox
                                                checked={selectedQuestions.includes(q._tempId!)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) setSelectedQuestions(p => [...p, q._tempId!]);
                                                    else setSelectedQuestions(p => p.filter(id => id !== q._tempId));
                                                }}
                                                className="h-5 w-5 rounded-md border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            />
                                        </div>

                                        {q._uploadingImage && (
                                            <div className="absolute inset-0 bg-card/80 z-50 flex flex-col items-center justify-center rounded-card">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                                                <span className="u-label">Anexando imagem…</span>
                                            </div>
                                        )}
                                        <button onClick={() => {
                                            const url = q.image_url;
                                            setExtractedQuestions(prev => prev.filter(item => item._tempId !== q._tempId));
                                            if (url) deleteImageFromStorage(url);
                                        }} aria-label="Remover questão" className="absolute top-4 right-4 h-8 w-8 rounded-control text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-50 hover:text-red-600">
                                            <Trash2 className="h-4 w-4" />
                                        </button>

                                        <div className="flex items-center gap-1.5 mb-4 flex-wrap pl-8 pr-8">
                                            <Badge variant="outline" className="font-bold text-[11px] px-2">
                                                Questão {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                                            </Badge>
                                            {q.options.length < 2 && (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold text-[11px] px-2">Alternativas incompletas</Badge>
                                            )}
                                            {!q.correct_answer && (
                                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-bold text-[11px] px-2">Sem gabarito</Badge>
                                            )}
                                            {q.year ? <Badge variant="outline" className="font-bold text-[11px] px-2 text-muted-foreground">{q.year}</Badge> : null}
                                            {q.subject_name && (
                                                <Badge variant="outline" className="font-bold text-[11px] px-2 text-muted-foreground">Sugestão da IA: {q.subject_name}</Badge>
                                            )}
                                            <Button variant="ghost" size="sm"
                                                className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    const cur = q.question_text;
                                                    const upd = cur.includes('[IMAGEM_PENDENTE]') ? cur.replace('[IMAGEM_PENDENTE]', '') : cur + ' [IMAGEM_PENDENTE]';
                                                    setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, question_text: upd } : item));
                                                }}>
                                                <ImageIcon className="h-3 w-3 mr-1" /> Marcar imagem
                                            </Button>
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            {q.supporting_text !== undefined && (
                                                <div className="space-y-1">
                                                    <Label className="u-label">Texto de apoio</Label>
                                                    <Textarea value={q.supporting_text}
                                                        onChange={e => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, supporting_text: e.target.value } : item))}
                                                        className="text-xs bg-muted/40 rounded-control min-h-[60px] leading-relaxed" />
                                                </div>
                                            )}

                                            <div className="space-y-1 relative">
                                                <Label className="u-label flex items-center justify-between">
                                                    Enunciado
                                                </Label>
                                                <div className={`relative rounded-control border-2 transition-colors overflow-hidden ${dragOverId === q._tempId
                                                        ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                                                        : (q.question_text.includes('[IMAGEM_PENDENTE]') || q.supporting_text?.includes('[IMAGEM_PENDENTE]')) && !q.image_url
                                                            ? 'border-foreground/30 border-dashed bg-brand-yellow/15'
                                                            : 'border-border bg-muted/30'
                                                    }`}>
                                                    <Textarea value={q.question_text}
                                                        onChange={e => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, question_text: e.target.value } : item))}
                                                        className="text-sm text-foreground leading-relaxed min-h-[80px] bg-transparent border-none rounded-none resize-y relative z-10" />

                                                    {/* Overlay Drop Target Indicator for Textarea */}
                                                    {(q.question_text.includes('[IMAGEM_PENDENTE]') || q.supporting_text?.includes('[IMAGEM_PENDENTE]')) && !q.image_url && (
                                                        <div className="absolute bottom-2 right-2 z-20">
                                                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-control cursor-pointer transition-colors ${dragOverId === q._tempId ? 'bg-primary text-primary-foreground' : 'bg-brand-yellow text-foreground hover:bg-brand-yellow/80'}`}>
                                                                <Upload className="h-3 w-3" />
                                                                <span className="text-xs font-bold">{dragOverId === q._tempId ? 'Solte a imagem' : 'Anexar imagem'}</span>
                                                                <input type="file" accept="image/*" className="hidden"
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                                        const f = e.target.files?.[0];
                                                                        if (f) handleImageUpload(q._tempId!, f);
                                                                    }} />
                                                            </label>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Image Preview if uploaded */}
                                                {q.image_url && (
                                                    <div className="mt-3 relative aspect-video rounded-control overflow-hidden border-2 border-emerald-200 bg-card group/img">
                                                        <div className="absolute top-2 left-2 z-10 bg-emerald-600 text-white px-2 py-1 rounded-control text-[11px] font-bold flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> Imagem anexada
                                                        </div>
                                                        <Image src={q.image_url} alt="Questão" fill className="object-contain" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center z-20">
                                                            <Button variant="destructive" size="sm" onClick={async () => {
                                                                const url = q.image_url;
                                                                setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, image_url: undefined } : item));
                                                                if (url) await deleteImageFromStorage(url);
                                                            }} className="font-bold text-xs h-8"><Trash2 className="h-4 w-4 mr-2" /> Remover imagem</Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <Label className="u-label mb-1 block">Matéria</Label>
                                                <Select value={q.subject_id || ''}
                                                    onValueChange={val => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, subject_id: val, micro_topic_id: undefined } : item))}>
                                                    <SelectTrigger className="h-9 rounded-control text-xs w-full">
                                                        <SelectValue placeholder="Selecionar matéria..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-control">
                                                        {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-xs">{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {/* Sem micro-tópico a questão não aparece no "Treino Específico". */}
                                            <div>
                                                <Label className="u-label mb-1 block">Micro-tópico</Label>
                                                <Select value={q.micro_topic_id || ''}
                                                    disabled={!q.subject_id}
                                                    onValueChange={val => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, micro_topic_id: val } : item))}>
                                                    <SelectTrigger className="h-9 rounded-control text-xs w-full">
                                                        <SelectValue placeholder={q.subject_id ? 'Opcional...' : 'Escolha a matéria'} />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-control">
                                                        {allMicroTopics.filter(mt => mt.subject_id === q.subject_id)
                                                            .map(mt => <SelectItem key={mt.id} value={mt.id} className="font-bold text-xs">{mt.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {q.options.map(opt => {
                                                const isDubious = q.correct_answer === 'A' && !q._confirmed_answer;
                                                return (
                                                    <div key={opt.key}
                                                        onClick={() => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, correct_answer: opt.key, _confirmed_answer: true } : item))}
                                                        className={`flex items-center gap-3 p-3 rounded-control border text-xs cursor-pointer transition-colors ${q.correct_answer === opt.key ? (isDubious ? 'bg-brand-yellow/25 border-foreground/30 text-foreground' : 'bg-emerald-50 border-emerald-200 text-emerald-800') : 'bg-muted/30 border-transparent text-muted-foreground hover:bg-muted hover:border-border'}`}>
                                                        <span className="font-bold">{opt.key})</span>
                                                        <span className="truncate">{opt.text}</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </Card>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                        className="h-9 w-9 rounded-control bg-card border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>

                                    {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                                            if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                                            acc.push(p); return acc;
                                        }, [])
                                        .map((p, idx) =>
                                            p === 'ellipsis' ? (
                                                <span key={`e-${idx}`} className="text-muted-foreground font-bold text-xs px-1">···</span>
                                            ) : (
                                                <button key={p} onClick={() => setCurrentPage(p as number)}
                                                    className={`h-9 w-9 rounded-control text-xs font-bold tabular-nums transition-colors ${currentPage === p ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
                                                    {p}
                                                </button>
                                            )
                                        )}

                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                        className="h-9 w-9 rounded-control bg-card border border-border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors">
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </button>

                                    <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredQuestions.length)} de {filteredQuestions.length}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedQuestions.length > 0 && (
                        <div className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto max-w-4xl bg-slate-900 text-white px-4 py-3 rounded-card shadow-2xl z-50 flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="text-sm font-bold">{selectedQuestions.length} selecionadas</span>
                            <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block" />
                            <Select onValueChange={(val) => {
                                setExtractedQuestions(prev => prev.map(q => selectedQuestions.includes(q._tempId!) ? { ...q, subject_id: val, micro_topic_id: undefined } : q));
                                toast({ title: 'Matéria aplicada às selecionadas' });
                            }}>
                                <SelectTrigger className="h-8 bg-slate-800 border-none text-xs font-bold text-white w-40"><SelectValue placeholder="Definir matéria" /></SelectTrigger>
                                <SelectContent className="rounded-control">
                                    {subjects.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-bold">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {/* Só oferece micro-tópicos válidos para a matéria comum às selecionadas. */}
                            {bulkSelectionMicroTopics.length > 0 && (
                                <Select onValueChange={(val) => {
                                    setExtractedQuestions(prev => prev.map(q => selectedQuestions.includes(q._tempId!) ? { ...q, micro_topic_id: val } : q));
                                    toast({ title: 'Micro-tópico aplicado às selecionadas' });
                                }}>
                                    <SelectTrigger className="h-8 bg-slate-800 border-none text-xs font-bold text-white w-44"><SelectValue placeholder="Micro-tópico" /></SelectTrigger>
                                    <SelectContent className="rounded-control">
                                        {bulkSelectionMicroTopics.map(mt => <SelectItem key={mt.id} value={mt.id} className="text-xs font-bold">{mt.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}

                            <Select onValueChange={(val) => {
                                setExtractedQuestions(prev => prev.map(q => selectedQuestions.includes(q._tempId!) ? { ...q, target_audience: val } : q));
                                toast({ title: 'Público aplicado às selecionadas' });
                            }}>
                                <SelectTrigger className="h-8 bg-slate-800 border-none text-xs font-bold text-white w-32"><SelectValue placeholder="Público" /></SelectTrigger>
                                <SelectContent className="rounded-control">
                                    <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                                    <SelectItem value="etec" className="text-xs font-bold">ETEC</SelectItem>
                                    <SelectItem value="enem" className="text-xs font-bold">ENEM</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="ghost" size="sm" onClick={() => {
                                setExtractedQuestions(prev => prev.filter(q => !selectedQuestions.includes(q._tempId!)));
                                setSelectedQuestions([]);
                                toast({ title: 'Questões selecionadas removidas' });
                            }} className="text-red-300 hover:text-red-200 hover:bg-red-400/20 h-8 px-3 rounded-control text-xs font-bold">
                                <Trash2 className="h-4 w-4 mr-2" /> Remover selecionadas
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedQuestions([])} aria-label="Limpar seleção" className="h-8 w-8 rounded-control hover:bg-slate-800 text-slate-400">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
                        <DialogContent className="sm:max-w-md rounded-card">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-foreground">Resumo da importação</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 py-4">
                                <div className="flex items-center justify-between gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-control border border-emerald-200">
                                    <span className="font-semibold text-sm">Prontas para salvar</span>
                                    <span className="u-num text-xl">{Math.max(0, extractedQuestions.length - filterCounts.no_subject - filterCounts.needs_image - filterCounts.needs_gabarito)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 p-4 bg-red-50 text-red-700 rounded-control border border-red-200">
                                    <span className="font-semibold text-sm">Sem matéria</span>
                                    <div className="flex items-center gap-4">
                                        <span className="u-num text-xl">{filterCounts.no_subject}</span>
                                        {filterCounts.no_subject > 0 && (
                                            <Button size="sm" variant="outline" className="h-8 rounded-control text-xs font-bold border-red-200 hover:bg-red-100 text-red-700" onClick={() => { setShowSaveModal(false); setFilterMode('no_subject'); }}>Filtrar</Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 p-4 bg-brand-yellow/25 text-foreground rounded-control border border-foreground/15">
                                    <span className="font-semibold text-sm">Precisam de imagem</span>
                                    <div className="flex items-center gap-4">
                                        <span className="u-num text-xl">{filterCounts.needs_image}</span>
                                        {filterCounts.needs_image > 0 && (
                                            <Button size="sm" variant="outline" className="h-8 rounded-control text-xs font-bold border-foreground/20 text-foreground" onClick={() => { setShowSaveModal(false); setFilterMode('needs_image'); }}>Filtrar</Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 p-4 bg-red-50 text-red-700 rounded-control border border-red-200">
                                    <span className="font-semibold text-sm">Sem gabarito</span>
                                    <div className="flex items-center gap-4">
                                        <span className="u-num text-xl">{filterCounts.needs_gabarito}</span>
                                        {filterCounts.needs_gabarito > 0 && (
                                            <Button size="sm" variant="outline" className="h-8 rounded-control text-xs font-bold border-red-200 hover:bg-red-100 text-red-700" onClick={() => { setShowSaveModal(false); setFilterMode('needs_gabarito'); }}>Filtrar</Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="flex-col sm:flex-row gap-3">
                                <Button variant="ghost" onClick={() => setShowSaveModal(false)} className="rounded-control font-bold h-11">Continuar revisando</Button>
                                <Button onClick={() => { setShowSaveModal(false); handleDuplicateCheck(); }} className="rounded-control font-bold h-11 px-6">Verificar e salvar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
                        <DialogContent className="sm:max-w-md rounded-card">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-red-700 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" /> Questões repetidas
                                </DialogTitle>
                            </DialogHeader>
                            <div className="p-4 bg-red-50 text-red-800 rounded-control text-sm leading-relaxed border border-red-200 mt-2">
                                Encontramos <strong className="font-bold">{duplicateWarning?.existing} questões</strong> que já estão no banco com o mesmo enunciado.
                            </div>
                            <DialogFooter className="flex-col sm:flex-row gap-3 mt-6">
                                <Button variant="ghost" onClick={() => setDuplicateWarning(null)} className="rounded-control font-bold h-11">Cancelar</Button>
                                <Button onClick={() => {
                                    const uniqueItems = duplicateWarning!.newItems.filter(q => !duplicateWarning!.existingTexts.includes(q.question_text.trim()));
                                    setDuplicateWarning(null);
                                    handleSaveProcessed(uniqueItems);
                                }} className="rounded-control font-bold bg-red-600 text-white hover:bg-red-700 h-11">Pular as repetidas e salvar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>

            <section className="pt-6">
                <div className="mb-4">
                    <p className="u-label">Banco de questões</p>
                    <h2 className="text-lg font-bold text-foreground mt-1">Questões cadastradas</h2>
                </div>
                <QuestionsList />
            </section>
        </div>
    );
}
