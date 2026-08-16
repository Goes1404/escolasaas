"use client";

import { Target } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LABELS, avg, pct, subjectScores, type EnemReportCard } from "./report-card-lib";

export default function EnemInsights({ entries }: { entries: EnemReportCard[] }) {
  const latest = entries[entries.length - 1];
  const first = entries[0];

  const evolutionData = entries.map((entry) => {
    const simAvg = avg([entry.simulado_1_score, entry.simulado_2_score, entry.simulado_3_score]);
    return {
      semester: `${entry.semester} sem`,
      classificatoria: pct(entry.classificatoria_score, entry.classificatoria_max) ?? 0,
      simulados: pct(simAvg, entry.simulado_max) ?? 0,
      redacao: pct(entry.redacao_score, entry.redacao_max) ?? 0,
    };
  });

  const topFive = subjectScores(latest).sort((a, b) => b.score - a.score).slice(0, 5);
  const radarData = topFive.map((subject) => ({
    subject: subject.short,
    value: subject.score * 10,
    raw: subject.score,
  }));

  const firstClass = pct(first?.classificatoria_score, first?.classificatoria_max);
  const latestClass = pct(latest?.classificatoria_score, latest?.classificatoria_max);
  const delta = firstClass !== null && latestClass !== null ? latestClass - firstClass : null;
  const bestSubject = topFive[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Evolucao do aluno</h2>
            <p className="text-xs font-semibold text-slate-500">Percentual por semestre em provas, simulados e redacao.</p>
          </div>
          {delta !== null && (
            <span className={`rounded-full px-3 py-1 text-xs font-black ${delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {delta >= 0 ? "+" : ""}
              {delta} pts
            </span>
          )}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionData} margin={{ left: -20, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="semester" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b", fontWeight: 700 }} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip formatter={(value) => [`${value}%`, ""]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Line type="monotone" dataKey="classificatoria" name={LABELS.classificatoria} stroke="#4ccced" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="simulados" name="Simulados" stroke="#0f172a" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="redacao" name={LABELS.redacao} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">{LABELS.classificatoria}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Simulados</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{LABELS.redacao}</span>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">{LABELS.pentagono} de afinidade</h2>
            <p className="text-xs font-semibold text-slate-500">Top 5 materias com melhor desempenho.</p>
          </div>
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid gridType="polygon" stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#334155", fontWeight: 800 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip formatter={(value, _name, props) => [`${props.payload.raw}`, "Nota"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Radar dataKey="value" stroke="#4ccced" fill="#4ccced" fillOpacity={0.28} strokeWidth={3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {bestSubject && (
          <div className="rounded-2xl bg-primary/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">Maior afinidade</p>
            <p className="text-sm font-black text-slate-950">
              {bestSubject.label} <span className="text-primary">{bestSubject.score}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
