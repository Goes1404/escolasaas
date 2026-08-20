
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
                toast({ title: 'Base Vazia', description: 'Nenhuma disciplina cadastrada.', variant: 'destructive' });
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
            toast({ title: 'Upload concluído!', description: `${files.length} arquivo(s) lido(s).${imgMsg}` });
        } else {
            toast({ title: 'Aviso', description: 'Texto insuficiente extraído dos arquivos.', variant: 'destructive' });
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
                toast({ title: 'Prova criada!', description: `"${examTitle}" com ${inserted.length} questões.` });
            } else if (failed.length === 0) {
                toast({ title: 'Banco Atualizado!', description: `${inserted.length} questões gravadas.` });
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
            toast({ title: 'Questão Salva!' });
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
            return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch { return iso; }
    };

    const statusColors: Record<UploadRecord['status'], string> = {
        completed: 'bg-green-100 text-green-700',
        partial: 'bg-amber-100 text-amber-700',
        error: 'bg-red-100 text-red-600',
    };

    // ---------- JSX ----------
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24 px-1">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl rotate-3">
                        <Database className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-primary italic leading-none">Banco de Questões</h1>
                        <p className="text-muted-foreground font-medium italic">Gestão estratégica de avaliações e simulados.</p>
                    </div>
                </div>
            </header>

            <QuestionsDashboard />

            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-dashed p-6">
                    <div className="flex flex-wrap bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border w-fit mx-auto md:mx-0 shadow-sm">
                        <Button variant={entryMode === 'bulk' ? 'default' : 'ghost'} onClick={() => setEntryMode('bulk')}
                            className={`rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6 ${entryMode === 'bulk' ? 'bg-primary text-white shadow-lg' : ''}`}>
                            <ListChecks className="h-4 w-4 mr-2" /> Carga em Massa
                        </Button>
                        <Button variant={entryMode === 'manual' ? 'default' : 'ghost'} onClick={() => setEntryMode('manual')}
                            className={`rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6 ${entryMode === 'manual' ? 'bg-primary text-white shadow-lg' : ''}`}>
                            <PlusCircle className="h-4 w-4 mr-2" /> Manual
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-6">
                    {/* ---- BULK MODE ---- */}
                    {entryMode === 'bulk' && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">

                            {/* Upload history */}
                            {uploadHistory.length > 0 && (
                                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 overflow-hidden">
                                    <button
                                        onClick={() => setShowHistory(v => !v)}
                                        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                                            <History className="h-4 w-4" />
                                            Histórico de Uploads ({uploadHistory.length})
                                        </div>
                                        {showHistory ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                    </button>
                                    {showHistory && (
                                        <div className="px-4 pb-4 space-y-2">
                                            {uploadHistory.map(r => (
                                                <div key={r.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 shadow-sm border border-slate-100">
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{r.filename}</p>
                                                        <p className="text-[10px] text-muted-foreground">{formatDate(r.timestamp)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${statusColors[r.status]}`}>
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
                            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-2xl border border-blue-100">
                                <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                                <p className="text-xs font-bold text-blue-700 flex-1">
                                    Cole o texto da prova abaixo <span className="font-black">ou</span> faça upload de um arquivo <span className="font-black">.txt / .pdf</span> com texto selecionável.
                                </p>
                                <input ref={fileInputRef} type="file" accept=".txt,.pdf,text/plain,application/pdf" className="hidden" multiple onChange={handleFileUpload} />
                                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isReadingFile}
                                    className="shrink-0 h-9 rounded-xl border-blue-200 text-blue-600 font-black text-xs hover:bg-blue-100">
                                    {isReadingFile ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Lendo...</> : <><Upload className="h-4 w-4 mr-1" />Upload</>}
                                </Button>
                            </div>

                            {/* Text area + PDF preview side by side */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className={`${pdfUrl ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Texto Bruto da Prova</Label>
                                        <Textarea
                                            placeholder="Cole aqui o texto copiado de um PDF ou documento..."
                                            className="min-h-[250px] rounded-2xl bg-muted/30 border-none p-4 font-medium text-sm leading-relaxed italic"
                                            value={rawText}
                                            onChange={e => setRawText(e.target.value)}
                                        />
                                        <div className="flex justify-between items-center px-2">
                                            {rawText && (
                                                <p className="text-[10px] text-muted-foreground font-medium">
                                                    {rawText.length.toLocaleString('pt-BR')} caracteres · {rawText.split('\n').length} linhas
                                                </p>
                                            )}
                                            {rawText && (
                                                <Button variant="ghost" size="sm"
                                                    onClick={() => { clearExtraction(); setPdfUrl(null); }}
                                                    className="h-6 text-[8px] font-black text-red-400 hover:text-red-600 uppercase">
                                                    Limpar Tudo
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => startExtraction({ text: rawText, imageQueue: autoImageQueue, subjects, bulkSubjectId, filename: currentFilename })}
                                        disabled={isAnalyzing || !rawText.trim()}
                                        className="w-full h-12 rounded-2xl bg-primary text-white font-black text-base shadow-xl hover:scale-[1.02] transition-all active:scale-95 mt-2">
                                        {isAnalyzing
                                            ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Analisando com Aurora IA...</>
                                            : <><BrainCircuit className="h-5 w-5 mr-2" />Extrair Questões com Aurora IA</>}
                                    </Button>
                                </div>

                                {/* PDF preview panel */}
                                {pdfUrl && (
                                    <div className="lg:col-span-5 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-primary text-white border-none text-[8px] font-black uppercase px-3">PDF Original</Badge>
                                            <Button variant="ghost" size="sm" onClick={() => setPdfUrl(null)}
                                                className="h-7 w-7 p-0 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="h-[380px] bg-slate-900 rounded-[2rem] overflow-hidden border-4 border-slate-800 shadow-2xl">
                                            <iframe src={pdfUrl} className="w-full h-full border-none" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Progress overlay */}
                            {isAnalyzing && (
                                <div className="mt-4 p-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 space-y-5 animate-in fade-in duration-500">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                                        </div>
                                        <div>
                                            <p className="font-black text-primary italic text-base leading-tight">Aurora está analisando a prova...</p>
                                            <p className="text-xs text-muted-foreground font-medium">Você pode navegar para outras páginas — a extração continua em segundo plano.</p>
                                        </div>
                                    </div>
                                    {progress.totalChunks > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                                                <span>Parte {progress.currentChunk} de {progress.totalChunks}</span>
                                                <span>{Math.round((progress.currentChunk / progress.totalChunks) * 100)}%</span>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                                                    style={{ width: `${Math.max(5, (progress.currentChunk / progress.totalChunks) * 100)}%` }} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                                            <p className="text-2xl font-black text-primary">{progress.questionsFound}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Questões encontradas</p>
                                        </div>
                                        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                                            <p className="text-2xl font-black text-accent">{progress.totalChunks > 0 ? progress.totalChunks : '—'}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Partes do texto</p>
                                        </div>
                                        <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                                            <p className="text-2xl font-black text-slate-600">{progress.elapsedSeconds}s</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Tempo decorrido</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Image gallery */}
                            {autoImageQueue.length > 0 && (
                                <div className="mt-6 p-6 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 animate-in fade-in duration-500">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                        <div>
                                            <Label className="text-sm font-black uppercase text-primary flex items-center gap-2">
                                                <ImageIcon className="h-4 w-4" /> Fila de Imagens Detectadas ({autoImageQueue.length})
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Arraste para reordenar ou solte uma imagem diretamente em uma questão.
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setAutoImageQueue([])}
                                            className="h-8 text-[10px] font-black text-red-400 hover:bg-red-50 hover:text-red-600 uppercase">
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
                                                className="relative w-32 h-32 shrink-0 rounded-2xl overflow-hidden border-2 border-transparent hover:border-primary cursor-grab active:cursor-grabbing group shadow-sm bg-white">
                                                <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-lg z-10 shadow-md">
                                                    {img.questionNumber != null ? `Q${img.questionNumber}` : `#${idx + 1}`}
                                                </div>
                                                <button onClick={() => setAutoImageQueue(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Enunciado da Questão</Label>
                                <Textarea placeholder="Digite o texto da pergunta..." className="rounded-2xl bg-muted/30 border-none min-h-[80px] p-4 font-medium italic text-sm"
                                    value={manualQuestion.question_text} onChange={e => setManualQuestion(p => ({ ...p, question_text: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {['A', 'B', 'C', 'D', 'E'].map(key => (
                                    <div key={key} className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase opacity-40 ml-2">Opção {key}</Label>
                                        <Input placeholder={`Texto da alternativa ${key}...`} className="h-10 rounded-xl bg-muted/30 border-none font-medium pl-4 text-sm"
                                            value={manualOptions[key as keyof typeof manualOptions]}
                                            onChange={e => setManualOptions(p => ({ ...p, [key]: e.target.value }))} />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-40 ml-2">Gabarito</Label>
                                    <Select value={manualQuestion.correct_answer} onValueChange={val => setManualQuestion(p => ({ ...p, correct_answer: val }))}>
                                        <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                            {['A', 'B', 'C', 'D', 'E'].map(k => <SelectItem key={k} value={k} className="font-bold">Alternativa {k}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-40 ml-2">Disciplina</Label>
                                    <Select value={manualQuestion.subject_id} onValueChange={val => setManualQuestion(p => ({ ...p, subject_id: val }))}>
                                        <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold text-sm"><SelectValue placeholder="Matéria" /></SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                            {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-sm">{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {manualMicroTopics.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label className="text-[9px] font-black uppercase opacity-40 ml-2">Micro-tópico</Label>
                                        <Select value={manualQuestion.micro_topic_id || '_none'}
                                            onValueChange={val => setManualQuestion(p => ({ ...p, micro_topic_id: val === '_none' ? '' : val }))}>
                                            <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold text-sm"><SelectValue placeholder="Selecionar tópico" /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                                <SelectItem value="_none" className="font-bold text-sm">Nenhum (Geral)</SelectItem>
                                                {manualMicroTopics.map(mt => <SelectItem key={mt.id} value={mt.id} className="font-bold text-sm">{mt.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-40 ml-2">Público Alvo</Label>
                                    <Select value={manualQuestion.target_audience} onValueChange={val => setManualQuestion(p => ({ ...p, target_audience: val }))}>
                                        <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold text-sm"><SelectValue placeholder="Turma" /></SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                            <SelectItem value="all" className="font-bold text-sm">Todos (Geral)</SelectItem>
                                            <SelectItem value="etec" className="font-bold text-sm">Foco ETEC / FATEC</SelectItem>
                                            <SelectItem value="enem" className="font-bold text-sm">Foco ENEM</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase opacity-40 ml-2">Ano Referência</Label>
                                    <Input type="number" className="h-10 rounded-xl bg-muted/30 border-none font-black text-center text-sm"
                                        value={manualQuestion.year} onChange={e => setManualQuestion(p => ({ ...p, year: parseInt(e.target.value, 10) }))} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Explicação Pedagógica (Opcional)</Label>
                                <Textarea placeholder="Justifique a resposta correta..." className="rounded-2xl bg-muted/30 border-none min-h-[60px] p-4 font-medium italic text-sm"
                                    value={manualQuestion.explanation}
                                    onChange={e => setManualQuestion(p => ({ ...p, explanation: e.target.value }))} />
                            </div>
                            <Button onClick={handleSaveSingle} disabled={isSaving || !manualQuestion.question_text}
                                className="w-full h-12 bg-primary text-white font-black text-base rounded-2xl shadow-xl transition-all active:scale-95 mt-2">
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                                Salvar no Repositório
                            </Button>
                        </div>
                    )}

                    {/* ---- CURATION AREA ---- */}
                    {extractedQuestions.length > 0 && (
                        <div className="mt-12 pt-12 border-t border-dashed space-y-6 animate-in slide-in-from-bottom-8">

                            {/* Curation controls (STICKY) */}
                            <div className="sticky top-4 z-40 bg-white/90 backdrop-blur-xl p-6 rounded-3xl border border-muted/20 shadow-xl space-y-4 mb-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-black text-primary italic flex items-center gap-2">
                                            Área de Curadoria ({extractedQuestions.length})
                                            {lastSaved && <span className="text-[10px] font-bold text-muted-foreground flex items-center bg-slate-100 px-2 py-1 rounded-lg not-italic"><Clock className="h-3 w-3 mr-1" /> Rascunho salvo às {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                                        </h3>
                                        <p className="text-xs text-muted-foreground font-medium">Matérias detectadas pela IA. Ajuste se necessário.</p>
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
                                        }} className="h-10 rounded-xl font-bold text-xs bg-white shadow-sm border-slate-200 hover:border-primary">
                                            <Download className="h-4 w-4 mr-2" /> Exportar JSON
                                        </Button>
                                        <Select value={bulkTargetAudience} onValueChange={setBulkTargetAudience}>
                                            <SelectTrigger className="w-full md:w-40 h-10 rounded-xl bg-white border-none shadow-md font-bold text-xs"><SelectValue placeholder="Público Alvo" /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                                <SelectItem value="all" className="font-bold text-xs">Todos</SelectItem>
                                                <SelectItem value="etec" className="font-bold text-xs">ETEC/FATEC</SelectItem>
                                                <SelectItem value="enem" className="font-bold text-xs">ENEM</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="text-xs text-muted-foreground font-medium">Fallback matéria:</div>
                                        <Select value={bulkSubjectId} onValueChange={setBulkSubjectId}>
                                            <SelectTrigger className="w-full md:w-44 h-10 rounded-xl bg-white border-none shadow-md font-bold text-xs"><SelectValue placeholder="Matéria padrão" /></SelectTrigger>
                                            <SelectContent className="rounded-xl border-none shadow-2xl">
                                                {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-xs">{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-dashed">
                                    <Switch id="create-exam" checked={createExam} onCheckedChange={setCreateExam} />
                                    <Label htmlFor="create-exam" className="font-black text-sm text-primary cursor-pointer flex items-center gap-2">
                                        <Scroll className="h-4 w-4 text-accent" /> Criar também como Prova Completa
                                    </Label>
                                </div>

                                {createExam && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-300">
                                        <div className="md:col-span-1 space-y-1">
                                            <Label className="text-[9px] font-black uppercase opacity-40 ml-1">Título da Prova</Label>
                                            <Input placeholder="Ex: ENEM 2023 — 1ª Aplicação" className="h-10 rounded-xl bg-white border-none shadow-md font-bold text-xs"
                                                value={examTitle} onChange={e => setExamTitle(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase opacity-40 ml-1">Tipo</Label>
                                            <Select value={examType} onValueChange={setExamType}>
                                                <SelectTrigger className="h-10 rounded-xl bg-white border-none shadow-md font-bold text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                                    {EXAM_TYPES.map(t => (
                                                        <SelectItem key={t} value={t} className="font-bold text-xs">{t.toUpperCase()}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-black uppercase opacity-40 ml-1">Ano</Label>
                                            <Input type="number" className="h-10 rounded-xl bg-white border-none shadow-md font-black text-center text-xs"
                                                value={examYear} onChange={e => setExamYear(parseInt(e.target.value, 10))} />
                                        </div>
                                    </div>
                                )}

                                <Button onClick={handlePreSave} disabled={isSaving || !bulkSubjectId || (createExam && !examTitle.trim())}
                                    className="w-full h-12 rounded-xl bg-primary text-white font-black shadow-lg relative overflow-hidden">
                                    {saveProgress && (
                                        <div 
                                            className="absolute top-0 left-0 h-full bg-accent transition-all duration-300 z-0" 
                                            style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%`, opacity: 0.2 }}
                                        />
                                    )}
                                    <div className="relative z-10 flex items-center justify-center">
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2 text-accent" />}
                                        {saveProgress ? `Salvando... (${saveProgress.current}/${saveProgress.total})` : isSaving ? 'Verificando...' : `Validar e Salvar Tudo (${extractedQuestions.length} questões)`}
                                    </div>
                                </Button>
                            </div>

                            {/* Gabarito em lote — provas como a da FUVEST publicam o gabarito
                                num PDF separado, então as questões saem da extração sem resposta. */}
                            <Card className="border-none shadow-lg bg-white p-5 rounded-[2rem]">
                                <button
                                    type="button"
                                    onClick={() => setShowAnswerKeyPanel(v => !v)}
                                    className="w-full flex items-center justify-between gap-3 text-left"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                                            Aplicar gabarito em lote
                                        </span>
                                        {filterCounts.needs_gabarito > 0 && (
                                            <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                                                {filterCounts.needs_gabarito} sem resposta
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRightIcon className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${showAnswerKeyPanel ? 'rotate-90' : ''}`} />
                                </button>

                                {showAnswerKeyPanel && (
                                    <div className="mt-4 space-y-3">
                                        <p className="text-[10px] font-semibold text-muted-foreground leading-relaxed">
                                            Cole o gabarito oficial. Entende <b>1-A 2-B 3-C</b>, <b>1. A</b>, <b>01) A</b> ou só as letras
                                            (<b>A B C D</b>). Com numeração, casa pelo número impresso da questão — questão faltando não desalinha.
                                        </p>
                                        <Textarea
                                            value={answerKeyText}
                                            onChange={e => setAnswerKeyText(e.target.value)}
                                            placeholder={"1-A 2-B 3-C 4-D 5-E ..."}
                                            className="min-h-[110px] rounded-2xl bg-slate-50 border-none font-mono text-xs"
                                        />
                                        {answerKeyPreview && (
                                            <div className={`rounded-2xl p-3 text-[10px] font-bold ${answerKeyPreview.applied > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
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
                                            className="h-11 rounded-2xl font-black text-xs uppercase tracking-widest"
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
                                    { key: 'all' as const, label: 'Todas', count: filterCounts.all, color: 'bg-slate-700' },
                                    { key: 'needs_image' as const, label: 'Precisam de Imagem', count: filterCounts.needs_image, color: 'bg-amber-500' },
                                    { key: 'no_subject' as const, label: 'Sem Matéria', count: filterCounts.no_subject, color: 'bg-red-500' },
                                    { key: 'dubious_answer' as const, label: 'Gabarito Duvidoso', count: filterCounts.dubious_answer, color: 'bg-purple-500' },
                                    { key: 'needs_gabarito' as const, label: 'Gabarito Pendente', count: filterCounts.needs_gabarito, color: 'bg-rose-600' },
                                ] as const).map(f => (
                                    <button key={f.key} onClick={() => setFilterMode(f.key)}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filterMode === f.key ? `${f.color} text-white border-transparent shadow-md` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                        {f.label}
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${filterMode === f.key ? 'bg-white/20' : 'bg-slate-100'}`}>{f.count}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Questions grid (paginated) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {paginatedQuestions.map((q: ParsedQuestion & { _confirmed_answer?: boolean }, i: number) => (
                                    <Card key={q._tempId}
                                        className={`border-none shadow-lg bg-white p-6 rounded-[2rem] relative group transition-all duration-300 ${dragOverId === q._tempId ? 'ring-4 ring-primary bg-primary/5 scale-[1.02] z-10' : 'hover:shadow-xl'}`}
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
                                            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center rounded-[2rem] animate-in fade-in">
                                                <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                                                <span className="text-xs font-black text-primary uppercase tracking-widest">Anexando Imagem...</span>
                                            </div>
                                        )}
                                        <button onClick={() => {
                                            const url = q.image_url;
                                            setExtractedQuestions(prev => prev.filter(item => item._tempId !== q._tempId));
                                            if (url) deleteImageFromStorage(url);
                                        }} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-50 shadow-sm">
                                            <Trash2 className="h-4 w-4" />
                                        </button>

                                        <div className="flex items-center gap-2 mb-4 flex-wrap pl-8">
                                            <Badge className="bg-primary/5 text-primary border-none font-black text-[8px] uppercase px-3">
                                                Q {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                                            </Badge>
                                            {q.options.length < 2 && (
                                                <Badge className="bg-red-50 text-red-600 border-red-200 font-black text-[8px] uppercase px-3">⚠️ Opções Incompletas</Badge>
                                            )}
                                            {!q.correct_answer && (
                                                <Badge className="bg-rose-100 text-rose-700 border-rose-200 font-black text-[8px] uppercase px-3 animate-pulse">Gabarito Pendente</Badge>
                                            )}
                                            <Badge className="bg-accent/10 text-accent border-none font-black text-[8px] uppercase px-3">{q.year}</Badge>
                                            {q.subject_name && (
                                                <Badge className="bg-green-50 text-green-600 border-none font-black text-[8px] uppercase px-3">IA: {q.subject_name}</Badge>
                                            )}
                                            <Button variant="ghost" size="sm"
                                                className="h-6 text-[8px] font-black uppercase text-slate-400 hover:text-accent"
                                                onClick={() => {
                                                    const cur = q.question_text;
                                                    const upd = cur.includes('[IMAGEM_PENDENTE]') ? cur.replace('[IMAGEM_PENDENTE]', '') : cur + ' [IMAGEM_PENDENTE]';
                                                    setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, question_text: upd } : item));
                                                }}>
                                                <ImageIcon className="h-3 w-3 mr-1" /> Marcar Imagem
                                            </Button>
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            {q.supporting_text !== undefined && (
                                                <div className="space-y-1">
                                                    <Label className="text-[9px] font-black uppercase opacity-40 ml-1">Texto de Apoio</Label>
                                                    <Textarea value={q.supporting_text}
                                                        onChange={e => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, supporting_text: e.target.value } : item))}
                                                        className="text-[11px] bg-amber-50/50 border-amber-100 rounded-xl min-h-[60px] font-medium leading-relaxed italic" />
                                                </div>
                                            )}

                                            <div className="space-y-1 relative">
                                                <Label className="text-[9px] font-black uppercase opacity-40 ml-1 flex items-center justify-between">
                                                    Enunciado
                                                </Label>
                                                <div className={`relative rounded-xl border-2 transition-all overflow-hidden ${dragOverId === q._tempId
                                                        ? 'border-primary bg-primary/5 ring-4 ring-primary/10'
                                                        : (q.question_text.includes('[IMAGEM_PENDENTE]') || q.supporting_text?.includes('[IMAGEM_PENDENTE]')) && !q.image_url
                                                            ? 'border-amber-300 border-dashed bg-amber-50'
                                                            : 'border-transparent bg-slate-50/50'
                                                    }`}>
                                                    <Textarea value={q.question_text}
                                                        onChange={e => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, question_text: e.target.value } : item))}
                                                        className="text-xs font-bold text-primary italic leading-relaxed min-h-[80px] bg-transparent border-none rounded-none resize-y relative z-10" />

                                                    {/* Overlay Drop Target Indicator for Textarea */}
                                                    {(q.question_text.includes('[IMAGEM_PENDENTE]') || q.supporting_text?.includes('[IMAGEM_PENDENTE]')) && !q.image_url && (
                                                        <div className="absolute bottom-2 right-2 z-20">
                                                            <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-sm ${dragOverId === q._tempId ? 'bg-primary text-white shadow-md scale-105' : 'bg-amber-400 text-white hover:bg-amber-500 hover:shadow-md'}`}>
                                                                <Upload className="h-3 w-3" />
                                                                <span className="text-[10px] font-black uppercase tracking-widest">{dragOverId === q._tempId ? 'Solte a Imagem' : 'Anexar Imagem'}</span>
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
                                                    <div className="mt-3 relative aspect-video rounded-xl overflow-hidden border-2 border-green-200 bg-white group/img shadow-sm">
                                                        <div className="absolute top-2 left-2 z-10 bg-green-500 text-white px-2 py-1 rounded-md text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                                                            <CheckCircle2 className="h-3 w-3" /> Imagem Anexada
                                                        </div>
                                                        <Image src={q.image_url} alt="Questão" fill className="object-contain" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center z-20">
                                                            <Button variant="destructive" size="sm" onClick={async () => {
                                                                const url = q.image_url;
                                                                setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, image_url: undefined } : item));
                                                                if (url) await deleteImageFromStorage(url);
                                                            }} className="font-black text-xs h-8"><Trash2 className="h-4 w-4 mr-2" /> Remover Imagem</Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <Label className="text-[9px] font-black uppercase opacity-40 ml-1 mb-1 block">Disciplina</Label>
                                                <Select value={q.subject_id || ''}
                                                    onValueChange={val => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, subject_id: val, micro_topic_id: undefined } : item))}>
                                                    <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none font-bold text-xs w-full">
                                                        <SelectValue placeholder="Selecionar matéria..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                                        {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-bold text-xs">{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {/* Sem micro-tópico a questão não aparece no "Treino Específico". */}
                                            <div>
                                                <Label className="text-[9px] font-black uppercase opacity-40 ml-1 mb-1 block">Micro-tópico</Label>
                                                <Select value={q.micro_topic_id || ''}
                                                    disabled={!q.subject_id}
                                                    onValueChange={val => setExtractedQuestions(prev => prev.map(item => item._tempId === q._tempId ? { ...item, micro_topic_id: val } : item))}>
                                                    <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none font-bold text-xs w-full">
                                                        <SelectValue placeholder={q.subject_id ? 'Opcional...' : 'Escolha a matéria'} />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-none shadow-2xl">
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
                                                        className={`flex items-center gap-3 p-3 rounded-xl border text-[10px] font-medium cursor-pointer transition-colors ${q.correct_answer === opt.key ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-transparent text-muted-foreground hover:bg-slate-100 hover:border-slate-200'} ${isDubious && q.correct_answer === opt.key ? 'animate-pulse border-orange-400 bg-orange-50 text-orange-700' : ''}`}>
                                                        <span className="font-black italic">{opt.key})</span>
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
                                <div className="flex items-center justify-center gap-2 pt-4">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                        className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-primary hover:text-white hover:border-transparent transition-all shadow-sm">
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
                                                <span key={`e-${idx}`} className="text-slate-400 font-black text-xs px-1">···</span>
                                            ) : (
                                                <button key={p} onClick={() => setCurrentPage(p as number)}
                                                    className={`h-9 w-9 rounded-xl text-xs font-black transition-all shadow-sm ${currentPage === p ? 'bg-primary text-white border-transparent shadow-md' : 'bg-white border border-slate-200 hover:border-primary hover:text-primary'}`}>
                                                    {p}
                                                </button>
                                            )
                                        )}

                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                        className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center disabled:opacity-30 hover:bg-primary hover:text-white hover:border-transparent transition-all shadow-sm">
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </button>

                                    <span className="text-[10px] text-muted-foreground font-bold ml-2">
                                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredQuestions.length)} de {filteredQuestions.length}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedQuestions.length > 0 && (
                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4 animate-in slide-in-from-bottom-10">
                            <span className="text-sm font-bold">{selectedQuestions.length} selecionadas</span>
                            <div className="h-6 w-px bg-slate-700 mx-2" />
                            <Select onValueChange={(val) => {
                                setExtractedQuestions(prev => prev.map(q => selectedQuestions.includes(q._tempId!) ? { ...q, subject_id: val, micro_topic_id: undefined } : q));
                                toast({ title: 'Matéria atribuída em lote!' });
                            }}>
                                <SelectTrigger className="h-8 bg-slate-800 border-none text-xs font-bold text-white w-40"><SelectValue placeholder="Atribuir Matéria" /></SelectTrigger>
                                <SelectContent className="border-none shadow-xl rounded-xl">
                                    {subjects.map(s => <SelectItem key={s.id} value={s.id} className="text-xs font-bold">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {/* Só oferece micro-tópicos válidos para a matéria comum às selecionadas. */}
                            {bulkSelectionMicroTopics.length > 0 && (
                                <Select onValueChange={(val) => {
                                    setExtractedQuestions(prev => prev.map(q => selectedQuestions.includes(q._tempId!) ? { ...q, micro_topic_id: val } : q));
                                    toast({ title: 'Micro-tópico atribuído em lote!' });
                                }}>
                                    <SelectTrigger className="h-8 bg-slate-800 border-none text-xs font-bold text-white w-44"><SelectValue placeholder="Micro-tópico" /></SelectTrigger>
                                    <SelectContent className="border-none shadow-xl rounded-xl">
                                        {bulkSelectionMicroTopics.map(mt => <SelectItem key={mt.id} value={mt.id} className="text-xs font-bold">{mt.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )}

                            <Select onValueChange={(val) => {
                                setExtractedQuestions(prev => prev.map(q => selectedQuestions.includes(q._tempId!) ? { ...q, target_audience: val } : q));
                                toast({ title: 'Público-alvo alterado em lote!' });
                            }}>
                                <SelectTrigger className="h-8 bg-slate-800 border-none text-xs font-bold text-white w-32"><SelectValue placeholder="Público-Alvo" /></SelectTrigger>
                                <SelectContent className="border-none shadow-xl rounded-xl">
                                    <SelectItem value="all" className="text-xs font-bold">Todos</SelectItem>
                                    <SelectItem value="etec" className="text-xs font-bold">ETEC</SelectItem>
                                    <SelectItem value="enem" className="text-xs font-bold">ENEM</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="ghost" size="sm" onClick={() => {
                                setExtractedQuestions(prev => prev.filter(q => !selectedQuestions.includes(q._tempId!)));
                                setSelectedQuestions([]);
                                toast({ title: 'Questões excluídas em lote!' });
                            }} className="text-red-400 hover:text-red-300 hover:bg-red-400/20 h-8 px-4 rounded-xl text-xs font-black">
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir Lote
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedQuestions([])} className="h-8 w-8 rounded-full hover:bg-slate-800 text-slate-400">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
                        <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black italic text-primary">Resumo da Importação</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-3 py-4">
                                <div className="flex items-center justify-between p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100">
                                    <span className="font-bold text-sm">Questões Prontas ✓</span>
                                    <span className="font-black text-xl">{extractedQuestions.length - filterCounts.no_subject - filterCounts.needs_image - filterCounts.needs_gabarito}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                                    <span className="font-bold text-sm">Sem Matéria ⚠</span>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-xl">{filterCounts.no_subject}</span>
                                        {filterCounts.no_subject > 0 && (
                                            <Button size="sm" variant="outline" className="h-8 rounded-xl text-[10px] uppercase font-black border-red-200 hover:bg-red-100 text-red-700" onClick={() => { setShowSaveModal(false); setFilterMode('no_subject'); }}>Filtrar</Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                                    <span className="font-bold text-sm">Precisam de Imagem ⚠</span>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-xl">{filterCounts.needs_image}</span>
                                        {filterCounts.needs_image > 0 && (
                                            <Button size="sm" variant="outline" className="h-8 rounded-xl text-[10px] uppercase font-black border-amber-200 hover:bg-amber-100 text-amber-700" onClick={() => { setShowSaveModal(false); setFilterMode('needs_image'); }}>Filtrar</Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100">
                                    <span className="font-bold text-sm">Gabarito Pendente ⚠</span>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-xl">{filterCounts.needs_gabarito}</span>
                                        {filterCounts.needs_gabarito > 0 && (
                                            <Button size="sm" variant="outline" className="h-8 rounded-xl text-[10px] uppercase font-black border-rose-200 hover:bg-rose-100 text-rose-700" onClick={() => { setShowSaveModal(false); setFilterMode('needs_gabarito'); }}>Filtrar</Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="flex-col sm:flex-row gap-3">
                                <Button variant="ghost" onClick={() => setShowSaveModal(false)} className="rounded-xl font-bold h-12">Revisar Mais</Button>
                                <Button onClick={() => { setShowSaveModal(false); handleDuplicateCheck(); }} className="rounded-xl font-black bg-primary text-white shadow-lg h-12 px-8">Verificar e Salvar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!duplicateWarning} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
                        <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black italic text-red-600 flex items-center gap-3">
                                    <AlertTriangle className="h-6 w-6" /> Atenção: Duplicatas
                                </DialogTitle>
                            </DialogHeader>
                            <div className="p-5 bg-red-50 text-red-800 rounded-2xl font-medium text-sm leading-relaxed border border-red-100 mt-2">
                                Identificamos que <strong className="font-black text-base">{duplicateWarning?.existing} questões</strong> já existem no banco de dados com enunciados idênticos.
                            </div>
                            <DialogFooter className="flex-col sm:flex-row gap-3 mt-6">
                                <Button variant="ghost" onClick={() => setDuplicateWarning(null)} className="rounded-xl font-bold h-12">Cancelar</Button>
                                <Button onClick={() => {
                                    const uniqueItems = duplicateWarning!.newItems.filter(q => !duplicateWarning!.existingTexts.includes(q.question_text.trim()));
                                    setDuplicateWarning(null);
                                    handleSaveProcessed(uniqueItems);
                                }} className="rounded-xl font-black bg-red-600 text-white hover:bg-red-700 h-12 shadow-lg">Ignorar Duplicadas e Salvar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>

            <section className="pt-8">
                <div className="flex items-center justify-between px-2 mb-6">
                    <h2 className="text-2xl font-black text-primary italic flex items-center gap-3">
                        <ArrowRight className="h-6 w-6 text-accent" /> Histórico do Repositório
                    </h2>
                </div>
                <QuestionsList />
            </section>
        </div>
    );
}
