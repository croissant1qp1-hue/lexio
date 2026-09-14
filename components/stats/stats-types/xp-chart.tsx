'use client';
import {AreaChart,Area,ResponsiveContainer,XAxis,YAxis,CartesianGrid,Tooltip,Legend} from "recharts";
import { useEffect, useState } from "react";
import { WochenXpTyp } from "@/lib/types";
import LoadingStateDiv from "@/components/loading-state-div/loading-state-div";
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
            <LoadingStateDiv />
         ):
        (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart width={500} height={400} data={chartData}>
                <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)" }} axisLine={{ stroke: "var(--muted)" }} tickLine={false}/>
                <YAxis tick={{ fill: "var(--text-secondary)" }} axisLine={{ stroke: "var(--muted)" }} tickLine={false}/>
                <Tooltip contentStyle={{
                    borderRadius: "10px",
                    backgroundColor: "var(--card-dark)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--terracotta)",
                    boxShadow: "var(--shadow-card)",
                }} itemStyle={{ color: "var(--text-primary)" }} labelStyle={{ color: "var(--text-secondary)" }}/>
                <Legend wrapperStyle={{ color: "var(--text-secondary)" }}/>
                <CartesianGrid stroke="var(--muted)" strokeDasharray="4 6" opacity={0.35}/>
                <Area type="monotone" dataKey="xp"
                stroke="var(--gold)" strokeWidth={3} fill="var(--gold)" fillOpacity={0.2}></Area>
            </AreaChart>
        </ResponsiveContainer>
        )
        
    );
};