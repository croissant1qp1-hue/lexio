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

export default function StatsProSprache() {
  const [loading, setLoading] = useState(true);
  const [datenFetch, setDatenFetch] = useState<SprachStat[] | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/sprachen-stats")
      .then((res) => res.json())
      .then((dat: SprachStat[]) => {
        setDatenFetch(dat);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading || !datenFetch) {
    return <LoadingStateDiv />;
  }

  const formatLanguageLabel = (name: string) => {
    const maxLength = 8;
    if (name.length <= maxLength) return name;
    return `${name.slice(0, maxLength)}...`;
  };

  const chartData = datenFetch.map((item) => ({
    name: formatLanguageLabel(item.sprache),
    xp: item.xp,
  }));

  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#DDD2B9" opacity={0.7} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#3B2112", fontSize: 12 }}
            axisLine={{ stroke: "#DDD2B9" }}
            tickLine={false}
            interval={0}
            height={40}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: "#3B2112", fontSize: 12 }}
            axisLine={{ stroke: "#DDD2B9" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "10px",
              backgroundColor: "#241F16",
              color: "#F2EAD6",
              border: "1px solid #C25B3F",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
            }}
            itemStyle={{ color: "#F2EAD6" }}
            labelStyle={{ color: "#F2EAD6" }}
            formatter={(value) => `${value} XP`}
          />
          <Bar dataKey="xp" fill="#C25B3F" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}