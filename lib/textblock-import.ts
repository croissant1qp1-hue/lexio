/*
 * Textblock-Import (Plan 2.3): Listen von Vokabeln, die jemand aus einer
 * anderen App oder Tabellenkalkulation kopiert, in Wortpaare zerlegen.
 *
 * Die Funktion ist bewusst ohne React/Next geschrieben: reine Strings rein,
 * strukturierte Paare raus, und mit `node lib/textblock-import.ts` testbar
 * (Node 24 liest .ts direkt). Die Oberflaeche legt nur darueber.
 *
 * Formatvermutung: eine Vokabel je Zeile, Trennzeichen zwischen Begriff und
 * Uebersetzung. Der Sonderfall "Englisch nach links, Deutsch nach rechts"
 * ist nur eine Ausrichtung der Spalten – hier bleibt Spalte 1 immer der
 * Begriff (frage) und Spalte 2 die Uebersetzung (antwort).
 */

export type TextblockPaar = {
  frage: string;
  antwort: string;
  beispiel: string;
  beispielUebersetzung: string;
};

export type TextblockErgebnis = {
  paare: TextblockPaar[];
  /** Zeilen, die mehr als 4 Spalten hatten und deshalb wegfielen. */
  uebersprungen: number;
  /** Zeilen, die gar kein erkanntes Trennzeichen enthielten (einzelnes Wort). */
  ohneTrenner: number;
  /** Das Trennzeichen, das am haeufigsten vorkam – oder null bei keinem. */
  trenner: string | null;
};

/*
 * Reihenfolge ist zugleich Prioritaet bei Gleichstand. Der Tabulator steht
 * oben, weil Listen aus Tabellenkalkulationen fast immer mit Tabs kopiert
 * werden – da ist die Zuordnung am wenigsten mehrdeutig.
 */
const KANDIDATEN = ["\t", ";", "|", "->", "=", ":", " - "] as const;

const MAX_SPALTEN = 4;

function trimZellen(roh: string): string[] {
  return roh
    .split(/\r?\n/)
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0);
}

/** Zaehlt, in wie vielen Zeilen ein Kandidat vorkommt; nimmt den haeufigsten. */
export function erkenneTrenner(zeilen: string[]): string | null {
  let bester: string | null = null;
  let besteZahl = 0;
  for (const kandidat of KANDIDATEN) {
    const zahl = zeilen.filter((z) => z.includes(kandidat)).length;
    if (zahl > besteZahl) {
      bester = kandidat;
      besteZahl = zahl;
    }
  }
  return besteZahl > 0 ? bester : null;
}

export function textblockZuPaaren(text: string): TextblockErgebnis {
  const zeilen = trimZellen(text);
  if (zeilen.length === 0) {
    return { paare: [], uebersprungen: 0, ohneTrenner: 0, trenner: null };
  }

  const trenner = erkenneTrenner(zeilen);
  if (!trenner) {
    return {
      paare: [],
      uebersprungen: 0,
      ohneTrenner: zeilen.length,
      trenner: null,
    };
  }

  const paare: TextblockPaar[] = [];
  let ohneTrenner = 0;
  let uebersprungen = 0;

  for (const zeile of zeilen) {
    const zellen = zeile.split(trenner).map((z) => z.trim());

    if (zellen.length === 1) {
      /*
       * Kein Trenner in dieser Zeile (der Trenner wurde nur in anderen Zeilen
       * gefunden): als einzelnes Wort mit leerer Uebersetzung durchreichen.
       * Die Vorschau markiert es dann als "Uebersetzung fehlt", und der Nutzer
       * traegt sie nach – besser als die Zeile stillschweigend zu verlieren.
       */
      ohneTrenner += 1;
      paare.push({ frage: zellen[0], antwort: "", beispiel: "", beispielUebersetzung: "" });
      continue;
    }

    if (zellen.length > MAX_SPALTEN) {
      uebersprungen += 1;
      continue;
    }

    paare.push({
      frage: zellen[0] ?? "",
      antwort: zellen[1] ?? "",
      beispiel: zellen[2] ?? "",
      beispielUebersetzung: zellen[3] ?? "",
    });
  }

  return { paare, uebersprungen, ohneTrenner, trenner };
}