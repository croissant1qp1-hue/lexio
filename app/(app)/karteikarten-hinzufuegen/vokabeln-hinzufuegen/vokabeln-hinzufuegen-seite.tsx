"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { farbeVonSprache, type Sprache, type SpracheInfo } from "@/lib/sprachen";
import { holeJson, sendeJson, ApiFehler } from "@/lib/api-client";
import styles from "./vokabeln-hinzufuegen.module.css";
import SprachAuswahl from "./sprach-auswahl";

type Status = "idle" | "speichert" | "fehler";

type SetZeile = {
    id: string;
    name: string;
    /** Seit 0.1 ein Objekt aus public.sprachen, kein Freitext. */
    sprache: SpracheInfo;
    kartenGesamt: number;
    /**
     * true = gehoert dieser Person und darf befuellt werden.
     *
     * Nicht optional. Mit `eigen?` waere ein fehlendes Feld kein Fehler,
     * sondern `undefined`, und `filter(s => s.eigen)` wuerde dann jedes Set
     * aussortieren: die eigene Liste waere leer, alle Sets landeten bei den
     * Demos, und die Seite erklaerte, es gebe nichts. Die Oberflaeche
     * entscheidet an dieser Stelle, ob jemand seine Woerter speichern kann –
     * da gehoert ein fehlendes Feld zu einem Fehler.
     */
    eigen: boolean;
};

/*
 * `beispiel` und `beispielUebersetzung` heissen hier anders als in der API.
 * Das Formular benutzt camelCase wie der Rest der Oberflaeche, die Spalten in
 * Postgres sind snake_case. Die Umbenennung passiert genau an einer Stelle,
 * beim Senden – sonst muesste man an beiden Enden daran denken.
 */
type Paar = { frage: string; antwort: string; beispiel: string; beispielUebersetzung: string };

const LEER: Paar = { frage: "", antwort: "", beispiel: "", beispielUebersetzung: "" };

/** Kennung fuer "neues Set" in der Auswahl. Kein Slug, also keine Kollision. */
const NEUES_SET = "__neu__";

const MAX_NAME = 60;

const SCHRITT_TITEL = {
    1: "Wort hinzufügen",
    2: "Wörter eingeben",
    3: "Name vergeben",
} as const;

type Schritt = 1 | 2 | 3;

/** Fehlerschluessel: ein Objekt pro Feld, wie es die API zurueckgibt. */
type Fehler = Record<string, string>;

/**
 * Drei Schritte, ein Formular:
 *
 *   1  Set waehlen – eigenes Set oder "Neues Set"
 *   2  Wortpaare eingeben, mehrere auf einmal
 *   3  Name und Sprache bestaetigen und speichern
 *
 * Der Namensschritt kommt bewusst ans Ende. Wer zehn Woerter getippt hat,
 * hat die Arbeit getan; ein Abbruch in Schritt 2 kostet dadurch nichts.
 *
 * Bleibt der Name in Schritt 3 unveraendert, landen die Karten im gewaehlten
 * Set. Ein geaenderter Name legt ein neues Set an – das bestehende bleibt
 * unangetastet. So kann man jederzeit eine Kopie eines Sets anlegen.
 */
