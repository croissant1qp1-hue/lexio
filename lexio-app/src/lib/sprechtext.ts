/**
 * Verbindet die Teile einer Kartenrueckseite fuer die Sprachausgabe.
 *
 * Rein, damit die Kuerzung testbar ist. expo-speech kennt keine
 * Warteschlange, also werden die Teile zu einem Text verbunden – dieselbe
 * Kuerzung wie "nochmal vorlesen" im Web: die Satzzeichen bleiben erhalten,
 * nur ein doppelter Schlusspunkt am Ende wird geschluckt. Leere Teile und
 * null fallen weg; nur gelesenes Material ist gemeint, leeres ergibt null.
 */
export function sprechText(teile: (string | null | undefined)[]): string | null {
  const texte = teile
    .filter(
      (teil): teil is string => typeof teil === "string" && teil.trim().length > 0,
    )
    .map((t) => t.trim());
  if (texte.length === 0) return null;
  return (texte.join(". ") + ".").replace(/\.{2,}$/, ".");
}