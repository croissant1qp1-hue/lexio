"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { holeJson, ApiFehler } from "@/lib/api-client";
import { IconBearbeiten, IconHaken, IconLoeschen } from "@/components/icone";
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
  set: { slug: string; name: string; eigen: boolean };
  karten: Karte[];
  anzahl: number;

  gekuerzt: boolean;
};

/** Der Text beim Bearbeiten, unveraendert gegenueber dem Listenfeld. */
type Entwurf = {
  frage: string;
  antwort: string;
  beispielsatz: string;
  beispielUebersetzung: string;
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

  /*
   * Welche Karte gerade bearbeitet oder zum Loeschen vorgemerkt ist – und ihr
   * Textentwurf.
   *
   * Alles drei in einem Zustand, weil es eine Frage ist: "welche Karte ist
   * gerade im Bearbeitungszustand". Zwei Karten gleichzeitig waere eine
   * Funktion, die man nicht braucht und die auf dem Handy den Bildschirm
   * mit zwei offenen Formularen fuellt.
   *
   * `null` heisst: nichts offen. Beim Bearbeiten ist das ein Zustand, in dem
   * die Zeile wieder wie eine Zeile aussieht – kein Platzhalter, kein
   * Ausgegrautes.
   */
  const [bearbeiten, setBearbeiten] = useState<{ id: string; entwurf: Entwurf } | null>(null);
  const [loeschenId, setLoeschenId] = useState<string | null>(null);

  const [arbeitet, setArbeitet] = useState(false);
  const [aktionFehler, setAktionFehler] = useState<string | null>(null);

  /*
   * Zaehler fuer den Fokus, kein Ref auf das Feld.
   *
   * Das Feld wird im Kind gerendert, nicht hier – ein Ref hier waere immer
   * `null`, und die Tastatur ginge nicht auf. Der Zaehler loest das ohne
   * Durchreichen: das Kind sieht, dass sich die Zahl geaendert hat, und legt
   * den Fokus selbst auf sein erstes `textarea`.
   *
   * `null` als Startwert heisst "noch nie fokussiert" – sonst wuerde beim
   * ersten Rendern der Fokus in ein Feld springen, das der Nutzer gar nicht
   * geoeffnet hat.
   */
  const [fokusAnlass, setFokusAnlass] = useState<number | null>(null);

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

  /*
   * Speichert den Bearbeitungsstand in die bereits geladene Liste.
   *
   * Bewusst KEIN neues Laden der ganzen Liste: bei 500 Karten waere das fuer
   * eine getippte Aenderung ein Ruecksprung ans Anfang, und der Filter, die
   * Sortierung und die Scrollposition stuenden dabei still. Geaendert wird
   * genau eine Zeile, also wird genau eine Zeile ersetzt.
   *
   * Das ist eine Optimierung, keine Regel gegen die Datenbank: gespeichert
   * hat die Route, und die Route entscheidet. Stimmt die Antwort nicht mit dem
   * uebernommenen Text ueberein – weil jemand anders dasselbe Set bearbeitet
   * hat –, dann steht hier trotzdem der gespeicherte Text, weil die Route
   * ihn zurueckschickt und nicht der Bildschirm ihn erraten hat.
   */
  async function speichern() {
    if (!bearbeiten) return;
    const { id, entwurf } = bearbeiten;

    const frage = entwurf.frage.trim();
    const antwort = entwurf.antwort.trim();

    /*
     * Dieselben Grenzen wie in der Route (200 Zeichen, 300 fuer Saetze). Hier
     * noch einmal zu pruefen ist nicht doppelt, sondern frueher: die Route
     * nennt im Fehlerfall, WELCHES Feld es war – aber erst nachdem der Knopf
     * gedrueckt wurde und die Tastatur wieder zu ist.
     */
    const zuLang: Record<string, string> = {};
    if (!frage) zuLang.frage = "Begriff fehlt";
    else if (frage.length > 200) zuLang.frage = "Maximal 200 Zeichen";
    if (!antwort) zuLang.antwort = "Übersetzung fehlt";
    else if (antwort.length > 200) zuLang.antwort = "Maximal 200 Zeichen";
    if (entwurf.beispielsatz.length > 300) {
      zuLang.beispielsatz = "Maximal 300 Zeichen";
    }
    if (entwurf.beispielUebersetzung.length > 300) {
      zuLang.beispielUebersetzung = "Maximal 300 Zeichen";
    }

    if (Object.keys(zuLang).length > 0) {
      setAktionFehler(
        zuLang.frage ?? zuLang.antwort ?? zuLang.beispielsatz ?? zuLang.beispielUebersetzung,
      );
      return;
    }

    setArbeitet(true);
    setAktionFehler(null);
    try {
      await holeJson(`/api/karten/${id}`, undefined, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frage,
          antwort,
          beispielsatz: entwurf.beispielsatz.trim(),
          beispielUebersetzung: entwurf.beispielUebersetzung.trim(),
        }),
      });
      setDaten((alt) =>
        alt
          ? {
              ...alt,
              karten: alt.karten.map((k) =>
                k.id === id
                  ? {
                      ...k,
                      frage,
                      antwort,
                      beispielsatz: entwurf.beispielsatz.trim(),
                      beispielUebersetzung: entwurf.beispielUebersetzung.trim(),
                    }
                  : k,
              ),
            }
          : alt,
      );
      setBearbeiten(null);
      setFokusAnlass(null);
    } catch (f) {
      setAktionFehler(
        f instanceof Error ? f.message : "Die Karte konnte nicht gespeichert werden.",
      );
    } finally {
      setArbeitet(false);
    }
  }

  /*
   * Loescht die Karte aus der geladenen Liste, ohne die Liste neu zu holen.
   *
   * `anzahl` wird mitgezählt, weil es im Kopf und im Hinweis auf
   * `gekuerzt` steht. Ohne Anpassung zeigte der Kopf nach dem Loeschen eine
   * Zahl, die um eins zu hoch war.
   */
  async function loeschen(id: string) {
    setArbeitet(true);
    setAktionFehler(null);
    try {
      await holeJson(`/api/karten/${id}`, undefined, { method: "DELETE" });
      setDaten((alt) => {
        if (!alt) return alt;
        const rest = alt.karten.filter((k) => k.id !== id);
        return { ...alt, karten: rest, anzahl: rest.length };
      });
      setLoeschenId(null);
    } catch (f) {
      setAktionFehler(
        f instanceof Error ? f.message : "Die Karte konnte nicht gelöscht werden.",
      );
    } finally {
      setArbeitet(false);
    }
  }

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

          {/*
           * Die Meldung steht ueber der Liste und nicht in der Zeile, die den
           * Fehler gemacht hat: die Zeile ist dann zugemacht und man sieht
           * nicht, welche gemeint war. Zusaetzlich wandert der Fokus nicht
           * zurueck – wer einen 300-Zeichen-Satz gekuerzt hat, soll seinen
           * Cursor behalten.
           */}
          {aktionFehler && (
            <p role="alert" className={styles.fehler}>
              {aktionFehler}
            </p>
          )}

          <dl className={styles.vokabelListe}>
            {sichtbar.map((k) => (
              <VokabelZeile
                key={k.id}
                karte={k}
                eigen={daten?.set.eigen ?? false}
                bearbeiten={bearbeiten?.id === k.id ? bearbeiten.entwurf : null}
                /*
                 * Nur die Zaehligaenderung zaehlt, nicht das Objekt: `bearbeiten`
                 * ist bei jedem Tastendruck ein neues Objekt, und `useEffect`
                 * auf dieses Objekt wuerde den Fokus bei jedem Buchstaben
                 * zuruecksetzen – mitten in die Eingabe.
                 */
                fokusAnlass={bearbeiten?.id === k.id ? fokusAnlass : null}
                onFeldAendern={(feld, wert) => {
                  setBearbeiten((alt) =>
                    alt ? { ...alt, entwurf: { ...alt.entwurf, [feld]: wert } } : alt,
                  );
                }}
                loeschenVorgemerkt={loeschenId === k.id}
                arbeitet={arbeitet}
                onBearbeiten={() => {
                  setAktionFehler(null);
                  setLoeschenId(null);
                  setBearbeiten({
                    id: k.id,
                    entwurf: {
                      frage: k.frage,
                      antwort: k.antwort,
                      beispielsatz: k.beispielsatz,
                      beispielUebersetzung: k.beispielUebersetzung,
                    },
                  });
                  setFokusAnlass((n) => (n === null ? 1 : n + 1));
                }}
                onBearbeitenAbbruch={() => {
                  setBearbeiten(null);
                  setFokusAnlass(null);
                }}
                onSpeichern={() => void speichern()}
                onLoeschen={() => {
                  setAktionFehler(null);
                  setBearbeiten(null);
                  setFokusAnlass(null);
                  setLoeschenId(k.id);
                }}
                onLoeschenAbbruch={() => setLoeschenId(null)}
                onLoeschenBestaetigen={() => void loeschen(k.id)}
              />
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
/**
 * Eine Vokabelzeile – als eigene Komponente, weil sie in drei Zustaende
 * zerfaellt: aufgeschaltet, bearbeitet, und zum Loeschen vorgemerkt.
 *
 * Als Teil der Schleife waere das ein Block mit sieben Bedingungen direkt im
 * Rendering, und die Frage "darf diese Zeile das ueberhaupt" faellt dann
 * zweimal auf – einmal fuer den Stift, einmal fuer den Muelleimer. Hier steht
 * sie einmal: `eigen`.
 *
 * WENN `eigen` FALSCH IST, GIBT ES KEINE KNOPFE. Kein Ausgegrautes, kein
 * Klick, der nichts tut. Die Karten eines Demo-Sets gehoeren allen; ein
 * Loeschknopf darauf waere eine Einladung, etwas zu zerstoeren, das einem
 * nicht gehoert.
 */
function VokabelZeile({
  karte,
  eigen,
  bearbeiten,
  fokusAnlass,
  onFeldAendern,
  loeschenVorgemerkt,
  arbeitet,
  onBearbeiten,
  onBearbeitenAbbruch,
  onSpeichern,
  onLoeschen,
  onLoeschenAbbruch,
  onLoeschenBestaetigen,
}: {
  karte: Karte;
  eigen: boolean;
  /** null = nicht im Bearbeitungszustand. */
  bearbeiten: Entwurf | null;
  /** Zaehler; null heisst "Fokus nicht setzen". */
  fokusAnlass: number | null;
  onFeldAendern: (feld: keyof Entwurf, wert: string) => void;
  loeschenVorgemerkt: boolean;
  arbeitet: boolean;
  onBearbeiten: () => void;
  onBearbeitenAbbruch: () => void;
  onSpeichern: () => void;
  onLoeschen: () => void;
  onLoeschenAbbruch: () => void;
  onLoeschenBestaetigen: () => void;
}) {
  const erstesFeld = useRef<HTMLTextAreaElement>(null);

  /*
   * Fokus in das erste Feld, wenn – und nur wenn – der Zaehler steigt.
   *
   * Ueber `useRef` und nicht ueber `autoFocus`: `autoFocus` feuert beim
   * Rendern, auch beim allerersten. Beim Ankommen auf der Seite wuerde die
   * Handy-Tastatur aufspringen, obwohl niemand etwas bearbeiten will – und
   * man kaeme nicht mehr aus der Liste heraus, ohne sie zu verlassen.
   */
  useEffect(() => {
    if (fokusAnlass === null) return;
    const feld = erstesFeld.current;
    if (!feld) return;
    feld.focus();
    // Nach dem Setzen an den Anfang: sonst steht der Cursor hinter dem Wort,
    // das man korrigieren wollte.
    feld.setSelectionRange(feld.value.length, feld.value.length);
  }, [fokusAnlass]);

  if (bearbeiten) {
    return (
      <div className={styles.vokabelZeile}>
        <dt className={styles.vokabelBegriff}>
          <label className={styles.feldGanz}>
            <span className={styles.feldName}>Begriff</span>
            {/*
             * `rows={1}` bei einer textarea: die Zeile waechst mit dem Text und
             * nicht nach einemischen Laengen. Bei `rows={2}` sieht eine
             * einzeilige Vokabel aus, als fehle etwas, und auf dem Handy
             * schiebt sich der Rest der Zeile aus dem Bild.
             */}
            <textarea
              ref={erstesFeld}
              className={styles.feld}
              value={bearbeiten.frage}
              onChange={(e) => onFeldAendern("frage", e.target.value)}
              rows={1}
              maxLength={200}
              disabled={arbeitet}
            />
          </label>
        </dt>
        <dd className={styles.vokabelAntwort}>
          <label className={styles.feldGanz}>
            <span className={styles.feldName}>Übersetzung</span>
            <textarea
              className={styles.feld}
              value={bearbeiten.antwort}
              onChange={(e) => onFeldAendern("antwort", e.target.value)}
              rows={1}
              maxLength={200}
              disabled={arbeitet}
            />
          </label>

          <label className={styles.feldGanz}>
            <span className={styles.feldName}>Beispielsatz (optional)</span>
            <textarea
              className={styles.feld}
              value={bearbeiten.beispielsatz}
              onChange={(e) => onFeldAendern("beispielsatz", e.target.value)}
              rows={2}
              maxLength={300}
              disabled={arbeitet}
            />
          </label>

          <label className={styles.feldGanz}>
            <span className={styles.feldName}>Übersetzung des Satzes (optional)</span>
            <textarea
              className={styles.feld}
              value={bearbeiten.beispielUebersetzung}
              onChange={(e) => onFeldAendern("beispielUebersetzung", e.target.value)}
              rows={2}
              maxLength={300}
              disabled={arbeitet}
            />
          </label>

          {/*
           * Kein `<form>`, kein `type=submit`.
           *
           * Der Knopf steht in der Kopfzeile, nicht unter vier Feldern. Sonst
           * muesste man auf dem Handy durch alles durchscrollen, um zum
           * Speichern zu kommen, und waere zur Kontrolle wieder oben.
           */}
          <div className={styles.zeilenAktionen}>
            <button
              type="button"
              className={styles.kleinKnopf}
              onClick={onBearbeitenAbbruch}
              disabled={arbeitet}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className={styles.kleinHaupt}
              onClick={onSpeichern}
              disabled={arbeitet}
            >
              {arbeitet ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </dd>
      </div>
    );
  }

  return (
    <div className={styles.vokabelZeile}>
      <dt className={styles.vokabelBegriff}>
        {karte.frage}
        {karte.gelernt && (
          <span className={styles.gelerntHaken}>
            <IconHaken title="gelernt" />
          </span>
        )}

        {/*
         * Die Aktionen stehen unter dem Begriff, nicht ueber der Zeile.
         *
         * Ueber der Zeile waeren sie beim Nachschlagen im Weg und wuerden den
         * Text verdecken. Diese Zeile ist ausserdem keine klickbare Flaeche wie
         * in der Uebersicht: es gibt kein "Zeile anfahren, dann kommt ein
         * Menue". Also zwei Knoepfe, die genau das tun, was sie sagen.
         */}
        {eigen && !loeschenVorgemerkt && (
          <span className={styles.zeilenAktionen}>
            <button
              type="button"
              className={styles.kleinKnopf}
              onClick={onBearbeiten}
              disabled={arbeitet}
              aria-label={`${karte.frage} bearbeiten`}
            >
              <IconBearbeiten />
              Bearbeiten
            </button>
            <button
              type="button"
              className={`${styles.kleinKnopf} ${styles.kleinGefahr}`}
              onClick={onLoeschen}
              disabled={arbeitet}
              aria-label={`${karte.frage} löschen`}
            >
              <IconLoeschen />
              Löschen
            </button>
          </span>
        )}
      </dt>

      <dd className={styles.vokabelAntwort}>
        {/*
         * Das Loeschen fragt nach, in der Zeile. Ein Dialog waere fuer einen
         * einzelnen Vokabelbegriff uebertrieben: es gibt keine zweite Aktion,
         * die man verwechseln koennte. Der Begriff steht im Confirm, damit man
         * nicht auf "ja" klickt, weil man die Zeile daneben fuer die richtige
         * hielt.
         */}
        {loeschenVorgemerkt ? (
          <span className={styles.loeschFrage}>
            <span className={styles.loeschText}>
              „{karte.frage}“ dauerhaft löschen?
            </span>
            <span className={styles.zeilenAktionen}>
              <button
                type="button"
                className={styles.kleinKnopf}
                onClick={onLoeschenAbbruch}
                disabled={arbeitet}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className={`${styles.kleinKnopf} ${styles.kleinGefahr}`}
                onClick={onLoeschenBestaetigen}
                disabled={arbeitet}
              >
                {arbeitet ? "Löscht…" : "Ja, löschen"}
              </button>
            </span>
          </span>
        ) : (
          <>
            {karte.antwort}
            {karte.beispielsatz && (
              <span className={styles.vokabelBeispiel}>
                {karte.beispielsatz}
                {karte.beispielUebersetzung && (
                  <>
                    {" "}
                    <span className={styles.vokabelBeispielUebersetzung}>
                      {karte.beispielUebersetzung}
                    </span>
                  </>
                )}
              </span>
            )}
          </>
        )}
      </dd>
    </div>
  );
}
