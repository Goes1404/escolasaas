"use client";

/**
 * 📊 Premium Chart Library — Plataforma LMS
 *
 * Conjunto único de gráficos Recharts com visual premium (gradientes, brilho,
 * animações suaves e tooltip consistente). Mobile-first: eixos enxutos, fontes
 * pequenas, margens otimizadas e ResponsiveContainer em 100%.
 *
 * Todos os gráficos são carregados via `dynamic(..., { ssr: false })` porque o
 * Recharts acessa `window`/DOM. IDs de gradiente/brilho são únicos por instância
 * (useId) para evitar colisão quando há vários gráficos na mesma tela.
 *
 * Uso:
 *   <AreaChartPremium  data={d} xKey="date" yKey="acertos" color="#4ccced" />
 *   <BarChartPremium   data={d} xKey="subject" yKey="count" />
 *   <BarChartPremium   data={d} xKey="name" yKey="performance" horizontal domainMax={100} unit="%" />
 *   <LineChartPremium  data={d} xKey="week" yKey="pct" referenceY={75} unit="%" domainMax={100} />
 *   <RadarChartPremium data={d} angleKey="subject" yKey="score" />
 */

import { useId } from "react";
import dynamic from "next/dynamic";

/* ── Tooltip premium compartilhado (sem dependência de recharts) ───────────── */
function PremiumTooltip({ active, payload, label, unit = "" }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/95 backdrop-blur-xl px-3.5 py-2.5 shadow-2xl shadow-slate-900/10">
      {label !== undefined && label !== "" && (
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ background: p.color || p.stroke || p.fill || "#4ccced" }}
          />
          <span className="text-sm font-black italic text-slate-900 leading-none">
            {typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}
            {unit}
          </span>
          {p.name && <span className="text-[10px] font-bold text-slate-400 lowercase">{p.name}</span>}
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-full w-full flex items-center justify-center bg-slate-50/60 animate-pulse rounded-2xl" />;
}

