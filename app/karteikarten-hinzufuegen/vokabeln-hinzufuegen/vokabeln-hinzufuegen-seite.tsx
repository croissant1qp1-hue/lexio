"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { KarteikartenSet } from "@/lib/types";
import { getFarbeforSprache } from "@/lib/sprachen-farbe";
import styles from "./vokabeln-hinzufuegen.module.css";

type Status = "idle" | "speichert" | "fertig" | "fehler";

export default function VokabelnHinzufuegenSeite() {
    const router = useRouter();

    const [sets, setSets] = useState<KarteikartenSet[]>([]);
    const [setSlug, setSetSlug] = useState<string | null>(null);
    const [frage, setFrage] = useState("");
    const [antwort, setAntwort] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [fehler, setFehler] = useState<Record<string, string>>({});
    const [zaehler, setZaehler] = useState(0);

    const frageRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let abgebrochen = false;
        fetch("/api/karteikarten")
            .then((r) => (r.ok ? r.json() : []))
            .then((data: KarteikartenSet[]) => {
                if (abgebrochen) return;
                setSets(Array.isArray(data) ? data : []);
            })
            .catch(() => undefined);
        return () => {
            abgebrochen = true;
        };
    }, []);

    // Nach dem Speichern bleibt man im Formular. Das ist beabsichtigt: wer
    // 30 Woerter eintippt, will nicht 30 mal zurueck navigieren.
    useEffect(() => {
        if (setSlug) frageRef.current?.focus();
    }, [setSlug]);

    const gewaehltesSet = sets.find((s) => s.id === setSlug);

    async function speichern(event: React.FormEvent) {
        event.preventDefault();
        if (!setSlug || status === "speichert") return;

        setStatus("speichert");
        setFehler({});

        try {
            const antwortHttp = await fetch("/api/karten", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ setSlug, frage, antwort }),
            });

            const daten = await antwortHttp.json();

            if (!antwortHttp.ok) {
                setFehler(daten?.felder ?? {});
                setStatus("fehler");
                return;
            }

            setFrage("");
            setAntwort("");
            setZaehler((z) => z + 1);
            setStatus("fertig");
            setTimeout(() => setStatus("idle"), 1600);
        } catch {
            setStatus("fehler");
            setFehler({ form: "Keine Verbindung zum Server." });
        }
    }

    return (
        <div className={styles.seite}>
            <header className={styles.kopf}>
                <button
                    type="button"
                    className={styles.zurueck}
                    onClick={() => router.push("/")}
                    aria-label="Zurueck zur Uebersicht"
                >
                    <svg viewBox="0 -960 960 960" width="22" height="22" fill="currentColor" aria-hidden="true">
                        <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                    </svg>
                </button>
                <div>
                    <h2 className={styles.titel}>Wort hinzufügen</h2>
                    <p className={styles.untertitel}>
                        {zaehler > 0
                            ? `${zaehler} ${zaehler === 1 ? "Wort gespeichert" : "Wörter gespeichert"}`
                            : "Wähle eine Sprache und trag dein Wort ein."}
                    </p>
                </div>
            </header>

            <div className={styles.sprachen}>
                {sets.map((set) => {
                    const aktiv = setSlug === set.id;
                    return (
                        <button
                            key={set.id}
                            type="button"
                            className={`${styles.sprache} ${aktiv ? styles.spracheAktiv : ""}`}
                            style={{ backgroundColor: getFarbeforSprache(set.sprache) ?? "var(--bg-elevated)" }}
                            onClick={() => setSetSlug(aktiv ? null : set.id)}
                            aria-pressed={aktiv}
                        >
                            {set.name}
                        </button>
                    );
                })}
            </div>

            {gewaehltesSet && (
                <form className={styles.form} onSubmit={speichern}>
                    <div className={styles.kopfzeile}>
                        <span
                            className={styles.punkt}
                            style={{ backgroundColor: getFarbeforSprache(gewaehltesSet.sprache) ?? "var(--muted)" }}
                        />
                        {gewaehltesSet.name}
                    </div>

                    <label className={styles.feld}>
                        <span className={styles.label}>Begriff</span>
                        <input
                            ref={frageRef}
                            className={styles.input}
                            value={frage}
                            onChange={(e) => setFrage(e.target.value)}
                            placeholder="z. B. ciao"
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            aria-invalid={Boolean(fehler.frage)}
                        />
                        {fehler.frage && <span className={styles.fehler}>{fehler.frage}</span>}
                    </label>

                    <label className={styles.feld}>
                        <span className={styles.label}>Übersetzung</span>
                        <input
                            className={styles.input}
                            value={antwort}
                            onChange={(e) => setAntwort(e.target.value)}
                            placeholder="z. B. hallo"
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            aria-invalid={Boolean(fehler.antwort)}
                        />
                        {fehler.antwort && <span className={styles.fehler}>{fehler.antwort}</span>}
                    </label>

                    {fehler.form && <p className={styles.fehler}>{fehler.form}</p>}

                    <button
                        type="submit"
                        className={styles.speichern}
                        disabled={status === "speichert"}
                    >
                        {status === "speichert"
                            ? "Speichert…"
                            : status === "fertig"
                              ? "Gespeichert ✓"
                              : "Wort speichern"}
                    </button>

                    {status === "fertig" && gewaehltesSet.id && (
                        <button
                            type="button"
                            className={styles.weiter}
                            onClick={() => router.push(`/lernen/${gewaehltesSet.id}`)}
                        >
                            Jetzt lernen →
                        </button>
                    )}
                </form>
            )}

            {!gewaehltesSet && sets.length > 0 && (
                <p className={styles.hinweis}>Wähle oben eine Sprache aus, um loszulegen.</p>
            )}
        </div>
    );
}
