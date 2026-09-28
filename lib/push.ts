/**
 * Web-Push an einer Stelle: der VAPID-Public-Key in der Form, die der
 * Browser beim Abonnement will.
 *
 * Der Basestreifen hier ist Dekodierung, keine Zauberei: der Public-Key
 * kommt als base64url-String (aus `npm run push:schluessel`), und
 * `pushManager.subscribe` verlangt ihn als Uint8Array. Die Umwandlung ist
 * das hin und her zwischen den beiden Darstellungen.
 */

/**
 * Der VAPID-Public-Key liegt als NEXT_PUBLIC-Variable vor, damit der Browser
 * ihn beim Abonnieren mitgeben kann. Ohne ihn geht `pushManager.subscribe`
 * nicht – der Push-Dienst verlangt ihn als applicationServerKey.
 */
export function vapidPublicKey(): string {
    const schluessel = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!schluessel) {
        // Kein Wurf, sondern eine Meldung, die sichtbar macht, woran es
        // liegt. Ein leiser Fehlschlag waere ein Schalter, der still nichts
        // tut – und genau das soll hier nicht passieren.
        throw new Error(
            "NEXT_PUBLIC_VAPID_PUBLIC_KEY fehlt in der Umgebung. " +
                "Schluessel erzeugen mit `npm run push:schluessel`, dann in .env eintragen.",
        );
    }
    return schluessel;
}

/**
 * base64url in ein Uint8Array. Die Browser-Implementation von
 * `pushManager.subscribe` akzeptiert nur die binäre Form.
 */
export function alsUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
    // base64url -> base64: URL-sichere Zeichen zuruecktauschen.
    const mitPolstern = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const ohnePad = mitPolstern.padEnd(mitPolstern.length + ((4 - (mitPolstern.length % 4)) % 4), "=");
    const roh = atob(ohnePad);
    const aus = new Uint8Array(new ArrayBuffer(roh.length));
    for (let i = 0; i < roh.length; i++) {
        aus[i] = roh.charCodeAt(i);
    }
    return aus;
}