const PALETTE = ["#4ccced", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#a855f7", "#14b8a6"];

/* ── Área premium (gradiente + brilho) ─────────────────────────────────────── */
export const AreaChartPremium = dynamic(
  () =>
    import("recharts").then(({ AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer }) => {
      function Chart({
        data,
        xKey = "name",
        yKey = "score",
        color = "#4ccced",
        unit = "",
        showAxis = true,
        domainMax,
      }: any) {
        const uid = useId().replace(/:/g, "");
        const gradId = `area-grad-${uid}`;
        const glowId = `area-glow-${uid}`;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, left: showAxis ? -16 : 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.38} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
                <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef2f6" />
              {showAxis ? (
                <>
                  <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} dy={8} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    fontWeight={700}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                    domain={domainMax ? [0, domainMax] : undefined}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey={xKey} hide />
                  <YAxis hide domain={domainMax ? [0, domainMax] : undefined} />
                </>
              )}
              <Tooltip content={<PremiumTooltip unit={unit} />} cursor={{ stroke: color, strokeOpacity: 0.25, strokeWidth: 2 }} />
              <Area
                type="monotone"
                dataKey={yKey}
                stroke={color}
                strokeWidth={3}
                fill={`url(#${gradId})`}
                fillOpacity={1}
                style={{ filter: `url(#${glowId})` }}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff", fill: color }}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      return { default: Chart };
    }),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/* ── Barras premium (gradiente por barra, vertical ou horizontal) ──────────── */
export const BarChartPremium = dynamic(
  () =>
    import("recharts").then(({ BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell }) => {
      function Chart({
        data = [],
        xKey,
        yKey,
        colors,
        colorKey,
        horizontal = false,
        barSize,
        domainMax,
        unit = "",
      }: any) {
        const uid = useId().replace(/:/g, "");
        const pal = colors && colors.length ? colors : PALETTE;
        const radius: [number, number, number, number] = horizontal ? [0, 10, 10, 0] : [10, 10, 0, 0];
        const colorFor = (i: number) => (colorKey ? data[i]?.[colorKey] : pal[i % pal.length]) || "#4ccced";
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: 8, right: horizontal ? 16 : 8, left: horizontal ? 4 : -14, bottom: 4 }}
            >
              <defs>
                {data.map((_: any, i: number) => {
                  const c = colorFor(i);
                  const id = `bar-grad-${uid}-${i}`;
                  return (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
                      <stop offset="0%" stopColor={c} stopOpacity={1} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.5} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" horizontal={!horizontal} vertical={horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" domain={domainMax ? [0, domainMax] : undefined} hide />
                  <YAxis
                    dataKey={xKey}
                    type="category"
                    stroke="#64748b"
                    fontSize={11}
                    fontWeight={700}
                    width={88}
                    tickLine={false}
                    axisLine={false}
                  />
                </>
              ) : (
                <>
                  <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} dy={8} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    fontWeight={700}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    domain={domainMax ? [0, domainMax] : undefined}
                  />
                </>
              )}
              <Tooltip content={<PremiumTooltip unit={unit} />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
              <Bar dataKey={yKey} radius={radius} barSize={barSize} animationDuration={800}>
                {data.map((_: any, i: number) => (
                  <Cell key={i} fill={`url(#bar-grad-${uid}-${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }
      return { default: Chart };
    }),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/* ── Linha premium (área sutil + brilho + linha de meta) ───────────────────── */
export const LineChartPremium = dynamic(
  () =>
    import("recharts").then(({ AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine }) => {
      function Chart({
        data,
        xKey,
        yKey,
        color = "#10b981",
        referenceY,
        referenceColor = "#f59e0b",
        unit = "",
        domainMax,
      }: any) {
        const uid = useId().replace(/:/g, "");
        const gradId = `line-grad-${uid}`;
        const glowId = `line-glow-${uid}`;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
                <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eef2f6" />
              <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} dy={8} />
              <YAxis
                stroke="#94a3b8"
                fontSize={10}
                fontWeight={700}
                tickLine={false}
                axisLine={false}
                width={36}
                domain={domainMax ? [0, domainMax] : undefined}
                tickFormatter={unit ? (v: number) => `${v}${unit}` : undefined}
              />
              <Tooltip content={<PremiumTooltip unit={unit} />} cursor={{ stroke: color, strokeOpacity: 0.25, strokeWidth: 2 }} />
              {typeof referenceY === "number" && (
                <ReferenceLine y={referenceY} stroke={referenceColor} strokeDasharray="5 5" strokeWidth={1.5} />
              )}
              <Area
                type="monotone"
                dataKey={yKey}
                stroke={color}
                strokeWidth={3}
                fill={`url(#${gradId})`}
                fillOpacity={1}
                style={{ filter: `url(#${glowId})` }}
                dot={{ r: 4, fill: color, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, strokeWidth: 3, stroke: "#fff", fill: color }}
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      return { default: Chart };
    }),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

/* ── Radar premium (gradiente radial + brilho) ─────────────────────────────── */
export const RadarChartPremium = dynamic(
  () =>
    import("recharts").then(({ Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip }) => {
      function Chart({ data, angleKey = "subject", yKey = "score", color = "#4ccced", unit = "" }: any) {
        const uid = useId().replace(/:/g, "");
        const gradId = `radar-grad-${uid}`;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="78%" data={data}>
              <defs>
                <radialGradient id={gradId}>
                  <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.12} />
                </radialGradient>
              </defs>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey={angleKey} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="Desempenho"
                dataKey={yKey}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                fillOpacity={1}
                animationDuration={900}
              />
              <Tooltip content={<PremiumTooltip unit={unit} />} />
            </RadarChart>
          </ResponsiveContainer>
        );
      }
      return { default: Chart };
    }),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
