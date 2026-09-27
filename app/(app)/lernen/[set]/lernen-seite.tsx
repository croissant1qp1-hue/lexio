"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BEWERTUNGEN, type Bewertung, intervallVorschau } from "@/lib/lernlogik";
import { getFarbeforSprache } from "@/lib/sprachen-farbe";
import { ApiFehler, holeJson, sendeJson } from "@/lib/api-client";
import { xpFormatieren } from "@/lib/profil";
import styles from "./lernen.module.css";

type Karte = {
    id: string;
    frage: string;
    antwort: string;
    stufe: number;
    gelernt: boolean;
};

type SetInfo = { slug: string; name: string; sprache: string };

/** Antwort von /api/lernen. */
type LernAntwort = {
    set: SetInfo;
    karten: Karte[];
    faelligGesamt: number;
    /** Nur gesetzt, wenn das Set groesser ist als die Lesegrenze der Route. */
    setZuGross?: boolean;
    hinweis?: string;
};

/**
 * Gelernt und XP kommen aus der Datenbank, nicht aus dem localStorage.
 *
 * Vorher lag der Fortschritt im Browser: localStorage-Key "lexio.lernfortschritt",
 * mit einer Serienzahl, die bei jedem Klick um eins hochgezaehlt wurde. Nach
 * 20 Antworten in einer Sitzung stand dort "Serie 20". Diese Zahl war
 * weder ein Streak noch irgendetwas anderes – sie war nur nicht
 * ueberpruefbar, weil niemand sie sehen konnte ausser der Person, die
 *den Browser zuruecksetzte.
 *
 * Jetzt: /api/profil beim Start, /api/lernen/antwort nach jeder Antwort. Der
 * Server zaehlt, und der Server weiss es richtig.
 */
type Punkte = { xp: number; streak: number };

const NULL_PUNKTE: Punkte = { xp: 0, streak: 0 };

