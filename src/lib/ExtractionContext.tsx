'use client';

import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/app/lib/supabase';

export type Subject = { id: string; name: string };
export type QuestionOption = { key: string; text: string };
export type ParsedQuestion = {
    _tempId?: string;
    question_text: string;
    options: QuestionOption[];
    correct_answer: string | null;
    year: number;
    explanation?: string;
    subject_name?: string;
    subject_id?: string;
    micro_topic_id?: string;
    supporting_text?: string;
    image_url?: string;
    /** Número impresso da questão no documento original (ex.: "QUESTÃO 15" → 15). */
    question_number?: number | null;
    _uploadingImage?: boolean;
    _autoFileToUpload?: File;
};
export type ExtractionProgress = {
    currentChunk: number;
    totalChunks: number;
    phase: 'idle' | 'analyzing' | 'done' | 'error';
    questionsFound: number;
    elapsedSeconds: number;
};
export type ImgItem = {
    id: string;
    file: File;
    url: string;
    /** Página do PDF de origem, quando a imagem veio da extração automática. */
    page?: number;
    /** Número da questão detectada acima da imagem no PDF (pareamento determinístico). */
    questionNumber?: number | null;
};
export type UploadRecord = {
    id: string;
    timestamp: string;
    filename: string;
    questionCount: number;
    status: 'completed' | 'partial' | 'error';
};

type ExtractionContextType = {
    isAnalyzing: boolean;
    progress: ExtractionProgress;
    extractedQuestions: ParsedQuestion[];
    rawText: string;
    pdfUrl: string | null;
    pdfFile: File | null;
    autoImageQueue: ImgItem[];
    uploadHistory: UploadRecord[];
    setExtractedQuestions: React.Dispatch<React.SetStateAction<ParsedQuestion[]>>;
    setRawText: React.Dispatch<React.SetStateAction<string>>;
    setPdfUrl: React.Dispatch<React.SetStateAction<string | null>>;
    setPdfFile: React.Dispatch<React.SetStateAction<File | null>>;
    setAutoImageQueue: React.Dispatch<React.SetStateAction<ImgItem[]>>;
    clearExtraction: () => void;
    startExtraction: (params: {
        text: string;
        imageQueue: ImgItem[];
        subjects: Subject[];
        bulkSubjectId: string;
        filename?: string;
    }) => void;
    handleImageUpload: (tempId: string, file: File) => Promise<void>;
};

const ExtractionContext = createContext<ExtractionContextType | null>(null);

export function useExtraction() {
    const ctx = useContext(ExtractionContext);
    if (!ctx) throw new Error('useExtraction must be used within ExtractionProvider');
    return ctx;
}

// ---- subject resolution (runs in context, not page) ----
const ALIAS: Record<string, string> = {
    'linguagens': 'Português', 'linguagens e codigos': 'Português',
    'linguagens codigos e suas tecnologias': 'Português', 'lingua portuguesa': 'Português',
    'portugues': 'Português', 'literatura': 'Português', 'redacao': 'Português',
    'matematica e suas tecnologias': 'Matemática', 'matematica': 'Matemática',
    'ciencias da natureza e suas tecnologias': 'Física', 'ciencias da natureza': 'Física',
    'fisica': 'Física', 'quimica': 'Química', 'biologia': 'Biologia',
    'ciencias biologicas': 'Biologia', 'ciencias': 'Biologia',
    'ciencias humanas e suas tecnologias': 'História', 'ciencias humanas': 'História',
    'humanidades': 'História', 'historia': 'História', 'geografia': 'Geografia',
    'filosofia': 'Filosofia', 'sociologia': 'Sociologia',
    'ingles': 'Inglês', 'lingua inglesa': 'Inglês', 'english': 'Inglês',
    'espanhol': 'Espanhol', 'lingua espanhola': 'Espanhol',
    'artes': 'Artes', 'arte': 'Artes', 'educacao fisica': 'Educação Física',
    'ed fisica': 'Educação Física', 'informatica': 'Informática',
    'computacao': 'Informática', 'tecnologia da informacao': 'Informática',
};

