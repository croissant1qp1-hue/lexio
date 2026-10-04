"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { farbeVonSprache, type Sprache, type SpracheInfo } from "@/lib/sprachen";
import { holeJson, sendeJson, ApiFehler } from "@/lib/api-client";
import { textblockEinlesen, type EinzelErgebnis } from "@/lib/einzelimport";
import {
    dateiEinlesen,
    dateiZuGross,
    groesseText,
    istTextdatei,
} from "@/lib/datei-import";
import styles from "./vokabeln-hinzufuegen.module.css";
import SprachAuswahl from "./sprach-auswahl";
import { IconDatei } from "@/components/icone";

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

/*
 * Was beide Wege liefern: der eingefuegte Text ergibt ein `EinzelErgebnis`,
 * die Datei ein `DateiErgebnis`. Der Unterschied ist nur die Kopfzeile –
 * die kennt nur der Dateiweg. Das Feld ist deshalb optional, und die
 * Oberflaeche muss es nicht mit einem `in`-Test abfragen (der hat hier
 * schon einmal `unknown` produziert). Fehlt es, gab es keine Kopfzeile.
 */
type ImportErgebnis = EinzelErgebnis & { kopfzeile?: string[] };

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
    /**
     * Eingabemodus in Schritt 2: Zeile fuer Zeile tippen oder einen
     * Textblock einfuegen (Plan 2.3). Der Textblock wird geparst und in
     * `paare` uebernommen; ab dann ist es eine Suche und Korrektur wie bei
     * jedem anderen Wortpaar. Erst wenn das Uebernehmen geglueckt ist,
     * wird weitergeschaltet – gespeichert wird weiterhin erst in Schritt 3.
     */
    const [eingabeArt, setEingabeArt] = useState<"zeilen" | "textblock">("zeilen");
    const [textblock, setTextblock] = useState("");
    /** Gruene Rueckmeldung nach dem Uebernehmen eines Textblocks. */
    const [textblockMeldung, setTextblockMeldung] = useState<string | null>(null);
    const textblockRef = useRef<HTMLTextAreaElement>(null);
    const [setName, setSetName] = useState("");
    /** Die Sprache als Code aus public.sprachen. null = noch keine gewaehlt. */
    const [spracheCode, setSpracheCode] = useState<string | null>(null);

    const [status, setStatus] = useState<Status>("idle");
    const [fehler, setFehler] = useState<Fehler>({});
    const [zaehler, setZaehler] = useState(0);
    const [fertig, setFertig] = useState<{ name: string; slug: string; anzahl: number } | null>(null);

    /** Laufender Beispielsatz-Fuellvorgang (Plan: s. unter der Tabelle). */
    const [beispielStatus, setBeispielStatus] = useState<
        | { ziele: number; fertig: number; sätze: number }
        | null
    >(null);
    /** Zusammenfassung nach einem abgeschlossenen Lauf. */
    const [beispielMeldung, setBeispielMeldung] = useState<string | null>(null);

    /*
     * Spiegel der Paare fuer die Auto-Ergaenzung, damit die parallelen
     * Anfragen nicht auf einem veralteten Stand arbeiten. Ohne dieses Ref
     * laege in jeder Antwort eine Einzelbeobachtung, und zwei gleichzeitig
     * laufende Treffer ueberschrieben sich gegenseitig.
     */
    const paareRef = useRef(paare);
    useEffect(() => {
        paareRef.current = paare;
    }, [paare]);

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
        // Ein ganz neues Set ohne jedes eigene Set: die Zielsprache ist noch
        // unbekannt, und dann wuerde auch die Beispielsatz-Ergaenzung (Korpus
        // nur fuer Englisch) leerlaufen. Belegt wird sichtbar Englisch – erste
        // Sprache der App, im Namensschritt aenderbar, nicht in Stein gemeisselt.
        else if (wert === NEUES_SET && eigeneSets.length === 0) {
            setSpracheCode("en");
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

    /*
     * Textblock (Plan 2.3): den eingefuegten Text parsen und die Zeilen als
     * eigene Wortpaare uebernehmen. Nicht sofort speichern – die Zeilen
     * landen in der bekannten Eingabeliste, wo jede einzelne noch korrigiert
     * werden kann, bevor sie in Schritt 3 gespeichert wird.
     */
    function textblockUebernehmen() {
        uebernehmen(textblockEinlesen(textblock), textblock);
    }

    /*
     * Eine Datei lesen (Feature 3) und genauso uebernehmen wie eingefuegten
     * Text – nur eben ohne Tippen.
     *
     * Der Import passiert SOFORT, nicht erst nach einem Klick auf "Wörter
     * übernehmen". Der Grund ist die Vorschau: was danach im Bild steht, sind
     * die Zeilen in der normalen Liste, jede einzeln editierbar, jede mit
     * eigener Fehlermeldung. Das ist eine bessere Vorschau als ein Textfeld
     * voller Rohdaten. Bei 500 Zeilen waere ein Zwischenstopp im Textfeld
     * nur ein zweiter Ort, an dem dieselben Daten liegen.
     *
     * Der Weg ist trotzdem derselbe wie beim Einfuegen: `uebernehmen` nimmt
     * ein `EinzelErgebnis` und macht daraus Zeilen. Zwei Wege, ein Parser.
     */
    async function dateiLesen(datei: File) {
        setFehler({});

        if (dateiZuGross(datei.size)) {
            setFehler({
                textblock:
                    `Die Datei ist ${groesseText(datei.size)} gross. ` +
                    "Bitte eine Liste bis 500 kB wählen – bei einer " +
                    "Wortliste ist das sehr viel.",
            });
            return;
        }

        let inhalt: string;
        try {
            inhalt = await datei.text();
        } catch {
            setFehler({ textblock: "Die Datei konnte nicht gelesen werden." });
            return;
        }

        if (!inhalt.trim()) {
            setFehler({
                textblock: "Die Datei ist leer. Es steht nichts drin, was importiert werden könnte.",
            });
            return;
        }

        if (!istTextdatei(inhalt, datei.name, datei.type)) {
            setFehler({
                textblock:
                    `„${datei.name}" ist keine Textdatei. ` +
                    "Der Import erwartet eine Wortliste als .txt, .csv oder .tsv.",
            });
            return;
        }

        const ergebnis = dateiEinlesen(inhalt, datei.name);

        /*
         * Eine Datei, die nur aus einer Kopfzeile besteht, hat keine
         * Vokabeln. Der Import liefert dann absichtlich eine leere Liste,
         * statt eine leere Zeile als Karte zu speichern.
         */
        if (ergebnis.paare.length === 0) {
            setFehler({
                textblock: ergebnis.kopfzeileWeg
                    ? `„${datei.name}" enthält nur die Kopfzeile ` +
                      `(${ergebnis.kopfzeile.join(" | ")}). ` +
                      "Darunter stehen keine Vokabeln."
                    : `In „${datei.name}" steht keine Vokabel.`,
            });
            return;
        }

        /*
         * Die Meldung wird unten in `uebernehmen` gebaut, nicht hier: dort
         * stehen alle Faelle schon aneinander – Zeilenzahl, offene Zeilen,
         * weggelassene Zeilen, Kopfzeile. Zwei Stellen, die dieselbe Meldung
         * bauen, laufen auseinander, und am Ende gewinnt die zuletzt
         * geschriebene.
         *
         * Als `quelle` den DATEINAMEN, nicht den Inhalt: in der Meldung
         * steht "Gelesen aus: woerter.csv" – der Name ist die Information,
         * die der Nutzer bei 500 Zeilen noch braucht.
         */
        uebernehmen(ergebnis, datei.name);
    }

    function uebernehmen(ergebnis: ImportErgebnis, quelle: string) {
        /*
         * Zwei Parser, in dieser Reihenfolge.
         *
         * Der strenge (textblockZuPaaren) braucht ein Trennzeichen und
         * gewinnt daraus die Spaltenzahl, mit der sich auch Beispielsatz und
         * Beispieluebersetzung auslesen lassen. Der milde
         * (textblockEinlesen) kommt ohne Trennzeichen aus, verliert dabei
         * aber die Spaltenzahl – eine Liste mit Tabulatoren liefert dann
         * keine Beispielsätze.
         *
         * Deshalb wird erst streng probiert und nur bei Misserfolg mild.
         * Eine deutsche Wortliste ohne jede Formatierung ist genau der
         * Fall, an dem die App vorher mit "Kein Trennzeichen gefunden"
         * abgewiesen hat.
         */
        /*
         * Der milde Parser hat Vorrang, nicht der strenge.
         *
         * Das war zuerst andersherum und damit falsch: der strenge Parser
         * liest "1. Haus = house" ohne Fehler als Begriff "1. Haus". Die
         * Nummerierung bleibt dann im Eingabefeld stehen, weil er sie nicht
         * kennt. Live geprueft, alle sieben Faelle:
         *
         *   1. Haus = house   ->  streng: "1. Haus" / house
         *                         milde:  "Haus"   / house
         *
         * Der milde schneidet die Nummerierung ab und beherrscht
         * ausserdem alle Faelle des strengen (er erkennt Tabulator, Pipe und
         * Semikolon als Spalten, und Trennworte wie "means"). Es gibt also
         * keinen Grund, ihn erst im Notfall zu fragen – der strenge Parser
         * darf nur eins: die Zahl der Spalten liefern, wenn vier da sind.
         *
         * Siehe die Messung in lib/einzelimport.ts: dort stehen beide
         * Ergebnisse nebeneinander.
         */
        if (ergebnis.paare.length === 0) {
            setFehler({
                textblock:
                    "Daraus wurde keine Vokabel erkannt. Möglich sind:\n" +
                    "Haus ; Übersetzung   (Tabulator, Doppelpunkt, =, ->)\n" +
                    "1. Haus = house      (Nummerierung wird weggelassen)\n" +
                    "Haus                (nur der Begriff, Übersetzung danach)" +
                    (quelle ? `\n\nAus: ${quelle}` : ""),
            });
            return;
        }

        // Erste, noch leere Zeile ersetzen, sonst staendest du vor einer
        // leeren Zeile und weisst nicht, wohin sie gehoert.
        //
        // Die fertige Liste wird hier GEBILDET und nicht erst im setPaare-
        // Aufrufer, weil die Auto-Ergaenzung unten dieselbe Liste braucht.
        // `paare` ist hier der Stand des gerenderten Bildes und damit genau
        // das, was der Nutzer sieht – ein Ref waere hier der falsche Weg.
        const nurLeereStartzeile =
            paare.length === 1 && !paare[0].frage.trim() && !paare[0].antwort.trim();
        const neueListe = nurLeereStartzeile ? ergebnis.paare : [...paare, ...ergebnis.paare];
        setPaare(neueListe);
        setTextblock("");

        /*
         * Zaehlt, was beim Import verloren ging, und sagt es. Drei Faelle:
         *
         *   - offene Zeilen (Begriff ohne Uebersetzung): die Meldung sagt,
         *     WAS zu tun ist. "12 Zeilen uebernommen" allein laesst raten,
         *     ob etwas fehlt – und das fuehrt zum Speichern, das dann an
         *     der ersten leeren Uebersetzung haengenbleibt.
         *   - eine Kopfzeile, die weggelassen wurde: siehe dateiLesen.
         *   - uebersprungene Zeilen (mehr als vier Spalten): stillschweigend
         *     fallen gelassen waere Datenverlust ohne jede Spur.
         */
        const offen = ergebnis.ohneUebersetzung;
        const kopf = ergebnis.kopfzeile ?? [];
        const teile: string[] = [];

        teile.push(
            `${ergebnis.paare.length} Vokabel${
                ergebnis.paare.length === 1 ? "" : "n"
            } übernommen` +
                (quelle ? ` aus ${quelle}` : "") +
                ".",
        );
        if (offen > 0) {
            teile.push(
                `Bei ${offen} fehlt die Übersetzung – bitte in der Liste ergänzen.`,
            );
        }
        if (ergebnis.uebersprungen > 0) {
            teile.push(
                `${ergebnis.uebersprungen} Zeile${
                    ergebnis.uebersprungen === 1 ? "" : "n"
                } nicht übernommen (mehr als vier Spalten).`,
            );
        }
        if (kopf.length > 0) {
            teile.push(`Kopfzeile weggelassen: ${kopf.join(" | ")}.`);
        }
        if (offen === 0 && ergebnis.uebersprungen === 0 && kopf.length === 0) {
            teile.push("Prüfe die Zeilen und speichere dann.");
        }

        setTextblockMeldung(teile.join(" "));
        setEingabeArt("zeilen");
        window.setTimeout(() => textblockRef.current?.scrollIntoView({ block: "center" }), 30);

        /*
         * Automatisch fuellen, was nebenbei mitgekommen ist. Der Nutzer war
         * so freundlich, einen ganzen Block abzugeben – da soll er nicht fuer
         * jede Zeile einzeln einen Beispielsatz tippen. Gutsein ist unser
         * einziger Job, wenn wir nicht stoeren. Ohne Abbruch-Flag, nur bis
         * zur Schritt-Grenze.
         *
         * `neueListe` wird uebergeben statt aus `paareRef` gelesen: der Ref
         * haengt an einem useEffect und laeuft deshalb noch einen Render
         * hinterher. Beim ersten Aufruf nach dem Import stand dort noch die
         * eine leere Zeile, `ziele` war leer, und die Funktion kehrte sofort
         * zurueck – es ging kein einziger API-Aufruf raus. Live gemessen:
         * 0 Aufrufe bei zwei importierten Woertern.
         */
        void beispielSaetzeErgaenzen(neueListe);
    }

    /*
     * Beispielsaetze fuer alle ausgefuellten Zeilen holen, die noch keinen
     * haben (Plan 2.x, Nutzerwunsch). Die Route `/api/beispielsatz` nimmt
     * erst den Tatoeba-Korpus, dann den Cache, dann – wenn ein Groq-Schluessel
     * konfiguriert ist – die kostenlose KI. Die Sprache des gewaehlten Sets
     * geht mit, damit der Korpus nur fuer Englisch greift.
     *
     * Wichtig: Nicht den ganzen Stapel auf einmal mit `Promise.all` abfeuern.
     * Die KI-Quote ist kostenlos und damit begrenzt; 40 parallele Aufrufe
     * ruinierten die Wartezeit und das Paket. Hier sind es hoechstens
     * MAX_PARALLEL gleichzeitige Anfragen, der Rest wartet in einer Queue.
     *
     * `quelle` ist die Liste, fuer die gearbeitet werden soll. Ohne Argument
     * (Knopf "Beispielsätze ergänzen") kommt der aktuelle Bildschirmstand aus
     * `paareRef`; beim Textblock-Import wird die gerade erzeugte Liste
     * uebergeben, weil der Ref noch nicht nachgezogen hat.
     */
    async function beispielSaetzeErgaenzen(quelle?: Paar[]) {
        const basis = quelle ?? paareRef.current;
        const ziele = basis
            .map((p, index) => ({ p, index }))
            .filter(
                ({ p }) =>
                    (p.frage.trim() !== "" || p.antwort.trim() !== "") &&
                    !p.beispiel.trim(),
            );
        if (ziele.length === 0) return;

        setBeispielStatus({ ziele: ziele.length, fertig: 0, sätze: 0 });

        /*
         * MAX_PARALLEL Worker, jeder nimmt sich per Zaehler EINE Zeile,
         * wartet auf die Antwort und nimmt sich die naechste. So laufen nie
         * mehr als MAX_PARALLEL Anfragen gleichzeitig – wichtig, weil die
         * KI-Quote kostenlos und damit begrenzt ist, und weil 40 parallele
         * Aufrufe die Wartezeit und das Ratelimit sprengen wuerden.
         */
        const MAX_PARALLEL = 4;
        let naechster = 0;
        let gefundeneSätze = 0;

        const verarbeite = async (): Promise<void> => {
            for (;;) {
                const meine = naechster++;
                if (meine >= ziele.length) return;
                const { p, index } = ziele[meine];

                let gefunden = false;
                try {
                    const daten = await sendeJson<{
                        satz: string | null;
                        uebersetzung: string | null;
                    }>("/api/beispielsatz", {
                        frage: p.frage.trim(),
                        antwort: p.antwort.trim(),
                        sprache: spracheCode ?? null,
                    });
                    if (daten.satz && daten.uebersetzung) {
                        gefunden = true;
                        setPaare((alt) =>
                            alt.map((zeile, i) =>
                                i === index
                                    ? {
                                          ...zeile,
                                          beispiel: String(daten.satz),
                                          beispielUebersetzung: String(daten.uebersetzung),
                                      }
                                    : zeile,
                            ),
                        );
                    }
                } catch {
                    /* Einzelne Fehler (z. B. Netz) koennen wir nicht reparieren;
                       die Zeile bleibt leer, das ist kein Grund, den Rest wegzuwerfen. */
                } finally {
                    if (gefunden) gefundeneSätze += 1;
                    setBeispielStatus((alt) =>
                        alt
                            ? {
                                  ...alt,
                                  fertig: alt.fertig + 1,
                                  sätze: gefundeneSätze,
                              }
                            : alt,
                    );
                }
            }
        };

        const parallel = Math.min(MAX_PARALLEL, ziele.length);
        await Promise.all(Array.from({ length: parallel }, () => verarbeite()));

        /*
         * Nach dem Lauf die Zwischenanzeige abbauen und eine feste
         * Zusammenfassung zeigen. `beispielStatus` bleibt nicht stehen,
         * sonst wuerde der Ergänzen-Knopf ausblendet, obwohl noch Zeilen
         * ohne Satz da sein koennen.
         */
        setBeispielStatus(null);
        if (gefundeneSätze > 0) {
            setBeispielMeldung(
                `${gefundeneSätze} ${
                    gefundeneSätze === 1 ? "Beispielsatz" : "Beispielsätze"
                } automatisch ergänzt.` +
                    (gefundeneSätze < ziele.length
                        ? ` Für ${ziele.length - gefundeneSätze} wurde nichts gefunden – ` +
                          "die kannst du selbst eintragen."
                        : ""),
            );
        } else {
            /*
             * Nichts gefunden ist kein Fehler, aber es ist auch nichts, was
             * man dem Nutzen zumuten kann. Vorher verschwand der Knopf
             * ersatzlos und die Zeilen blieben einfach leer – bei einem
             * spanischen Set passiert das bei JEDEM Wort, weil es dort keine
             * Quelle gibt. Er sagen, woran es liegt, ist ehrlicher als
             * Stille.
             */
            setBeispielMeldung(
                `Zu ${ziele.length === 1 ? "diesem Wort" : `diesen ${ziele.length} Wörtern`} ` +
                    "gibt es noch keinen Beispielsatz. Du kannst sie selbst " +
                    "eintragen – das Feld ist optional.",
            );
        }
        setFehler({});
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
             * gerade angelegten Set-Namen zeigt.
             *
             * Eigenes try/catch, und das ist der ganze Punkt: die Wörter sind
             * zu diesem Zeitpunkt gespeichert. Schlaegt nur dieser Aufruf fehl
             * — kein Netz, 503, Session weg —, landete der Fehler im catch
             * weiter unten, die Meldung lautete "Fehler", und wer die Meldung
             * ernst nimmt, wiederholt: ein zweites Set mit denselben Wörtern.
             *
             * Bewusst kein `abfall`-Wert an holeJson: der greift nur bei
             * HTTP-Fehlern, nicht wenn die Verbindung abbricht (der häufigere
             * Fall) — und ein stilles `[]` waere die schlechtere Taeuschung,
             * weil danach keine eigene Kachel mehr da ist.
             *
             * Bleibt das Nachladen aus, steht die Liste so, wie sie war. Das
             * neue Set erscheint darin beim naechsten Aufruf der Seite; der
             * Erfolg wird trotzdem gemeldet, weil er einer ist.
             */
            try {
                setSets(await holeJson<SetZeile[]>("/api/karteikarten"));
            } catch {
                setSetsGeladen(true);
            }
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
                    {/* Zwei Wege, Woerter einzutragen (Plan 2.3): Zeile fuer
                        Zeile tippen oder einen ganzen Textblock einfuegen.
                        Beide munden in derselben Liste, die erst in Schritt 3
                        gespeichert wird. */}
                    <div className={styles.eingabeModus} role="tablist" aria-label="Eingabeweise">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={eingabeArt === "zeilen"}
                            className={`${styles.modus} ${
                                eingabeArt === "zeilen" ? styles.modusAktiv : ""
                            }`}
                            onClick={() => {
                                setEingabeArt("zeilen");
                                setFehler({});
                            }}
                        >
                            Zeile für Zeile
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={eingabeArt === "textblock"}
                            className={`${styles.modus} ${
                                eingabeArt === "textblock" ? styles.modusAktiv : ""
                            }`}
                            onClick={() => {
                                setEingabeArt("textblock");
                                setFehler({});
                            }}
                        >
                            Textblock einfügen
                        </button>
                    </div>

                    {eingabeArt === "textblock" ? (
                        <div className={styles.textblock}>
{/*
                             * Datei statt Liste abtippen (Feature 3).
                             *
                             * Der Import passiert SOFORT, ohne Umweg ueber
                             * das Textfeld: `dateiLesen` liest die Datei,
                             * `dateiEinlesen` macht daraus Paare, und
                             * `uebernehmen` stellt sie in die Liste. Der Weg
                             * ist derselbe wie beim eingefuegten Text – es
                             * gibt also nur EINEN Parser fuer beide Wege.
                             *
                             * Warum kein Zwischenstopp im Textfeld: die
                             * Zeilenliste ist die bessere Vorschau. Jede
                             * Zeile ist einzeln editierbar und traegt ihre
                             * eigene Fehlermeldung. Ein Textfeld voller
                             * Rohdaten waere nur ein zweiter Ort, an dem
                             * dieselben Daten liegen.
                             *
                             * Das <label> ist das richtige Element, kein
                             * <button>: es oeffnet den Dateidialog mit einem
                             * Klick und ohne JavaScript, und der eigentliche
                             * <input> bleibt fuer Tastatur und Screenreader
                             * da – nur visuell versteckt. Der Kasten reagiert
                             * auf :focus-within, damit die Tastatur denselben
                             * Zustand sieht wie die Maus.
                             */}
                            <div className={styles.dateiKasten}>
                                <input
                                    id="wortliste-datei"
                                    type="file"
                                    className={styles.dateiFeld}
                                    accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values"
                                    onChange={(e) => {
                                        const datei = e.target.files?.[0];
                                        /*
                                         * `value` wird zurueckgesetzt, sonst
                                         * loest der Wechsel auf DIESELBE Datei
                                         * kein onChange mehr aus – der Nutzer
                                         * waehlt sie zweimal und wundert sich,
                                         * dass nichts passiert.
                                         */
                                        e.target.value = "";
                                        if (datei) void dateiLesen(datei);
                                    }}
                                />
                                <label htmlFor="wortliste-datei" className={styles.dateiKnopf}>
                                    <IconDatei aria-hidden="true" />
                                    Datei wählen
                                </label>
                                {/*
                                 * Der Hinweistext steht als <span>, nicht als
                                 * <p>: er gehoert optisch zum Knopf und soll
                                 * beim Tabben nicht als eigener Stopp
                                 * auffallen. Fuer Screenreader bleibt er
                                 * Text – der Hinweis, dass .csv erlaubt ist,
                                 * ist nuetzlich und nicht nur Dekoration.
                                 */}
                                <span className={styles.dateiText}>
                                    <span className={styles.dateiTitel}>
                                        Oder eine Wortliste als Datei
                                    </span>
                                    <span className={styles.dateiHinweis}>
                                        .txt, .csv, .tsv bis 500 kB. Semikolon, Komma,
                                        Tabulator. Kopfzeile wird erkannt.
                                    </span>
                                </span>
                            </div>

                            <label className={styles.feld}>
                                <span className={styles.label}>Mehrere Wörter auf einmal</span>
                                <textarea
                                    ref={textblockRef}
                                    className={styles.textblockFeld}
                                    value={textblock}
                                    onChange={(e) => {
                                        setTextblock(e.target.value);
                                        if (fehler.textblock) setFehler({});
                                    }}
                                    rows={8}
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    aria-invalid={Boolean(fehler.textblock)}
                                    aria-describedby={
                                        fehler.textblock ? "fehler-textblock" : undefined
                                    }
                                    placeholder={
                                        'Eine Vokabel je Zeile, z. B.:\n\napple\tApfel\ncat ; Katze\nto learn -> lernen\nbook = Buch'
                                    }
                                />
                            </label>
                            <p className={styles.textblockHinweis}>
                                Trennzeichen: Tabulator, ; | -&gt; = : oder ein Strich. Optional auch
                                Beispielsatz als dritte Spalte.
                            </p>
                            {fehler.textblock && (
                                <p className={styles.fehler} id="fehler-textblock" role="alert">
                                    {fehler.textblock}
                                </p>
                            )}
                            <button
                                type="button"
                                className={styles.speichern}
                                onClick={textblockUebernehmen}
                            >
                                Wörter übernehmen
                            </button>
                        </div>
                    ) : (
                        <>
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

                        {beispielStatus && (
                            <p className={styles.textblockOk} role="status">
                                {beispielStatus.fertig < beispielStatus.ziele
                                    ? `Beispielsätze werden gesucht… ${beispielStatus.fertig} von ${beispielStatus.ziele}`
                                    : `${beispielStatus.sätze} von ${beispielStatus.ziele} ${
                                          beispielStatus.sätze === 1 ? "Satz" : "Sätzen"
                                      } ergänzt.`}
                            </p>
                        )}

                        {beispielMeldung && (
                            <p className={styles.textblockOk} role="status">
                                {beispielMeldung}
                            </p>
                        )}

                        {!beispielStatus &&
                            paare.some(
                                (p) =>
                                    (p.frage.trim() !== "" || p.antwort.trim() !== "") &&
                                    !p.beispiel.trim(),
                            ) && (
                                <button
                                    type="button"
                                    className={styles.weiter}
                                    onClick={() => {
                                        setBeispielMeldung(null);
                                        void beispielSaetzeErgaenzen();
                                    }}
                                >
                                    <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
                                    &nbsp; Beispielsätze ergänzen
                                </button>
                            )}

                        <button type="button" className={styles.speichern} onClick={weiter}>
                            Fertig
                        </button>
                    </>
                    )}
                    {textblockMeldung && eingabeArt === "zeilen" && (
                        <p className={styles.textblockOk} role="status">
                            {textblockMeldung}
                        </p>
                    )}
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
