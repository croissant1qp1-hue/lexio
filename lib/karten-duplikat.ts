/**
 * Wann gilt ein Wortpaar als Doppeleingabe?
 *
 * Das ist die eine Frage, die zwei Stellen beantworten muessen: der Import
 * (`scripts/wortlisten-importieren.mjs`, der eine Wortlistendatei einliest) und
 * `POST`/`PATCH /api/karten` (der einem Nutzerpaar beim Speichern folgt). Wenn
 * die beiden unterschiedlich antworten, ist eine der beiden Pruefungen wertlos,
 * und man merkt es erst, wenn die eine Stelle Dubletten ablehnt und die andere
 * sie durchlaesst.
 *
 * Warum ueberhaupt: gemessen am 2026-10-04 im eigenen Testset
 * `englisch-testlauf`. `POST /api/karten` nahm dasselbe Paar zweimal an —
 * *dog/Hund* und *cat/Katze*, je zweimal, ohne dass etwas stoppte. In der
 * Lernrunde steht dasselbe Wort dann zweimal im Stapel, und der Fortschritt
 * zaehlt es zweimal. `public.karten` hat ausser `karten_pkey (id)` keine
 * Eindeutigkeitsbedingung, also fängt die Datenbank nichts ab.
 *
 * Verglichen wird auf **beide** Seiten. Die Alternative waere, nur die
 * englische Seite zu vergleichen — so arbeitet der Import, und das ist dort
 * Absicht: eine Wortliste enthaelt zu jedem Wort genau eine Karte. Fuer
 * Handeingaben ist das falsch. „Bank" (Bench) und „Bank" (Bank) sind
 * unterschiedliche Karten, und ein Lernender kann beide brauchen.
 *
 * Gross-/Kleinschreibung und Randleerzeichen zaehlen nicht als Unterschied:
 * „Hund", „hund" und „ Hund " sind fuer einen Lernenden dieselbe Karte, und
 * drei Eintraege dazu sind Rauschen.
 */

/** Ein Paar in der Form, in der beide Stellen ihre Daten halten. */
export type PaarT = { frage: string; antwort: string };

/**
 * Der Vergleichsschluessel: getrimmt, ohne Gross-/Kleinschreibung.
 *
 * `JSON.stringify` statt eines Trennzeichens: bei `frage = "a|b"` waere ein
 * Trennzeichen mehrdeutig, `a` + `b` waere nicht von `a|b` zu unterscheiden.
 */
export function paarSchluessel(frage: unknown, antwort: unknown): string {
  const f = typeof frage === "string" ? frage.trim().toLowerCase() : "";
  const a = typeof antwort === "string" ? antwort.trim().toLowerCase() : "";
  return JSON.stringify([f, a]);
}

/**
 * Welche der neuen Paare gibt es schon?
 *
 * Geprueft wird gegen zwei Bestände, und beide sind noetig:
 *
 *   - `bestand`: was schon in der Datenbank steht. Sonst prüft man nur die
 *     eigenen Eingaben gegeneinander und nennt das eine Dublettensperre.
 *   - die früheren Einträge aus `neue` selbst. Sonst genügt ein Stapel, in dem
 *     dasselbe Paar zweimal steht, um die Prüfung zu umgehen — und genau das ist
 *     der Fall, der beim Import am 2026-10-04 durchgerutscht ist.
 *
 * Zurückgegeben werden die Indizes aus `neue`, nicht die Paare: der Aufrufer
 * braucht die Position, um die Meldung an die richtige Zeile zu haengen.
 */
export function doppelteIndizes(neue: PaarT[], bestand: PaarT[]): number[] {
  const vorhanden = new Set(bestand.map((p) => paarSchluessel(p.frage, p.antwort)));
  const gesehen = new Set<string>();
  const treffer: number[] = [];

  neue.forEach((paar, index) => {
    const schluessel = paarSchluessel(paar.frage, paar.antwort);
    if (vorhanden.has(schluessel) || gesehen.has(schluessel)) {
      treffer.push(index);
      return;
    }
    gesehen.add(schluessel);
  });

  return treffer;
}

/** Der Satz, den der Nutzer zu sehen bekommt. */
export function duplikatMeldung(paar: PaarT): string {
  const f = paar.frage.trim();
  const a = paar.antwort.trim();
  return `„${f} / ${a}“ steht schon in diesem Set`;
}