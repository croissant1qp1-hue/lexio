"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { farbeVonSprache, nameVonSprache, type SpracheInfo } from "@/lib/sprachen";
import { holeJson } from "@/lib/api-client";
import SetAktionen from "./set-aktionen";
import styles from "./karteikarten.module.css";

type SetZeile = {
  id: string;
  name: string;
  /** Seit 0.1 ein Objekt aus public.sprachen, kein Freitext. */
  sprache: SpracheInfo;
  kartenGesamt: number;
  kartenGelernt: number;
  kartenFaellig: number;
  fortschrittProzent: number;
  eigenesSet?: boolean;
  /** true = gehoert dieser Person. Aus 003. */
  eigen?: boolean;
  zuletztGelernt: string | null;
};

type SprachStat = { code: string | null; xp: number };

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

  /*
   * Zaehler statt einer zweiten Ladefunktion: nach dem Bearbeiten oder
   * Loeschen will die Liste denselben Weg erneut gehen, den sie beim
   * Oeffnen geht – und zwar den, der `null` von `[]` unterscheidet. Ein
   * blosses Neuzeichnen wuerde den alten Stand zeigen, ein
   * clientseitiges Wegpatchen der Zeile den Serverstand umgehen.
   *
   * `laden` wird hier absichtlich nicht wieder auf true gesetzt. Die Tabelle
   * ist beim Bearbeiten bereits da; ein Ladeblinken wuerde nur verraten,
   * dass sich im Hintergrund etwas getan hat.
   */
  const [ladeNr, setLadeNr] = useState(0);
  const neuLaden = useCallback(() => setLadeNr((n) => n + 1), []);

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

    return () => {
      abgebrochen = true;
    };
  }, [ladeNr]);

  // XP haengen an keinem Zustand der Tabelle, deshalb unabhaengig davon.
  useEffect(() => {
    let abgebrochen = false;

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

  /*
   * Die XP einer Sprache an ihrem Code, nicht an ihrem Namen.
   *
   * Vorher stand hier `eintrag.sprache.trim().toLowerCase().split(...)[0]` –
   * dieselbe Umformung wie in lib/sprachen-farbe.ts, ein zweites Mal an einer
   * zweiten Stelle. Jetzt ist der Code der Schluessel, und beide Seiten
   * kommen aus derselben Sprachliste: ein Fehler ist nicht mehr an zwei Orten
   * gleichzeitig noetig.
   */
  const xpNachSprache = useMemo(() => {
    const karte: Record<string, number> = {};
    for (const eintrag of xpJeSprache) {
      if (!eintrag.code) continue;
      karte[eintrag.code] = eintrag.xp ?? 0;
    }
    return karte;
  }, [xpJeSprache]);

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return sets;
    return sets.filter(
      (set) =>
        set.name.toLowerCase().includes(begriff) ||
        set.sprache.name.toLowerCase().includes(begriff),
    );
  }, [sets, suche]);

  return (
    <div className={styles.seite}>
      <header className={styles.kopf}>
        <div>
          <h1 className={styles.titel}>Karteikarten</h1>
          <p className={styles.untertitel}>
            {sets.length} {sets.length === 1 ? "Set" : "Sets"} im Wortschatz
          </p>
        </div>
        <div className={styles.kopfknöpfe}>
          <button
            type="button"
            className={styles.wortschatz}
            onClick={() => router.push("/wortschatz")}
          >
            <i className="fa-solid fa-layer-group" aria-hidden="true" />
            Wortschatz
          </button>
          <button
            type="button"
            className={styles.neu}
            onClick={() => router.push("/karteikarten-hinzufuegen/vokabeln-hinzufuegen")}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" />
            Vokabeln hinzufügen
          </button>
        </div>
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
                      style={{ backgroundColor: farbeVonSprache(set.sprache).flaeche }}
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
                        {nameVonSprache(set.sprache)}
                        {set.eigen ? " · eigenes Set" : ""}
                        {set.kartenFaellig > 0 ? ` · ${set.kartenFaellig} fällig` : ""}
                    </span>
                    {/*
                     * "Nochmal lernen", und zwar genau dann, wenn der normale
                     * Weg nicht fuehrt: nichts mehr faellig. Klick auf ein
                     * bereits gelerntes Set fuehrt sonst zur Meldung "Alles
                     * geschafft" – und der einzige Weg zurueck in die
                     * Karten waere morgen. Das ist die haeufigste Form von
                     * "ich will lernen und die App laesst mich nicht".
                     *
                     * Der Link traegt `modus=ueben`, weil die Fälligkeit in
                     * der Route gefiltert wird. Ein eigener Pfad statt eines
                     * Zustands im Client: die Lernseite ist damit auch per
                     * Lesezeichen und vom Startbildschirm aus aufrufbar.
                     */}
                    {set.kartenFaellig === 0 && set.kartenGesamt > 0 && (
                        <Link
                            href={`/lernen/${set.id}?modus=ueben`}
                            className={styles.nochmal}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
                            Nochmal lernen
                        </Link>
                    )}
                    {/*
                     * Der Weg zum Nachschlagen. Der Set-Name fuehrt zum Lernen
                     * und die Zeile ebenfalls – beides richtig, aber beides
                     * fuehrt nicht dorthin, wo man hingeht, wenn man wissen
                     * will, welche Woerter ueberhaupt drinstehen. Die Lernseite
                     * zeigt hoechstens den Stapel von heute; bei 100 Karten
                     * sieht man davon 20 und haelt es fuer den Bestand.
                     */}
                    {set.kartenGesamt > 0 && (
                        <Link
                            href={`/wortschatz/${set.id}`}
                            className={styles.nochmal}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <i className="fa-solid fa-list-ul" aria-hidden="true" />
                            Vokabeln ansehen
                        </Link>
                    )}
                  </span>
                    {/*
                     * Nur fuer eigene Sets. Bei den vorgefertigten Sets waere
                     * der Knopf eine Sackgasse: die Route gibt 403 zurueck,
                     * und der Nutzer haette vorher raten muessen, warum.
                     */}
                    {set.eigen && (
                      <SetAktionen
                        slug={set.id}
                        name={set.name}
                        sprache={set.sprache}
                        kartenAnzahl={set.kartenGesamt}
                        onGeaendert={neuLaden}
                      />
                    )}
                  </th>
                  <td className={`${styles.rechts} ${styles.zahl}`}>{set.kartenGelernt}</td>
                  <td className={`${styles.rechts} ${styles.zahl}`}>{set.kartenGesamt}</td>
                  <td className={`${styles.rechts} ${styles.zahl} ${styles.xp}`}>
                    {set.sprache.code ? (xpNachSprache[set.sprache.code] ?? 0) : 0}
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
