"use client";

import { useCallback, useEffect, useState } from "react";
import type { Gesundheit } from "@/lib/gesundheit";

/**
 * Lädt /api/gesundheit einmal pro Seitenaufruf und teilt das Ergebnis.
 *
 * Zwei Komponenten brauchen dieselbe Antwort: der Setup-Hinweis und die
 * Anmeldeseite, um Knöpfe für nicht aktivierte Provider auszublenden. Ohne
 * geteilten Cache macht jede ihren eigenen Aufruf – auf dem Handy zwei
 * zusätzliche Roundtrips, bevor das Formular benutzbar ist.
 *
 * Das Modul merkt sich die laufende Abfrage im Versprechen selbst, nicht in
 * einem Zustand: Zwei Komponenten, die gleichzeitig mounten, lösen damit
 * trotzdem nur einen Aufruf aus.
 *
 * sessionStorage hält das Ergebnis 45 Sekunden. Länger wäre bequem und
 * falsch: Wer im Dashboard einen Schalter umlegt, erwartet beim Zurückkommen
 * eine neue Antwort.
 */

const CACHE = "lexio.gesundheit";
const FRISCH = 45_000;

let laufendeAbfrage: Promise<Gesundheit | null> | null = null;

function ausCache(): Gesundheit | null {
  try {
    const roh = sessionStorage.getItem(CACHE);
    if (!roh) return null;
    const { zeit, wert } = JSON.parse(roh) as { zeit: number; wert: Gesundheit };
    return Date.now() - zeit < FRISCH ? wert : null;
  } catch {
    return null;
  }
}

function holeGesundheit(frisch: boolean): Promise<Gesundheit | null> {
  if (!frisch) {
    const treffer = ausCache();
    if (treffer) return Promise.resolve(treffer);
  }
  // Ohne !frisch würde ein zweiter Aufrufer die laufende Anfrage wiederverwenden
  // und die "Erneut prüfen"-Schaltfläche nichts tun.
  if (laufendeAbfrage && !frisch) return laufendeAbfrage;

  laufendeAbfrage = (async () => {
    try {
      const antwort = await fetch("/api/gesundheit", { cache: "no-store" });
      if (!antwort.ok) return null;
      const wert = (await antwort.json()) as Gesundheit;
      try {
        sessionStorage.setItem(CACHE, JSON.stringify({ zeit: Date.now(), wert }));
      } catch {
        /* Nur ein Komfortgewinn. */
      }
      return wert;
    } catch {
      return null;
    } finally {
      laufendeAbfrage = null;
    }
  })();

  return laufendeAbfrage;
}

export function useGesundheit(): {
  bericht: Gesundheit | null;
  neuLaden: () => void;
  laeuft: boolean;
} {
  const [bericht, setBericht] = useState<Gesundheit | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const neuLaden = useCallback(() => {
    setLaeuft(true);
    void holeGesundheit(true).then((wert) => {
      setBericht(wert);
      setLaeuft(false);
    });
  }, []);

  useEffect(() => {
    let abgebrochen = false;
    /*
     * Der Cache wird innerhalb von holeGesundheit gelesen, nicht hier oben
     * mit einem setState. Ein setState direkt im Effekt erzwingt einen
     * zweiten Render-Durchlauf, und – schlimmer – auf dem Server gaenge der
     * erste Durchlauf mit "leer", auf dem Client mit "gefuellt" aus: das
     * waere ein Hydration-Mismatch an einer Stelle, an der niemand einen
     * Fehler vermutet.
     *
     * Der Cache ist damit einen Microtask spaeter da statt synchron. Der
     * Unterschied ist nicht sichtbar, und er kostet keinen Netzwerkaufruf.
     */
    void holeGesundheit(false).then((wert) => {
      if (!abgebrochen) setBericht(wert);
    });
    return () => {
      abgebrochen = true;
    };
  }, []);

  return { bericht, neuLaden, laeuft };
}
