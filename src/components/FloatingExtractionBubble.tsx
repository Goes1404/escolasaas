'use client';

import { useExtraction } from '@/lib/ExtractionContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, ArrowRight, BrainCircuit } from 'lucide-react';

export function FloatingExtractionBubble() {
    const { isAnalyzing, progress, extractedQuestions } = useExtraction();
    const pathname = usePathname();


    const isOnQuestionsPage = pathname === '/dashboard/teacher/questions';
    const hasPending = extractedQuestions.length > 0;

    if (isOnQuestionsPage || (!isAnalyzing && !hasPending)) return null;

    const pct = progress.totalChunks > 0
        ? Math.round((progress.currentChunk / progress.totalChunks) * 100)
        : 0;

    return (
        <div className="fixed bottom-24 right-6 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
            <Link href="/dashboard/teacher/questions">
                <div className="bg-primary text-white rounded-[1.5rem] shadow-2xl border border-white/10 p-4 min-w-[240px] cursor-pointer hover:scale-[1.03] transition-all active:scale-[0.98] backdrop-blur-sm">
                    {isAnalyzing ? (
                        <>
                            <div className="flex items-center gap-2 mb-2">
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                <span className="text-xs font-black uppercase tracking-widest leading-none">Aurora extraindo...</span>
                            </div>
                            {progress.totalChunks > 0 && (
                                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-2">
                                    <div
                                        className="h-full rounded-full bg-white transition-all duration-700"
                                        style={{ width: `${Math.max(4, pct)}%` }}
                                    />
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-white/60 font-bold">{progress.questionsFound} questões</span>
                                <span className="text-[10px] font-black text-accent-foreground/80">{pct}%</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-green-300 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-widest leading-none">
                                    {extractedQuestions.length} questões prontas
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-white/60 font-bold">
                                <span>Clique para revisar e salvar</span>
                                <ArrowRight className="h-3 w-3" />
                            </div>
                        </>
                    )}
                    <div className="absolute -top-2 -right-2">
                        <div className="h-5 w-5 rounded-full bg-accent shadow-lg flex items-center justify-center">
                            <BrainCircuit className="h-3 w-3 text-white" />
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    );
}
