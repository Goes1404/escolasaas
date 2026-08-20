
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileQuestion, Percent, Loader2 } from "lucide-react";
import { supabase } from '@/app/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChartPremium } from "@/components/charts/premium";

type DashboardData = {
  totalQuestions: number;
  questionsBySubject: {
    subject: string;
    count: number;
  }[];
  answeredRatio: number;
};

export function QuestionsDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // 1. Buscar total de questões e dados para agrupamento
                const { data: questions, error: qError } = await supabase
                    .from('questions')
                    .select('id, subject_id, subjects(name)');
                
                if (qError) throw qError;

                // 2. Processar agrupamento por matéria no cliente para máxima estabilidade
                const subjectCounts: Record<string, number> = {};
                const validQuestions = questions || [];
                
                validQuestions.forEach(q => {
                    const name = (q.subjects as any)?.name || 'Sem Categoria';
                    subjectCounts[name] = (subjectCounts[name] || 0) + 1;
                });

                const questionsBySubject = Object.entries(subjectCounts)
                    .map(([subject, count]) => ({ subject, count }))
                    .sort((a, b) => b.count - a.count);

                // 3. Buscar taxa de respostas (tabela de histórico opcional)
                let answeredRatio = 0;
                try {
                    const { data: answers, error: aError } = await supabase
                        .from('student_question_answers')
                        .select('question_id');
                    
                    if (!aError && validQuestions.length > 0 && answers) {
                        const uniqueAnswered = new Set(answers.map(a => a.question_id));
                        answeredRatio = Math.round((uniqueAnswered.size / validQuestions.length) * 100);
                    }
                } catch (e) {
                    // Tabela pode não existir no setup inicial, ignoramos silenciosamente
                }

                setData({
                    totalQuestions: validQuestions.length,
                    questionsBySubject,
                    answeredRatio
                });
            } catch (error: any) {
                console.error("Error fetching dashboard data:", error);
                // Erros de tabela inexistente ou RLS são comuns em setup inicial
                if (error.code !== 'PGRST116' && error.code !== '42P01') {
                    toast({
                        title: "Sincronização Pendente",
                        description: "O banco de dados de questões está sendo configurado.",
                        variant: "default"
                    });
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [toast]);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    if (!data || data.totalQuestions === 0) {
        return (
            <div className="py-16 text-center border-4 border-dashed rounded-[3rem] bg-white/50 animate-in fade-in duration-700">
                <FileQuestion className="h-12 w-12 mx-auto mb-4 text-primary/20" />
                <h3 className="text-xl font-black text-primary italic">Banco de Dados em Branco</h3>
                <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">Alimente o banco com questões manuais ou em massa para habilitar os gráficos de performance.</p>
            </div>
        );
    }

  return (
    <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h2 className="text-2xl font-black text-primary italic px-2">Análise Industrial do Banco</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:shadow-2xl transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Volume Total</CardTitle>
                    <div className="p-2 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <FileQuestion className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-5xl font-black text-primary italic">{data.totalQuestions}</div>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2">ITENS NO REPOSITÓRIO</p>
                </CardContent>
            </Card>
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:shadow-2xl transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Exploração de Rede</CardTitle>
                    <div className="p-2 rounded-xl bg-accent/5 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                        <Percent className="h-4 w-4" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-4xl md:text-5xl font-black text-accent italic">{data.answeredRatio}%</div>
                    <p className="text-[10px] font-bold text-muted-foreground mt-2">TAXA DE COBERTURA</p>
                </CardContent>
            </Card>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 pb-0">
                <CardTitle className="text-lg font-black text-primary italic">Distribuição Geográfica de Matérias</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
                <div className="h-[300px] w-full">
                    <BarChartPremium data={data.questionsBySubject} xKey="subject" yKey="count" barSize={40} />
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6 mb-10 animate-pulse">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-40 rounded-[2.5rem]" />
                <Skeleton className="h-40 rounded-[2.5rem]" />
            </div>
            <Skeleton className="h-[400px] rounded-[2.5rem]" />
        </div>
    );
}
