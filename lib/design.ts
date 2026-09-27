/**
 * Zwei Konstanten, die beide Seiten des Hydration-Übergangs brauchen:
 * der Server (fuer das Script im <head>) und der Client (fuer localStorage).
 *
 * Sie stehen in einer eigenen Datei, weil sie nicht in einer
 * `"use client"`-Datei liegen duerfen. Aus einer Client-Datei exportierte
 * Werte sind im Server-Module Client-Referenzen: `DESIGN_SCRIPT` waere dort
 * kein String, sondern ein Proxy, und `dangerouslySetInnerHTML` bekäme
 * Muell. Der Anbieter in components/design/design-anbieter.tsx importiert
 * deshalb ebenfalls von hier.
 */

/** localStorage-Schluessel. Muss mit dem im Script uebereinstimmen. */
export const DESIGN_SPEICHER = "lexio.design";

/**
 * Laeuft synchron im <head>, vor dem ersten Paint.
 *
 * Ein useEffect waere zu spaet: React rendert, der Browser malt, und erst
 * danach laeuft der Effekt. Wer hell eingestellt hat, saehe bei jedem
 * Aufruf zuerst Schwarz aufblitzen.
 *
 * Reihenfolge: gespeicherte Wahl, dann Systemvorgabe, dann Dunkel als
 * Auffangwert. Alles in einem try, weil localStorage im privaten Modus und
 * bei blockierten Cookies einen SecurityError wirft – ein Design, das dann
 * gar nicht gesetzt wird, ist schlimmer als eines, das falsch gesetzt ist.
 *
 * `dangerouslySetInnerHTML` ist hier die einzige Moeglichkeit. Der Inhalt
 * ist eine Konstante aus dieser Datei, kein Input von aussen.
 */
export const DESIGN_SCRIPT = `(function(){try{var d=localStorage.getItem(${JSON.stringify(
    DESIGN_SPEICHER,
)});if(d!=="hell"&&d!=="dunkel"){d=window.matchMedia("(prefers-color-scheme: light)").matches?"hell":"dunkel";}document.documentElement.dataset.design=d;}catch(e){document.documentElement.dataset.design="dunkel";}})();`;
