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
                <XAxis dataKey="name" tick={{ fill: "#3B2112" }} axisLine={{ stroke: "#DDD2B9" }} tickLine={false}/>
                <YAxis tick={{ fill: "#3B2112" }} axisLine={{ stroke: "#DDD2B9" }} tickLine={false}/>
                <Tooltip contentStyle={{
                    borderRadius: "10px",
                    backgroundColor: "#241F16",
                    color: "#F2EAD6",
                    border: "1px solid #C25B3F",
                    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
                }} itemStyle={{ color: "#F2EAD6" }} labelStyle={{ color: "#F2EAD6" }}/>
                <Legend wrapperStyle={{ color: "#3B2112" }}/>
                <CartesianGrid stroke="#DDD2B9" strokeDasharray="4 6" opacity={0.65}/>
                <Area type="monotone" dataKey="xp"
                stroke="#C25B3F" strokeWidth={3} fill="#C25B3F" fillOpacity={0.22}></Area>
            </AreaChart>
        </ResponsiveContainer>
        )
        
    );
};