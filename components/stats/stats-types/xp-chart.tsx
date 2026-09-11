'use client';
import {AreaChart,Area,ResponsiveContainer,XAxis,YAxis,CartesianGrid,Tooltip,Legend} from "recharts";
import { useEffect, useState } from "react";
import { WochenXpTyp } from "@/lib/types";
import { WochenXp } from "@/lib/mock-xp-pro-tag";
export default function XpChart() {
    const [wochenXp, setWochenXp] = useState<WochenXpTyp | null>(null);
    const [loading,setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        fetch("/api/wochen-xp").then((response) => {
            response.json().then((daten:WochenXpTyp) => {
                setLoading(false);
                setWochenXp(daten)
            })
        }).catch(() => {
            setLoading(false)
        })
    },[]) 
    const chartData = [
  { name: "Mo", xp: wochenXp?.mo ?? 0 },
  { name: "Di", xp: wochenXp?.di ?? 0 },
  { name: "Mi", xp: wochenXp?.mi ?? 0 },
  { name: "Do", xp: wochenXp?.do ?? 0 },
  { name: "Fr", xp: wochenXp?.fr ?? 0 },
  { name: "Sa", xp: wochenXp?.sa ?? 0 },
  { name: "So", xp: wochenXp?.so ?? 0 },
];
    return(
        loading? (
            <div style={{
                            width: "100%",
                            height: "100%",
                            minHeight: "220px",
                            borderRadius: 12,
                            background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)",
                            backgroundSize: "200% 100%",
                            animation: "pulse 1.2s ease-in-out infinite",
                            margin: "8px 0",
                            border:"none",
                        }}></div> ):
        (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart width={500} height={400} data={chartData}>
                <XAxis dataKey="name"/>
                <YAxis />
                <Tooltip contentStyle={{
      borderRadius: "12px",
      backgroundColor: "#fff",
      border: "1px solid #e5e7eb",
    }}/>
                <Legend />
                <CartesianGrid strokeDasharray="5 5"/>
                <Area type="monotone" dataKey="xp"
                stroke="#110e0e63" fill="#801e2e"></Area>
            </AreaChart>
        </ResponsiveContainer>
        )
        
    );
};