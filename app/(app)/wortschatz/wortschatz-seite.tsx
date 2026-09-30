"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { farbeVonSprache, nameVonSprache, type SpracheInfo } from "@/lib/sprachen";
import { holeJson } from "@/lib/api-client";
import styles from "./wortschatz.module.css";

type WortEintrag = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string | null;
  beispielUebersetzung: string | null;
  set: {
    id: string;
    name: string;
    sprache: SpracheInfo;
    eigen: boolean;
  } | null;
};

/**
 * Wortschatz – alle Vokabeln quer durch alle sichtbaren Sets, mit Suche.
 *
 * Plan 2.4 loest damit die alte Weiterleitung auf /karteikarten ein: dort
 * steht die Set-Uebersicht mit Fortschritt, hier die Wortliste, nach der der
 * Menueeintrag benannt ist. Die Sichtbarkeit regelt die RLS auf `karten`
 * (eine Karte ist lesbar, sobald ihr Set es ist) – die Route prueft das,
 * der Client darf es als gegeben annehmen.
 *
 * Suche und Liste sind beide clientseitig. Bei einigen tausend Eintraegen
 * ist das Filtern im Browser schneller als jede Runde durch die API, und
 * die Daten kommen einmal statt pro Tastendruck.
 */
export default function WortschatzSeite() {
  const router = useRouter();

  const [woerter, setWoerter] = useState<WortEintrag[]>([]);
  const [suche, setSuche] = useState("");
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;

    holeJson<WortEintrag[] | null>("/api/wortschatz", null)
      .then((daten) => {
        if (abgebrochen) return;
        if (daten === null) {
          setFehler("Wortschatz konnte nicht geladen werden.");
          setWoerter([]);
          return;
        }
        setWoerter(daten);
        setFehler(null);
      })
      .catch(() => {
        if (abgebrochen) return;
        setFehler("Wortschatz konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!abgebrochen) setLaden(false);
      });

    return () => {
      abgebrochen = true;
    };
  }, []);

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return woerter;
    return woerter.filter(
      (w) =>
        w.frage.toLowerCase().includes(begriff) ||
        w.antwort.toLowerCase().includes(begriff) ||
        (w.beispielsatz ?? "").toLowerCase().includes(begriff),
    );
  }, [woerter, suche]);

  return (
    <div className={styles.wortschatz}>
      <header className={styles.kopf}>
        <div>
          <h1 className={styles.titel}>Wortschatz</h1>
          <p className={styles.untertitel}>
            {woerter.length} {woerter.length === 1 ? "Vokabel" : "Vokabeln"}
            {woerter.length > 0 ? " in allen Sets" : ""}
          </p>
        </div>
        <button
          type="button"
          className={styles.zurueck}
          onClick={() => router.push("/karteikarten")}
        >
          <i className="fa-solid fa-layer-group" aria-hidden="true" />
          Set-Übersicht
        </button>
      </header>

      <div className={styles.suchfeld}>
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Wort, Übersetzung oder Beispielsatz suchen"
          aria-label="Wortschatz durchsuchen"
        />
      </div>

      {laden ? (
        <div className={styles.skelett} />
      ) : fehler ? (
        <p className={styles.fehler}>{fehler}</p>
      ) : gefiltert.length === 0 ? (
        <p className={styles.leer}>
          {woerter.length === 0
            ? "Noch keine Vokabeln vorhanden."
            : `Nichts gefunden für „${suche.trim()}".`}
        </p>
      ) : (
        <ul className={styles.liste}>
          {gefiltert.map((w) => (
            <li key={w.id} className={styles.zeile}>
              <div className={styles.text}>
                <span className={styles.begriff}>{w.frage}</span>
                <span className={styles.uebersetzung}>{w.antwort}</span>
                {w.beispielsatz && (
                  <>
                    <span className={styles.beispiel}>„{w.beispielsatz}“</span>
                    {w.beispielUebersetzung && (
                      <span className={styles.beispielUebersetzung}>
                        {w.beispielUebersetzung}
                      </span>
                    )}
                  </>
                )}
              </div>

              {w.set && (
                <div className={styles.setSeite}>
                  <span className={styles.setBild}>
                    <span
                      className={styles.punkt}
                      style={{ backgroundColor: farbeVonSprache(w.set.sprache).flaeche }}
                      aria-hidden="true"
                    />
                    {nameVonSprache(w.set.sprache)}
                  </span>
                  <a className={styles.setName} href={`/lernen/${w.set.id}`}>
                    {w.set.name}
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}