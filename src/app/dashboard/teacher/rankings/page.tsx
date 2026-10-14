
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  Medal,
  Loader2,
  School,
  ArrowLeft,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { fmtNumber, txt } from "@/lib/format";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/lib/AuthProvider";

export default function TeacherRankingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [etecRank, setEtecRank] = useState<any[]>([]);
  const [enemRank, setEnemRank] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"etec" | "enem">("etec");

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: attempts, error } = await supabase
        .from("simulation_attempts")
        .select(`
          score,
          total_questions,
          created_at,
          profiles!inner (
            id,
            name,
            profile_type,
            institution,
            avatar_url
          )
        `);

      if (error) throw error;

      const userStats: Record<string, any> = {};

      attempts?.forEach((att: any) => {
        const profile = att.profiles;
        if (!userStats[profile.id]) {
          userStats[profile.id] = {
            id: profile.id,
            name: profile.name,
            type: profile.profile_type,
            institution: profile.institution,
            totalScore: 0,
            bestScore: 0,
            attempts: 0,
          };
        }
        userStats[profile.id].totalScore += att.score;
        userStats[profile.id].bestScore = Math.max(userStats[profile.id].bestScore, att.score);
        userStats[profile.id].attempts += 1;
      });

      const allUsers = Object.values(userStats);

      const etec = allUsers
        .filter((u: any) => u.type === "etec")
        .sort((a: any, b: any) => b.bestScore - a.bestScore)
        .slice(0, 10);

      const enem = allUsers
        .filter((u: any) => u.type === "enem")
        .sort((a: any, b: any) => b.bestScore - a.bestScore)
        .slice(0, 10);

      setEtecRank(etec);
      setEnemRank(enem);
    } catch (err) {
      console.error("Ranking error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const activeRank = activeTab === "etec" ? etecRank : enemRank;

  return (
    <div className="pb-24 space-y-5">

      {/* ── Voltar ── */}
      <Link
        href="/dashboard/teacher/home"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao início
      </Link>

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="u-label flex items-center gap-2"><Trophy className="h-3.5 w-3.5" /> Professor · ranking</p>
          <h1 className="u-page-title text-3xl mt-1">Ranking dos simulados</h1>
          <p className="text-sm text-muted-foreground mt-1">Os 10 alunos com a melhor nota em simulados.</p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-control bg-muted w-full sm:w-64" role="tablist">
          {(["etec", "enem"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`h-9 rounded-control text-sm font-bold transition-colors touch-manipulation ${
                activeTab === tab ? "bg-background text-foreground border border-border" : "text-muted-foreground"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ranking ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          <p className="u-label">Carregando…</p>
        </div>
      ) : activeRank.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={`Ainda não há simulados ${activeTab.toUpperCase()} feitos`}
          description="Quando os alunos fizerem simulados, os 10 melhores aparecem aqui."
          action={{ label: "Ver alunos", href: "/dashboard/teacher/students" }}
        />
      ) : (
        <div className="space-y-2">
          {activeRank.map((student, idx) => {
            const position = idx + 1;
            const podium = position <= 3;
            return (
              <div
                key={student.id}
                className={`flex items-center gap-3 u-surface p-3 ${podium ? "!border-foreground/25" : ""}`}
              >
                <div className={`h-10 w-10 rounded-control flex items-center justify-center shrink-0 border ${position === 1 ? "bg-brand-yellow border-foreground/20 text-foreground" : "border-border text-foreground"}`}>
                  <span className="u-num text-base">{position}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate leading-tight flex items-center gap-1.5">
                    {podium && <Medal className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />}
                    {txt(student.name, "Aluno sem nome")}
                  </p>
                  {student.institution && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate">
                      <School className="h-3 w-3 shrink-0" />
                      {student.institution}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="u-label !tracking-[0.16em]">Melhor nota</p>
                  <p className="u-num text-base text-foreground mt-0.5">
                    {fmtNumber(student.bestScore)}
                    <span className="text-[10px] text-muted-foreground ml-1 font-sans">pts</span>
                  </p>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground text-center pt-2">
            Conta a melhor nota de cada aluno entre todos os simulados que ele fez.
          </p>
        </div>
      )}
    </div>
  );
}
