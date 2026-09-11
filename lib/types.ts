export type KarteikartenSet = {
    //ts typ damit es sichere ist
  id: string;
  name: string;
  sprache: string;
  anzahlKarten: number;
  fortschritt: number;
};
export type WochenXpTyp = {
  mo: number;
  di: number;
  mi: number;
  do: number;
  fr: number;
  sa: number;
  so: number;
}
export type TagesXpTyp = {
  erreicht: number;
  ziel: number;
}