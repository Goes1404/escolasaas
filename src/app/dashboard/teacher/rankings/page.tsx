
"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Medal,
  Loader2,
  Sparkles,
  School,
  Crown,
  ArrowLeft,
} from "lucide-react";
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
  const accentClasses =
    activeTab === "etec"
      ? {
          ringBg: "bg-indigo-500/15",
          ringBorder: "border-indigo-500/25",
          ringText: "text-indigo-400",
          badge: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25",
        }
      : {
          ringBg: "bg-purple-500/15",
          ringBorder: "border-purple-500/25",
          ringText: "text-purple-400",
          badge: "bg-purple-500/15 text-purple-400 border border-purple-500/25",
        };

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Back link ── */}
      <Link
        href="/dashboard/teacher/home"
        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/55 hover:text-white/70 transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Voltar ao Painel
      </Link>

      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-[#0d0d0f] border border-white/5 p-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              activeTab === "etec"
                ? "radial-gradient(ellipse at 80% 10%, rgba(99,102,241,0.18) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(76,204,237,0.08) 0%, transparent 60%)"
                : "radial-gradient(ellipse at 80% 10%, rgba(168,85,247,0.18) 0%, transparent 60%), radial-gradient(ellipse at 10% 90%, rgba(76,204,237,0.08) 0%, transparent 60%)",
          }}
        />
        <Trophy className="absolute right-4 top-4 h-20 w-20 text-white/[0.04]" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Crown className={`h-3 w-3 ${activeTab === "etec" ? "text-indigo-400" : "text-purple-400"}`} />
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${activeTab === "etec" ? "text-indigo-400/80" : "text-purple-400/80"}`}>
              Auditoria Viva
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
            Rankings de Elite
          </h1>
          <p className="text-white/65 text-xs font-semibold mt-1">
            Top 10 por performance em simulados
          </p>

          {/* Tab pills */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => setActiveTab("etec")}
              className={`h-11 rounded-xl font-black text-xs uppercase tracking-widest italic transition-all touch-manipulation active:scale-95 ${
                activeTab === "etec"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                  : "bg-white/5 border border-white/8 text-white/65"
              }`}
            >
              ETEC
            </button>
            <button
              onClick={() => setActiveTab("enem")}
              className={`h-11 rounded-xl font-black text-xs uppercase tracking-widest italic transition-all touch-manipulation active:scale-95 ${
                activeTab === "enem"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                  : "bg-white/5 border border-white/8 text-white/65"
              }`}
            >
              ENEM
            </button>
          </div>
        </div>
      </div>

      {/* ── Ranking content ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">
            Sincronizando posições...
          </p>
        </div>
      ) : activeRank.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-200 rounded-[1.5rem]">
          <Trophy className="h-8 w-8 mx-auto mb-2 text-white/15" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Aguardando dados de performance
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Top 3 podium */}
          {activeRank.length >= 1 && (
            <div className="grid grid-cols-3 gap-2">
              {/* 2nd */}
              {activeRank[1] && (
                <div className="flex flex-col items-center pt-6">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 flex items-center justify-center font-black text-lg italic shadow-lg">
                      2
                    </div>
                    <Medal className="h-3.5 w-3.5 absolute -top-1 -right-1 text-slate-300 drop-shadow" />
                  </div>
                  <p className="text-[11px] font-black text-slate-800 text-center mt-2 truncate w-full px-1">
                    {activeRank[1].name?.split(" ")[0]}
                  </p>
                  <p className="text-base font-black text-slate-300 italic">{activeRank[1].bestScore}</p>
                </div>
              )}
              {/* 1st */}
              {activeRank[0] && (
                <div className="flex flex-col items-center">
                  <Crown className="h-4 w-4 text-amber-400 mb-1 animate-pulse" />
                  <div className="relative">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-amber-900 flex items-center justify-center font-black text-2xl italic shadow-xl shadow-amber-500/30">
                      1
                    </div>
                    <Medal className="h-4 w-4 absolute -top-1 -right-1 text-amber-300 drop-shadow" />
                  </div>
                  <p className="text-xs font-black text-slate-800 text-center mt-2 truncate w-full px-1">
                    {activeRank[0].name?.split(" ")[0]}
                  </p>
                  <div className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    <p className="text-lg font-black text-amber-400 italic">{activeRank[0].bestScore}</p>
                  </div>
                </div>
              )}
              {/* 3rd */}
              {activeRank[2] && (
                <div className="flex flex-col items-center pt-8">
                  <div className="relative">
                    <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-700 text-orange-100 flex items-center justify-center font-black text-base italic shadow-lg">
                      3
                    </div>
                    <Medal className="h-3 w-3 absolute -top-1 -right-1 text-orange-300 drop-shadow" />
                  </div>
                  <p className="text-[11px] font-black text-slate-800 text-center mt-2 truncate w-full px-1">
                    {activeRank[2].name?.split(" ")[0]}
                  </p>
                  <p className="text-base font-black text-orange-400 italic">{activeRank[2].bestScore}</p>
                </div>
              )}
            </div>
          )}

          {/* Rest of the list (4-10) */}
          {activeRank.slice(3).length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              {activeRank.slice(3).map((student, idx) => {
                const position = idx + 4;
                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 bg-white shadow-sm border border-slate-200 rounded-2xl p-3"
                  >
                    <div className={`h-8 w-8 rounded-xl ${accentClasses.ringBg} border ${accentClasses.ringBorder} flex items-center justify-center font-black italic ${accentClasses.ringText} text-xs shrink-0`}>
                      {position}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 italic text-sm truncate leading-none">{student.name}</p>
                      {student.institution && (
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mt-1">
                          <School className="h-2.5 w-2.5" />
                          {student.institution}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Recorde</p>
                      <p className="text-base font-black text-slate-800 italic mt-0.5">
                        {student.bestScore}
                        <span className="text-[9px] opacity-40 ml-1">pts</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Badge className={`mx-auto mt-4 block w-fit ${accentClasses.badge} font-black text-[9px] uppercase tracking-widest px-3 py-1.5`}>
            Master {activeTab.toUpperCase()} 2024
          </Badge>
        </div>
      )}
    </div>
  );
}