export default function LernenSeite({ setSlug }: { setSlug: string }) {
    const router = useRouter();

    const [set, setSet] = useState<SetInfo | null>(null);
    const [karten, setKarten] = useState<Karte[]>([]);
    const [index, setIndex] = useState(0);
    const [aufgedeckt, setAufgedeckt] = useState(false);
    const [laden, setLaden] = useState(true);
    const [fehler, setFehler] = useState<string | null>(null);
    const [senden, setSenden] = useState(false);
    /** Meldung, wenn das Speichern schlug. Solange sie steht, bleibt die
     *  Karte liegen und dieselbe Bewertung kann erneut gesendet werden. */
    const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
    const [hinweis, setHinweis] = useState<string | null>(null);
    const [punkte, setPunkte] = useState<Punkte>(NULL_PUNKTE);
    const [aufblitzen, setAufblitzen] = useState<number | null>(null);

    /**
     * Bilanz dieser Runde. Getrennt vom Gesamt-Fortschritt, weil "XP gesamt"
     * und "XP in dieser Runde" zwei verschiedene Fragen sind und die
     * Gesamtzahl sich mit jeder Runde veraendert.
     */
    const [bilanz, setBilanz] = useState<Record<Bewertung, number>>({
        nochmal: 0,
        schwer: 0,
        gut: 0,
        einfach: 0,
    });

    // Zaehler statt Funktionsaufruf: "Noch eine Runde" erhoeht ihn, der
    // Effekt laeuft erneut. So bleibt das setState im Klick-Handler statt im
    // Effekt-Rumpf, wo es einen zweiten Render-Durchlauf erzwingen wuerde.
    const [runde, setRunde] = useState(0);

    const neuStarten = useCallback(() => {
        setLaden(true);
        setFehler(null);
        setSpeicherFehler(null);
        setBilanz({ nochmal: 0, schwer: 0, gut: 0, einfach: 0 });
        setRunde((r) => r + 1);
    }, []);

    useEffect(() => {
        let abgebrochen = false;

        (async () => {
            try {
                // Beides parallel: die Karten sind das, was angezeigt wird,
                // die Punkte nur die Kopfzeile. Sie duerfen sich nicht
                // aufhalten.
                const [daten, profil] = await Promise.all([
                    holeJson<LernAntwort | null>(
                        `/api/lernen?set=${encodeURIComponent(setSlug)}`,
                        null,
                    ),
                    // Fehlgeschlagenes /api/profil ist in der Regel kein
                    // Grund, das Lernen abzubrechen: die Punkte stehen dann
                    // auf 0, und das ist ehrlicher als eine Fehlermeldung
                    // ueber den Karten. Ausgenommen ist 503 – dort weiss
                    // auch /api/lernen nichts, und der Aufruf bricht ohnehin
                    // ab.
                    holeJson<{ xp: number; streak: number } | null>("/api/profil", null),
                ]);

                if (abgebrochen) return;

                if (!daten) {
                    setFehler("Karten konnten nicht geladen werden.");
                    return;
                }

                setFehler(null);
                setSpeicherFehler(null);
                setHinweis(daten.setZuGross ? (daten.hinweis ?? null) : null);
                setSet(daten.set);
                setKarten(daten.karten ?? []);
                setIndex(0);
                setAufgedeckt(false);
                if (profil) setPunkte({ xp: profil.xp, streak: profil.streak });
            } catch (e) {
                /*
                 * `try/finally` allein genuegt nicht.
                 *
                 * `holeJson` wirft auch dann, wenn ein `abfall` uebergeben
                 * wurde – bei 503 (Supabase nicht erreichbar) inzwischen
                 * immer. Vor `finally` ist nur `laden` abgeräumt worden;
                 * `fehler` blieb null und `karten` leer, und darunter wartet
                 * die Meldung "Alles gelernt". Bei einer Lern-App ist das
                 * die denkbar schlechteste Antwort auf "ich komme nicht
                 * an": Sie behauptet Erfolg.
                 */
                if (abgebrochen) return;
                setFehler(
                    e instanceof ApiFehler && e.status === 503
                        ? "Keine Verbindung zu Supabase. In einem Moment erneut versuchen."
                        : "Karten konnten nicht geladen werden.",
                );
            } finally {
                if (!abgebrochen) setLaden(false);
            }
        })();

        return () => {
            abgebrochen = true;
        };
    }, [setSlug, runde]);

    const karte = karten[index];
    const fertig = !laden && !fehler && karten.length > 0 && index >= karten.length;

    /** Aus der Bilanz abgeleitet, damit Anzeige und Zaehler nicht
     *  auseinanderlaufen koennen. */
    const sitzung = useMemo(() => {
        const beantwortet = bilanz.nochmal + bilanz.schwer + bilanz.gut + bilanz.einfach;
        const richtig = beantwortet - bilanz.nochmal;
        return {
            beantwortet,
            richtig,
            quote: beantwortet > 0 ? Math.round((richtig / beantwortet) * 100) : 0,
            xp: BEWERTUNGEN.reduce((summe, b) => summe + bilanz[b.id] * b.xp, 0),
        };
    }, [bilanz]);

    const bewerten = useCallback(
        async (bewertung: Bewertung) => {
            if (!karte || senden) return;
            setSenden(true);
            setSpeicherFehler(null);

            const xp = BEWERTUNGEN.find((b) => b.id === bewertung)?.xp ?? 0;

            if (xp > 0) {
                setAufblitzen(xp);
                window.setTimeout(() => setAufblitzen(null), 900);
            }

            // Optimistisch zaehlen, damit die Animation nicht auf den
            // Roundtrip wartet. Kommt die Serverzahl, wird sie uebernommen –
            // sie ist die richtige, weil der Server sie aus derselben Quelle
            // liest, aus der auch die Navbar sie liest.
            setPunkte((p) => ({ ...p, xp: p.xp + xp }));
            setBilanz((alt) => ({ ...alt, [bewertung]: alt[bewertung] + 1 }));

            try {
                const antwort = await sendeJson<{
                    xpGesamt?: number;
                    streak?: number | null;
                }>("/api/lernen/antwort", { kartenId: karte.id, bewertung });

                setPunkte((p) => ({
                    xp: typeof antwort.xpGesamt === "number" ? antwort.xpGesamt : p.xp,
                    /*
                     * Der Streak haengt daran, ob es HEUTE schon XP gab. Die
                     * erste Antwort des Tages erzeugt diese Zeile also erst
                     * jetzt. Ohne diesen Wert blieb das Flammensymbol bis zum
                     * naechsten Seitenaufruf auf 0 stehen, waehrend die
                     * Kopfzeile daneben schon die neuen XP zeigte – die
                     * beiden widersprachen sich sichtbar.
                     *
                     * `null` heisst: die View gibt es nicht (Migration 003
                     * fehlt). Dann bleibt der alte Wert stehen, statt auf 0
                     * zurueckzuspringen.
                     */
                    streak: typeof antwort.streak === "number" ? antwort.streak : p.streak,
                }));

                // Erst jetzt weiter. Vorher stand das `setIndex` im `finally`
                // und damit auch bei einem Fehler: die Karte wanderte, die
                // Bilanz zaehlte mit, im Server stand aber nichts. Eine
                // abgelehnte Antwort – leeres WLAN, abgelaufene Sitzung,
                // 503, weil die Migration fehlt – war damit ein stiller
                // Fortschrittsverlust. Jetzt bleibt die Karte stehen, und
                // dieselbe Bewertung kann erneut gesendet werden.
                setAufgedeckt(false);
                setIndex((i) => i + 1);
            } catch (antwortFehler) {
                // Optimistische Zaehlung zuruecknehmen, sonst zeigt die
                // Kopfzeile XP, die es nie gab.
                setPunkte((p) => ({ ...p, xp: Math.max(0, p.xp - xp) }));
                setBilanz((alt) => ({ ...alt, [bewertung]: Math.max(0, alt[bewertung] - 1) }));
                setAufblitzen(null);

                /*
                 * Diesmal ist die Meldung fuer den Nutzer bestimmt, im
                 * Gegensatz zum urspruenglichen Kommentar. "Verloren" ist
                 * keine Information, mit der jemand etwas anfangen kann –
                 * und genau dieses Schweigen war der Fehler.
                 *
                 * 401 behandelt holeJson selbst: es leitet zur Anmeldung um.
                 */
                setSpeicherFehler(
                    antwortFehler instanceof ApiFehler
                        ? antwortFehler.message
                        : "Die Antwort konnte nicht gespeichert werden. Versuch es noch einmal.",
                );
            } finally {
                setSenden(false);
            }
        },
        [karte, senden],
    );

    // Tastaturbedienung: Leertaste deckt auf, 1-4 bewerten.
    useEffect(() => {
        function aufTaste(e: KeyboardEvent) {
            if (laden || fehler || fertig) return;

            /*
             * Der alte Test war `["INPUT", "TEXTAREA", "BUTTON"].includes(tagName)`
             * und wurde bei JEDEM Tastendruck ausgewertet – auch dann, wenn
             * der Fokus auf dem Knopf "Antwort aufdecken" lag. Genau das war
             * der Grund, warum sich nach einem Klick mit der Maus nichts mehr
             * tat: Der Knopf hatte den Fokus, die Bedingung traf zu, der
             * Handler kehhrte zurueck. Die Anzeige unten ("Leertaste zum
             * Aufdecken") versprach also etwas, das nicht passierte.
             *
             * Die richtige Regel: nur abschreiben, wenn der Fokus in einem
             * Eingabefeld liegt. Sonst gehoert die Taste uns.
             */
            const ziel = e.target as HTMLElement | null;
            const inEingabefeld =
                ziel?.tagName === "INPUT" || ziel?.tagName === "TEXTAREA" || ziel?.isContentEditable;

            // Alt/Strg/Super gedrueckt: das ist eine Browser- oder
            // Systemkombination, keine Lerntaste.
            if (inEingabefeld || e.altKey || e.ctrlKey || e.metaKey) return;

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
                void bewerten(wahl);
            }
        }

        window.addEventListener("keydown", aufTaste);
        return () => window.removeEventListener("keydown", aufTaste);
    }, [laden, fehler, fertig, aufgedeckt, bewerten]);

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
                    <button type="button" className={styles.knopf} onClick={neuStarten}>
                        Erneut versuchen
                    </button>
                    <button type="button" className={styles.knopfLeise} onClick={() => router.push("/")}>
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
                    <span className={styles.endeZeichen} aria-hidden="true">
                        ☕
                    </span>
                    <h2 className={styles.endeTitel}>Alles gelernt</h2>
                    <p className={styles.endeText}>
                        Für {set?.name} sind heute keine Karten fällig. Komm später wieder – dann wartet
                        der nächste Stapel.
                    </p>
                    <button type="button" className={styles.knopf} onClick={() => router.push("/")}>
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
                    <span className={styles.endeZeichen} aria-hidden="true">
                        🎉
                    </span>
                    <h2 className={styles.endeTitel}>Sitzung geschafft</h2>
                    <p className={styles.endeText}>
                        {karten.length} {karten.length === 1 ? "Karte" : "Karten"} in {set?.name}.
                    </p>
                    <div className={styles.endeStats}>
                        <div className={styles.endeStat}>
                            <span className={styles.endeZahl}>+{sitzung.xp}</span>
                            <span className={styles.endeLabel}>XP in dieser Runde</span>
                        </div>
                        <div className={styles.endeStat}>
                            <span className={styles.endeZahl}>{sitzung.quote}%</span>
                            <span className={styles.endeLabel}>richtig</span>
                        </div>
                        <div className={styles.endeStat}>
                            <span className={styles.endeZahl}>
                                <i className="fa-solid fa-fire" aria-hidden="true" /> {punkte.streak}
                            </span>
                            <span className={styles.endeLabel}>Serie</span>
                        </div>
                    </div>
                    <button type="button" className={styles.knopf} onClick={neuStarten}>
                        Noch eine Runde
                    </button>
                    <button type="button" className={styles.knopfLeise} onClick={() => router.push("/")}>
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
                    <svg
                        viewBox="0 -960 960 960"
                        width="20"
                        height="20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                    </svg>
                </button>
                <div className={styles.fortschritt}>
                    <div
                        className={styles.fortschrittBalken}
                        role="progressbar"
                        aria-valuenow={index}
                        aria-valuemin={0}
                        aria-valuemax={karten.length}
                        aria-label="Fortschritt in dieser Runde"
                    >
                        <div className={styles.fortschrittFuellung} style={{ width: `${anteil}%` }} />
                    </div>
                    <span className={styles.fortschrittText}>
                        {index + 1} / {karten.length}
                    </span>
                </div>
                <div className={styles.punkte}>
                    <span className={styles.xp}>{xpFormatieren(punkte.xp)} XP</span>
                    <span className={styles.streak}>
                        <i className="fa-solid fa-fire" aria-hidden="true" /> {punkte.streak}
                    </span>
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
                    style={farbe ? ({ ["--kartenFarbe" as string]: farbe } as React.CSSProperties) : undefined}
                    onClick={() => setAufgedeckt((a) => !a)}
                    aria-label={aufgedeckt ? "Antwort verbergen" : "Antwort aufdecken"}
                    aria-pressed={aufgedeckt}
                >
                    <span className={styles.karteInnen}>
                        {/* Die farbigen Flaechen liegen unter dem Text und
                            drehen sich mit ihm. Ohne sie haette die gedrehte
                            Karte keinen Grund, sich zu drehen. */}
                        <span className={styles.flaeche} />
                        <span className={`${styles.flaeche} ${styles.flaecheHinten}`} />

                        {/* Vorderseite: der Begriff. Nie verdeckt, solange
                            nicht gedreht wurde. */}
                        <span className={styles.kartenSeite}>
                            <span className={styles.karteLabel}>Begriff</span>
                            <span className={styles.karteText}>{karte.frage}</span>
                            <span className={styles.karteTipp}>Tippen zum Aufdecken</span>

                            <span className={styles.karteZeichen}>
                                <Image
                                    src="/images/karte/globe.svg"
                                    alt=""
                                    width={26}
                                    height={26}
                                    className={styles.karteZeichenBild}
                                />
                                <span className={styles.karteZeichenText}>{set?.sprache}</span>
                            </span>

                            {karte.stufe > 0 && (
                                <span
                                    className={styles.stufePunkte}
                                    aria-label={`Lernstufe ${karte.stufe}`}
                                >
                                    {Array.from({ length: Math.min(karte.stufe, 5) }).map((_, i) => (
                                        <span key={i} className={styles.stufePunkt} />
                                    ))}
                                </span>
                            )}
                        </span>

                        {/* Rueckseite: die Antwort. Vorgedreht, damit sich
                            die Containerdrehung aufhebt. */}
                        <span className={`${styles.kartenSeite} ${styles.kartenSeiteHinten}`}>
                            <span className={styles.karteLabel}>Antwort</span>
                            <span className={styles.karteText}>{karte.antwort}</span>

                            <span className={styles.karteZeichen}>
                                <Image
                                    src="/images/karte/globe.svg"
                                    alt=""
                                    width={26}
                                    height={26}
                                    className={styles.karteZeichenBild}
                                />
                                <span className={styles.karteZeichenText}>{set?.sprache}</span>
                            </span>
                        </span>
                    </span>
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
                                onClick={() => void bewerten(b.id)}
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
                    <button type="button" className={styles.aufdecken} onClick={() => setAufgedeckt(true)}>
                        Antwort aufdecken
                    </button>
                )}
            </div>

            {speicherFehler && (
                <p className={styles.speicherFehler} role="alert">
                    {speicherFehler}
                </p>
            )}

            {/*
             * Kein Fehler: das Lernen funktioniert. Aber wenn nur ein Teil
             * eines Sets durchgeht, muss das oben stehen – sonst lernt
             * jemand wochenlang am Anfang seines Setses und wundert sich,
             * warum die letzten Wörter nie kommen.
             */}
            {hinweis && (
                <p className={styles.hinweis} role="status">
                    {hinweis}
                </p>
            )}

            <p className={styles.tastaturTipp}>
                Leertaste zum Aufdecken · Tasten 1–4 zum Bewerten
            </p>
        </div>
    );
}
