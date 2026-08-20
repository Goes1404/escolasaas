"use client";

import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactElement } from "react";

export interface EvolutionPoint {
  attempt: number;
  /** Nota TRI (0–1000) ou null quando a prova não calcula TRI. */
  tri: number | null;
  /** Aproveitamento em % (0–100). */
  pct: number;
  countsForReport: boolean;
  date: string;
}

export interface EvolutionChartProps {
  data: EvolutionPoint[];
  /** Se true, plota a nota TRI; senão, o aproveitamento (%). */
  useTri: boolean;
}

/**
 * Gráfico de evolução das tentativas de um simulado. Renderizado apenas no
 * cliente (Recharts acessa window) — importe com dynamic(..., { ssr: false }).
 */
export function EvolutionChart({ data, useTri }: EvolutionChartProps): ReactElement {
  const yKey = useTri ? "tri" : "pct";
  const yMax = useTri ? 1000 : 100;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
        <XAxis
          dataKey="attempt"
          tickFormatter={(v) => `${v}ª`}
          tick={{ fontSize: 10, fontWeight: 800, fill: "#94a3b8" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, yMax]}
          tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        {/* Divisor: tentativas > 2 não contam para o boletim */}
        {data.some((d) => d.attempt === 2) && data.length > 2 && (
          <ReferenceLine
            x={2.5}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: "boletim", position: "insideTopLeft", fontSize: 9, fill: "#d97706", fontWeight: 800 }}
          />
        )}
        <Tooltip
          contentStyle={{ borderRadius: 16, border: "1px solid #f1f5f9", fontSize: 12, fontWeight: 700 }}
          formatter={(value: number) => [useTri ? `${value} pts` : `${value}%`, useTri ? "Nota TRI" : "Aproveitamento"]}
          labelFormatter={(l) => `${l}ª tentativa`}
        />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke="#f97316"
          strokeWidth={3}
          dot={(props: { cx?: number; cy?: number; payload?: EvolutionPoint; index?: number }) => {
            const { cx, cy, payload, index } = props;
            if (cx == null || cy == null) return <g key={index} />;
            const official = payload?.countsForReport;
            return (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={official ? 6 : 4}
                fill={official ? "#f97316" : "#fff"}
                stroke="#f97316"
                strokeWidth={2}
              />
            );
          }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
