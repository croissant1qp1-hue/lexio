"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { holeJson, ApiFehler } from "@/lib/api-client";
import { IconHaken } from "@/components/icone";
import styles from "./wortschatz.module.css";

type Karte = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string;
  beispielUebersetzung: string;
  gelernt: boolean;
  stufe: number;
  fehler: number;
  faellig: boolean;
};

type Antwort = {
  set: { slug: string; name: string };
  karten: Karte[];
  anzahl: number;
  
  gekuerzt: boolean;
};

/**
 * Alle Vokabeln eines Sets.
 *
 * Bewusst eine Liste und keine Kartenansicht: der Zweck ist Nachschlagen,
 * nicht Lernen. Wer lernen will, hat dafuer die Lernansicht mit den vier
 * Bewertungsknoepfen – eine Liste, die nach Lernen aussieht, verwechselt
 * das nur.
 *
 * Der Lernstand steht als Text an jedem Paar, nicht als Farbe allein. "Gelernt"
 * als gruenes Kästchen ist fuer jemanden, der die Farbe sieht; fuer alle
 * anderen ist es ein Unterschied, den man nicht bemerkt.
 */
export default function VokabelnSeite({ setSlug }: { setSlug: string }) {
  const router = useRouter();
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<"alle" | "offen" | "gelernt">("alle");
  /*
   * Zaehler statt eines `laden()`-Aufrufs im Knopf.
   *
   * Ein erneutes Laden ist genau ein Fall: nach einem Fehler. `setLaden(true)`
   * im Klick-Handler wuerde zwar funktionieren, aber der Effekt haette danach
   * keine Abhaengigkeit, an der er die neue Anfrage erkennt. Der Zaehler
   * ist die Abhaengigkeit – so wie `setRunde` in der Lernseite.
   */
  const [anlass, setAnlass] = useState(0);

  useEffect(() => {
    let abgebrochen = false;

    (async () => {
      try {
        // `encodeURIComponent` ist hier Pflicht, nicht Sparsamkeit: ein Slug
        // koennte ein "/" enthalten, und das waere sonst ein Pfad statt eines
        // Parameters.
        const antwort = await holeJson<Antwort>(
          `/api/karten?setSlug=${encodeURIComponent(setSlug)}`,
        );
        if (abgebrochen) return;
        setDaten(antwort);
        setFehler(null);
      } catch (e) {
        if (abgebrochen) return;
        setFehler(e instanceof ApiFehler ? e.message : "Die Vokabeln konnten nicht geladen werden.");
      } finally {
        // Auch das im `finally`, aber nicht synchron: setState direkt im
        // Effekt-Rumpf erzwingt einen zweiten Render, und der Lint-Regel
        // ("cascading renders") zu Recht.
        if (!abgebrochen) setLaden(false);
      }
    })();

    return () => {
      abgebrochen = true;
    };
  }, [setSlug, anlass]);

  if (laden) {
    return <div className={styles.spalte}>Wird geladen …</div>;
  }

  if (fehler) {
    return (
      <div className={styles.spalte}>
        <p role="alert">{fehler}</p>
        <button type="button" onClick={() => setAnlass((a) => a + 1)}>
          Erneut versuchen
        </button>
        <button type="button" onClick={() => router.push("/wortschatz")}>
          Zur Wortschatz-Übersicht
        </button>
      </div>
    );
  }

  const alle = daten?.karten ?? [];
  const sichtbar = alle.filter((k) =>
    filter === "alle" ? true : filter === "gelernt" ? k.gelernt : !k.gelernt,
  );
  const gelerntAnzahl = alle.filter((k) => k.gelernt).length;

  return (
    <div className={styles.spalte}>
      <header className={styles.kopf}>
        <button
          type="button"
          className={styles.zurueck}
          onClick={() => router.push("/wortschatz")}
          aria-label="Zurück zur Wortschatz-Übersicht"
        >
          ‹ Wortschatz
        </button>
        <h1 className={styles.titel}>{daten?.set.name}</h1>
        <p className={styles.untertitel}>
          {alle.length} {alle.length === 1 ? "Vokabel" : "Vokabeln"}
          {alle.length > 0 && (
            <>
              {" · "}
              {gelerntAnzahl} gelernt
            </>
          )}
        </p>
      </header>

      {daten?.gekuerzt && (
        <p role="status" className={styles.hinweisBox}>
          Es werden nur die ersten {daten.anzahl} Vokabeln angezeigt. Für ein Set dieser Größe
          gibt es noch keine vollständige Ansicht.
        </p>
      )}

      {alle.length === 0 ? (
        <p className={styles.untertitel}>
          In diesem Set steht noch nichts. Füge zuerst Vokabeln hinzu.
        </p>
      ) : (
        <>
          <div className={styles.filterZeile} role="group" aria-label="Vokabeln filtern">
            {(
              [
                ["alle", `Alle ${alle.length}`],
                ["offen", `Offen ${alle.length - gelerntAnzahl}`],
                ["gelernt", `Gelernt ${gelerntAnzahl}`],
              ] as const
            ).map(([wert, beschriftung]) => (
              <button
                key={wert}
                type="button"
                className={styles.filterKnopf}
                aria-pressed={filter === wert}
                onClick={() => setFilter(wert)}
              >
                {beschriftung}
              </button>
            ))}
          </div>

          <dl className={styles.vokabelListe}>
            {sichtbar.map((k) => (
              <div key={k.id} className={styles.vokabelZeile}>
                <dt className={styles.vokabelBegriff}>
                  {k.frage}
                  {k.gelernt ? (
                    <span className={styles.gelerntHaken}>
                      <IconHaken title="gelernt" />
                    </span>
                  ) : null}
                </dt>
                <dd className={styles.vokabelAntwort}>
                  {k.antwort}
                  {k.beispielsatz && (
                    <span className={styles.vokabelBeispiel}>
                      {k.beispielsatz}
                      {k.beispielUebersetzung && (
                        <>
                          {" "}
                          <span className={styles.vokabelBeispielUebersetzung}>
                            {k.beispielUebersetzung}
                          </span>
                        </>
                      )}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {sichtbar.length === 0 && (
            <p className={styles.untertitel}>In diesem Filter steht keine Vokabel.</p>
          )}
        </>
      )}

      <div className={styles.aktionen}>
        <button type="button" className={styles.knopf} onClick={() => router.push(`/lernen/${setSlug}`)}>
          Set lernen
        </button>
      </div>
    </div>
  );
}