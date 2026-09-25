"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getFarbeforSprache } from "@/lib/sprachen-farbe";
import styles from "./wortschatz.module.css";

type SetZeile = {
    id: string;
    name: string;
    sprache: string;
    kartenGesamt: number;
    kartenGelernt: number;
    kartenFaellig: number;
    fortschrittProzent: number;
};

export default function WortschatzSeite() {
    const router = useRouter();
    const [sets, setSets] = useState<SetZeile[]>([]);
    const [laden, setLaden] = useState(true);

    useEffect(() => {
        let abgebrochen = false;
        fetch("/api/karteikarten")
            .then((r) => (r.ok ? r.json() : []))
            .then((daten: SetZeile[]) => {
                if (abgebrochen) return;
                setSets(Array.isArray(daten) ? daten : []);
                setLaden(false);
            })
            .catch(() => {
                if (abgebrochen) return;
                setLaden(false);
            });
        return () => {
            abgebrochen = true;
        };
    }, []);

    return (
        <div className={styles.seite}>
            <h2 className={styles.titel}>Wortschatz</h2>
            <p className={styles.untertitel}>Alle Sprachpakete auf einen Blick.</p>

            {laden ? (
                <div className={styles.skelett} />
            ) : (
                <ul className={styles.liste}>
                    {sets.map((set) => (
                        <li key={set.id}>
                            <button
                                type="button"
                                className={styles.zeile}
                                onClick={() => router.push(`/lernen/${set.id}`)}
                            >
                                <span
                                    className={styles.punkt}
                                    style={{
                                        backgroundColor:
                                            getFarbeforSprache(set.sprache) ?? "var(--muted)",
                                    }}
                                />
                                <span className={styles.text}>
                                    <span className={styles.name}>{set.name}</span>
                                    <span className={styles.meta}>
                                        {set.kartenGelernt ?? 0} / {set.kartenGesamt ?? 0} gelernt
                                        {typeof set.kartenFaellig === "number" && set.kartenFaellig > 0
                                            ? ` · ${set.kartenFaellig} fällig`
                                            : ""}
                                    </span>
                                </span>
                                <span className={styles.prozent}>{set.fortschrittProzent ?? 0}%</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <button
                type="button"
                className={styles.neu}
                onClick={() => router.push("/karteikarten-hinzufuegen")}
            >
                Wort hinzufügen
            </button>
        </div>
    );
}
