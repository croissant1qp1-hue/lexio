"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSprachFarbe } from "@/lib/sprachen-farbe";
import { holeJson, ApiFehler } from "@/lib/api-client";
import { xpFormatieren } from "@/lib/profil";
import type { ProfilDaten } from "@/components/navbar/profil-karte";
import styles from "./uebersicht.module.css";

type SetZeile = {
  id: string;
  name: string;
  sprache: string;
  kartenGesamt: number;
  kartenGelernt: number;
  kartenFaellig: number;
  fortschrittProzent: number;
  eigenesSet?: boolean;
  /** true, wenn das Set dieser Person gehoert. Aus 003. */
  eigen?: boolean;
};

type Meldung = { text: string; fehler: boolean } | null;

/**
 * Uebersicht nach Mockup-Screen #0: Begruessung mit echten XP- und
 * Streak-Badges, grosse Karteikarten-Karte, darunter das Raster aller Sets.
 *
 * Zwei Dinge, die vorher fest verdrahtet waren und jetzt nicht mehr:
 *   - "Hallo Theo" und "6777 XP / 18 Tage Streak" kommen aus /api/profil.
 *   - "Lerne heute 10 neue Wörter" wird aus der Zahl der faelligen Karten
 *     gebildet. Die 10 waren ein Mockup-Wert; niemand mit drei faelligen
 *     Karten soll vorgesetzt bekommen werden, sich zehn vorzunehmen.
 */
