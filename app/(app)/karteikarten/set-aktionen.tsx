"use client";

import { useEffect, useRef, useState } from "react";
import { holeJson } from "@/lib/api-client";
import { kopieName } from "@/lib/kopie-name";
import type { Sprache, SpracheInfo } from "@/lib/sprachen";
import { IconDuplizieren } from "@/components/icone";
import SprachAuswahl from "../karteikarten-hinzufuegen/vokabeln-hinzufuegen/sprach-auswahl";
import styles from "./set-aktionen.module.css";

/**
 * Duplizieren, Bearbeiten und Loeschen fuer ein Set.
 *
 * Vier Ansichten in einem Dialog statt eines Menues im Menue: die Zeile
 * klickt sonst mit und landet in der Lernansicht, und ein zweites, schwebendes
 * Menue braucht eine zweite Ebene, die man auf dem Handy verliert.
 *
 * Das Set selbst wird hier nicht angefasst. Die Liste laedt ueber
 * `onGeaendert` neu – dieselbe Quelle, aus der sie gekommen ist. Eine lokale
 * Liste im Dialog koennte von der Datenbank abweichen, und die Route
 * entscheidet, was gespeichert wird, nicht der Bildschirm.
 *
 * WICHTIG FUER DEMO-SETS: Bei `eigen === false` zeigt der Dialog nur das
 * Duplizieren. Bearbeiten und Loeschen waeren dort Sackgassen – die Route
 * gibt 403 zurueck, weil `user_id` des Demo-Sets null ist, und der Nutzer
 * haette vorher raten muessen, warum. Duplizieren ist dort nicht nur erlaubt,
 * sondern der einzige sinnvolle Zweck: das Demo-Set ist genau das Material,
 * das man kopieren will, um es zu veraendern.
 */

type Props = {
  /** Bei /api/karteikarten ist `id` der Slug – siehe Zeile 125 der Route. */
  slug: string;
  name: string;
  sprache: SpracheInfo;
  kartenAnzahl: number;
  /** false bei vorgefertigten Sets: dann gibt es nur Duplizieren. */
  eigen: boolean;
  onGeaendert: () => void;
};

type Ansicht = "start" | "bearbeiten" | "loeschen" | "duplizieren";

/**
 * Nur der Knopf und die Entscheidung, ob der Dialog steht.
 *
 * Der Dialog selbst ist eine eigene Komponente, die bei jedem Oeffnen neu
 * montiert wird. Deshalb braucht sie keinen Effekt, um ihre Felder mit dem
 * Set gleichzusetzen: `useState(name)` liest den Namen genau einmal, bei der
 * Montage. Der Umweg ueber einen Effekt – und damit die alte Fassung im Feld,
 * wenn jemand den Dialog zweimal abbricht – entfaellt.
 */
export default function SetAktionen({ slug, name, sprache, kartenAnzahl, eigen, onGeaendert }: Props) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.knopf}
        onClick={(e) => {
          // Ohne das klickt die ganze Zeile durch und öffnet die Lernansicht.
          e.stopPropagation();
          setOffen(true);
        }}
        aria-haspopup="dialog"
        aria-label={
          eigen
            ? `Set ${name} bearbeiten, duplizieren oder löschen`
            : `Set ${name} in eine eigene Kopie übernehmen`
        }
      >
        ⋯
      </button>

      {offen && (
        <SetDialog
          slug={slug}
          name={name}
          sprache={sprache}
          kartenAnzahl={kartenAnzahl}
          eigen={eigen}
          onGeaendert={onGeaendert}
          onSchliessen={() => setOffen(false)}
        />
      )}
    </>
  );
}

