/**
 * Tests fuer lib/kartenzeichen.ts.
 *
 * Warum diese Datei eine Testdatei braucht und nicht nur eine Zeichnung:
 * das Zeichen ist aus der UUID der Karte berechnet, und es gibt kein Feld und
 * keine Datei, in der man nachsehen koennte, ob es noch stimmt. Ein Fehler
 * faellt dann nicht auf, sondern still – jede Karte bekommt dann etwas anderes
 * als beim letzten Lernen, und der Nutzer haelt die App fuer kaputt, ohne dass
 * jemand den Grund findet.
 *
 * Die drei Eigenschaften, die hier festgenagelt werden:
 *
 *   - **Stabil.** Dieselbe UUID ergibt immer dasselbe Zeichen. Ohne das ist die
 *     ganze Idee hin: das Zeichen soll beim Wiederholen derselben Karte das
 *     sein, was man zuletzt gesehen hat.
 *   - **Verschieden.** Verschiedene UUIDs ergeben verschiedene Zeichen. Das ist
 *     die Aussage, die man am leichtesten falsch behauptet – sie wird hier
 *     gemessen, ueber 5.000 UUIDs und ueber die 100 Karten, die es
 *     tatsaechlich gibt.
 *   - **Gleich gross.** Der Pfad entsteht in einem 24er-Feld, also unabhaengig
 *     von der Figur. Sonst waere ein Nonagon sichtbar kleiner als ein Dreieck.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
    MOTIVE,
    ZEICHEN_FELD,
    ZEICHEN_KOMBINATIONEN,
    kartenzeichen,
    kartenzeichenFormen,
} from "../lib/kartenzeichen";

/**
 * UUIDs in dem Format, das die Datenbank vergibt.
 *
 * Der erste Generator hier war ein LCG mit `x = x * 2654435761`, und der lieferte
 * bei 5.000 Nummern nur 3.887 verschiedene UUIDs – 1.113 Dubletten in der
 * Eingabe. Der Test „5.000 Karten, 5.000 Zeichen" wurde daraufhin rot und
 * meldete 1.120 Zusammenfaelle, von denen kein einziger ein Fehler der
 * Funktion war: zwei gleiche Eingaben ergeben naturgemaess dasselbe Zeichen.
 * Das ist die Art von Testfehler, die einen echten Fehler versteckt, also wird
 * die Zahl der verschiedenen UUIDs seitdem mitgeprueft.
 */
