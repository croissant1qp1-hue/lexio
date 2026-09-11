"use client";

import { useEffect, useState } from "react";
import {  Legend ,Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import LoadingStateDiv from "../../loading-state-div/loading-state-div";
import type { TagesXpTyp } from "@/lib/types";

export default function TagesXpPieChart() {
    const [loading, setLoading] = useState(true);
    const [proTagXp, setProTagXp] = useState<TagesXpTyp | null>(null);

    useEffect(() => {
        fetch("/api/tages-xp")
            .then((response) => response.json())
            .then((daten: TagesXpTyp) => {
                setProTagXp(daten);
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);
    //hier wird das loading state überprüft und generiert
    if (loading || !proTagXp) {
        return <LoadingStateDiv />;
    }
    //hier werden daten generiert für den chart
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
                        <Cell fill="#C25B3F" />
                        <Cell fill="#E7DCC2" />
                    </Pie>
                        <text
                        x="50%"
                        y="47%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ fontSize: "1.8rem", fontWeight: 700, fill: "#333" }}
                    >
                            {erreicht}
                        </text>
                        <text
                            x="50%"
                            y="60%"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ fontSize: "0.85rem", fill: "#888" }}
                        >
                        von {proTagXp.ziel} XP
                    </text>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "#241F16",
                            border: "1px solid #C25B3F",
                            borderRadius: "10px",
                            color: "#F2EAD6",
                            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
                        }}
                        labelStyle={{ color: "#F2EAD6" }}
                        itemStyle={{ color: "#F2EAD6" }}
                        formatter={(value) => `${value} XP`}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}