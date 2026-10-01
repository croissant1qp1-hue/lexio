"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BEWERTUNGEN, type Bewertung, intervallVorschau } from "@/lib/lernlogik";
import { schwerChance } from "@/lib/reihenfolge";
import { farbeVonSprache, nameVonSprache, type SpracheInfo } from "@/lib/sprachen";
import { ApiFehler, holeJson, sendeJson } from "@/lib/api-client";
import { xpFormatieren } from "@/lib/profil";
import { spreche, stimmen, stoppe, tonVerfuegbar } from "@/lib/sprachausgabe";
import { LAUTSTÄRKE_VOLUMEN, liesTon, TON_SPEICHER } from "@/lib/ton";
import styles from "./lernen.module.css";

type Karte = {
    id: string;
    frage: string;
    antwort: string;
    /*
     * Seit Migration 005 optional. Deshalb nullable: die Haelfte der Karten in
     * einem gemischten Set stammt noch ohne Satz, und der Typ muss das sagen,
     * statt die Anzeige auf "" zu pruefen.
     */
    beispielsatz: string | null;
    beispielUebersetzung: string | null;
    stufe: number;
    gelernt: boolean;
    /**
     * Plan 1.7: erreicht diese Karte die Fehlerschwelle, ist sie eine
     * Problemskarte. Die Route setzt das Flag; die Seite zeigt damit eine
     * Markierung und erklärt, warum diese Karte nicht in der normalen
     * Rotation vorkommt.
     */
    leech: boolean;
    /**
     * Plan 1.8: wie schwer diese Karte laut dem Modell des Accounts ist
     * (0 = ganz leicht, 1 = ganz schwer). Kommt nur, wenn die Route ein
     * Modell trainieren konnte – der Wert ist optional, und ohne ihn faellt
     * die schwer-Chance auf ihre Basis zurueck.
     */
    schwierigkeit?: number;
};

/**
 * Das Set, wie /api/lernen es meldet.
 *
 * `sprache` ist seit 0.1 ein Objekt mit Code, Namen und Farben. Der Code wird
 * gleich fuer speechSynthesis gebraucht (1.3) – vorher muesste die Seite aus
 * einem deutschen Namen ("Englisch") erst erraten, welche Browserstimme passt.
 */
type SetInfo = { slug: string; name: string; sprache: SpracheInfo };

