'use client';

import { useEffect, useState } from "react";
import type { SprachStat } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import LoadingStateDiv from "../../loading-state-div/loading-state-div";
import { holeJson } from "@/lib/api-client";

export default function StatsProSprache() {
  const [loading, setLoading] = useState(true);
  const [datenFetch, setDatenFetch] = useState<SprachStat[] | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    holeJson<SprachStat[] | null>("/api/sprachen-stats", null)
      .then((dat) => {
        if (abgebrochen) return;
        setDatenFetch(dat ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (abgebrochen) return;
        setLoading(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  if (loading || !datenFetch) {
    return <LoadingStateDiv />;
  }

  /*
   * "Italienisch" wurde auf 8 Zeichen gekuerzt und bekam "..." – im
   * Diagramm stand dann mehr Text als irgendwo sonst auf der Seite. Die
   * Achse hat Platz, und Hochformat laesst sich per CSS regeln. Deshalb: der
   * volle Name, und die Achsenbeschriftung bricht selbst um.
   */
  const formatLanguageLabel = (name: string) => name;

  const chartData = datenFetch.map((item) => ({
    name: formatLanguageLabel(item.sprache),
    xp: item.xp,
  }));

  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" opacity={0.35} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--muted)" }}
            tickLine={false}
            interval={0}
            height={48}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--muted)" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "10px",
              backgroundColor: "var(--card-bg)",
              color: "var(--text-primary)",
              border: "1px solid var(--terracotta)",
              boxShadow: "var(--shadow-card)",
            }}
            itemStyle={{ color: "var(--text-primary)" }}
            labelStyle={{ color: "var(--text-secondary)" }}
            formatter={(value) => `${value} XP`}
          />
          <Bar dataKey="xp" fill="var(--terracotta)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}