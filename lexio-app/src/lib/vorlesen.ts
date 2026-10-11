import * as Speech from "expo-speech";

import { sprechText } from "./sprechtext";

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

/**
 * Spricht eine Kartenrueckseite aus: `antwort` und – falls vorhanden –
 * der Beispielsatz, nacheinander in derselben Ausgabe. Die Verbindung der
 * Teile ist rein und getestet (`sprechText`).
 */
export function spreche(
  teile: (string | null | undefined)[],
  spracheCode: string | null,
  fertig?: () => void,
): void {
  const text = sprechText(teile);
  if (!text) return;

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