"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSprachFarbe } from "@/lib/sprachen-farbe";
import { holeJson } from "@/lib/api-client";
import styles from "./karteikarten.module.css";

type SetZeile = {
  id: string;
  name: string;
  sprache: string;
  kartenGesamt: number;
  kartenGelernt: number;
  kartenFaellig: number;
  fortschrittProzent: number;
  eigenesSet?: boolean;
  /** true = gehoert dieser Person. Aus 003. */
  eigen?: boolean;
  zuletztGelernt: string | null;
};

type SprachStat = { sprache: string; xp: number };

/**
 * Holt die Sets. Freie Funktion ohne State, damit der Effekt sie aufrufen
 * darf, ohne synchron im Effekt-Rumpf State zu setzen
 * (react-hooks/set-state-in-effect).
 *
 * Der Fallback ist null statt [], damit ein Fehler von "leer" unterscheidbar
 * bleibt. Sonst zeigt ein Datenbankfehler dieselbe Seite wie ein leerer
 * Wortschatz, und niemand weiss, ob etwas fehlt oder etwas kaputt ist.
 */
function holeKarteikarten(): Promise<SetZeile[] | null> {
  return holeJson<SetZeile[] | null>("/api/karteikarten", null);
}

/**
 * XP gibt es nur je Sprache, nicht je Set. Die Tabelle zeigt daher den
 * Sprach-Wert in jeder Zeile dieser Sprache. Das ist ehrlicher als eine
 * erfundene Aufteilung, die sich beim Lernen als falsch herausstellt.
 *
 * Ein Fehler ist hier kein Grund fuer eine Meldung: die Spalte waere dann
 * 0, und das ist dieselbe Zahl wie bei einem Set, zu dem noch keine XP
 * gehoeren. Der Nutzer kann den Unterschied ohnehin nicht erkennen.
 */
function holeSprachenXp(): Promise<SprachStat[]> {
  return holeJson<SprachStat[] | null>("/api/sprachen-stats", null).then((d) => d ?? []);
}

/** "vor 3 Tagen" statt "2026-09-23" – der Abstand ist die interestingere Zahl. */
function zeitHer(text: string | null): string {
  if (!text) return "–";
  const datum = new Date(text);
  if (Number.isNaN(datum.getTime())) return "–";

  const tage = Math.floor((Date.now() - datum.getTime()) / 86_400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  if (tage < 30) return `vor ${Math.floor(tage / 7)} Wo.`;
  return datum.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function KarteikartenSeite() {
  const router = useRouter();

  const [sets, setSets] = useState<SetZeile[]>([]);
  const [xpJeSprache, setXpJeSprache] = useState<SprachStat[]>([]);
  const [suche, setSuche] = useState("");
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;

    holeKarteikarten()
      .then((daten) => {
        if (abgebrochen) return;
        if (daten === null) {
          setFehler("Karteikarten konnten nicht geladen werden.");
          setSets([]);
          return;
        }
        setSets(daten);
        setFehler(null);
      })
      .catch(() => {
        if (abgebrochen) return;
        setFehler("Karteikarten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (!abgebrochen) setLaden(false);
      });

    // XP haengen an keinem Zustand der Tabelle, deshalb unabhaengig davon.
    holeSprachenXp()
      .then((daten) => {
        if (abgebrochen) return;
        setXpJeSprache(daten);
      })
      .catch(() => undefined);

    return () => {
      abgebrochen = true;
    };
  }, []);

  const xpNachSprache = useMemo(() => {
    const karte: Record<string, number> = {};
    for (const eintrag of xpJeSprache) {
      // Wie in sprachen-farbe.ts: "Italienisch Urlaub" -> "italienisch".
      const key = eintrag.sprache.trim().toLowerCase().split(/[\s\-_/]+/)[0] ?? "";
      karte[key] = eintrag.xp ?? 0;
    }
    return karte;
  }, [xpJeSprache]);

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return sets;
    return sets.filter(
      (set) =>
        set.name.toLowerCase().includes(begriff) || set.sprache.toLowerCase().includes(begriff),
    );
  }, [sets, suche]);

  const spracheKey = (sprache: string) =>
    sprache.trim().toLowerCase().split(/[\s\-_/]+/)[0] ?? "";

  return (
    <div className={styles.seite}>
      <header className={styles.kopf}>
        <div>
          <h1 className={styles.titel}>Karteikarten</h1>
          <p className={styles.untertitel}>
            {sets.length} {sets.length === 1 ? "Set" : "Sets"} im Wortschatz
          </p>
        </div>
        <button
          type="button"
          className={styles.neu}
          onClick={() => router.push("/karteikarten-hinzufuegen/vokabeln-hinzufuegen")}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />
          Vokabeln hinzufügen
        </button>
      </header>

      <div className={styles.suchfeld}>
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Set oder Sprache suchen"
          aria-label="Karteikarten durchsuchen"
        />
      </div>

      {laden ? (
        <div className={styles.skelett} />
      ) : fehler ? (
        <p className={styles.fehler}>{fehler}</p>
      ) : gefiltert.length === 0 ? (
        <p className={styles.leer}>
          {sets.length === 0
            ? "Noch keine Sets vorhanden."
            : `Nichts gefunden für „${suche.trim()}".`}
        </p>
      ) : (
        <div className={styles.tabellenRahmen}>
          <table className={styles.tabelle}>
            <thead>
              <tr>
                <th scope="col">Sprache</th>
                <th scope="col" className={styles.rechts}>
                  Gelernt
                </th>
                <th scope="col" className={styles.rechts}>
                  Total
                </th>
                <th scope="col" className={styles.rechts}>
                  XP
                </th>
                <th scope="col">Zuletzt gelernt</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((set) => (
                /*
                 * Die Zeile war ein <tr onClick> mit tabIndex – also eine
                 * erfundene Schaltflaeche. Sie liess sich mit Tab ansteuern,
                 * war aber kein Link: kein Mittelklick, kein Kopieren der
                 * Adresse, kein "Link in neuem Tab", und Screenreader
                 * ansagten "Zeile".
                 *
                 * Jetzt ist der Name ein echter Link und die ganze Zeile
                 * nur noch eine Klick-Flaeche darueber. Die Tastatur kommt
                 * ueber den Link, die Maus ueber beides.
                 */
                <tr
                  key={set.id}
                  className={styles.zeile}
                  onClick={() => router.push(`/lernen/${set.id}`)}
                >
                  <th scope="row" className={styles.sprachZelle}>
                    <span
                      className={styles.punkt}
                      style={{ backgroundColor: getSprachFarbe(set.sprache).flaeche }}
                      aria-hidden="true"
                    />
                    <span className={styles.text}>
                      <Link
                        href={`/lernen/${set.id}`}
                        className={styles.name}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {set.name}
                      </Link>
                      <span className={styles.meta}>
                        {set.sprache}
                        {set.eigen ? " · eigenes Set" : ""}
                        {set.kartenFaellig > 0 ? ` · ${set.kartenFaellig} fällig` : ""}
                      </span>
                    </span>
                  </th>
                  <td className={`${styles.rechts} ${styles.zahl}`}>{set.kartenGelernt}</td>
                  <td className={`${styles.rechts} ${styles.zahl}`}>{set.kartenGesamt}</td>
                  <td className={`${styles.rechts} ${styles.zahl} ${styles.xp}`}>
                    {xpNachSprache[spracheKey(set.sprache)] ?? 0}
                  </td>
                  <td className={styles.datum}>{zeitHer(set.zuletztGelernt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
