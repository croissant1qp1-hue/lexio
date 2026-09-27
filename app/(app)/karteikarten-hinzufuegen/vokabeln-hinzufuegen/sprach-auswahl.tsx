"use client";

/**
 * Sprachauswahl als eigenes Menü.
 *
 * Warum nicht einfach ein `<select>`
 * -------------------------------
 * Zuerst war es eins, und es war das Richtige: kostenlos, mit Tastatur, mit
 * dem Menü des Systems beim Antippen. Der Wunsch war ein schöneres Feld mit
 * Farbpunkt und Haken. Das geht mit `<option>` nicht – eine Option kann nur
 * Text enthalten, keine Bilder, keine eigenen Elemente, keine Farbe pro
 * Zeile. Wer das im Menü will, muss das Menü selbst bauen.
 *
 * Also: eigenes Menü, mit allem, was das `<select>` mitgebracht hat und ohne
 * dass es verloren geht.
 *
 *   - Pfeiltasten bewegen, Pos1/Ende springen, Enter wählt, Escape schließt,
 *     Tab schließt ohne Auswahl. Der Fokus bleibt auf dem Knopf, damit die
 *     Tastatur nicht im Menü verschwindet.
 *   - Die Rolle ist combobox/listbox mit `aria-activedescendant`. Der Zeiger
 *     wandert über `aria-activedescendant`, nicht über den Fokus – sonst
 *     kaeme der Fokus an einem Bildschirmleser mitten im Menue an.
 *   - Außerhalb klicken und Tab schließen beide das Menü.
 *   - Ohne JS (Server-Rendering) ist es ein echtes `<select>`, siehe
 *     `OhneJavaScript`. Ein Auswahlfeld, das nur mit JS existiert, ist fuer
 *     jemanden ohne JS ein totes Feld – und die Migration ist nicht
 *     rueckgaengig zu machen, indem man sie weglaesst.
 *
 * Der Nachteil, den man eingeht: das Systemmenü auf dem Handy ist beim
 * Antippen oft angenehmer, weil es über den ganzen Bildschirm geht. Das ist
 * der bewusst gewählte Preis. Getestet wird deshalb auf 360 Pixel Breite.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Sprache } from "@/lib/sprachen";
import styles from "./sprach-auswahl.module.css";

type Props = {
    /** null = noch keine Sprache gewaehlt. */
    wert: string | null;
    sprachen: Sprache[];
    onWahl: (code: string | null) => void;
    disabled?: boolean;
    /** Fuer die Fehlermeldung des Formulars. */
    invalid?: boolean;
    /** Beschriftung sichtbar ueber dem Feld. */
    label: string;
};

const KEIN_WAHL = "";