export default function VokabelnHinzufuegenSeite() {
    const router = useRouter();

    const [sets, setSets] = useState<SetZeile[]>([]);
    const [setsGeladen, setSetsGeladen] = useState(false);
    /** Die feste Sprachliste. Ohne sie laesst sich kein neues Set anlegen. */
    const [sprachListe, setSprachListe] = useState<Sprache[]>([]);
    const [sprachFehler, setSprachFehler] = useState<string | null>(null);
    const [schritt, setSchritt] = useState<Schritt>(1);

    /** null = nichts gewaehlt, NEUES_SET = neues Set, sonst der Slug. */
    const [auswahl, setAuswahl] = useState<string | null>(null);
    const [paare, setPaare] = useState<Paar[]>([{ ...LEER }]);
    const [setName, setSetName] = useState("");
    /** Die Sprache als Code aus public.sprachen. null = noch keine gewaehlt. */
    const [spracheCode, setSpracheCode] = useState<string | null>(null);

    const [status, setStatus] = useState<Status>("idle");
    const [fehler, setFehler] = useState<Fehler>({});
    const [zaehler, setZaehler] = useState(0);
    const [fertig, setFertig] = useState<{ name: string; slug: string; anzahl: number } | null>(null);

    const ersteFrageRef = useRef<HTMLInputElement>(null);

    /*
     * Die Sprachliste kommt getrennt von den Sets. Sie ist ein fester Katalog
     * aus der Datenbank, kein Zustand dieser Person, und sie wird auch dann
     * gebraucht, wenn es noch kein einziges eigenes Set gibt – das ist genau
     * der Fall, in dem jemand sein erstes Set anlegt.
     */
    useEffect(() => {
        let abgebrochen = false;
        holeJson<Sprache[] | null>("/api/sprachen", null)
            .then((daten) => {
                if (abgebrochen) return;
                setSprachListe(daten ?? []);
            })
            .catch((f) => {
                if (abgebrochen) return;
                /*
                 * 503 wird auch mit Ersatzwert geworfen – hier ist das
                 * richtig: Die Meldung nennt die fehlende Migration, und genau
                 * die braucht der Nutzer. Eine leere Liste ohne Erklaerung
                 * waere ein Auswahlfeld, das sich nicht bedienen laesst.
                 */
                setSprachFehler(
                    f instanceof ApiFehler
                        ? f.message
                        : "Die Sprachliste konnte nicht geladen werden.",
                );
            });
        return () => {
            abgebrochen = true;
        };
    }, []);

    useEffect(() => {
        let abgebrochen = false;
        holeJson<SetZeile[] | null>("/api/karteikarten", null)
            .then((daten) => {
                if (abgebrochen) return;
                setSets(daten ?? []);
            })
            .catch(() => {
                if (abgebrochen) return;
                setSets([]);
            })
            .finally(() => {
                if (!abgebrochen) setSetsGeladen(true);
            });
        return () => {
            abgebrochen = true;
        };
    }, []);

    /*
     * Getrennt nach "darf ich" und "darf ich nicht".
     *
     * Vorher standen alle Sets in einer Liste, und der Server lehnte das
     * Speichern in ein Demoset mit einem 403 ab. Die Person hatte also zehn
     * Woerter eingetippt, geklickt, und dann eine Meldung bekommen, die
     * erklaert, dass sie die ganze Arbeit nicht speichern kann. Die
     * Demodaten stehen jetzt getrennt und nur mit dem Hinweis, dass man sie
     * kopieren kann.
     */
    const eigeneSets = useMemo(() => sets.filter((s) => s.eigen), [sets]);
    const demoSets = useMemo(() => sets.filter((s) => !s.eigen), [sets]);

    const gewaehltesSet = useMemo(
        () => eigeneSets.find((s) => s.id === auswahl) ?? null,
        [eigeneSets, auswahl],
    );

    /** Beim Kopieren wird der Name vorbelegt, sonst sucht man ihn nicht. */
    const kopieName = (set: SetZeile) => {
        const ohneSuffix = set.name.replace(/\s*\(Kopie(\s+\d+)?\)\s*$/, "");
        return `${ohneSuffix} (Kopie)`.slice(0, MAX_NAME);
    };

    const gefuelltePaare = useMemo(
        () => paare.filter((p) => p.frage.trim() !== "" || p.antwort.trim() !== ""),
        [paare],
    );

    /** Index der ersten unvollstaendigen Zeile, fuer die Fehlermeldung. */
    const unvollstaendigIndex = useMemo(
        () => gefuelltePaare.findIndex((p) => !p.frage.trim() || !p.antwort.trim()),
        [gefuelltePaare],
    );

    /** Fehler eines Feldes, egal ob lokal oder vom Server gesetzt. */
    const feldFehler = (index: number, feld: keyof Paar) =>
        fehler[`${feld}.${index}`] ?? (index === 0 ? fehler[feld] : undefined);

    /**
     * Laesst nur die uebrigen Meldungen stehen.
     *
     * /api/karten nummeriert die Fehler nach dem, was wirklich gesendet
     * wurde – also nach den gefuellten Zeilen. Die Anzeige nummeriert nach
     * allen Zeilen. Sobald eine leere Zeile dazwischensteht, zeigen beide
     * Nummern auf verschiedene Felder. Deshalb werden Feldmarkierungen beim
     * Bearbeiten pauschal verworfen, statt sie umzurechnen.
     */
    const ohneFeldfehler = (alt: Fehler): Fehler =>
        Object.fromEntries(
            Object.entries(alt).filter(
                /*
                 * Beide Schreibweisen: die lokalen Felder heissen camelCase,
                 * die API meldet snake_case. Sonst bliebe eine Laengenmarkierung
                 * am Beispielsatz stehen, obwohl der Satz laengst gekuerzt wurde.
                 */
                ([schluessel]) =>
                    !/^(frage|antwort|beispiel|beispielUebersetzung|beispielsatz|beispiel_uebersetzung)(\.|$)/.test(
                        schluessel,
                    ),
            ),
        );

    function waehlen(wert: string | null) {
        setAuswahl(wert);
        setFehler({});
        setStatus("idle");

        // Sprache vorbelegen, sobald ein eigenes Set gewaehlt ist. Fuer ein
        // neues Set bleibt der Wert des ersten eigenen Sets als Startwert –
        // sichtbar und aenderbar, nicht stillschweigend geraten.
        const ziel = eigeneSets.find((s) => s.id === wert);
        if (ziel) setSpracheCode(ziel.sprache.code);
        else if (wert === NEUES_SET && eigeneSets.length > 0) {
            setSpracheCode(eigeneSets[0].sprache.code);
        }
    }

    function demoKopieren(set: SetZeile) {
        setAuswahl(NEUES_SET);
        setSetName(kopieName(set));
        setSpracheCode(set.sprache.code);
        setFehler({});
        setStatus("idle");
        setSchritt(2);
        window.setTimeout(() => ersteFrageRef.current?.focus(), 60);
    }

    function paarAendern(index: number, feld: keyof Paar, wert: string) {
        setPaare((alt) => alt.map((p, i) => (i === index ? { ...p, [feld]: wert } : p)));
        // Beim Tippen die alte Feldmarkierung wegräumen, sonst bleibt der
        // rote Rand an einer Zeile stehen, die längst in Ordnung ist. Index
        // passt hier nicht als Filter: die Serverindizes zählen nur gefüllte
        // Zeilen, die Anzeigeindizes zählen alle.
        setFehler(ohneFeldfehler);
    }

    function paarEntfernen(index: number) {
        setPaare((alt) => {
            const neu = alt.filter((_, i) => i !== index);
            // Die letzte Zeile bleibt immer stehen, sonst steht man vor einer
            // leeren Seite und weiss nicht, wohin tippen soll.
            return neu.length > 0 ? neu : [{ ...LEER }];
        });
        /*
         * Alle Feldmarkierungen loeschen. Nach dem Entfernen verschieben sich
         * die Indizes, und eine Meldung an Zeile 3 saehe plötzlich an Zeile 2
         * aus – bei zehn Zeilen ein ziemlich irritierender Fehler.
         */
        setFehler(ohneFeldfehler);
    }

    function paarHinzufuegen() {
        setPaare((alt) => [...alt, { ...LEER }]);
        // Nach dem Rendern des neuen Feldes hineinspringen. Ohne den Timeout
        // zeigt der Browser noch das alte, kuerzere Formular.
        window.setTimeout(() => {
            const felder = document.querySelectorAll<HTMLInputElement>(
                `[data-paar-index="${paare.length}"] input`,
            );
            felder[0]?.focus();
        }, 0);
    }

    function zurueck() {
        setFehler({});
        setStatus("idle");
        setSchritt((s) => (s === 1 ? 1 : ((s - 1) as Schritt)));
    }

    function weiter() {
        setFehler({});

        if (schritt === 1) {
            if (!auswahl) {
                setFehler({ auswahl: "Wähle ein Set oder lege ein neues an." });
                return;
            }
            setSchritt(2);
            // Erst nach dem Schrittwechsel fokussieren, sonst existiert das
            // Eingabefeld noch gar nicht.
            window.setTimeout(() => ersteFrageRef.current?.focus(), 60);
            return;
        }

        if (schritt === 2) {
            if (gefuelltePaare.length === 0) {
                setFehler({ paare: "Trage mindestens ein Wortpaar ein." });
                return;
            }
            // Halb ausgefuellte Zeilen abfangen, bevor gespeichert wird. Die
            // Meldung nennt das Feld, das fehlt – nicht "Paar 3", denn bei
            // zehn Zeilen weiss man dann immer noch nicht, welches.
            if (unvollstaendigIndex >= 0) {
                const zeile = gefuelltePaare[unvollstaendigIndex];
                setFehler({
                    [`${!zeile.frage.trim() ? "frage" : "antwort"}.${unvollstaendigIndex}`]:
                        !zeile.frage.trim()
                            ? "Der Begriff fehlt."
                            : "Die Übersetzung fehlt.",
                });
                return;
            }

            setSetName(gewaehltesSet ? gewaehltesSet.name : "");
            setSchritt(3);
            return;
        }
    }

    async function speichern() {
        if (status === "speichert" || gefuelltePaare.length === 0) return;

        const name = setName.trim();

        const neu: Fehler = {};

        if (!name) neu.name = "Das Set braucht einen Namen.";
        else if (name.length > MAX_NAME) neu.name = `Maximal ${MAX_NAME} Zeichen`;

        /*
         * Die Sprache wird nur abgefragt, wenn tatsaechlich ein neues Set
         * entsteht. Beim Speichern in ein bestehendes Set waere sie eine
         * zweite, widerspruechliche Angabe: /api/sets wuerde sie beim
         * Anlegen gebraucht, /api/karten beim Befuellen nicht.
         */
        const legtNeuesSetAn = !gewaehltesSet || name !== gewaehltesSet.name.trim();

        if (legtNeuesSetAn && !spracheCode) {
            neu.sprache = "Welche Sprache?";
        }

        if (Object.keys(neu).length > 0) {
            setFehler(neu);
            return;
        }

        setStatus("speichert");
        setFehler({});

        try {
            // Name unveraendert + bestehendes Set -> direkt hineinspeichern.
            // Sonst ein neues Set anlegen und dorthin speichern.
            let slug = legtNeuesSetAn ? null : gewaehltesSet!.id;

            if (!slug) {
                const daten = await sendeJson<{ set: { slug: string } }>("/api/sets", {
                    name,
                    spracheCode,
                });
                slug = daten.set.slug;
            }

            await sendeJson("/api/karten", {
                setSlug: slug,
                paare: gefuelltePaare.map((p) => ({
                    frage: p.frage.trim(),
                    antwort: p.antwort.trim(),
                    /*
                     * Leere Beispielsätze gehen als null raus, nicht als "". Sonst
                     * stuende in der Datenbank spaeter ein leerer String, den die
                     * Lernseite erst als "Satz vorhanden" erkennen muesste.
                     */
                    beispielsatz: p.beispiel.trim() || null,
                    beispiel_uebersetzung: p.beispielUebersetzung.trim() || null,
                })),
            });

            /*
             * Liste neu laden, damit "Noch mehr Wörter" in Schritt 2 den
             * gerade angelegten Set-Namen zeigt. Ohne Ersatzwert: ein stilles
             * "[]" wuerde hier als Erfolg durchgehen, und die Meldung waere
             * "gespeichert", obwohl die Anzeige danach leer ist.
             */
            setSets(await holeJson<SetZeile[]>("/api/karteikarten"));
            setZaehler((z) => z + gefuelltePaare.length);
            setFertig({ name, slug, anzahl: gefuelltePaare.length });
            setAuswahl(slug);
        } catch (fehler) {
            /*
             * Bei einem Feldfehler (unvollstaendiges Paar) zurueck in Schritt
             * 2 und das betroffene Feld markieren. Sonst bleibt man in
             * Schritt 3 stehen und bekommt eine Meldung zu einem Feld, das
             * gar nicht sichtbar ist.
             */
            if (fehler instanceof ApiFehler && Object.keys(fehler.felder).length > 0) {
                setFehler(fehler.felder);
                setStatus("idle");
                setSchritt(2);
                return;
            }

            setFehler({
                form:
                    fehler instanceof ApiFehler
                        ? fehler.message
                        : "Keine Verbindung zum Server. Bitte erneut versuchen.",
            });
            setStatus("fehler");
        }
    }

    // ------------------------------------------------------------- Erfolg

    if (fertig) {
        return (
            <div className={styles.seite}>
                <header className={styles.kopf}>
                    <button
                        type="button"
                        className={styles.zurueck}
                        onClick={() => router.push("/")}
                        aria-label="Zurück zur Übersicht"
                    >
                        <svg
                            viewBox="0 -960 960 960"
                            width="22"
                            height="22"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                        </svg>
                    </button>
                    <div>
                        <h2 className={styles.titel}>Gespeichert</h2>
                        <p className={styles.untertitel}>
                            {fertig.anzahl} {fertig.anzahl === 1 ? "Wort" : "Wörter"} in {fertig.name}
                        </p>
                    </div>
                </header>

                <div className={styles.form}>
                    <div className={styles.kopfzeile}>
                        <span className={styles.punkt} style={{ backgroundColor: "var(--sage)" }} />
                        {fertig.name} ist bereit
                    </div>
                    <p className={styles.hinweis}>
                        Das Set landet auf deiner Übersicht. Von dort kannst du lernen oder es wieder
                        löschen.
                    </p>
                    <button
                        type="button"
                        className={styles.speichern}
                        onClick={() => router.push(`/lernen/${fertig.slug}`)}
                    >
                        Jetzt lernen
                    </button>
                    <button type="button" className={styles.weiter} onClick={() => router.push("/")}>
                        Zur Übersicht
                    </button>
                    <button
                        type="button"
                        className={styles.weiter}
                        onClick={() => {
                            setFertig(null);
                            setPaare([{ ...LEER }]);
                            setSchritt(2);
                        }}
                    >
                        Noch mehr Wörter
                    </button>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------- Schritt 1

    if (schritt === 1) {
        return (
            <div className={styles.seite}>
                <header className={styles.kopf}>
                    <button
                        type="button"
                        className={styles.zurueck}
                        onClick={() => router.push("/")}
                        aria-label="Zurück zur Übersicht"
                    >
                        <svg
                            viewBox="0 -960 960 960"
                            width="22"
                            height="22"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                        </svg>
                    </button>
                    <div>
                        <h2 className={styles.titel}>{SCHRITT_TITEL[1]}</h2>
                        <p className={styles.untertitel}>
                            {zaehler > 0
                                ? `${zaehler} ${zaehler === 1 ? "Wort gespeichert" : "Wörter gespeichert"}`
                                : "Wähle ein Set oder lege ein neues an."}
                        </p>
                    </div>
                </header>

                {!setsGeladen ? (
                    <div className={styles.sprachen} aria-hidden="true">
                        <div className={styles.sprache} style={{ opacity: 0.4 }} />
                        <div className={styles.sprache} style={{ opacity: 0.4 }} />
                        <div className={styles.sprache} style={{ opacity: 0.4 }} />
                    </div>
                ) : (
                    <div className={styles.sprachen}>
                        {/* Neues Set zuerst: fuer die meisten ist es das, was
                            sie wollen, und es ist der einzige Weg, wenn noch
                            kein eigenes Set existiert. */}
                        <button
                            type="button"
                            className={`${styles.sprache} ${styles.spracheNeu} ${
                                auswahl === NEUES_SET ? styles.spracheAktiv : ""
                            }`}
                            onClick={() => waehlen(auswahl === NEUES_SET ? null : NEUES_SET)}
                            aria-pressed={auswahl === NEUES_SET}
                        >
                            ＋ Neues Set
                        </button>

                        {eigeneSets.map((set) => {
                            const aktiv = auswahl === set.id;
                            return (
                                <button
                                    key={set.id}
                                    type="button"
                                    className={`${styles.sprache} ${aktiv ? styles.spracheAktiv : ""}`}
                                    style={{
                                        backgroundColor:
                                            farbeVonSprache(set.sprache).flaeche ?? "var(--bg-elevated)",
                                    }}
                                    onClick={() => waehlen(aktiv ? null : set.id)}
                                    aria-pressed={aktiv}
                                >
                                    {set.name}
                                </button>
                            );
                        })}
                    </div>
                )}

                {fehler.auswahl && (
                    <p className={styles.fehler} role="alert">
                        {fehler.auswahl}
                    </p>
                )}

                {setsGeladen && eigeneSets.length === 0 && demoSets.length === 0 && (
                    <p className={styles.hinweis}>Noch keine Sets vorhanden – lege oben ein neues an.</p>
                )}

                {demoSets.length > 0 && (
                    <details className={styles.demoBereich}>
                        <summary className={styles.demoTitel}>
                            Vorgefertigte Sets ({demoSets.length})
                        </summary>
                        <p className={styles.hinweis}>
                            Diese Sets gehören allen und lassen sich nicht verändern. Nimm ein Wort
                            daraus mit „Kopie anlegen“ in ein eigenes Set.
                        </p>
                        {demoSets.map((set) => (
                            <button
                                key={set.id}
                                type="button"
                                className={styles.demoZeile}
                                onClick={() => demoKopieren(set)}
                            >
                                <span
                                    className={styles.punkt}
                                    style={{ backgroundColor: farbeVonSprache(set.sprache).flaeche }}
                                    aria-hidden="true"
                                />
                                <span className={styles.demoName}>{set.name}</span>
                                <span className={styles.demoAktion}>Kopie anlegen</span>
                            </button>
                        ))}
                    </details>
                )}

                <button type="button" className={styles.speichern} onClick={weiter}>
                    Weiter
                </button>
            </div>
        );
    }

    // -------------------------------------------------------------- Schritt 2

    if (schritt === 2) {
        return (
            <div className={styles.seite}>
                <header className={styles.kopf}>
                    <button
                        type="button"
                        className={styles.zurueck}
                        onClick={zurueck}
                        aria-label="Zurück zur Auswahl"
                    >
                        <svg
                            viewBox="0 -960 960 960"
                            width="22"
                            height="22"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                        </svg>
                    </button>
                    <div>
                        <h2 className={styles.titel}>{SCHRITT_TITEL[2]}</h2>
                        <p className={styles.untertitel}>
                            {gewaehltesSet
                                ? `Neue Wörter für ${gewaehltesSet.name}`
                                : `Neue Wörter für ${setName.trim() || "dein neues Set"}`}
                        </p>
                    </div>
                </header>

                <div className={styles.form}>
                    {paare.map((paar, index) => {
                        /*
                         * Serverindex != Anzeigeindex.
                         *
                         * Gesendet wird `gefuelltePaare`, ohne leere Zeilen.
                         * /api/karten nummeriert die Felder also 0,1,2 …
                         * ueber die Stapel, die wirklich ankommen. Hier laeuft
                         * die Schleife aber ueber `paare`, wo eine leere Zeile
                         * mitzaehlt. Also muss die Nummer aus der Sicht der
                         * Anzeige gebaut werden: gefuellte Zeilen davor.
                         */
                        const gefIndex = paare
                            .slice(0, index)
                            .filter((p) => p.frage.trim() !== "" || p.antwort.trim() !== "").length;

                        const frageFehler = feldFehler(gefIndex, "frage");
                        const antwortFehler = feldFehler(gefIndex, "antwort");
                        /*
                         * Die API meldet Laengenfehler je Stapel unter dem
                         * Spaltennamen: "beispielsatz.3". Beide Nummern sind
                         * derselbe gefIndex, den auch die anderen Felder
                         * benutzen.
                         */
                        const serverBeispielFehler = fehler[`beispielsatz.${gefIndex}`];
                        const serverBeispielUebFehler = fehler[`beispiel_uebersetzung.${gefIndex}`];
                        const beispielFehler =
                            fehler[`beispiel.${gefIndex}`] ?? serverBeispielFehler;
                        const beispielUebFehler =
                            fehler[`beispielUebersetzung.${gefIndex}`] ?? serverBeispielUebFehler;
                        return (
                            <div
                                className={styles.paarZeile}
                                key={index}
                                data-paar-index={index}
                            >
                                <label className={styles.feld}>
                                    <span className={styles.label}>Begriff</span>
                                    <input
                                        ref={index === 0 ? ersteFrageRef : undefined}
                                        className={styles.input}
                                        value={paar.frage}
                                        onChange={(e) => paarAendern(index, "frage", e.target.value)}
                                        placeholder="z. B. ciao"
                                        autoComplete="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        aria-invalid={Boolean(frageFehler)}
                                        aria-describedby={frageFehler ? `fehler-${index}-frage` : undefined}
                                    />
                                    {frageFehler && (
                                        <span className={styles.fehler} id={`fehler-${index}-frage`}>
                                            {frageFehler}
                                        </span>
                                    )}
                                </label>

                                <label className={styles.feld}>
                                    <span className={styles.label}>Übersetzung</span>
                                    <input
                                        className={styles.input}
                                        value={paar.antwort}
                                        onChange={(e) => paarAendern(index, "antwort", e.target.value)}
                                        placeholder="z. B. hallo"
                                        autoComplete="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        aria-invalid={Boolean(antwortFehler)}
                                        aria-describedby={
                                            antwortFehler ? `fehler-${index}-antwort` : undefined
                                        }
                                    />
                                    {antwortFehler && (
                                        <span className={styles.fehler} id={`fehler-${index}-antwort`}>
                                            {antwortFehler}
                                        </span>
                                    )}
                                </label>

                                {/*
                                 * Beispielsatz, optional (Migration 005). Bewusst
                                 * unter Begriff und Uebersetzung und nicht
                                 * daneben: wer zehn Woerter auf einmal eintippt,
                                 * soll dafuer keine vier Felder je Zeile
                                 * bedienen muessen. Wer einen Satz will, hat
                                 * Platz dafuer – ohne ihn ausfuellen zu muessen.
                                 */}
                                <label className={styles.feld}>
                                    <span className={styles.label}>
                                        Beispielsatz
                                        <span className={styles.optional}>optional</span>
                                    </span>
                                    <input
                                        className={styles.input}
                                        value={paar.beispiel}
                                        onChange={(e) => paarAendern(index, "beispiel", e.target.value)}
                                        placeholder="z. B. Ci vediamo domani?"
                                        autoComplete="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        aria-invalid={Boolean(beispielFehler)}
                                        aria-describedby={
                                            beispielFehler ? `fehler-${index}-beispiel` : undefined
                                        }
                                    />
                                    {beispielFehler && (
                                        <span className={styles.fehler} id={`fehler-${index}-beispiel`}>
                                            {beispielFehler}
                                        </span>
                                    )}
                                </label>

                                <label className={styles.feld}>
                                    <span className={styles.label}>
                                        Satz auf Deutsch
                                        <span className={styles.optional}>optional</span>
                                    </span>
                                    <input
                                        className={styles.input}
                                        value={paar.beispielUebersetzung}
                                        onChange={(e) =>
                                            paarAendern(index, "beispielUebersetzung", e.target.value)
                                        }
                                        placeholder="z. B. Wir sehen uns morgen?"
                                        autoComplete="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        aria-invalid={Boolean(beispielUebFehler)}
                                        aria-describedby={
                                            beispielUebFehler
                                                ? `fehler-${index}-beispielUebersetzung`
                                                : undefined
                                        }
                                    />
                                    {beispielUebFehler && (
                                        <span
                                            className={styles.fehler}
                                            id={`fehler-${index}-beispielUebersetzung`}
                                        >
                                            {beispielUebFehler}
                                        </span>
                                    )}
                                </label>

                                {paare.length > 1 && (
                                    <button
                                        type="button"
                                        className={styles.entfernen}
                                        onClick={() => paarEntfernen(index)}
                                        aria-label={`Paar ${index + 1} entfernen`}
                                    >
                                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {fehler.paare && (
                        <p className={styles.fehler} role="alert">
                            {fehler.paare}
                        </p>
                    )}

                    <button type="button" className={styles.weiter} onClick={paarHinzufuegen}>
                        ＋ Wort hinzufügen
                    </button>

                    <button type="button" className={styles.speichern} onClick={weiter}>
                        Fertig
                    </button>
                </div>
            </div>
        );
    }

    // -------------------------------------------------------------- Schritt 3

    const legtNeuesSetAn = !gewaehltesSet || setName.trim() !== gewaehltesSet.name;

    return (
        <div className={styles.seite}>
            <header className={styles.kopf}>
                <button
                    type="button"
                    className={styles.zurueck}
                    onClick={zurueck}
                    aria-label="Zurück zur Eingabe"
                >
                    <svg
                        viewBox="0 -960 960 960"
                        width="22"
                        height="22"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                    </svg>
                </button>
                <div>
                    <h2 className={styles.titel}>{SCHRITT_TITEL[3]}</h2>
                    <p className={styles.untertitel}>
                        {gefuelltePaare.length} {gefuelltePaare.length === 1 ? "Wort" : "Wörter"} bereit
                    </p>
                </div>
            </header>

            <div className={styles.form}>
                <label className={styles.feld}>
                    <span className={styles.label}>Name des Sets</span>
                    <input
                        className={styles.input}
                        value={setName}
                        onChange={(e) => setSetName(e.target.value)}
                        placeholder="z. B. Italienisch Alltag"
                        maxLength={MAX_NAME}
                        autoComplete="off"
                        aria-invalid={Boolean(fehler.name)}
                    />
                    {fehler.name && <span className={styles.fehler}>{fehler.name}</span>}
                </label>

                {/*
                 * Die Sprache ist ein Auswahlfeld mit fester Liste, kein
                 * Freitext. Zwei Gruende, und beide sind der Grund fuer 0.1:
                 *
                 *   - "Englisch", "englisch", "Englisch Unterricht" waren drei
                 *     verschiedene Sets und drei verschiedene Farben, von
                 *     denen keine zuordenbar war. Die Liste ist jetzt public.
                 *     sprachen, und der Code ist der Schluessel.
                 *   - Der Code entscheidet auch mit, welche Browserstimme fuer
                 *     die Aussprache passt (1.3). Ein getippter Name sagt das
                 *     nicht.
                 *
                 * Bei einem bestehenden Set bleibt das Feld gesperrt: Dann
                 * aendert sich am Set nichts, und eine zweite, widerspruechliche
                 * Angabe waere nur eine neue Fehlerquelle.
                 */}
                <SprachAuswahl
                    label="Sprache"
                    wert={spracheCode}
                    sprachen={sprachListe}
                    onWahl={setSpracheCode}
                    disabled={!legtNeuesSetAn || sprachListe.length === 0}
                    invalid={Boolean(fehler.sprache)}
                />
                {sprachFehler && (
                    <span className={styles.fehler} role="alert">
                        {sprachFehler}
                    </span>
                )}

                {gewaehltesSet && legtNeuesSetAn && (
                    <p className={styles.hinweis}>
                        Mit einem anderen Namen entsteht ein <strong>neues Set</strong>.{" "}
                        {gewaehltesSet.name} bleibt unverändert.
                    </p>
                )}

                {fehler.form && (
                    <p className={styles.fehler} role="alert">
                        {fehler.form}
                    </p>
                )}

                <button
                    type="button"
                    className={styles.speichern}
                    onClick={speichern}
                    disabled={status === "speichert"}
                >
                    {status === "speichert"
                        ? "Speichert…"
                        : `${gefuelltePaare.length} ${gefuelltePaare.length === 1 ? "Wort" : "Wörter"} speichern`}
                </button>
            </div>
        </div>
    );
}