function SetDialog({ slug, name, sprache, kartenAnzahl, eigen, onGeaendert, onSchliessen }: Props & {
  onSchliessen: () => void;
}) {
  /*
   * Bei einem Demo-Set ist Bearbeiten sinnlos, also startet der Dialog
   * gleich dort, wo es weitergeht. Sonst staende da erst eine Auswahl, von der
   * nur eine Zeile noetig ist – und der Knopf waere ein Umweg.
   */
  const [ansicht, setAnsicht] = useState<Ansicht>(eigen ? "start" : "duplizieren");
  const [nameEntwurf, setNameEntwurf] = useState(name);
  const [codeEntwurf, setCodeEntwurf] = useState<string | null>(sprache.code);
  const [sprachListe, setSprachListe] = useState<Sprache[]>([]);
  const [sprachFehler, setSprachFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  /*
   * Die Sprachliste wird nur fuer "bearbeiten" gebraucht. Bei einem
   * Demo-Set, der direkt im Duplizieren-Dialog startet, waere die Abfrage
   * eine Roundtrip-Arbeit ohne Nutzen – und sie liefe bei jedem Oeffnen des
   * Dialogs, auch wenn niemand die Sprache aendert.
   */
  const brauchtSprachListe = eigen && ansicht === "bearbeiten";

  useEffect(() => {
    if (!brauchtSprachListe) return;
    let abgebrochen = false;

    holeJson<Sprache[]>("/api/sprachen")
      .then((liste) => {
        if (!abgebrochen) setSprachListe(liste);
      })
      .catch(() => {
        if (!abgebrochen) setSprachFehler("Die Sprachliste konnte nicht geladen werden.");
      });

    return () => {
      abgebrochen = true;
    };
  }, [brauchtSprachListe]);

  // Fokus in den Dialog, damit Escape und Tab dort wirken und die Tabelle
  // nicht weiter bedienbar ist, waehrend das Fenster offen steht.
  useEffect(() => {
    const ziel = nameRef.current ?? dialogRef.current;
    ziel?.focus();

    const aufTaste = (ereignis: KeyboardEvent) => {
      if (ereignis.key === "Escape" && !arbeitet) {
        ereignis.preventDefault();
        onSchliessen();
      }
    };
    document.addEventListener("keydown", aufTaste);
    return () => document.removeEventListener("keydown", aufTaste);
  }, [arbeitet, onSchliessen]);

  async function speichern() {
    const neuerName = nameEntwurf.trim();
    if (!neuerName) {
      setFehler("Der Name darf nicht leer sein.");
      return;
    }
    if (!codeEntwurf) {
      setFehler("Bitte eine Sprache wählen.");
      return;
    }

    setArbeitet(true);
    setFehler(null);
    try {
      await holeJson(`/api/sets/${slug}`, undefined, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Nur schicken, was sich geaendert hat. Sonst schreibt ein leeres
        // Feld einen Fehler, den der Nutzer gar nicht gemacht hat.
        body: JSON.stringify({
          ...(neuerName !== name ? { name: neuerName } : {}),
          ...(codeEntwurf !== sprache.code ? { spracheCode: codeEntwurf } : {}),
        }),
      });
      onSchliessen();
      onGeaendert();
    } catch (f) {
      setFehler(f instanceof Error ? f.message : "Das Set konnte nicht gespeichert werden.");
    } finally {
      setArbeitet(false);
    }
  }

  async function loeschen() {
    setArbeitet(true);
    setFehler(null);
    try {
      await holeJson(`/api/sets/${slug}`, undefined, { method: "DELETE" });
      onSchliessen();
      onGeaendert();
    } catch (f) {
      setFehler(f instanceof Error ? f.message : "Das Set konnte nicht gelöscht werden.");
    } finally {
      setArbeitet(false);
    }
  }

  /*
   * Die Kopie bleibt im Dialog offen, bis `onGeaendert` die Liste neu geladen
   * hat. Der Nutzer sieht danach sein neues Set in der Uebersicht – dort, wo
   * er es erwartet – und muss nicht raten, ob es geklappt hat.
   *
   * Bei einem Fehler bleibt der Dialog mit der Meldung stehen, statt zu
   * schliessen. Eine Meldung, die sofort wieder verschwindet, ist keine
   * Meldung.
   */
  async function duplizieren() {
    setArbeitet(true);
    setFehler(null);
    try {
      await holeJson(`/api/sets/${slug}/duplizieren`, undefined, { method: "POST" });
      onSchliessen();
      onGeaendert();
    } catch (f) {
      setFehler(f instanceof Error ? f.message : "Die Kopie konnte nicht erstellt werden.");
    } finally {
      setArbeitet(false);
    }
  }

  return (
    <div
      className={styles.schleier}
      // Klick auf den Hintergrund schliesst, Klick auf den Dialog nicht.
      onClick={onSchliessen}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Set ${name}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
            <h2 className={styles.titel}>{name}</h2>

            {ansicht === "start" && (
              <div className={styles.aktionen}>
                <button type="button" className={styles.haupt} onClick={() => setAnsicht("bearbeiten")}>
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className={styles.neutral}
                  onClick={() => setAnsicht("duplizieren")}
                  disabled={arbeitet}
                >
                  <IconDuplizieren />
                  Duplizieren
                </button>
                <button
                  type="button"
                  className={styles.gefahr}
                  onClick={() => setAnsicht("loeschen")}
                  disabled={arbeitet}
                >
                  Löschen
                </button>
                <button type="button" className={styles.abbrechen} onClick={onSchliessen}>
                  Abbrechen
                </button>
              </div>
            )}

            {ansicht === "bearbeiten" && (
              <form
                className={styles.formular}
                onSubmit={(e) => {
                  e.preventDefault();
                  void speichern();
                }}
              >
                <label className={styles.feld}>
                  <span className={styles.beschriftung}>Name</span>
                  <input
                    ref={nameRef}
                    className={styles.eingabe}
                    value={nameEntwurf}
                    onChange={(e) => setNameEntwurf(e.target.value)}
                    maxLength={60}
                    disabled={arbeitet}
                  />
                </label>

                {sprachFehler ? (
                  <p className={styles.fehler}>{sprachFehler}</p>
                ) : (
                  <SprachAuswahl
                    label="Sprache"
                    wert={codeEntwurf}
                    sprachen={sprachListe}
                    onWahl={setCodeEntwurf}
                    disabled={arbeitet || sprachListe.length === 0}
                  />
                )}

                {fehler && <p className={styles.fehler}>{fehler}</p>}

                <div className={styles.knopfZeile}>
                  <button
                    type="button"
                    className={styles.abbrechen}
                    onClick={onSchliessen}
                    disabled={arbeitet}
                  >
                    Abbrechen
                  </button>
                  <button type="submit" className={styles.haupt} disabled={arbeitet}>
                    {arbeitet ? "Speichert…" : "Speichern"}
                  </button>
                </div>
              </form>
            )}

            {ansicht === "duplizieren" && (
              <div className={styles.formular}>
                {/*
                 * Hier steht absichtlich KEIN Namensfeld.
                 *
                 * Der Server vergibt den Namen selbst, nach der Regel aus
                 * lib/kopie-name.ts: "X" wird zu "X (Kopie)", und ist der
                 * Name schon vergeben, bekommt die naechste Nummer. Ein
                 * Namensfeld wuerde diese Regel aushebeln – der Nutzer
                 * schreibt "Mein Set" hin, und es entstuende "Mein Set (Kopie)".
                 * Er muesste dann ahnlich denken wie die Regel, also
                 * "(Kopie)" weglassen, damit es "passt".
                 *
                 * Der hier gezeigte Name ist eine Vorschau, nicht die
                 * Zusage: existiert er schon, setzt die Route die Nummer
                 * darueber. Genau deshalb steht "bekommt", nicht "heisst".
                 */}
                <p className={styles.warnung}>
                  {kartenAnzahl === 0 ? (
                    <>
                      Es entsteht ein leeres eigenes Set mit dem Namen{" "}
                      <strong>{kopieName(name)}</strong>.
                    </>
                  ) : (
                    <>
                      Es entsteht eine eigene Kopie mit allen {kartenAnzahl}{" "}
                      {kartenAnzahl === 1 ? "Karte" : "Karten"}. Sie bekommt den Namen{" "}
                      <strong>{kopieName(name)}</strong> und ist danach deine – du kannst
                      sie umbenennen, bearbeiten und ergänzen.
                    </>
                  )}
                </p>

                <p className={styles.hinweis}>
                  {eigen
                    ? "Der Lernstand wird nicht mitkopiert. Die Kopie startet bei Stufe 0."
                    : "So kannst du das vorgefertigte Set an deine Wörter und deinen Unterricht anpassen."}
                </p>

                {fehler && <p className={styles.fehler}>{fehler}</p>}

                <div className={styles.knopfZeile}>
                  <button
                    type="button"
                    className={styles.abbrechen}
                    onClick={onSchliessen}
                    disabled={arbeitet}
                  >
                    Abbrechen
                  </button>
                  {eigen && (
                    <button
                      type="button"
                      className={styles.abbrechen}
                      onClick={() => setAnsicht("start")}
                      disabled={arbeitet}
                    >
                      Zurück
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.haupt}
                    onClick={() => void duplizieren()}
                    disabled={arbeitet}
                  >
                    {arbeitet ? "Kopiert…" : "Kopie erstellen"}
                  </button>
                </div>
              </div>
            )}

            {ansicht === "loeschen" && (
              <div className={styles.formular}>
                <p className={styles.warnung}>
                  {kartenAnzahl === 0
                    ? `„${name}“ wird gelöscht.`
                    : `„${name}“ wird mit ${kartenAnzahl} ${
                        kartenAnzahl === 1 ? "Karte" : "Karten"
                      } gelöscht.`}{" "}
                  Das lässt sich nicht rückgängig machen.
                </p>

                {fehler && <p className={styles.fehler}>{fehler}</p>}

                <div className={styles.knopfZeile}>
                  <button
                    type="button"
                    className={styles.abbrechen}
                    onClick={onSchliessen}
                    disabled={arbeitet}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className={styles.gefaer}
                    onClick={() => void loeschen()}
                    disabled={arbeitet}
                  >
                    {arbeitet ? "Löscht…" : "Endgültig löschen"}
                  </button>
                </div>
              </div>
            )}
      </div>
    </div>
  );
}