export default function SprachAuswahl({
    wert,
    sprachen,
    onWahl,
    disabled = false,
    invalid = false,
    label,
}: Props) {
    const [offen, setOffen] = useState(false);
    /* Index des hervorgehobenen Eintrags, -1 fuer "keiner". Fuehrt statt des
       Codes, weil ein Code sich aendern kann, waehrend das Menue offen ist
       (Sprachliste kommt nach). */
    const [hervor, setHervor] = useState(-1);
    const knopfRef = useRef<HTMLButtonElement>(null);
    const feldRef = useRef<HTMLDivElement>(null);
    const listeId = useId();
    const eintragId = (i: number) => `${listeId}-eintrag-${i}`;

    const gewaehlt = sprachen.findIndex((s) => s.code === wert);

    const schliessen = useCallback(
        (fokusZurueck: boolean) => {
            setOffen(false);
            setHervor(-1);
            if (fokusZurueck) knopfRef.current?.focus();
        },
        [],
    );

    /* Wegklicken und Tab schliessen. `pointerdown` statt `click`, weil der
       Klick nach aussen sonst erst ankommt, wenn das Element schon weg ist –
       und dann bliebe das Menü offen. */
    useEffect(() => {
        if (!offen) return;
        const weg = (e: PointerEvent) => {
            if (!feldRef.current?.contains(e.target as Node)) setOffen(false);
        };
        const raus = (e: FocusEvent) => {
            if (!feldRef.current?.contains(e.target as Node)) setOffen(false);
        };
        document.addEventListener("pointerdown", weg);
        document.addEventListener("focusin", raus);
        return () => {
            document.removeEventListener("pointerdown", weg);
            document.removeEventListener("focusin", raus);
        };
    }, [offen]);

    const waehlen = useCallback(
        (code: string) => {
            onWahl(code === KEIN_WAHL ? null : code);
            schliessen(true);
        },
        [onWahl, schliessen],
    );

    function oeffnen() {
        if (disabled) return;
        setOffen(true);
        /* Mit dem gewaehlten Eintrag anfangen, sonst mit dem ersten. Leer
           ausgewaehlt heisst: nichts ist gewaehlt, es gibt keinen Zeiger. */
        setHervor(gewaehlt >= 0 ? gewaehlt : 0);
    }

    function taste(e: React.KeyboardEvent) {
        if (disabled) return;
        const anzahl = sprachen.length;

        switch (e.key) {
            case "ArrowDown":
            case "Down":
                e.preventDefault();
                if (!offen) {
                    oeffnen();
                    return;
                }
                setHervor((i) => (anzahl ? (i + 1) % anzahl : -1));
                return;
            case "ArrowUp":
            case "Up":
                e.preventDefault();
                if (!offen) {
                    oeffnen();
                    return;
                }
                setHervor((i) => (anzahl ? (i - 1 + anzahl) % anzahl : -1));
                return;
            case "Home":
                if (!offen) return;
                e.preventDefault();
                setHervor(anzahl ? 0 : -1);
                return;
            case "End":
                if (!offen) return;
                e.preventDefault();
                setHervor(anzahl - 1);
                return;
            case "Enter":
            case " ":
            case "Spacebar":
                e.preventDefault();
                if (!offen) {
                    oeffnen();
                    return;
                }
                if (hervor >= 0 && hervor < anzahl) waehlen(sprachen[hervor].code);
                return;
            case "Escape":
            case "Esc":
                if (!offen) return;
                /* Escape schliesst und verwirft: der Wert bleibt, wie er war.
                   Zweimal Escape hintereinander geht nicht – das ist der
                   Unterschied zu einem Dialog. */
                e.preventDefault();
                schliessen(true);
                return;
            case "Tab":
                if (offen) schliessen(false);
                return;
            default:
        }
    }

    const aktuellerName = gewaehlt >= 0 ? sprachen[gewaehlt].name : "";
    /* Waehrend `open` bleibt der Text stehen und wechselt nicht auf den
       hervorgehobenen Eintrag: das Zappeln des Werts beim Scrollen macht die
       Auswahl unlesbar. */
    const text = gewaehlt >= 0 ? aktuellerName : label;

    return (
        <div className={styles.feld} ref={feldRef}>
            <span className={styles.beschriftung} id={`${listeId}-label`}>
                {label}
            </span>

            <button
                type="button"
                ref={knopfRef}
                className={styles.knopf}
                onClick={() => (offen ? schliessen(true) : oeffnen())}
                onKeyDown={taste}
                disabled={disabled}
                /*
                 * `combobox` ist hier keine Zierde. Der Knopf ist der
                 * Einstieg in eine Liste, und nur mit dieser Rolle tragen
                 * `aria-expanded`, `aria-controls` und `aria-invalid`
                 * zusammen – ohne sie ist `aria-invalid` an einem Knopf nicht
                 * erlaubt, und die Fehlermeldung kaeme bei einem
                 * Bildschirmleser nicht als Feldfehler an.
                 */
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={offen}
                aria-controls={offen ? listeId : undefined}
                aria-activedescendant={offen && hervor >= 0 ? eintragId(hervor) : undefined}
                aria-invalid={invalid || undefined}
                aria-labelledby={`${listeId}-label`}
            >
                <span className={styles.punkt} style={{ background: aktuellerName ? sprachen[gewaehlt].flaeche : "transparent" }} />
                <span className={styles.text}>{text}</span>
                <span className={styles.pfeil} aria-hidden="true" />
            </button>

            {offen && (
                <div className={styles.liste} role="listbox" id={listeId} aria-labelledby={`${listeId}-label`}>
                    {sprachen.length === 0 && (
                        <p className={styles.leer}>Keine Sprachen geladen.</p>
                    )}
                    {sprachen.map((s, i) => {
                        const gewaehltZeile = s.code === wert;
                        return (
                            <div
                                key={s.code}
                                id={eintragId(i)}
                                role="option"
                                aria-selected={gewaehltZeile}
                                className={`${styles.eintrag} ${gewaehltZeile ? styles.eintragGewaehlt : ""} ${i === hervor ? styles.eintragHervor : ""}`}
                                /*
                                 * Die Auswahl haengt am `click`, nicht am
                                 * `pointerdown`. Ein Bildschirmleser, der
                                 * keinen Zeiger hat, loest nur einen Klick aus
                                 * – mit `pointerdown` waere die Liste fuer ihn
                                 * nicht bedienbar. Das `pointerdown` bleibt
                                 * trotzdem, aber nur mit `preventDefault`:
                                 * es verhindert, dass der Knopf den Fokus
                                 * verliert, bevor der Klick ankommt, und das
                                 * Menue sich vorher von selbst schliesst.
                                 */
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => waehlen(s.code)}
                                onPointerEnter={() => setHervor(i)}
                            >
                                <span className={styles.punkt} style={{ background: s.flaeche }} />
                                <span className={styles.text}>{s.name}</span>
                                {gewaehltZeile && (
                                    <span className={styles.haken} aria-hidden="true">
                                        <i className="fa-solid fa-check" />
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/*
             * Ohne JavaScript: das native Feld. Gleiche Namen, gleiche
             * Optionen, gleicher Wert – der Server liest `name`/`value`, nicht
             * die Oberflaeche. Wer JS hat, sieht es nicht, weil `hidden` per
             * CSS weggezogen wird; wer keines hat, sieht genau ein Feld.
             */}
            <noscript>
                <select
                    className={styles.ohneJs}
                    name="sprache"
                    defaultValue={wert ?? KEIN_WAHL}
                    disabled={disabled}
                >
                    <option value={KEIN_WAHL}>{label}</option>
                    {sprachen.map((s) => (
                        <option key={s.code} value={s.code}>
                            {s.name}
                        </option>
                    ))}
                </select>
            </noscript>
        </div>
    );
}
