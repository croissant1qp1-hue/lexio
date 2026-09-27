import type { KarteikartenSet } from "./types";
//fake databse
export const mockKarteikarten: KarteikartenSet[] = [
  {
    id: "englisch-grundlagen",
    name: "Englisch Grundlagen",
    sprache: { code: "en", name: "Englisch", flaeche: "#FFC857", akzent: "#FFCE73" },
    anzahlKarten: 120,
    fortschrittProzent: 65,
  },
  {
    id: "italienisch-urlaub",
    name: "Italienisch Urlaub",
    sprache: { code: "it", name: "Italienisch", flaeche: "#42D6A4", akzent: "#6FE0BA" },
    anzahlKarten: 80,
    fortschrittProzent: 32,
  },
  {
    id: "spanisch-alltag",
    name: "Spanisch Alltag",
    sprache: { code: "es", name: "Spanisch", flaeche: "#FF6B5B", akzent: "#FF9E8F" },
    anzahlKarten: 95,
    fortschrittProzent: 48,
  },
];