function resolveSubjectId(name: string | undefined, list: Subject[]): string | undefined {
    if (!name || list.length === 0) return undefined;
    const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const nm = n(name);
    const exact = list.find(s => n(s.name) === nm);
    if (exact) return exact.id;
    const canonical = ALIAS[nm];
    if (canonical) {
        const hit = list.find(s => n(s.name) === n(canonical));
        if (hit) return hit.id;
        const partial = list.find(s => n(s.name).includes(n(canonical)) || n(canonical).includes(n(s.name)));
        if (partial) return partial.id;
    }
    const partial = list.find(s => n(s.name).includes(nm) || nm.includes(n(s.name)));
    return partial?.id;
}

// -------------------------------------------------------

export function ExtractionProvider({ children }: { children: ReactNode }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState<ExtractionProgress>({
        currentChunk: 0, totalChunks: 0, phase: 'idle', questionsFound: 0, elapsedSeconds: 0,
    });
    const [extractedQuestions, setExtractedQuestions] = useState<ParsedQuestion[]>([]);
    const [rawText, setRawTextState] = useState('');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [autoImageQueue, setAutoImageQueue] = useState<ImgItem[]>([]);
    const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);

    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isAnalyzingRef = useRef(false);
    const uploadedTempIds = useRef(new Set<string>());
    const extractedRef = useRef<ParsedQuestion[]>([]);
    useEffect(() => { extractedRef.current = extractedQuestions; }, [extractedQuestions]);

    // Load from localStorage on mount
    useEffect(() => {
        const raw = localStorage.getItem('draft_raw_text');
        const extracted = localStorage.getItem('draft_extracted_questions');
        const history = localStorage.getItem('upload_history');
        if (raw) setRawTextState(raw);
        if (extracted) { try { setExtractedQuestions(JSON.parse(extracted)); } catch {} }
        if (history) { try { setUploadHistory(JSON.parse(history)); } catch {} }
    }, []);

    // Persist rawText
    useEffect(() => {
        if (rawText) localStorage.setItem('draft_raw_text', rawText);
        else localStorage.removeItem('draft_raw_text');
    }, [rawText]);

    // Persist extractedQuestions (strip non-serializable File objects)
    useEffect(() => {
        if (extractedQuestions.length > 0) {
            const safe = extractedQuestions.map(({ _autoFileToUpload, ...q }) => q);
            localStorage.setItem('draft_extracted_questions', JSON.stringify(safe));
        } else {
            localStorage.removeItem('draft_extracted_questions');
        }
    }, [extractedQuestions]);

    const setRawText = setRawTextState;

    const deleteImageFromStorage = useCallback(async (url: string) => {
        try {
            const m = url.match(/question-images\/(.+)$/);
            if (m?.[1]) await supabase.storage.from('question-images').remove([m[1]]);
        } catch {}
    }, []);

    const handleImageUpload = useCallback(async (tempId: string, file: File) => {
        if (!file.type.startsWith('image/')) {
            toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem (PNG, JPG, WEBP).', variant: 'destructive' });
            return;
        }
        setExtractedQuestions(prev => prev.map(q => q._tempId === tempId ? { ...q, _uploadingImage: true } : q));
        try {
            const cur = extractedRef.current.find(q => q._tempId === tempId);
            if (cur?.image_url) await deleteImageFromStorage(cur.image_url);
            const ext = file.name.split('.').pop();
            const path = `questions/${Date.now()}_${tempId}.${ext}`;
            const { error: upErr } = await supabase.storage.from('question-images').upload(path, file, { upsert: true });
            if (upErr) throw upErr;
            const { data: urlData } = supabase.storage.from('question-images').getPublicUrl(path);
            setExtractedQuestions(prev => prev.map(q =>
                q._tempId === tempId ? { ...q, image_url: urlData.publicUrl, _uploadingImage: false } : q
            ));
            toast({ title: 'Imagem vinculada!', description: 'A imagem foi associada à questão.' });
        } catch (e: any) {
            toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
            setExtractedQuestions(prev => prev.map(q => q._tempId === tempId ? { ...q, _uploadingImage: false } : q));
        }
    }, [deleteImageFromStorage]);

    // Auto-trigger uploads for questions marked with _autoFileToUpload
    useEffect(() => {
        extractedQuestions.forEach(q => {
            if (q._autoFileToUpload && q._tempId && !uploadedTempIds.current.has(q._tempId)) {
                uploadedTempIds.current.add(q._tempId);
                setTimeout(() => handleImageUpload(q._tempId!, q._autoFileToUpload!), 500);
            }
        });
    }, [extractedQuestions, handleImageUpload]);

    const clearExtraction = useCallback(() => {
        extractedRef.current.forEach(q => { if (q.image_url) deleteImageFromStorage(q.image_url); });
        setExtractedQuestions([]);
        setRawTextState('');
        setPdfUrl(null);
        setPdfFile(null);
        setAutoImageQueue([]);
        uploadedTempIds.current.clear();
        localStorage.removeItem('draft_raw_text');
        localStorage.removeItem('draft_extracted_questions');
    }, [deleteImageFromStorage]);

    const startExtraction = useCallback(async ({
        text, imageQueue, subjects, bulkSubjectId, filename = 'Prova',
    }: {
        text: string; imageQueue: ImgItem[]; subjects: Subject[];
        bulkSubjectId: string; filename?: string;
    }) => {
        if (!text.trim() || isAnalyzingRef.current) return;
        isAnalyzingRef.current = true;
        setIsAnalyzing(true);
        setExtractedQuestions([]);
        uploadedTempIds.current.clear();

        let elapsed = 0;
        elapsedRef.current = setInterval(() => {
            elapsed++;
            setProgress(p => ({ ...p, elapsedSeconds: elapsed }));
        }, 1000);

        const CHUNK_SIZE = 5500;
        const OVERLAP = 1200;

        const findBoundary = (src: string, end: number): number => {
            const win = src.substring(Math.max(0, end - 600), end);
            const re = /\n\s*(?:questão\s+\d+|\d{1,3}[\.\)])/gi;
            let last = -1, m: RegExpExecArray | null;
            while ((m = re.exec(win)) !== null) last = m.index;
            if (last === -1) return end;
            return Math.max(0, end - 600) + last;
        };

        const chunks: string[] = [];
        let pos = 0;
        while (pos < text.length) {
            const rawEnd = Math.min(pos + CHUNK_SIZE, text.length);
            const end = rawEnd < text.length ? findBoundary(text, rawEnd) : rawEnd;
            const safeEnd = end > pos ? end : rawEnd;
            chunks.push(text.substring(pos, safeEnd));
            if (safeEnd >= text.length) break;
            pos = Math.max(pos + 1, safeEnd - OVERLAP);
        }

        setProgress({ currentChunk: 0, totalChunks: chunks.length, phase: 'analyzing', questionsFound: 0, elapsedSeconds: 0 });

        const propagateSupportingText = (qs: any[]): any[] => {
            let carrier = '';
            return qs.map(q => {
                const st: string | undefined = q.supporting_text;
                if (typeof st === 'string' && st.trim().length > 5) {
                    carrier = st.trim();
                    return q;
                }
                if (typeof st === 'string' && st.trim() === '' && carrier.length > 0) {
                    return { ...q, supporting_text: carrier };
                }
                carrier = '';
                return q;
            });
        };

        const seenTexts = new Set<string>();
        const usedImageIds = new Set<string>();
        let totalFound = 0;

        // Número impresso da questão: prioridade para o campo da IA, senão regex no enunciado.
        const parseQuestionNumber = (q: any): number | null => {
            const fromAi = Number(q.question_number);
            if (Number.isInteger(fromAi) && fromAi >= 1 && fromAi <= 200) return fromAi;
            const text: string = `${q.question_text || ''}`;
            const m = text.match(/quest[ãa]o\s*(\d{1,3})/i) || text.match(/^\s*(\d{1,3})\s*[.)-]\s/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n >= 1 && n <= 200) return n;
            }
            return null;
        };

        // Pareamento determinístico: imagem cujo questionNumber (posição no PDF) bate
        // com o número da questão. Fallback sequencial preserva o comportamento antigo,
        // preferindo imagens sem número para não "roubar" a imagem de outra questão.
        const takeImageByNumber = (n: number | null): ImgItem | undefined => {
            if (n === null) return undefined;
            // Se mais de uma imagem cair na mesma questão (ex.: alternativas em
            // fórmula viradas imagem + a figura real), prefere a MAIOR.
            return imageQueue
                .filter(img => img.questionNumber === n && !usedImageIds.has(img.id))
                .sort((a, b) => b.file.size - a.file.size)[0];
        };
        const takeImageSequential = (): ImgItem | undefined =>
            imageQueue.find(img => img.questionNumber == null && !usedImageIds.has(img.id))
            ?? imageQueue.find(img => !usedImageIds.has(img.id));

        const saveHistory = (status: UploadRecord['status'], count: number) => {
            const record: UploadRecord = {
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toISOString(),
                filename,
                questionCount: count,
                status,
            };
            setUploadHistory(prev => {
                const updated = [record, ...prev].slice(0, 10);
                localStorage.setItem('upload_history', JSON.stringify(updated));
                return updated;
            });
        };

        try {
            for (let i = 0; i < chunks.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 700));
                setProgress(p => ({ ...p, currentChunk: i + 1 }));

                let response: Response | null = null;
                for (let attempt = 0; attempt < 3; attempt++) {
                    response = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [{
                                role: 'user',
                                content: `Você é um extrator de alta precisão especializado em exames brasileiros (ENEM, ETEC, FUVEST).
Sua missão é extrair questões de múltipla escolha mantendo a INTEGRIDADE do contexto.

REGRAS DE OURO PARA CONTEXTO COMPARTILHADO:
1. IDENTIFIQUE GRUPOS: Fique atento a frases como "As questões X a Y referem-se ao texto...", "Considere a imagem para responder às questões...".
2. PERSISTÊNCIA: Se um "Texto de Apoio" ou "Imagem" for base para múltiplas questões, você DEVE replicar esse conteúdo INTEGRALMENTE no campo "supporting_text" de CADA UMA dessas questões. Nunca deixe uma questão sem o seu texto de base se ele existir no trecho. Para questões de um grupo onde você NÃO replicou o texto de base, use "" (string vazia) em "supporting_text" — NUNCA omita o campo.
3. MARCADORES DE IMAGEM: Sempre que houver menção a "Figura", "Imagem", "Fotografia", "Gráfico", "Charge", "Mapa", "Tabela Visual", "Quadro", "Esquema", "Tirinha" ou "Ilustração" que não possa ser transcrita em texto, insira [IMAGEM_PENDENTE] no campo "supporting_text" (ou no início de "question_text" se não houver supporting_text).
4. NÃO RESUMA: Mantenha o enunciado e o texto de apoio exatamente como estão no original.
5. GABARITO AUSENTE: Se o gabarito não estiver explícito neste trecho, defina "correct_answer" como null. NUNCA invente ou adivinhe a resposta correta.
6. NÚMERO ORIGINAL: Sempre que a questão tiver numeração impressa no documento (ex: "QUESTÃO 15", "15.", "Questão 15 (ENEM)"), preencha "question_number" com esse número inteiro. Se não houver numeração visível, use null. NUNCA renumere por conta própria.

ESTRUTURA JSON EXIGIDA:
{
  "questions": [
    {
      "question_text": "Enunciado completo.",
      "supporting_text": "Texto de base (se houver).",
      "options": [{"key": "A", "text": "..."}, {"key": "B", "text": "..."}, {"key": "C", "text": "..."}, {"key": "D", "text": "..."}, {"key": "E", "text": "..."}],
      "correct_answer": "LETRA_DA_CORRETA ou null se o gabarito NÃO estiver visível neste trecho",
      "question_number": 15,
      "year": 2024,
      "subject_name": "Matéria"
    }
  ]
}

TEXTO PARA ANÁLISE (Trecho ${i + 1}/${chunks.length}):\n${chunks[i]}`,
                            }],
                        }),
                    });
                    if (response.status !== 429 && response.status !== 504) break;
                    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                }

                if (!response?.ok) {
                    if (response?.status === 429) { toast({ description: `Limite atingido. Parte ${i + 1} ignorada.`, variant: 'destructive' }); continue; }
                    if (response?.status === 504) { toast({ description: `Timeout na parte ${i + 1}. Pulando.`, variant: 'destructive' }); continue; }
                    throw new Error(`Erro no servidor na parte ${i + 1}.`);
                }

                let data: any;
                try { data = JSON.parse(await response.text()); }
                catch { toast({ description: `Formato inválido na parte ${i + 1}. Pulando.`, variant: 'destructive' }); continue; }
                if (!data.success) { toast({ description: `Erro da Aurora na parte ${i + 1}.`, variant: 'destructive' }); continue; }

                const clean = (data.result?.response || '').trim()
                    .replace(/^```json\s*/m, '').replace(/```\s*$/m, '').trim();
                try {
                    const jsonMatch = clean.match(/\{[\s\S]*"questions"[\s\S]*\}/);
                    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
                    const rawQs = parsed.questions || (Array.isArray(parsed) ? parsed : []);
                    const chunkQs = propagateSupportingText(rawQs);

                    const unique: any[] = [];
                    chunkQs.forEach((q: any) => {
                        const norm = (q.question_text || '')
                            .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                            .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                        if (!seenTexts.has(norm) && norm.length > 10) { seenTexts.add(norm); unique.push(q); }
                    });

                    const IMAGE_TRIGGERS = ['[IMAGEM_PENDENTE]', 'FIGURA ', 'IMAGEM ', 'FOTOGRAFIA ',
                        'GRÁFICO ', 'GRAFICO ', 'CHARGE ', 'TIRINHA ', 'ESQUEMA ', 'QUADRO ',
                        'ILUSTRAÇÃO ', 'ILUSTRACAO '];

                    const mapped = unique.map((rawQ: any) => {
                        let q = rawQ;
                        const combinedText = (q.question_text + ' ' + (q.supporting_text || '')).toUpperCase();
                        const needsImage = IMAGE_TRIGGERS.some(t => combinedText.includes(t));
                        const questionNumber = parseQuestionNumber(q);

                        if (needsImage && !combinedText.includes('[IMAGEM_PENDENTE]')) {
                            if (q.supporting_text && q.supporting_text.trim().length > 0) {
                                q = { ...q, supporting_text: '[IMAGEM_PENDENTE]\n' + q.supporting_text };
                            } else {
                                q = { ...q, question_text: '[IMAGEM_PENDENTE] ' + q.question_text };
                            }
                        }

                        const base = {
                            ...q,
                            question_number: questionNumber,
                            _tempId: Math.random().toString(36).substring(2, 9),
                            subject_id: resolveSubjectId(q.subject_name, subjects) || bulkSubjectId,
                        };

                        // Match por número vale mesmo sem palavra-gatilho — a posição
                        // da imagem no PDF é evidência mais forte que o texto da IA.
                        const matched = takeImageByNumber(questionNumber)
                            ?? (needsImage ? takeImageSequential() : undefined);
                        if (matched) {
                            usedImageIds.add(matched.id);
                            return { ...base, _autoFileToUpload: matched.file, _uploadingImage: true };
                        }
                        return base;
                    });

                    setExtractedQuestions(prev => [...prev, ...mapped]);
                    totalFound += unique.length;
                    setProgress(p => ({ ...p, questionsFound: totalFound }));
                } catch {
                    if (clean.includes('"questions"'))
                        toast({ description: `Aviso: Parte ${i + 1} pode estar incompleta.`, variant: 'destructive' });
                }
            }

            setProgress(p => ({ ...p, phase: 'done' }));
            toast({ title: 'Extração concluída!', description: `${totalFound} questões encontradas.` });
            saveHistory(totalFound > 0 ? 'completed' : 'error', totalFound);

        } catch (e: any) {
            setProgress(p => ({ ...p, phase: 'error' }));
            toast({ title: 'Falha na Extração', description: e.message, variant: 'destructive' });
            saveHistory(totalFound > 0 ? 'partial' : 'error', totalFound);
        } finally {
            if (elapsedRef.current) clearInterval(elapsedRef.current);
            isAnalyzingRef.current = false;
            setIsAnalyzing(false);
        }
    }, [deleteImageFromStorage]);

    return (
        <ExtractionContext.Provider value={{
            isAnalyzing, progress, extractedQuestions, rawText, pdfUrl, pdfFile, autoImageQueue, uploadHistory,
            setExtractedQuestions, setRawText, setPdfUrl, setPdfFile, setAutoImageQueue,
            clearExtraction, startExtraction, handleImageUpload,
        }}>
            {children}
        </ExtractionContext.Provider>
    );
}
