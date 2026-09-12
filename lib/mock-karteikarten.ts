import type { KarteikartenSet } from "./types";
//fake databse
export const mockKarteikarten: KarteikartenSet[] = [
  {
    id: "englisch-grundlagen",
    name: "Englisch Grundlagen",
    sprache: "Englisch",
    anzahlKarten: 120,
    fortschrittProzent: 65,
  },
  {
    id: "italienisch-urlaub",
    name: "Italienisch Urlaub",
    sprache: "Italienisch",
    anzahlKarten: 80,
    fortschrittProzent: 32,
  },
  {
    id: "spanisch-alltag",
    name: "Spanisch Alltag",
    sprache: "Spanisch",
    anzahlKarten: 95,
    fortschrittProzent: 48,
  },
];