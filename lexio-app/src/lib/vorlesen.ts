import * as Speech from "expo-speech";

/**
 * Sprachausgabe in der App (Phase 7) – Gegenstueck zu lib/sprachausgabe.ts
 * im Web. Der Plan benennt diesen Austauschpunkt ausdruecklich: das Web
 * nutzt die Sperrklinke `speechSynthesis` des Browsers, die App spricht
 * ueber den nativen TTS der Plattform (expo-speech).
 *
 * Anders als im Web gibt expo-speech keine Voiceliste aus; die Stimme waehlt
 * die Plattform ueber den Sprachcode selbst. Eine eigene `stimmeFuer`-
 * Funktion wuerde hier also eine Einstellung vortaeuschen, die es gar nicht
 * gibt – deshalb bewusst keine.
 */

function sprechbar(text: string | null | undefined): boolean {
  return typeof text === "string" && text.trim().length > 0;
}

/**
 * Spricht eine Kartenrueckseite aus: `antwort` und – falls vorhanden –
 * der Beispielsatz, nacheinander in derselben Ausgabe. expo-speech kennt
 * keine Warteschlange, also werden die Teile zu einem Text verbunden –
 * dieselbe Kuerzung wie "nochmal vorlesen" im Web (die Satzzeichen bleiben
 * erhalten, nur ein doppelter Schlusspunkt wird geschluckt).
 */
export function spreche(
  teile: (string | null | undefined)[],
  spracheCode: string | null,
  fertig?: () => void,
): void {
  const texte = teile.filter((teil): teil is string => sprechbar(teil));
  if (texte.length === 0) return;

  let text = texte.map((t) => t.trim()).join(". ") + ".";
  text = text.replace(/\.{2,}$/, ".");

  const weiter = () => fertig?.();

  Speech.speak(text, {
    language: spracheCode ?? undefined,
    onDone: weiter,
    onStopped: weiter,
    onError: weiter,
  });
}

/** Bricht die laufende Ausgabe ab (z. B. beim Wechsel oder Aufraeumen). */
export function stoppe(): void {
  void Speech.stop();
}

/** Sagt im Stillen, ob gerade etwas spricht (fuer einen Umlegen-Knopf). */
export async function sprichtGerade(): Promise<boolean> {
  return await Speech.isSpeakingAsync();
}