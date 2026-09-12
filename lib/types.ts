export type KarteikartenSet = {
    //ts typ damit es sichere ist
  id: string;
  name: string;
  sprache: string;
  anzahlKarten: number;
  fortschrittProzent: number;
  updatedAt?: string;
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
  updatedAt?: string;
}
export type SprachStat = {
  id?: string;
  sprache: string;
  gelernt: number;
  total: number;
  xp: number;
  updatedAt?: string;
}