"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MoreHorizontal, Pencil, Trash2, Loader2, Search, Filter, Upload, ImageIcon, X } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Subject = { id: string; name: string };
type QuestionOption = { key: string; text: string };
type FullQuestion = {
    id: string;
    question_text: string;
    year: number;
    options: any; 
    correct_answer: string;
    subject_id: string;
    supporting_text?: string | null;
    image_url?: string | null;
    subject: { name: string } | null;
};

const initialEditState = {
    question_text: '',
    year: new Date().getFullYear(),
    correct_answer: '',
    subject_id: '',
    supporting_text: '',
    image_url: '',
    options: { A: '', B: '', C: '', D: '', E: '' },
};

export function QuestionsList() {
    const [questions, setQuestions] = useState<FullQuestion[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    
    const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
    const [questionToEdit, setQuestionToEdit] = useState<FullQuestion | null>(null);
    const [editForm, setEditForm] = useState(initialEditState);

    const [searchTerm, setSearchTerm] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('all');

    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const questionsPromise = supabase.from('questions').select(`*, subject:subjects(name)`).order('created_at', { ascending: false });
                const subjectsPromise = supabase.from('subjects').select('id, name');
                
                const [{ data: questionsData, error: questionsError }, { data: subjectsData, error: subjectsError }] = await Promise.all([questionsPromise, subjectsPromise]);

                if (questionsError) throw questionsError;
                if (subjectsError) throw subjectsError;

                setQuestions(questionsData as FullQuestion[]);
                setSubjects(subjectsData as Subject[]);
            } catch (error: any) {
                console.error("Erro ao carregar repositório:", error);
                toast({ title: "Erro ao Carregar Dados", description: "Não foi possível buscar as questões do banco.", variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [toast]);

    useEffect(() => {
        if (questionToEdit) {
            let optionsObj = questionToEdit.options;
            if (typeof optionsObj === 'string') {
                try { optionsObj = JSON.parse(optionsObj); } catch(e) { optionsObj = []; }
            }
            
            const optionsMap = Array.isArray(optionsObj) 
                ? optionsObj.reduce((acc: any, opt: any) => {
                    acc[opt.key] = opt.text;
                    return acc;
                }, {})
                : {};

            setEditForm({
                question_text: questionToEdit.question_text,
                year: questionToEdit.year,
                correct_answer: questionToEdit.correct_answer,
                subject_id: questionToEdit.subject_id,
                supporting_text: questionToEdit.supporting_text || '',
                image_url: questionToEdit.image_url || '',
                options: { ...initialEditState.options, ...optionsMap },
            });
        } else {
            setEditForm(initialEditState);
        }
    }, [questionToEdit]);

    const handleDelete = async () => {
        if (!questionToDelete) return;
        setIsProcessing(true);
        const { error } = await supabase.from('questions').delete().match({ id: questionToDelete });
        if (error) {
            toast({ title: "Erro ao Excluir", description: error.message, variant: "destructive" });
        } else {
            setQuestions(prev => prev.filter(q => q.id !== questionToDelete));
            toast({ title: "Questão Excluída" });
            router.refresh();
        }
        setQuestionToDelete(null);
        setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
        setIsProcessing(false);
    };

    const deleteImageFromStorage = async (url: string) => {
        try {
            const marker = '/question-images/';
            const markerIndex = url.indexOf(marker);
            if (markerIndex === -1) return;
            const path = decodeURIComponent(url.slice(markerIndex + marker.length).split('?')[0]);
            if (path) await supabase.storage.from('question-images').remove([path]);
        } catch {
            // Best-effort cleanup; database state remains authoritative.
        }
    };

    const handleEditImageUpload = async (file: File) => {
        if (!questionToEdit) return;
        setIsUploadingImage(true);
        try {
            if (editForm.image_url) await deleteImageFromStorage(editForm.image_url);
            const ext = file.name.split('.').pop() || 'png';
            const path = `questions/${questionToEdit.id}-${Date.now()}.${ext}`;
            const { error } = await supabase.storage
                .from('question-images')
                .upload(path, file, { upsert: true, contentType: file.type });

            if (error) throw error;

            const { data } = supabase.storage.from('question-images').getPublicUrl(path);
            setEditForm(prev => ({ ...prev, image_url: data.publicUrl }));
            toast({ title: 'Imagem anexada', description: 'Ela será salva junto com a questão.' });
        } catch (error: any) {
            toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleRemoveEditImage = async () => {
        if (!editForm.image_url) return;
        const url = editForm.image_url;
        setEditForm(prev => ({ ...prev, image_url: '' }));
        await deleteImageFromStorage(url);
    };

    const handleUpdate = async () => {
        if (!questionToEdit) return;
        setIsProcessing(true);

        const updatedOptions: QuestionOption[] = Object.entries(editForm.options)
            .filter(([, text]) => text && text.trim() !== '')
            .map(([key, text]) => ({ key, text }));

        if (updatedOptions.length === 0) {
            toast({ title: "Questão Inválida", description: "A questão deve ter pelo menos uma alternativa.", variant: "destructive" });
            setIsProcessing(false);
            return;
        }

        const { data: updatedQuestion, error } = await supabase
            .from('questions')
            .update({
                question_text: editForm.question_text,
                year: editForm.year,
                correct_answer: editForm.correct_answer,
                subject_id: editForm.subject_id,
                supporting_text: editForm.supporting_text || null,
                image_url: editForm.image_url || null,
                options: updatedOptions,
            })
            .match({ id: questionToEdit.id })
            .select(`*, subject:subjects(name)`)
            .single();

        if (error) {
            toast({ title: "Erro ao Atualizar", description: error.message, variant: "destructive" });
        } else {
            setQuestions(prev => prev.map(q => q.id === questionToEdit.id ? updatedQuestion as FullQuestion : q));
            toast({ title: "Questão Atualizada!" });
            setQuestionToEdit(null);
            router.refresh();
        }
        setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
        setIsProcessing(false);
    };

    const handleFormChange = (field: string, value: string | number) => setEditForm(prev => ({ ...prev, [field]: value }));
    const handleOptionChange = (key: string, text: string) => setEditForm(prev => ({...prev, options: { ...prev.options, [key]: text }}));

    const filteredQuestions = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return questions.filter(q => {
            const matchesSubject = subjectFilter === 'all' || q.subject_id === subjectFilter;
            const matchesSearch = !searchTerm || 
                q.question_text.toLowerCase().includes(lowerSearch) ||
                (q.supporting_text?.toLowerCase() || '').includes(lowerSearch) ||
                (q.subject?.name?.toLowerCase() || '').includes(lowerSearch) ||
                q.year.toString().includes(lowerSearch) ||
                (Array.isArray(q.options) && q.options.some((opt: any) => opt.text.toLowerCase().includes(lowerSearch)));
            return matchesSubject && matchesSearch;
        });
    }, [questions, searchTerm, subjectFilter]);

    if (isLoading) return <ListSkeleton />;

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="p-8 border-b border-muted/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <CardTitle className="text-xl font-black text-primary italic">Repositório Maestro ({filteredQuestions.length})</CardTitle>
                        <div className="flex flex-wrap items-center gap-3">
                            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                                <SelectTrigger className="w-full md:w-[180px] rounded-xl bg-muted/30 border-none font-bold h-11">
                                    <Filter className="h-4 w-4 mr-2 opacity-40" />
                                    <SelectValue placeholder="Matéria" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                    <SelectItem value="all" className="font-bold">Todas as Matérias</SelectItem>
                                    {subjects.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40"/>
                                <Input 
                                    placeholder="Buscar enunciado..." 
                                    className="pl-11 rounded-xl bg-muted/30 border-none h-11 italic font-medium" 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-muted/5">
                        {filteredQuestions.map((question) => (
                            <div key={question.id} className="p-6 hover:bg-accent/5 transition-all group flex items-center justify-between gap-6">
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-primary text-sm leading-relaxed line-clamp-2 italic">"{question.question_text}"</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Badge variant="outline" className="bg-primary/5 border-none text-primary font-black text-[8px] uppercase px-2 h-5 tracking-widest">
                                            {question.subject?.name || 'Geral'}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-muted-foreground italic opacity-60">• Ano {question.year}</span>
                                        {question.image_url && (
                                            <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[8px] uppercase px-2 h-5 tracking-widest">
                                                <ImageIcon className="h-3 w-3 mr-1" />
                                                Imagem
                                            </Badge>
                                        )}
                                        {!question.image_url && (question.question_text.includes('[IMAGEM_PENDENTE]') || question.supporting_text?.includes('[IMAGEM_PENDENTE]')) && (
                                            <Badge className="bg-amber-50 text-amber-700 border-none font-black text-[8px] uppercase px-2 h-5 tracking-widest">
                                                Pendente
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-white hover:shadow-md transition-all shrink-0">
                                            <MoreHorizontal className="h-5 w-5 text-primary/40" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 w-48">
                                        <DropdownMenuItem onClick={() => setQuestionToEdit(question)} className="rounded-xl font-bold gap-3 py-3 cursor-pointer">
                                            <Pencil className="h-4 w-4 text-accent" />
                                            <span>Editar Questão</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-muted/5 mx-2" />
                                        <DropdownMenuItem className="text-red-500 focus:text-red-600 focus:bg-red-50 rounded-xl font-bold gap-3 py-3 cursor-pointer" onClick={() => setQuestionToDelete(question.id)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span>Remover</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ))}
                        {filteredQuestions.length === 0 && !isLoading && (
                            <div className="py-20 text-center opacity-30">
                                <p className='font-black italic text-sm'>Nenhuma questão encontrada para este filtro.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={!!questionToDelete} onOpenChange={(open) => {
                if (!open) {
                    setQuestionToDelete(null);
                    setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
                }
            }}>
                <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-10 max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black italic text-primary">Excluir Questão?</AlertDialogTitle>
                        <AlertDialogDescription className="font-medium text-sm">Esta ação é irreversível e removerá o item permanentemente do banco.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 mt-6">
                        <AlertDialogCancel disabled={isProcessing} className="rounded-xl font-bold border-none bg-muted/30 h-12">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="rounded-xl font-black bg-red-600 hover:bg-red-700 text-white h-12 px-8">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, Excluir"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={!!questionToEdit} onOpenChange={(open) => {
                if (!open) {
                    setQuestionToEdit(null);
                    setTimeout(() => { document.body.style.pointerEvents = ""; }, 500);
                }
            }}>
                <DialogContent className="max-w-3xl rounded-[2.5rem] p-6 md:p-10 bg-white border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic text-primary">Ajuste Pedagógico</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-6 overflow-y-auto max-h-[70vh] pr-4 scrollbar-thin">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase opacity-40 ml-2">Enunciado</Label>
                            <Textarea 
                                placeholder="Enunciado" 
                                value={editForm.question_text} 
                                onChange={e => handleFormChange('question_text', e.target.value)} 
                                className="min-h-[120px] rounded-2xl bg-muted/30 border-none font-medium italic p-4"
                            />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase opacity-40 ml-2">Texto de apoio</Label>
                                <Textarea
                                    placeholder="Texto, charge, gráfico ou contexto usado pela questão..."
                                    value={editForm.supporting_text}
                                    onChange={e => handleFormChange('supporting_text', e.target.value)}
                                    className="min-h-[160px] rounded-2xl bg-muted/30 border-none font-medium italic p-4"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase opacity-40 ml-2">Imagem da questão</Label>
                                {editForm.image_url ? (
                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/30 border border-emerald-100">
                                        <Image src={editForm.image_url} alt="Imagem da questão" fill className="object-contain" />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            onClick={handleRemoveEditImage}
                                            className="absolute top-3 right-3 h-8 w-8 rounded-full shadow-lg"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <label className="min-h-[160px] rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 text-amber-700 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-amber-50 transition-colors">
                                        {isUploadingImage ? (
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        ) : (
                                            <Upload className="h-6 w-6" />
                                        )}
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {isUploadingImage ? 'Enviando...' : 'Anexar imagem'}
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={isUploadingImage}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleEditImageUpload(file);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(editForm.options).map(([key, text]) => (
                                <div key={key} className="space-y-1">
                                    <Label className="text-[9px] font-black uppercase opacity-40 ml-4">Opção {key}</Label>
                                    <Input key={key} placeholder={`Alternativa ${key}`} value={text as string} onChange={e => handleOptionChange(key, e.target.value)} className="h-12 rounded-xl bg-muted/30 border-none font-medium" />
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase opacity-40 ml-4">Gabarito</Label>
                                <Select value={editForm.correct_answer} onValueChange={val => handleFormChange('correct_answer', val)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                        {Object.keys(editForm.options).map(key => <SelectItem key={key} value={key} className="py-2.5 font-bold">Alternativa {key}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase opacity-40 ml-4">Matéria</Label>
                                <Select value={editForm.subject_id} onValueChange={val => handleFormChange('subject_id', val)}>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                        {subjects.map(s => <SelectItem key={s.id} value={s.id} className="py-2.5 font-bold">{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase opacity-40 ml-4">Ano</Label>
                                <Input type="number" value={editForm.year} onChange={e => handleFormChange('year', parseInt(e.target.value, 10))} className="h-12 rounded-xl bg-muted/30 border-none font-black text-center" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-3">
                        <DialogClose asChild><Button type="button" variant="ghost" className="rounded-xl font-bold h-14">Descartar</Button></DialogClose>
                        <Button type="submit" onClick={handleUpdate} disabled={isProcessing} className="h-14 bg-primary text-white font-black rounded-xl px-10 shadow-xl">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Gravar Alterações"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ListSkeleton() {
    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white animate-pulse p-8">
            <div className="space-y-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className='flex justify-between items-center bg-muted/10 h-24 rounded-2xl px-6'>
                        <div className="w-2/3 space-y-2"><div className="h-4 bg-muted rounded-full w-full"></div><div className="h-3 bg-muted rounded-full w-1/2"></div></div>
                        <div className="h-10 w-10 bg-muted rounded-full"></div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
