"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { KarteikartenSet } from "@/lib/types";
import { getFarbeforSprache } from "@/lib/sprachen-farbe";
import { useRouter } from "next/navigation";

export default function KarteikartenUebersicht() {
    const router = useRouter();
    const [karteikarten, setKarteikarten] = useState<KarteikartenSet[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);

        fetch("/api/karteikarten")
            .then((response) => response.json())
            .then((data: KarteikartenSet[]) => {
                setKarteikarten(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className="vokabel-sets">
            <Image
                id="add-button-id"
                className="add-button"
                src="/images/tile-border-outer.svg"
                title="Vokabeln hinzufügen"
                alt="Vokabeln hinzufügen"
                width={250}
                height={250}
                onClick={() =>
                    router.push("/karteikarten-hinzufuegen")
                }
            />

            {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        style={{
                            aspectRatio: "1/1",
                            height: "clamp(200px, 25vw, 300px)",
                            borderRadius: 12,
                            background: "linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)",
                            backgroundSize: "200% 100%",
                            animation: "pulse 1.2s ease-in-out infinite",
                            margin: "8px 0",
                            border:"none",
                        }}
                    />
                ))
                : karteikarten.map((set) => (
                    <div
                        key={set.id}
                        style={
                            getFarbeforSprache(set.sprache)
                                ? { backgroundColor: getFarbeforSprache(set.sprache) }
                                : {}
                        }>
                            <h1 className="set-name">{set.name}</h1>   
                            <h2 className="set-anzahl-woerter">{set.anzahlKarten} Karten</h2>
                    </div>
                ))}
        </div>
    );
}