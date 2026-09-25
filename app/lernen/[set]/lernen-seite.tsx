"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    BEWERTUNGEN,
    type Bewertung,
    intervallVorschau,
} from "@/lib/lernlogik";
import { getFarbeforSprache } from "@/lib/sprachen-farbe";
import styles from "./lernen.module.css";

type Karte = {
    id: string;
    frage: string;
    antwort: string;
    stufe: number;
    gelernt: boolean;
    treffer: number;
    fehler: number;
};

type SetInfo = { slug: string; name: string; sprache: string };

const SPEICHER_SCHLUESSEL = "lexio.lernfortschritt";

/**
 * Ohne Server-Session liegt der Fortschritt nur im localStorage. Sobald Auth
 * laeuft, wandert er in die Datenbank – bis dahin ist das der ehrlichste Ort,
 * der ohne Anmeldung funktioniert.
 *
 * xp und heute werden dauerhaft gehalten, streak und sitzung sind Sitzungs-
 * groessen und werden bewusst nicht gespeichert: ein Streak, der nach einem
 * Neuladen wieder von null beginnt, motiviert mehr als einer, der nach zwei
 * Wochen Inaktivitaet als "589" dasteht.
 */
type Fortschritt = { xp: number; heute: number; streak: number; sitzung: number };

const LEER: Fortschritt = { xp: 0, heute: 0, streak: 0, sitzung: 0 };

function heuteKey(): number {
    const d = new Date();
    return Number(`${d.getFullYear()}${d.getMonth()}${d.getDate()}`);
}

function ladeFortschritt(): Fortschritt {
    if (typeof window === "undefined") return LEER;
    try {
        const roh = window.localStorage.getItem(SPEICHER_SCHLUESSEL);
        if (!roh) return LEER;
        const p = JSON.parse(roh) as { xp?: number; heute?: number; datum?: number };
        // Letzter Lerntag zaehlt nur, wenn er wirklich heute war.
        const heuteFisch = p.datum === heuteKey();
        return {
            xp: typeof p.xp === "number" ? p.xp : 0,
            heute: heuteFisch && typeof p.heute === "number" ? p.heute : 0,
            streak: 0,
            sitzung: 0,
        };
    } catch {
        return LEER;
    }
}

function speichereFortschritt(f: Fortschritt) {
    try {
        window.localStorage.setItem(
            SPEICHER_SCHLUESSEL,
            JSON.stringify({ xp: f.xp, heute: f.heute, datum: heuteKey() })
        );
    } catch {
        // Privater Modus: Fortschritt geht verloren, App funktioniert weiter.
    }
}

