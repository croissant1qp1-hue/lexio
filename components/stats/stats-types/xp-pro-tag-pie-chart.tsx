"use client";

import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import LoadingStateDiv from "../../loading-state-div/loading-state-div";
import { holeJson } from "@/lib/api-client";
import type { TagesXpTyp } from "@/lib/types";

export default function TagesXpPieChart() {
    const [loading, setLoading] = useState(true);
    const [proTagXp, setProTagXp] = useState<TagesXpTyp | null>(null);

    useEffect(() => {
        let abgebrochen = false;
        holeJson<TagesXpTyp | null>("/api/tages-xp", null)
            .then((daten) => {
                if (abgebrochen) return;
                setProTagXp(daten);
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
    if (loading || !proTagXp) {
        return <LoadingStateDiv />;
    }
    const erreicht = Math.min(proTagXp.erreicht, proTagXp.ziel);
    const uebrig = Math.max(proTagXp.ziel - erreicht, 0);
    const chartData = [
        { name: "Erreicht", value: erreicht },
        { name: "Übrig", value: uebrig },
    ];

    return (
        <div style={{ width: "100%", height: "100%", minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="62%"
                        outerRadius="82%"
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={3}
                        cornerRadius={8}
                        stroke="none"
                    >
                        <Cell fill="var(--terracotta)" />
                        <Cell fill="var(--bg-elevated-2)" />
                    </Pie>
                        <text
                        x="50%"
                        y="47%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ fontSize: "1.8rem", fontWeight: 700, fill: "var(--text-primary)" }}
                    >
                            {erreicht}
                        </text>
                        <text
                            x="50%"
                            y="60%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fontSize: "0.85rem", fill: "var(--text-secondary)" }}
                        >
                        von {proTagXp.ziel} XP
                    </text>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "var(--card-bg)",
                            border: "1px solid var(--terracotta)",
                            borderRadius: "10px",
                            color: "var(--text-primary)",
                            boxShadow: "var(--shadow-card)",
                        }}
                        labelStyle={{ color: "var(--text-secondary)" }}
                        itemStyle={{ color: "var(--text-primary)" }}
                        formatter={(value) => `${value} XP`}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}