export default function Uebersicht() {
  const router = useRouter();

  const [sets, setSets] = useState<SetZeile[]>([]);
  const [profil, setProfil] = useState<ProfilDaten | null>(null);
  const [laden, setLaden] = useState(true);
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [loescht, setLoescht] = useState<string | null>(null);

  const ladeSets = useCallback(async () => {
    const daten = await holeJson<SetZeile[]>("/api/karteikarten", []);
    setSets(Array.isArray(daten) ? daten : []);
  }, []);

  useEffect(() => {
    let abgebrochen = false;

    // Sets und Profil parallel: die Begruessung braucht beides, und das
    // Profil darf die Liste nicht aufhalten.
    Promise.all([
      holeJson<SetZeile[]>("/api/karteikarten", []),
      holeJson<ProfilDaten | null>("/api/profil", null),
    ])
      .then(([setDaten, profilDaten]) => {
        if (abgebrochen) return;
        setSets(Array.isArray(setDaten) ? setDaten : []);
        setProfil(profilDaten);
      })
      .catch((fehler) => {
        /*
         * Die beiden Abrufe haben einen Ersatzwert, deshalb wird hier nur die
         * 401 durchgereicht – und die behandelt holeJson selbst: der Browser
         * wird zur Anmeldung geschickt, es gibt nichts anzuzeigen. Ohne dieses
         * catch bliebe die Ablehnung als unbehandelte Promise im Log stehen.
         */
        if (abgebrochen) return;
        setMeldung({
          text:
            fehler instanceof ApiFehler
              ? fehler.message
              : "Übersicht konnte nicht geladen werden.",
          fehler: true,
        });
      })
      .finally(() => {
        if (!abgebrochen) setLaden(false);
      });

    return () => {
      abgebrochen = true;
    };
  }, []);

  // Meldung verschwindet von selbst, sonst bleibt sie bis zum Neuladen stehen.
  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(() => setMeldung(null), 4000);
    return () => clearTimeout(t);
  }, [meldung]);

  async function setLoeschen(set: SetZeile) {
    /*
     * confirm() ist hier richtig: das Loeschen ist nicht rueckgaengig zu machen,
     * und ein eigener Bestaetigungsdialog waere hier mehr Code als Nutzen.
     *
     * Kein Loesch-Knopf fuer fremde oder globale Sets: die Datenbank lehnt es
     * ab, aber ein Knopf, der immer einen Fehler produziert, ist eine
     * Beleidigung der Bedienung.
     */
    if (!set.eigen) return;

    const bestaetigt = window.confirm(
      `„${set.name}" wirklich loeschen?\n\n` +
        `Dabei werden auch alle ${set.kartenGesamt} Vokabeln in diesem Set geloescht. ` +
        `Das laesst sich nicht rueckgaengig machen.`,
    );
    if (!bestaetigt) return;

    setLoescht(set.id);
    try {
      await holeJson(`/api/sets/${encodeURIComponent(set.id)}`, null, { method: "DELETE" });
      setMeldung({ text: `„${set.name}" geloescht.`, fehler: false });
      await ladeSets();
    } catch (fehler) {
      setMeldung({
        text:
          fehler instanceof ApiFehler
            ? fehler.message
            : "Set konnte nicht geloescht werden. Bitte Verbindung pruefen.",
        fehler: true,
      });
    } finally {
      setLoescht(null);
    }
  }

  // Das Set mit den meisten faelligen Karten gewinnt: "Weiter lernen" soll
  // dort landen, wo es etwas zu tun gibt.
  const naechstes = [...sets]
    .filter((s) => s.kartenFaellig > 0)
    .sort((a, b) => b.kartenFaellig - a.kartenFaellig)[0];

  const faelligGesamt = sets.reduce((sum, s) => sum + (s.kartenFaellig || 0), 0);

  // "Lerne heute 12 Wörter" oder "Alles gelernt" – die Zahl kommt aus den
  // Daten, nicht aus dem Mockup.
  const lernText = faelligGesamt
    ? `Lerne heute ${faelligGesamt} ${faelligGesamt === 1 ? "Wort" : "Wörter"}.`
    : naechstes
      ? `Du bist auf dem neuesten Stand. ${naechstes.kartenGelernt} von ${naechstes.kartenGesamt} Karten gelernt.`
      : "Lege dein erstes Set an und lerne sofort los.";

  return (
    <div className={styles.seite}>
      <header className={styles.begruessung}>
        <div className={styles.begruessungText}>
          <h1 className={styles.begruessungHallo}>
            {profil ? `Hallo ${profil.vorname},` : "Hallo,"}
          </h1>
          <p className={styles.begruessungUnter}>Schön, dass du wieder da bist!</p>
        </div>
        {profil && (
          <div className={styles.abzeichen}>
            <span className={styles.abzeichenEintrag}>
              <i className="fa-solid fa-bolt" aria-hidden="true" />
              <span className={styles.abzeichenZahl}>{xpFormatieren(profil.xp)}</span> XP
            </span>
            <span className={styles.abzeichenEintrag}>
              <i className="fa-solid fa-fire" aria-hidden="true" />
              {profil.streak} {profil.streak === 1 ? "Tag" : "Tage"} Streak
            </span>
          </div>
        )}
      </header>

      <section className={styles.karte}>
        <div className={styles.karteText}>
          <h2 className={styles.karteTitel}>Karteikarten</h2>
          <p className={styles.karteText2}>{lernText}</p>
        </div>
        <div className={styles.karteAktion}>
          <button
            type="button"
            className={styles.knopf}
            disabled={!naechstes}
            onClick={() => naechstes && router.push(`/lernen/${naechstes.id}`)}
          >
            Weiter lernen
            <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className={styles.abschnitt}>
        <div className={styles.abschnittKopf}>
          <h2 className={styles.abschnittTitel}>Deine Sprachen</h2>
          <span className={styles.abschnittHinweis}>
            {sets.length} {sets.length === 1 ? "Set" : "Sets"}
          </span>
        </div>

        {laden ? (
          <div className={styles.raster}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skelett} />
            ))}
          </div>
        ) : sets.length === 0 ? (
          <div className={styles.leer}>
            <p className={styles.leerTitel}>Noch keine Vokabel-Sets</p>
            <p>Lege dein erstes Set an und lerne sofort los.</p>
            <button
              type="button"
              className={styles.leerKnopf}
              onClick={() => router.push("/karteikarten-hinzufuegen")}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Set anlegen
            </button>
          </div>
        ) : (
          <div className={styles.raster}>
            <button
              type="button"
              className={styles.neuKachel}
              onClick={() => router.push("/karteikarten-hinzufuegen")}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Neues Set
            </button>

            {sets.map((set) => {
              const farbe = getSprachFarbe(set.sprache);
              return (
                <div
                  key={set.id}
                  className={styles.kachel}
                  style={
                    {
                      backgroundColor: farbe.flaeche,
                      ["--kachelAkzent" as string]: farbe.akzent,
                    } as React.CSSProperties
                  }
                >
                  <button
                    type="button"
                    className={styles.kachelLernen}
                    onClick={() => router.push(`/lernen/${set.id}`)}
                    aria-label={`${set.name} lernen, ${set.kartenGelernt} von ${set.kartenGesamt} gelernt`}
                  >
                    <span className={styles.kachelSprache}>{set.sprache}</span>
                    <span className={styles.kachelName}>{set.name}</span>
                    <span className={styles.kachelFortschritt}>
                      {set.kartenGelernt}/{set.kartenGesamt} gelernt
                    </span>
                    <span className={styles.kachelBalken}>
                      <span
                        className={styles.kachelFuellung}
                        style={{ width: `${Math.min(100, Math.max(0, set.fortschrittProzent))}%` }}
                      />
                    </span>
                  </button>

                  {set.kartenFaellig > 0 && (
                    <span className={styles.kachelFaellig}>{set.kartenFaellig} fällig</span>
                  )}

                  {/* Nur eigene Sets. Bei Demosets gibt es nichts zu loeschen,
                      und die Route wuerde es auch ablehnen. */}
                  {set.eigen && (
                    <button
                      type="button"
                      className={styles.kachelLoeschen}
                      onClick={() => void setLoeschen(set)}
                      disabled={loescht === set.id}
                      aria-label={`Set ${set.name} loeschen`}
                      title="Set loeschen"
                    >
                      <i
                        className={
                          loescht === set.id
                            ? "fa-solid fa-spinner fa-spin"
                            : "fa-solid fa-trash-can"
                        }
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {meldung && (
        <div
          className={`${styles.meldung} ${meldung.fehler ? styles.meldungFehler : ""}`}
          role="status"
        >
          <i
            className={meldung.fehler ? "fa-solid fa-circle-exclamation" : "fa-solid fa-circle-check"}
            aria-hidden="true"
          />
          <span>{meldung.text}</span>
        </div>
      )}
    </div>
  );
}