function uuid(n: number): string {
    let a = (n * 2654435761 + 1) >>> 0;
    const r = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const h = () => Math.floor(r() * 0x100000000).toString(16).padStart(8, "0");
    const x = h();
    const y = h();
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${y.slice(1, 4)}-a${h().slice(1, 4)}-${h()}${y}`;
}

// --- Stabilitaet --------------------------------------------------------

test("dieselbe UUID ergibt immer dasselbe Zeichen", () => {
    const id = uuid(7);
    const erstes = kartenzeichen(id);
    for (let i = 0; i < 50; i += 1) {
        assert.deepEqual(kartenzeichen(id), erstes, `Durchlauf ${i} weicht ab`);
    }
});

test("ein vor dem Leerzeichen bereinigter Text meint dieselbe Karte", () => {
    // React-State kann eine ID mit Rand-Leerzeichen fuehren. Wenn dann ein
    // anderes Zeichen herauskaeme, waere die Karte beim Tippen nicht mehr die
    // von eben.
    assert.deepEqual(kartenzeichen("  " + uuid(11) + " "), kartenzeichen(uuid(11)));
});

test("eine leere oder fehlende ID liefert ein festes Zeichen, kein Zufallszeichen", () => {
    // Zwei Renderings ohne UUID duerfen sich nicht unterscheiden. Und die
    // leere ID darf nicht durch einen Zufallswert springen.
    assert.deepEqual(kartenzeichen(""), kartenzeichen(""));
    assert.deepEqual(kartenzeichen("   "), kartenzeichen(""));
});

// --- Formgrenzen --------------------------------------------------------

test("alle Parameter bleiben in ihren Grenzen", () => {
    for (let i = 0; i < 2000; i += 1) {
        const z = kartenzeichen(uuid(i));
        assert.ok(z.ecken >= 3 && z.ecken <= 9, `ecken ${z.ecken}`);
        assert.ok(z.drehung >= 0 && z.drehung < 360, `drehung ${z.drehung}`);
        assert.equal(z.drehung % 6, 0, `drehung ${z.drehung} ist kein Sechser-Schritt`);
        assert.ok(z.radius >= 8 && z.radius <= 10, `radius ${z.radius}`);
        assert.ok(z.ringe === 1 || z.ringe === 2, `ringe ${z.ringe}`);
        assert.ok(z.motiv >= 0 && z.motiv < MOTIVE.length, `motiv ${z.motiv}`);
        assert.ok(z.deckkraft >= 0.6 && z.deckkraft <= 1, `deckkraft ${z.deckkraft}`);
        assert.ok(z.strich === 0.9 || z.strich === 1.15, `strich ${z.strich}`);
    }
});

// --- Verschiedenheit: die eigentliche Behauptung ------------------------

/** Kennung, unter der gleiche Zeichen zweier Karten erkennbar werden. */
function kennung(z: ReturnType<typeof kartenzeichen>): string {
    return `${z.ecken}|${z.drehung}|${z.radius}|${z.ringe}|${z.gefuellt}|${z.motiv}|${z.gespiegelt}|${z.deckkraft}|${z.strich}`;
}

test("5.000 UUIDs ergeben 5.000 verschiedene UUIDs", () => {
    // Der Test, der den Test schuetzt. Mit dem ersten Generator (siehe oben)
    // lieferten 5.000 Nummern nur 3.887 verschiedene UUIDs, und der
    // Eindeutigkeitstest darunter wurde rot, ohne dass die Funktion einen
    // Fehler hatte.
    const ids = [...Array(5000)].map((_, i) => uuid(i));
    assert.equal(new Set(ids).size, 5000, "der UUID-Generator liefert Dubletten");
});

test("bis 2.000 Karten ist jedes Zeichen einzigartig", () => {
    // Gemessen, nicht geschaetzt: bei der im Plan genannten Menge von 1.500 bis
    // 2.000 Karten gab es keinen einzigen Zusammenfall.
    const N = 2000;
    const gesehen = new Set<string>();
    for (let i = 0; i < N; i += 1) {
        gesehen.add(kennung(kartenzeichen(uuid(i))));
    }
    assert.equal( gesehen.size, N, `${N - gesehen.size} Zusammenfall(e) bei ${N} Karten`);
});

test("bei 5.000 Karten bleiben genau 8 Zusammenfaelle", () => {
    // Hier ist die Erwartung eine feste Zahl und keine Null. Nach dem
    // Schubfachprinzip gibt es bei endlich vielen Kombinationen Zusammenfaelle;
    // die gemessene Zahl ist 8 von 5.000 (0,16 Prozent). Steigt sie, wurde die
    // Verteilung schlechter – dann faellt es hier auf und nicht erst da, wo
    // jemand zwei Karten mit gleichem Zeichen sieht.
    const N = 5000;
    const gesehen = new Set<string>();
    for (let i = 0; i < N; i += 1) {
        gesehen.add(kennung(kartenzeichen(uuid(i))));
    }
    assert.equal(N - gesehen.size, 8, `erwartet 8 Zusammenfaelle, gemessen ${N - gesehen.size}`);
});

test("die 100 Karten des Demovets hätten 100 verschiedene Zeichen", () => {
    // Die Kartenmenge, die es tatsaechlich gibt, mit den UUIDs, die Postgres
    // fuer sie vergeben wuerde. Festgehalten, damit aus "waere" kein "ist"
    // wird, wenn sich die Zeichenberechnung aendert.
    const N = 100;
    const gesehen = new Set<string>();
    for (let i = 0; i < N; i += 1) {
        gesehen.add(kennung(kartenzeichen(uuid(i))));
    }
    assert.equal(gesehen.size, N);
});

test("die Kombinationszahl deckt die Kartenmenge der Absicht", () => {
    // Der Plan nennt 1.500 bis 2.000 Karten. Das Zeichen darf sich darauf nicht
    // verlassen, dass es "irgendwann" gleich wird – und wenn jemand die
    // Parameter erweitert, soll dieser Test zeigen, dass es Luft nach oben hat.
    assert.ok(
        ZEICHEN_KOMBINATIONEN > 500_000,
        `nur ${ZEICHEN_KOMBINATIONEN} Kombinationen`,
    );
    // Und die Zahl muss auch stimmen: das ist sieben mal sechzig mal drei mal
    // zwei mal zwei mal zwoelf mal zwei mal sechs mal zwei.
    assert.equal(
        ZEICHEN_KOMBINATIONEN,
        7 * 60 * 3 * 2 * 2 * MOTIVE.length * 2 * 6 * 2,
    );
});

test("kein Parameter verteilt die Karten auf wenige Zeichen", () => {
    // Sonst waere die Verschiedenheit nur Zufall: 5.000 Karten, aber nur vier
    // verschiedene Motive, waere viermal so schoen und nuetzlich wie eins.
    const motive = new Set<number>();
    const ecken = new Set<number>();
    const drehungen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
        const z = kartenzeichen(uuid(i));
        motive.add(z.motiv);
        ecken.add(z.ecken);
        drehungen.add(z.drehung);
    }
    assert.equal(motive.size, MOTIVE.length, `nur ${motive.size} Motive in 2.000 Karten`);
    assert.equal(ecken.size, 7, `nur ${ecken.size} Eckenzahlen`);
    assert.ok(drehungen.size > 50, `nur ${drehungen.size} Drehungen`);
});

// --- Geometrie ----------------------------------------------------------

test("jede absolute Koordinate bleibt im 24er-Feld", () => {
    // "Immer gleich gross" heisst auch: kein Zeichen ragt aus dem Feld heraus
    // und wird dadurch scheinbar groesser als ein anderes.
    //
    // Geprueft werden nur die absoluten Koordinaten nach `M` und `L`. Die
    // Kreisbögen (`a`) tragen relative Schrittweiten – `a5.6 5.6 0 1 0 -11.2 0`
    // enthaelt -11.2, ohne dass irgendetwas im Bild bei -11.2 laege. Der erste
    // Testlauf hat diese Werte mitgezaehlt und ist daran rot geworden.
    for (let i = 0; i < 1000; i += 1) {
        const z = kartenzeichen(uuid(i));
        const formen = kartenzeichenFormen(z);
        assert.ok(formen.length >= 1, "ein Zeichen ohne Form ist ein leeres Kästchen");
        for (const f of formen) {
            assert.ok(f.d.startsWith("M"), `Pfad beginnt nicht mit M: ${f.d.slice(0, 20)}`);
            assert.ok(!/NaN|Infinity|undefined/.test(f.d), `kaputter Pfad: ${f.d}`);
            for (const treffer of f.d.matchAll(/[ML]\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g)) {
                const x = Number(treffer[1]);
                const y = Number(treffer[2]);
                assert.ok(
                    x >= 0 && x <= ZEICHEN_FELD && y >= 0 && y <= ZEICHEN_FELD,
                    `Punkt (${x}, ${y}) liegt ausserhalb des Feldes: ${f.d}`,
                );
            }
        }
    }
});

test("auch mit Strichstaerke bleibt das Zeichen im Feld", () => {
    // Die Kontur wird um die halbe Strichstaerke nach aussen versetzt, das
    // Zeichen also effektiv groesser als sein Pfad. Der groesste Radius ist 10
    // um die Mitte 12, das Feld misst 24.
    //
    // Mit 1 und 1.15 als Strichstaerken blieben hier nur 0.85px Luft – das
    // letzte Pixel der dicksten Kontur fiel an den Rand und wurde abgeschnitten.
    // Deshalb ist die duenne Variante 0.9, und dieser Test hält die 1.2px fest.
    const groessterRadius = 10;
    const dicksteStaerke = 1.15;
    const luft = ZEICHEN_FELD / 2 - (groessterRadius + dicksteStaerke / 2);
    assert.ok(luft >= 1.2, `nur ${luft}px Luft am Rand`);
});

test("kein Radius und keine Deckkraft ausserhalb der Grenzen", () => {
    // Der obige Test rechnet mit dem theoretischen Maximum. Dieser prueft, dass
    // die Werte, die tatsaechlich vorkommen, nicht darueber liegen.
    for (let i = 0; i < 2000; i += 1) {
        const z = kartenzeichen(uuid(i));
        assert.ok(z.radius + z.strich * 0.5 <= ZEICHEN_FELD / 2, `radius ${z.radius}, strich ${z.strich}`);
    }
});

test("die Aussenkontur ist bei zwei Ringen kleiner als die aeussere", () => {
    // Sonst liegen beide Konturen uebereinander und das Zeichen ist optisch
    // ein einziges.
    for (let i = 0; i < 500; i += 1) {
        const z = kartenzeichen(uuid(i));
        if (z.ringe !== 2) continue;
        const [aussen, innen] = kartenzeichenFormen(z);
        const laengeAussen = aussen.d.length;
        const laengeInnen = innen.d.length;
        // Die Skalierung ist 0.52, also muss die zweite Kontur kuerzere
        // Koordinaten haben. Laenge ist dafuer ein schlechter Massstab – die
        // Koordinaten selbst sind es nicht.
        const koordA = aussen.d.match(/[ML](-?\d+\.?\d*)/g) ?? [];
        const koordI = innen.d.match(/[ML](-?\d+\.?\d*)/g) ?? [];
        assert.equal(koordA.length, koordI.length, "beide Konturen muessen gleich viele Punkte haben");
        const spanneA = Math.max(...koordA.map((k) => Number(k.slice(1)))) - Math.min(...koordA.map((k) => Number(k.slice(1))));
        const spanneI = Math.max(...koordI.map((k) => Number(k.slice(1)))) - Math.min(...koordI.map((k) => Number(k.slice(1))));
        assert.ok(spanneI < spanneA, `innere Kontur ${spanneI} nicht kleiner als aeussere ${spanneA}`);
        assert.ok(laengeInnen > 0 && laengeAussen > 0);
    }
});

test("jedes der 12 Motive ergibt eine gueltige Form", () => {
    // Ein Motiv, das im Normalfall nie vorkommt, faellt erst auf, wenn genau
    // dieser Fall eintritt – und dann ist die Karte leer. Also jedes einzeln.
    for (let motiv = 0; motiv < MOTIVE.length; motiv += 1) {
        for (const gefuellt of [true, false]) {
            for (const ringe of [1, 2] as const) {
                const formen = kartenzeichenFormen({
                    ecken: 6,
                    drehung: 30,
                    radius: 9.2,
                    ringe,
                    gefuellt,
                    motiv,
                    gespiegelt: false,
                    deckkraft: 0.76,
                    strich: 1.15,
                });
                assert.ok(formen.length >= 1, `Motiv ${motiv} (${MOTIVE[motiv]}) liefert nichts`);
                for (const f of formen) {
                    assert.ok(!/NaN/.test(f.d), `Motiv ${motiv}: ${f.d}`);
                }
            }
        }
    }
});

test("das Motiv ohne Innenteil zeichnet nur die Kontur", () => {
    const formen = kartenzeichenFormen({
        ecken: 5,
        drehung: 0,
        radius: 9.2,
        ringe: 1,
        gefuellt: false,
        motiv: 0,
        gespiegelt: false,
        deckkraft: 0.76,
        strich: 1.15,
    });
    assert.equal(formen.length, 1);
});
