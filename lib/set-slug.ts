/**
 * Macht aus einem frei getippten Set-Namen einen URL-tauglichen Slug.
 *
 * "Reise nach Rom" -> "reise-nach-rom"
 * "  Übung 2!  "    -> "uebung-2"
 *
 * Umlaute werden ersetzt statt transliteriert: "München" -> "munchen". Das
 * ist lesbarer als "muenchen" und der Slug muss nirgends schoen aussehen,
 * er steht nur in der Datenbank.
 */
export function slugifySetzName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    // Zerlegt die Umlaute in Grundbuchstabe + combining mark, dann fliegt
    // nur der Buchstabe uebrig und das Zeichen wird wieder zusammengesetzt.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Alles weg, was nur aus Ziffern oder Sonderzeichen bestand ("???", "123").
  // Ohne diesen Fall ergaebe slugifySetzName("") einen leeren Slug, und
  // leerer Slug ist in Postgres ein gueltiger, aber sinnloser Wert.
  return slug || "set";
}
