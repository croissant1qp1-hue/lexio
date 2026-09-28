"use client";

import { useEffect, useRef, useState } from "react";
import { holeJson } from "@/lib/api-client";
import type { Sprache, SpracheInfo } from "@/lib/sprachen";
import SprachAuswahl from "../karteikarten-hinzufuegen/vokabeln-hinzufuegen/sprach-auswahl";
import styles from "./set-aktionen.module.css";

/**
 * Bearbeiten und Loeschen fuer ein eigenes Set.
 *
 * Drei Ansichten in einem Dialog statt eines Menues im Menue: die Zeile
 * klickt sonst mit und landet in der Lernansicht, und ein zweites, schwebendes
 * Menue braucht eine zweite Ebene, die man auf dem Handy verliert.
 *
 * Das Set selbst wird hier nicht angefasst. Die Liste laedt ueber
 * `onGeaendert` neu – dieselbe Quelle, aus der sie gekommen ist. Eine lokale
 * Liste im Dialog koennte von der Datenbank abweichen, und die Route
 * entscheidet, was gespeichert wird, nicht der Bildschirm.
 */

type Props = {
  /** Bei /api/karteikarten ist `id` der Slug – siehe Zeile 125 der Route. */
  slug: string;
  name: string;
  sprache: SpracheInfo;
  kartenAnzahl: number;
  onGeaendert: () => void;
};

type Ansicht = "start" | "bearbeiten" | "loeschen";

/**
 * Nur der Knopf und die Entscheidung, ob der Dialog steht.
 *
 * Der Dialog selbst ist eine eigene Komponente, die bei jedem Oeffnen neu
 * montiert wird. Deshalb braucht sie keinen Effekt, um ihre Felder mit dem
 * Set gleichzusetzen: `useState(name)` liest den Namen genau einmal, bei der
 * Montage. Der Umweg ueber einen Effekt – und damit die alte Fassung im Feld,
 * wenn jemand den Dialog zweimal abbricht – entfaellt.
 */
export default function SetAktionen({ slug, name, sprache, kartenAnzahl, onGeaendert }: Props) {
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
        aria-label={`Set ${name} bearbeiten oder löschen`}
      >
        ⋯
      </button>

      {offen && (
        <SetDialog
          slug={slug}
          name={name}
          sprache={sprache}
          kartenAnzahl={kartenAnzahl}
          onGeaendert={onGeaendert}
          onSchliessen={() => setOffen(false)}
        />
      )}
    </>
  );
}

function SetDialog({ slug, name, sprache, kartenAnzahl, onGeaendert, onSchliessen }: Props & {
  onSchliessen: () => void;
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>("start");
  const [nameEntwurf, setNameEntwurf] = useState(name);
  const [codeEntwurf, setCodeEntwurf] = useState<string | null>(sprache.code);
  const [sprachListe, setSprachListe] = useState<Sprache[]>([]);
  const [sprachFehler, setSprachFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Die Sprachliste ist eine eigene Abfrage und darf asynchron kommen; das
  // ist kein State im Effekt, sondern eine Reaktion auf ein Ergebnis.
  useEffect(() => {
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
  }, []);

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
