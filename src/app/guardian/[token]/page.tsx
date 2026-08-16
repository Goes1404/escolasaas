"use client";

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Tipo de dados retornado pela RPC get_student_engagement_by_token
type EngagementData = {
  xp: number;
  streak: number;
  questions_answered: number;
  last_activity: string | null;
};

export default function GuardianPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Busca os dados de engajamento ao montar a página
  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: resp, error } = await supabase.rpc('get_student_engagement_by_token', {
          token_val: token,
        });
        if (error) throw error;
        // A RPC devolve um array; pegamos o primeiro registro
        if (resp && Array.isArray(resp) && resp.length > 0) {
          setData(resp[0] as unknown as EngagementData);
        } else {
          setData(null);
        }
      } catch (err: any) {
        toast({ title: 'Erro ao obter dados', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // UI de carregamento
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <>
      {/* SEO otimizado */}
      <Head>
        <title>Acompanhamento do Aluno – Plataforma</title>
        <meta
          name="description"
          content="Visão geral das métricas de engajamento do aluno disponibilizada para responsáveis via token seguro."
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12">
        <div className="max-w-3xl mx-auto px-4 md:px-0 animate-fade-in">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-white/10 border-b border-white/20 p-8">
              <CardTitle className="text-3xl font-extrabold text-white tracking-tight">
                Acompanhamento do Aluno
              </CardTitle>
              <CardDescription className="text-sm text-gray-300">
                Métricas de engajamento resumidas para que você acompanhe o progresso.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {data ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase text-gray-400">XP</p>
                    <p className="text-3xl font-bold text-indigo-300">{data.xp}</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase text-gray-400">Streak</p>
                    <p className="text-3xl font-bold text-indigo-300">{data.streak} dias</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <p className="text-xs uppercase text-gray-400">Questões resolvidas</p>
                    <p className="text-3xl font-bold text-indigo-300">{data.questions_answered}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-400">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <span>Nenhum dado disponível para este token.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