/** Antwort von /api/lernen. */
type LernAntwort = {
    set: SetInfo;
    karten: Karte[];
    faelligGesamt: number;
    /**
     * Bestand des Sets, karten.length ist die Runde. Ohne diese Zahl waere
     * ein leeres Lernfenster nicht zu unterscheiden von einem, in dem heute
     * nichts faellig ist – und "Nochmal lernen" wuerde bei einem wirklich
     * leeren Set als Sackgasse enden.
     */
    kartenGesamt: number;
    /** Nur gesetzt, wenn das Set groesser ist als die Lesegrenze der Route. */
    setZuGross?: boolean;
    hinweis?: string;
    /**
     * Von der Route gesetzt, wenn sie auf `?modus=ueben` ignored hat. Nur zum
     * Anzeigen: die Karten sind dieselben, es sind nur mehr und andere. Der
     * Endschirm braucht es, um "7 von 40 geschafft" nicht mit "Alles
     * geschafft" zu verwechseln.
     */
    uebungsmodus?: boolean;
    /**
     * Wie viele Karten des Sets die Fehlerschwelle erreicht haben (1.7). Die
     * Seite zeigt daraus den Hinweis "N Problemskarten sind ausgeblendet" –
     * mit dem Knopf, der sie trotzdem hereinhält.
     */
    leechAnzahl?: number;
    /** True, wenn die Runde über `?modus=leech` nur Problemskarten zeigt. */
    leechModus?: boolean;
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

export default function LernenSeite({
    setSlug,
    ueben = false,
    leech = false,
    rundeNr = 0,
}: {
    setSlug: string;
    /**
     * Aus `?modus=ueben` in der Adresse, nicht aus einem Klick. Ein Knopf im
     * Client wuerde den Zustand verlieren, sobald die Seite neu geladen wird
     * – und "Nochmal lernen" ist genau der Knopf, den man nach einem Fehler
     * oder einer Unterbrechung noch einmal braucht.
     */
    ueben?: boolean;
    /**
     * Aus `?modus=leech` (Plan 1.7). Die Runde zeigt dann nur die
     * ausgeschlossenen Problemskarten – der Gegenweg zum Hinweis auf der
     * normalen Ansicht.
     */
    leech?: boolean;
    /**
     * Zaehler der Wiederholungsrunden aus `?runde=`. Er gehoert in die
     * Abhaengigkeit des Ladeeffekts, damit "Weitere Runde" die Karten
     * wirklich neu holt statt dieselbe Server-Ausgabe noch einmal zu zeigen.
     * Sonst waere der Knopf eine Attrappe – und zwar eine, die man bemerkt.
     */
    rundeNr?: number;
}) {
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
     * Kommt von der Route, nicht von `ueben`: `ueben` sagt, was der Nutzer
     * angefragt hat, `uebungsmodus` sagt, was tatsaechlich geliefert wurde.
     * Bei einem leeren Set liefert die Route keine Karten, und dann waere
     * ein Knopf "Nochmal lernen" eine Sackgasse.
     */
    const [uebungsmodus, setUebungsmodus] = useState(false);

    /**
     * Plan 1.7. `leechModus` kommt von der Route (nur Problemskarten in
     * dieser Runde), `leechAnzahl` davon, wie viele Karten im Set die
     * Fehlerschwelle erreicht haben – Nulle dorthin? Nein: Nulle ist der
     * normale Alltag, und die Zahl wird nur angezeigt, wenn sie nicht 0 ist.
     */
    const [leechModus, setLeechModus] = useState(false);
    const [leechAnzahl, setLeechAnzahl] = useState(0);

    /**
     * Plan 1.8 – „zweimal schwer". Merkt sich, wie oft eine Karte in DIESER
     * Runde schon mit „schwer" beantwortet wurde (Schluessel: kartenId).
     * Die Eskalation rechnet damit: Wer dieselbe Karte zum zweiten Mal
     * „schwer" nennt, bekommt eine hoehere Chance, dass sie noch einmal
     * kommt. Beim Neustart der Runde wird der Zaehler geleert.
     */
    const schwerInRunde = useRef<Record<string, number>>({});

    /**
     * Rückgängig für die letzte Antwort (Plan 1.7). Gehalten wird der
     * Zustand VOR der Antwort: karten und index, damit die Karte bei der
     * Rücknahme wieder an ihren Platz rutscht. Die Bilanz wird über die
     * bewertung zurückgesetzt, die XP über den Wert, den die Route nach der
     * Datenbank-Rücknahme meldet.
     */
    const [letzteAntwort, setLetzteAntwort] = useState<{
        kartenId: string;
        bewertung: Bewertung;
        karten: Karte[];
        index: number;
    } | null>(null);

    /**
     * Wie viele Karten heute faellig sind – vor der Grenze von 20.
     *
     * `karten.length` ist die Runde, `faelligGesamt` ist der Stapel. Ohne die
     * zweite Zahl war "Sitzung geschafft" nach 20 Karten eine Aussage ueber
     * 47, und niemand konnte sehen, dass 27 liegen bleiben.
     */
    const [faelligGesamt, setFaelligGesamt] = useState(0);

    /**
     * Bestand des Sets, siehe `kartenGesamt` in der LernAntwort. Null heisst:
     * wirklich nichts angelegt, also kein "Nochmal lernen" anbieten.
     */
    const [kartenGesamt, setKartenGesamt] = useState(0);

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

    /*
     * Vorlesen (Plan 1.3).
     *
     * `tonDa` heisst nicht "der Browser kann sprechen", sondern "es gibt
     * ueberhaupt eine Stimme". Ohne Stimmenliste waere der Knopf ein
     * Kontakt, der nichts tut, und ein Knopf, der nichts tut, ist schlimmer
     * als kein Knopf. Die Liste wird einmal geholt und dann behalten: sie
     * aendert sich waehrend einer Sitzung nicht.
     */
    const [tonDa, setTonDa] = useState(false);
    const [spricht, setSpricht] = useState(false);

    /*
     * Geräte-Einstellung aus lib/ton.ts: ob und wie laut vorgelesen wird.
     * Hört auch auf `storage`, damit zwei Tabs sich nicht widersprechen –
     * die Einstellungen-Seite ändert den Stand im localStorage, und wenn
     * der Lern-Tab offen ist, soll die Wahl dort sofort gelten.
     */
    const [tonStand, setTonStand] = useState(() => liesTon());

    useEffect(() => {
        const beiAenderung = (e: StorageEvent) => {
            const istTon = e.storageArea === window.localStorage && (e.key === null || e.key === TON_SPEICHER);
            if (!istTon) return;
            const frisch = liesTon();
            if (!frisch.an) {
                // Töne aus: das laufende Sprechen stoppen. Ein laufender
                // Obergrenzen-Timer aus `vorlesen` stört nicht – er setzt
                // nur `setSpricht(false)`, was hier schon gilt.
                setSpricht(false);
                stoppe();
            }
            setTonStand(frisch);
        };
        window.addEventListener("storage", beiAenderung);
        return () => window.removeEventListener("storage", beiAenderung);
    }, []);

    useEffect(() => {
        let weg = false;
        if (!tonVerfuegbar()) return;
        /* Safari fuellt die Liste erst nach `voiceschanged`. */
        stimmen().then((liste) => {
            if (!weg) setTonDa(liste.length > 0);
        });
        return () => {
            weg = true;
            stoppe();
        };
    }, []);

    const neuStarten = useCallback(() => {
        setLaden(true);
        setFehler(null);
        setSpeicherFehler(null);
        setBilanz({ nochmal: 0, schwer: 0, gut: 0, einfach: 0 });
        stoppe();
        setSpricht(false);
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
                        `/api/lernen?set=${encodeURIComponent(setSlug)}${ueben ? "&modus=ueben" : ""}${leech ? "&modus=leech" : ""}`,
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
                setFaelligGesamt(daten.faelligGesamt ?? 0);
                setKartenGesamt(daten.kartenGesamt ?? 0);
                setUebungsmodus(daten.uebungsmodus === true);
                setLeechAnzahl(daten.leechAnzahl ?? 0);
                setLeechModus(daten.leechModus === true);
                setIndex(0);
                setAufgedeckt(false);
                setLetzteAntwort(null);
                // Neue Runde, neue Würfe: die schwer-Eskalation (1.8) startet frisch.
                schwerInRunde.current = {};
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
    }, [setSlug, runde, ueben, leech, rundeNr]);

    const karte = karten[index];
    const fertig = !laden && !fehler && karten.length > 0 && index >= karten.length;

    /**
     * Karte vorlesen: erst der Begriff, dann – wenn da – der Beispielsatz.
     *
     * Beides steht auf der Rückseite, und beides in der Zielsprache. Der
     * Beispielsatz gehoert dazu, weil ein Begriff ohne seinen Gebrauch
     * nichts zu lernen ist; er wird deshalb als zweiter Satz derselben
     * Ausgabe gequeue't statt in einem zweiten Klick.
     *
     * Zweiter Klick waehrend des Sprechens bricht ab. Sonst gibt es zwei
     * Wege zum Stoppen, und der ungedachte laeuft weiter.
     */
    const tonZeitueber = useRef<number | null>(null);

    const tonTimerRaumen = () => {
        if (tonZeitueber.current !== null) {
            window.clearTimeout(tonZeitueber.current);
            tonZeitueber.current = null;
        }
    };

    const vorlesen = useCallback(() => {
        if (!karte) return;
        if (!tonStand.an) return;
        if (spricht) {
            stoppe();
            setSpricht(false);
            return;
        }
        const teile = [karte.frage, karte.beispielsatz ?? ""];
        if (
            !spreche(
                teile,
                set?.sprache.code ?? null,
                () => setSpricht(false),
                LAUTSTÄRKE_VOLUMEN[tonStand.lautstaerke],
            )
        )
            return;
        setSpricht(true);
        /*
         * `onend` meldet das echte Ende in den meisten Browsern; die
         * Obergrenze ist der Rest fuer die, die es verschlucken (siehe
         * spreche). 30 Sekunden koennen nicht verfrueh abbrechen, sie
         * raeumen nur ein haengendes Icon ab. Der Timer wird beim naechsten
         * Sprechen und beim Stoppen geloescht, damit er keine fruehere
         * Runde ausbremst.
         */
        tonTimerRaumen();
        tonZeitueber.current = window.setTimeout(() => setSpricht(false), 30000);
    }, [karte, set, spricht, tonStand.an, tonStand.lautstaerke]);

    /*
     * Das Abbrechen haengt an den EREIGNISSEN, nicht an den Werten: Karte
     * gewechselt, umgedreht, Runde neu gestartet. Ein Effekt auf `index`
     * waere kuerzer, ruft aber setState im Effekt-Rumpf auf – und das ist
     * genau die Form, die beim Rendern einen zweiten Durchlauf erzwingt.
     */
    const tonAnhalten = useCallback(() => {
        tonTimerRaumen();
        setSpricht(false);
        stoppe();
    }, []);

    /** Umdrehen: die Karte wechselt die Seite, also auch die Stimme. */
    const umdrehen = useCallback(() => {
        tonAnhalten();
        setAufgedeckt((a) => !a);
    }, [tonAnhalten]);

    /** Aus der Bilanz abgeleitet, damit Anzeige und Zaehler nicht
     *  auseinanderlaufen koennen. */
    const sitzung = useMemo(() => {
        const beantwortet = bilanz.nochmal + bilanz.schwer + bilanz.gut + bilanz.einfach;
        /*
         * Trefferquote ehrlich (Plan 1.6): nur "gut" und "einfach" zaehlen
         * als richtig. Vorher war `richtig = beantwortet - nochmal` und
         * "schwer" zaehlte mit – wer immer "schwer" klickte, hatte 100 %.
         */
        const richtig = bilanz.gut + bilanz.einfach;
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
            tonAnhalten();

            /*
             * Plan 1.7: Stand VOR der Antwort merken, damit "Rückgängig"
             * die Karte zurückholen kann. Nicht der Server-Stand, sondern der
             * der Runde: bei "Nochmal" wandert die Karte ans Ende der
             * Schlange, und ohne diesen Schnappschuss wüsste die Rücknahme
             * nicht, wohin die Karte gehört.
             */
            const vorher = { karten, index };

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

                /*
                 * Erst jetzt ist die Antwort verbucht – hier beginnt die
                 * Undo-Kette. `vorher` stammt aus dem Moment VOR der
                 * Optimistik, und die Karten sind noch unveraendert in der
                 * Campsite: erst nach dem Erfolg darf das als "letzte
                 * Antwort" gelten. Ein Fehlschlag relaesst kein Rückgängig.
                 */
                setLetzteAntwort({ ...vorher, kartenId: karte.id, bewertung });

                /*
                 * Was mit der Karte in der Runde passiert (Plan 1.8):
                 *
                 * - „nochmal": bleibt in der Runde. Die Karte wandert ans
                 *   Ende der Schlange, `index` bleibt stehen: sie kommt
                 *   wieder, sooft sie nochmal mit „nochmal" beantwortet
                 *   wird – und jeder weitere Fehler erhoeht ihren Zaehler,
                 *   das Modell laesst sie kuenftig frueher ranken.
                 * - „schwer": nicht so oft wie „nochmal". Basis ist eine
                 *   Chance von 50 %, das Modell faerbt sie (schwere Karten
                 *   eher, leichte seltener), und eine zweite „schwer"- 
                 *   Bewertung derselben Karte in dieser Runde eskaliert.
                 * - „gut"/„einfach": die Karte ist durch, sie wandert mit
                 *   `index` weiter.
                 *
                 * Der Wuerfel faellt hier im Client, aber die WAHRSCHIN-
                 * LICHKEIT kommt aus lib/reihenfolge.ts – dort ist sie
                 * testbar und dort steht, warum sie so ist.
                 */
                if (bewertung === "nochmal") {
                    setKarten((liste) => [...liste.slice(index + 1), karte]);
                } else if (bewertung === "schwer") {
                    const vorherSchwer = schwerInRunde.current[karte.id] ?? 0;
                    schwerInRunde.current[karte.id] = vorherSchwer + 1;
                    const bleibt = Math.random() < schwerChance(karte.schwierigkeit, vorherSchwer);
                    if (bleibt) {
                        setKarten((liste) => [...liste.slice(index + 1), karte]);
                    } else {
                        setIndex((i) => i + 1);
                    }
                } else {
                    setIndex((i) => i + 1);
                }
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
        [karte, karten, senden, index, tonAnhalten],
    );

    /*
     * Rückgängig für die letzte Antwort (Plan 1.7).
     *
     * Der Server stellt den Stand der Karte vor der letzten Antwort wieder
     * her (letzte_antwort-Schnappschuss aus der Datenbank). Der Client holt
     * mit dem `vorher`-Schnappschuss die Karte an ihren Platz in der Runde
     * zurueck und nimmt die Bilanz zurueck.
     */
    const rueckgaengig = useCallback(async () => {
        if (!letzteAntwort || senden) return;
        setSenden(true);
        setSpeicherFehler(null);

        try {
            const antwort = await sendeJson<{
                erledigt?: boolean;
                xpGesamt?: number;
                streak?: number | null;
            }>("/api/lernen/antwort/rueckgaengig", { kartenId: letzteAntwort.kartenId });

            /*
             * Kein Schnappschuss mehr (z. B. anderer Tab, anderes Geraet
             * hat inzwischen geantwortet). Dann gibt es nichts, was der
             * Server zuruecknehmen koennte – also auch keine Abnahme im
             * Client. Ehrlich mitteilen statt stur die Runde zurueckspulen.
             */
            if (antwort.erledigt === false) {
                setSpeicherFehler(
                    "Diese Antwort kann nicht mehr zurückgenommen werden – woanders wurde inzwischen geantwortet.",
                );
                setLetzteAntwort(null);
                return;
            }

            setKarten(letzteAntwort.karten);
            setIndex(letzteAntwort.index);
            setAufgedeckt(false);
            // Plan 1.8: zurueckgenommene schwer-Wuerfe aus der Eskalation loeschen.
            if (letzteAntwort.bewertung === "schwer") {
                const vorher = schwerInRunde.current[letzteAntwort.kartenId] ?? 0;
                if (vorher <= 1) delete schwerInRunde.current[letzteAntwort.kartenId];
                else schwerInRunde.current[letzteAntwort.kartenId] = vorher - 1;
            }
            setBilanz((alt) => ({
                ...alt,
                [letzteAntwort.bewertung]: Math.max(0, alt[letzteAntwort.bewertung] - 1),
            }));
            /*
             * XP aus der Server-Nachricht: die Ruecknahme kann einen Tag
             * auf 0 XP zaehlen, und dann faellt auch der Streak. Der
             * aufkuemmernde Wert ist ohne Abfrage des Profils nicht
             * ratbar – die Antwort bringt ihn mit.
             */
            setPunkte((p) => ({
                xp: typeof antwort.xpGesamt === "number" ? antwort.xpGesamt : p.xp,
                streak: typeof antwort.streak === "number" ? antwort.streak : p.streak,
            }));
            setLetzteAntwort(null);
        } catch (antwortFehler) {
            setSpeicherFehler(
                antwortFehler instanceof ApiFehler
                    ? antwortFehler.message
                    : "Die Antwort konnte nicht zurückgenommen werden. Versuch es noch einmal.",
            );
        } finally {
            setSenden(false);
        }
    }, [letzteAntwort, senden]);

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
        /*
         * Leerer Stapel, aber das Set hat Karten: Heute ist einfach nichts
         * faellig. "Nochmal lernen" holt dieselben Karten als Wiederholung.
         */
        if (kartenGesamt > 0) {
            return (
                <div className={styles.seite}>
                    <div className={styles.ende}>
                        <span className={styles.endeZeichen} aria-hidden="true">
                            ☕
                        </span>
                        <h2 className={styles.endeTitel}>Alles gelernt</h2>
                        {/* Leerer Stapel. Im normalen Modus kann er lügen: fällig ist nichts,
                         * aber die ausgeblendeten Problemskarten existieren trotzdem –
                         * dann erklärt der Text sie und der Knopf darüber holt sie
                         * herein. */}
                        <p className={styles.endeText}>
                            {leechAnzahl > 0 && !leechModus ? (
                                <>
                                    Für {set?.name} sind heute keine neuen Karten fällig.{" "}
                                    {leechAnzahl}{" "}
                                    {leechAnzahl === 1 ? "Problemskarte wartet" : "Problemskarten warten"}{" "}
                                    allerdings darauf, geübt zu werden.
                                </>
                            ) : (
                                <>
                                    Für {set?.name} sind heute keine Karten fällig. Komm später wieder – dann
                                    wartet der nächste Stapel.
                                </>
                            )}
                        </p>
                        {/*
                         * Im normalen Modus ist ein leerer Stapel kein Grund, die
                         * Seite zu verlassen: "Nochmal lernen" holt dieselben Karten
                         * als Wiederholung (modus=ueben).
                         */}
                        <button
                            type="button"
                            className={styles.knopf}
                            onClick={() => router.push(`/lernen/${setSlug}?modus=ueben`)}
                        >
                            Nochmal lernen
                        </button>
                        {/*
                         * Alle fälligen Karten sind ausgeblendete
                         * Problemskarten: "Alles gelernt" stimmt dann nicht –
                         * es gibt nichts zum Lernen, wohl aber zum Üben. Der
                         * Weg dorthin darf nicht fehlen, sonst stünde die
                         * Knopfkette hinter einer leeren Seite.
                         */}
                        {leechAnzahl > 0 && !leechModus && (
                            <button
                                type="button"
                                className={styles.knopfLeise}
                                onClick={() => router.push(`/lernen/${setSlug}?modus=leech`)}
                            >
                                Problemskarten üben
                            </button>
                        )}
                        <button
                            type="button"
                            className={styles.knopfText}
                            onClick={() => router.push(`/wortschatz/${setSlug}`)}
                        >
                            Alle Vokabeln ansehen
                        </button>
                        <button type="button" className={styles.knopfLeise} onClick={() => router.push("/")}>
                            Zur Übersicht
                        </button>
                    </div>
                </div>
            );
        }

        /*
         * Leerer Stapel UND keine Karten: Das Set ist angelegt, aber leer.
         *
         * Beide Faelle liefern `karten: []` aus der API, und beide sahen
         * deshalb vorher wie derselbe aus – mit dem Text "Alles gelernt"
         * und, weil der Knopf an `kartenGesamt > 0` hing, ohne jede
         * Moeglichkeit weiterzukommen. Das war die gemeldete Sackgasse: ein
         * eigenes Set anlegen, den Hinzufuegen-Wizard verlassen, und dann
         * bekommt man eine tellscheuende Gliederung mit Totenkopf-Kaffee.
         *
         * "Alles gelernt" waere hier schlicht falsch. Es wurde nichts
         * gelernt, es gibt nichts zu lernen. Der Weg fuehrt deshalb zum
         * Set zurueck, wo "Vokabeln hinzufuegen" steht – nicht mitten in
         * den Wizard, der haengt an Schritt 2 und dort erst die Sprache
         * abfragt, obwohl das Set sie schon hat.
         */
        return (
            <div className={styles.seite}>
                <div className={styles.ende}>
                    <span className={styles.endeZeichen} aria-hidden="true">
                        📝
                    </span>
                    <h2 className={styles.endeTitel}>Noch keine Vokabeln</h2>
                    <p className={styles.endeText}>
                        {set?.name} ist angelegt, enthält aber noch keine Wortpaare. Füge Vokabeln
                        hinzu, dann kannst du mit dem Lernen anfangen.
                    </p>
                    <button
                        type="button"
                        className={styles.knopf}
                        onClick={() => router.push("/karteikarten")}
                    >
                        Vokabeln hinzufügen
                    </button>
                    <button type="button" className={styles.knopfLeise} onClick={() => router.push("/")}>
                        Zur Übersicht
                    </button>
                </div>
            </div>
        );
    }

    /*
     * Was nach der Runde noch da ist. `faelligGesamt` ist der Stapel von
     * heute, `karten.length` die Runde davon (maximal 20). Die Differenz ist
     * die Zahl, die vorher nirgends stand.
     */
    const uebrig = Math.max(0, faelligGesamt - karten.length);

    if (fertig) {
        return (
            <div className={styles.seite}>
                <div className={styles.ende}>
                    <span className={styles.endeZeichen} aria-hidden="true">
                        {uebrig > 0 ? "🎉" : "🏁"}
                    </span>
                    <h2 className={styles.endeTitel}>
                        {uebrig > 0
                            ? "Runde geschafft"
                            : uebungsmodus
                              ? "Wiederholt"
                              : leechModus
                                ? "Probleme geübt"
                                : "Alles geschafft"}
                    </h2>
                    <p className={styles.endeText}>
                        {uebrig > 0 ? (
                            <>
                                {karten.length} von {faelligGesamt} geschafft – {uebrig}{" "}
                                {uebrig === 1 ? "bleibt" : "bleiben"} noch.
                                {leechModus
                                    ? " Der Rest folgt im nächsten Problemschub."
                                    : uebungsmodus
                                      ? " Der Rest folgt beim nächsten Mal."
                                      : " Morgen geht es weiter."}
                            </>
                        ) : leechModus ? (
                            <>
                                {karten.length} {karten.length === 1 ? "Problemskarte" : "Problemskarten"}{" "}
                                aus {set?.name} durchgehalten. Morgen rücken sie wieder mit dem normalen
                                Stapel an – die Schwelle zählt weiter.
                            </>
                        ) : uebungsmodus ? (
                            <>
                                {karten.length} {karten.length === 1 ? "Karte" : "Karten"} aus{" "}
                                {set?.name} nochmal durchgegangen. Jede Antwort zählt wie beim
                                Lernen: sichere Karten rücken weiter hinaus, unsichere kommen
                                früher wieder.
                            </>
                        ) : (
                            <>
                                {karten.length} {karten.length === 1 ? "Karte" : "Karten"} in{" "}
                                {set?.name}. Für heute ist nichts mehr fällig.
                            </>
                        )}
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
                    {/*
                     * "Nochmal lernen" nur im normalen Modus. Im Uebungsmodus
                     * waere "Noch eine Runde" dasselbe in zwei Worten – und
                     * `neuStarten` laedt dieselben 40 Karten noch einmal, was
                     * sich anfuehlt wie ein Fehler.
                     */}
                    {/* Leech-Runden haben dieselbe Kartenbegrenzung wie Übungsrunden:
                     also auch hier eine echte neue Runde statt neuStarten. */}
                    {uebungsmodus || leechModus ? (
                        <button
                            type="button"
                            className={styles.knopf}
                            onClick={() =>
                                router.push(
                                    `/lernen/${setSlug}?modus=${uebungsmodus ? "ueben" : "leech"}&runde=${
                                        rundeNr + 1
                                    }`,
                                )
                            }
                        >
                            Weitere Runde
                        </button>
                    ) : (
                        <button type="button" className={styles.knopf} onClick={neuStarten}>
                            Noch eine Runde
                        </button>
                    )}
                    {letzteAntwort && (
                        <button
                            type="button"
                            className={styles.knopfLeise}
                            onClick={() => void rueckgaengig()}
                            disabled={senden}
                        >
                            Letzte Antwort zurücknehmen
                        </button>
                    )}
                    {/*
                     * Normale Runde zu Ende, aber es liegen noch versteckte
                     * Problemskarten. "Alles geschafft" stimmt für den
                     * Stapel, nicht fürs Set – der Weg zu den Problemen darf
                     * nicht fehlen, sonst verschwinden sie hinter dem Feiern.
                     */}
                    {leechAnzahl > 0 && !leechModus && (
                        <button
                            type="button"
                            className={styles.knopfLeise}
                            onClick={() => router.push(`/lernen/${setSlug}?modus=leech`)}
                        >
                            Problemskarten üben
                        </button>
                    )}
                    <button type="button" className={styles.knopfLeise} onClick={() => router.push("/")}>
                        Zur Übersicht
                    </button>
                </div>
            </div>
        );
    }

    const anteil = Math.round((index / karten.length) * 100);
    const farbe = set ? farbeVonSprache(set.sprache).flaeche : undefined;
    const sprachName = set ? nameVonSprache(set.sprache) : "";

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
                    onClick={umdrehen}
                    aria-label={aufgedeckt ? "Antwort verbergen" : "Antwort aufdecken"}
                    aria-pressed={aufgedeckt}
                >
                    <span className={styles.karteBuehne}>
                        <span className={styles.karteInnen}>
                            {/* NUR EINE Ebene, und React entscheidet, ob die
                                Uebersetzung oder der Begriff darin steht.
                                Frueher lagen hier zwei Ebenen uebereinander,
                                die sich ueber `backface-visibility`
                                gegenseitig versteckt haben. In Firefox hat
                                das nicht funktioniert: der Button dazwischen
                                flachdrueckt den 3D-Kontext, und beide Texte
                                lagen sichtbar aufeinander. So kann es nicht
                                mehr passieren – es ist nur einer im DOM.
                                Siehe Kopfkommentar in lernen.module.css. */}
                            <span
                                className={`${styles.kartenSeite} ${
                                    aufgedeckt ? styles.kartenSeiteHinten : ""
                                }`}
                            >
                                {aufgedeckt ? (
                                    <>
                                        <span className={styles.karteLabel}>Begriff</span>
                                        <span className={styles.karteText}>{karte.frage}</span>
                                        {karte.beispielsatz && (
                                            <span className={styles.karteBeispiel}>
                                                {karte.beispielsatz}
                                            </span>
                                        )}

                                        {/*
                                         * Vorlesen.
                                         *
                                         * `role="button"` auf einem span, KEIN
                                         * <button>: die Karte ist selbst ein
                                         * <button>, und ein Knopf in einem
                                         * Knopf ist ungueltiges HTML – React
                                         * warnt mit validateDOMNesting, und die
                                         * Bedienung mit der Tastatur ist
                                         * dann von der des Knopfes abhaengig.
                                         * So bleibt die Karte der einzige
                                         * echte Knopf, und der Lautsprecher
                                         * bringt seine eigene Tastaturbedienung
                                         * mit (Enter und Leertaste), weil ein
                                         * role-Button sonst gar nicht
                                         * bedienbar waere.
                                         *
                                         * `stopPropagation` in beiden
                                         * Handlern: ohne das dreht sich beim
                                         * Vorlesen die Karte gleich mit, und
                                         * man hoert den Begriff, waehrend
                                         * vor einem die Uebersetzung steht.
                                         */}
                                        {tonDa && tonStand.an && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                className={`${styles.karteTon} ${
                                                    spricht ? styles.karteTonAktiv : ""
                                                }`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    vorlesen();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key !== "Enter" && e.key !== " ") return;
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    vorlesen();
                                                }}
                                                aria-label={`${karte.frage} vorlesen`}
                                                title="Vorlesen"
                                            >
                                                <svg
                                                    viewBox="0 0 24 24"
                                                    width="20"
                                                    height="20"
                                                    aria-hidden="true"
                                                    focusable="false"
                                                >
                                                    <path
                                                        d="M4 9v6h4l5 4V5L8 9H4z"
                                                        fill="currentColor"
                                                    />
                                                    {spricht ? (
                                                        <path
                                                            d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            fill="none"
                                                        />
                                                    ) : (
                                                        <path
                                                            d="M16.5 8.5a5 5 0 0 1 0 7"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            fill="none"
                                                        />
                                                    )}
                                                </svg>
                                            </span>
                                        )}

                                        <span className={styles.karteZeichen}>
                                            <Image
                                                src="/images/karte/globe.svg"
                                                alt=""
                                                width={26}
                                                height={26}
                                                className={styles.karteZeichenBild}
                                            />
                                            <span className={styles.karteZeichenText}>{sprachName}</span>
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className={styles.karteLabel}>Übersetzung</span>
                                        <span className={styles.karteText}>{karte.antwort}</span>
                                        {/*
                                         * Der Satz auf Deutsch steht auf der
                                         * Vorderseite. Er ist kein Spoiler,
                                         * sondern der Gebrauch, in dem das
                                         * deutsche Wort vorkommt; aufgedeckt
                                         * wuerde er der Fremdsprache
                                         * zuordnen, was er nicht ist.
                                         */}
                                        {karte.beispielUebersetzung && (
                                            <span className={styles.karteBeispiel}>
                                                {karte.beispielUebersetzung}
                                            </span>
                                        )}
                                        <span className={styles.karteTipp}>Tippen zum Aufdecken</span>

                                        {karte.leech && (
                                            <span className={styles.karteProblemskarte}>
                                                Problemskarte
                                            </span>
                                        )}

                                        {karte.stufe > 0 && (
                                            <span
                                                className={styles.stufePunkte}
                                                aria-label={`Lernstufe ${karte.stufe}`}
                                            >
                                                {Array.from({
                                                    length: Math.min(karte.stufe, 5),
                                                }).map((_, i) => (
                                                    <span key={i} className={styles.stufePunkt} />
                                                ))}
                                            </span>
                                        )}
                                    </>
                                )}
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

            {/*
             * Rückgängig (Plan 1.7): die letzte Antwort zurücknehmen. Der
             * Knopf erscheint nur, wenn es eine gibt – und die Antwort auf
             * einer Karte löst nicht sofort die nächste aus, also führt
             * "Rückgängig" die Runde an den vorherigen Stand zurück.
             */}
            {letzteAntwort && (
                <div className={styles.undoleiste}>
                    <button
                        type="button"
                        className={styles.undo}
                        onClick={() => void rueckgaengig()}
                        disabled={senden}
                    >
                        Letzte Antwort zurücknehmen
                    </button>
                </div>
            )}

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

            {/*
             * Plan 1.7: normale Runde, aber es gibt ausgeblendete
             * Problemskarten. Sie stehen NICHT faellig, also kauft sich der
             * Hinweis nicht mit dem Fortschritt – er erklärt nur, warum
             * nicht alles dabei ist, und zeigt den Weg, sie trotzdem zu
             * üben. Im leechModus selbst hat er nichts zu suchen, und im
             * Übungsmodus zählen die Problemskarten ja mit – dann ist
             * nichts ausgeblendet.
             */}
            {leechAnzahl > 0 && !leechModus && !uebungsmodus && (
                <div className={styles.leechHinweis} role="status">
                    <span>
                        {leechAnzahl}{" "}
                        {leechAnzahl === 1
                            ? "Problemskarte ist ausgeblendet."
                            : "Problemskarten sind ausgeblendet."}
                    </span>
                    <button
                        type="button"
                        className={styles.leechKnopf}
                        onClick={() => router.push(`/lernen/${setSlug}?modus=leech`)}
                    >
                        Trotzdem üben
                    </button>
                </div>
            )}

            <p className={styles.tastaturTipp}>
                Leertaste zum Aufdecken · Tasten 1–4 zum Bewerten
            </p>
        </div>
    );
}
