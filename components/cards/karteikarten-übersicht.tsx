"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { KarteikartenSet } from "@/lib/types";
import { getFarbeforSprache } from "@/lib/sprachen-farbe";
import { useRouter } from "next/navigation";

type SetMitLernstand = KarteikartenSet & { kartenFaellig?: number };

export default function KarteikartenUebersicht() {
    const router = useRouter();
    const [karteikarten, setKarteikarten] = useState<SetMitLernstand[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let abgebrochen = false;

        fetch("/api/karteikarten")
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((data: SetMitLernstand[]) => {
                if (abgebrochen) return;
                setKarteikarten(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                if (abgebrochen) return;
                setKarteikarten([]);
                setLoading(false);
            });

        return () => {
            abgebrochen = true;
        };
    }, []);

    return (
        <div className="vokabel-sets">
            <button
                type="button"
                className="add-button"
                aria-label="Neue Karteikarten anlegen"
                onClick={() => router.push("/karteikarten-hinzufuegen")}
            >
                <Image
                    src="/images/tile-border-outer.svg"
                    width={200}
                    height={200}
                    alt=""
                    style={{ width: "62%", height: "auto" }}
                />
            </button>

            {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                      <div
                          key={index}
                          style={{
                              background:
                                  "linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-highlight) 50%, var(--skeleton-base) 75%)",
                              backgroundSize: "200% 100%",
                              animation: "pulse 1.2s ease-in-out infinite",
                          }}
                      />
                  ))
                : karteikarten.map((set) => {
                      const farbe = getFarbeforSprache(set.sprache);
                      return (
                          <div key={set.id} className="set-relative">
                              <button
                                  type="button"
                                  className="set-tile"
                                  onClick={() => router.push(`/lernen/${set.id}`)}
                                  style={{
                                      backgroundColor: farbe ?? "var(--bg-elevated)",
                                      width: "100%",
                                      border: "2px solid #33444C",
                                  }}
                                  aria-label={`${set.name} lernen, ${set.fortschrittProzent} Prozent fortgeschritten`}
                              >
                                  {typeof set.kartenFaellig === "number" && set.kartenFaellig > 0 && (
                                      <span className="set-faellig">{set.kartenFaellig} fällig</span>
                                  )}
                                  <span className="set-name">{set.name}</span>
                                  <span className="set-anzahl-woerter">
                                      {set.anzahlKarten} Karten
                                  </span>
                                  <span className="set-fortschritt">
                                      <span
                                          className="set-fortschritt-fill"
                                          style={{ width: `${Math.min(100, Math.max(0, set.fortschrittProzent))}%` }}
                                      />
                                  </span>
                              </button>
                          </div>
                      );
                  })}
        </div>
    );
}