export default function LernenSeite({ setSlug }: { setSlug: string }) {
    const router = useRouter();

    const [set, setSet] = useState<SetInfo | null>(null);
    const [karten, setKarten] = useState<Karte[]>([]);
    const [index, setIndex] = useState(0);
    const [aufgedeckt, setAufgedeckt] = useState(false);
    const [laden, setLaden] = useState(true);
    const [fehler, setFehler] = useState<string | null>(null);
    const [senden, setSenden] = useState(false);
    const [fortschritt, setFortschritt] = useState<Fortschritt>(LEER);
    const [aufblitzen, setAufblitzen] = useState<number | null>(null);

    const erstmalGeladen = useRef(false);

    // Zaehler statt Funktionsaufruf: "Noch eine Runde" erhoeht ihn, der
    // Effect laeuft erneut. So bleibt das setState im Klick-Handler statt im
    // Effect-Rumpf, wo es einen zweiten Render-Durchlauf erzwingen wuerde.
    const [runde, setRunde] = useState(0);

    useEffect(() => {
        let abgebrochen = false;

        (async () => {
            try {
                const antwort = await fetch(`/api/lernen?set=${encodeURIComponent(setSlug)}`);
                if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
                const daten = (await antwort.json()) as { set: SetInfo; karten: Karte[] };
                if (abgebrochen) return;

                // Zaehlt den Fortschritt nur beim ersten Laden, damit
                // "Noch eine Runde" den Streak nicht zuruecksetzt.
                if (!erstmalGeladen.current) {
                    erstmalGeladen.current = true;
                    setFortschritt(ladeFortschritt());
                }

                setFehler(null);
                setSet(daten.set);
                setKarten(daten.karten ?? []);
                setIndex(0);
                setAufgedeckt(false);
            } catch {
                if (abgebrochen) return;
                setFehler("Karten konnten nicht geladen werden.");
            } finally {
                if (!abgebrochen) setLaden(false);
            }
        })();

        return () => {
            abgebrochen = true;
        };
    }, [setSlug, runde]);

    function neuStarten() {
        setLaden(true);
        setFehler(null);
        setRunde((r) => r + 1);
    }

    const karte = karten[index];
    const fertig = !laden && !fehler && karten.length > 0 && index >= karten.length;

    function bewerten(bewertung: Bewertung) {
        if (!karte || senden) return;
        setSenden(true);

        // Vorab optimistisch zaehlen, damit die Animation nicht auf die
        // Netzwerkroundtrip wartet. Die Serverantwort gleicht das spaeter ab.
        const xp = BEWERTUNGEN.find((b) => b.id === bewertung)?.xp ?? 0;

        setFortschritt((f) => {
            const next: Fortschritt = {
                xp: f.xp + xp,
                heute: f.heute + xp,
                streak: f.streak + 1,
                sitzung: f.sitzung + 1,
            };
            speichereFortschritt(next);
            return next;
        });

        if (xp > 0) {
            setAufblitzen(xp);
            setTimeout(() => setAufblitzen(null), 900);
        }

        void fetch("/api/lernen/antwort", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kartenId: karte.id, bewertung }),
        })
            .then(async (r) => {
                if (!r.ok) return;
                const daten = (await r.json()) as { xp?: number };
                const serverXp = daten.xp;
                if (typeof serverXp !== "number" || serverXp === xp) return;
                setFortschritt((f) => {
                    const next = { ...f, xp: f.xp - xp + serverXp, heute: f.heute - xp + serverXp };
                    speichereFortschritt(next);
                    return next;
                });
            })
            .catch(() => undefined)
            .finally(() => {
                setSenden(false);
                setAufgedeckt(false);
                setIndex((i) => i + 1);
            });
    }

    // Tastaturbedienung: Leertaste deckt auf, 1-4 bewerten.
    useEffect(() => {
        function aufTaste(e: KeyboardEvent) {
            if (laden || fehler || fertig) return;
            const ziel = e.target as HTMLElement | null;
            if (ziel && ["INPUT", "TEXTAREA", "BUTTON"].includes(ziel.tagName)) return;

            if (e.code === "Space" || e.code === "Enter") {
                e.preventDefault();
                setAufgedeckt((a) => !a);
                return;
            }
            if (!aufgedeckt) return;
            const tabelle: Record<string, Bewertung> = {
                Digit1: "nochmal",
                Digit2: "schwer",
                Digit3: "gut",
                Digit4: "einfach",
            };
            const wahl = tabelle[e.code];
            if (wahl) {
                e.preventDefault();
                bewerten(wahl);
            }
        }
        window.addEventListener("keydown", aufTaste);
        return () => window.removeEventListener("keydown", aufTaste);
    });

    if (laden) {
        return (
            <div className={styles.seite}>
                <div className={styles.skelett} />
            </div>
        );
    }

    if (fehler) {
        return (
            <div className={styles.seite}>
                <div className={styles.ende}>
                    <p className={styles.endeText}>{fehler}</p>
                    <button className={styles.knopf} onClick={neuStarten}>
                        Erneut versuchen
                    </button>
                    <button className={styles.knopfLeise} onClick={() => router.push("/")}>
                        Zur Übersicht
                    </button>
                </div>
            </div>
        );
    }

    if (karten.length === 0) {
        return (
            <div className={styles.seite}>
                <div className={styles.ende}>
                    <span className={styles.endeZeichen}>☕</span>
                    <h2 className={styles.endeTitel}>Alles gelernt</h2>
                    <p className={styles.endeText}>
                        Für {set?.name} sind heute keine Karten fällig. Komm später wieder – dann wartet der
                        nächste Stapel.
                    </p>
                    <button className={styles.knopf} onClick={() => router.push("/")}>
                        Zur Übersicht
                    </button>
                </div>
            </div>
        );
    }

    if (fertig) {
        return (
            <div className={styles.seite}>
                <div className={styles.ende}>
                    <span className={styles.endeZeichen}>🎉</span>
                    <h2 className={styles.endeTitel}>Sitzung geschafft</h2>
                    <p className={styles.endeText}>
                        {karten.length} {karten.length === 1 ? "Karte" : "Karten"} in {set?.name}.
                    </p>
                    <div className={styles.endeStats}>
                        <div className={styles.endeStat}>
                            <span className={styles.endeZahl}>+{fortschritt.xp}</span>
                            <span className={styles.endeLabel}>XP gesamt</span>
                        </div>
                        <div className={styles.endeStat}>
                            <span className={styles.endeZahl}>🔥 {fortschritt.streak}</span>
                            <span className={styles.endeLabel}>Streak</span>
                        </div>
                    </div>
                    <button className={styles.knopf} onClick={neuStarten}>
                        Noch eine Runde
                    </button>
                    <button className={styles.knopfLeise} onClick={() => router.push("/")}>
                        Zur Übersicht
                    </button>
                </div>
            </div>
        );
    }

    const anteil = Math.round((index / karten.length) * 100);
    const farbe = set ? getFarbeforSprache(set.sprache) : undefined;

    return (
        <div className={styles.seite}>
            <header className={styles.kopf}>
                <button
                    type="button"
                    className={styles.zurueck}
                    onClick={() => router.push("/")}
                    aria-label="Lernen verlassen"
                >
                    <svg viewBox="0 -960 960 960" width="20" height="20" fill="currentColor" aria-hidden="true">
                        <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                    </svg>
                </button>
                <div className={styles.fortschritt}>
                    <div className={styles.fortschrittBalken}>
                        <div className={styles.fortschrittFuellung} style={{ width: `${anteil}%` }} />
                    </div>
                    <span className={styles.fortschrittText}>
                        {index + 1} / {karten.length}
                    </span>
                </div>
                <div className={styles.punkte}>
                    <span className={styles.xp}>{fortschritt.xp} XP</span>
                    <span className={styles.streak}>🔥 {fortschritt.streak}</span>
                </div>
            </header>

            {aufblitzen !== null && (
                <div className={styles.xpPop} aria-live="polite">
                    +{aufblitzen} XP
                </div>
            )}

            <div className={styles.buehne}>
                <button
                    type="button"
                    className={`${styles.karte} ${aufgedeckt ? styles.karteAufgedeckt : ""}`}
                    style={farbe ? { ["--kartenFarbe" as string]: farbe } : undefined}
                    onClick={() => {
                        setAufgedeckt((a) => !a);
                            }}
                    aria-label={aufgedeckt ? "Antwort verbergen" : "Antwort aufdecken"}
                >
                    <span className={styles.karteInnen}>
                        <span className={styles.karteSeite}>
                            <span className={styles.karteLabel}>{aufgedeckt ? "Antwort" : "Begriff"}</span>
                            <span className={styles.karteText}>{aufgedeckt ? karte.antwort : karte.frage}</span>
                            {!aufgedeckt && <span className={styles.karteTipp}>Tippen zum Aufdecken</span>}
                        </span>
                    </span>

                    {/* Sprachzeichen unten links auf jeder Karte */}
                    <span className={styles.karteZeichen}>
                        <Image
                            src="/images/karte/globe.svg"
                            alt=""
                            width={64}
                            height={64}
                            className={styles.karteZeichenBild}
                        />
                        <span className={styles.karteZeichenText}>{set?.sprache}</span>
                    </span>

                    {karte.stufe > 0 && !aufgedeckt && (
                        <span className={styles.stufePunkte} aria-label={`Lernstufe ${karte.stufe}`}>
                            {Array.from({ length: Math.min(karte.stufe, 5) }).map((_, i) => (
                                <span key={i} className={styles.stufePunkt} />
                            ))}
                        </span>
                    )}
                </button>
            </div>

            <div className={styles.aktionen}>
                {aufgedeckt ? (
                    <div className={styles.bewertungen}>
                        {BEWERTUNGEN.map((b) => (
                            <button
                                key={b.id}
                                type="button"
                                className={`${styles.bewertung} ${styles[`bewertung_${b.id}`]}`}
                                onClick={() => bewerten(b.id)}
                                disabled={senden}
                            >
                                <span className={styles.bewertungLabel}>{b.knopf}</span>
                                <span className={styles.bewertungMeta}>
                                    {b.xp > 0 ? `+${b.xp} XP` : "0 XP"} ·{" "}
                                    {intervallVorschau(karte.stufe, b.id) === 0
                                        ? "heute"
                                        : `in ${intervallVorschau(karte.stufe, b.id)} T`}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <button
                        type="button"
                        className={styles.aufdecken}
                        onClick={() => {
                            setAufgedeckt(true);
                        }}
                    >
                        Antwort aufdecken
                    </button>
                )}
            </div>

            <p className={styles.tastaturTipp}>
                Leertaste zum Aufdecken · Tasten 1–4 zum Bewerten
            </p>
        </div>
    );
}
