import type { SprachStat } from "./types";
//fake databse
export const mockStatProSprache: SprachStat[] = [
  {
    code: 'it',
    sprache: 'Italienisch',
    flaeche: '#42D6A4',
    akzent: '#6FE0BA',
    gelernt: 12,
    total: 20,
    xp: 150,
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    code: 'en',
    sprache: 'Englisch',
    flaeche: '#FFC857',
    akzent: '#FFCE73',
    gelernt: 8,
    total: 20,
    xp: 100,
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    code: 'es',
    sprache: 'Spanisch',
    flaeche: '#FF6B5B',
    akzent: '#FF9E8F',
    gelernt: 5,
    total: 20,
    xp: 75,
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    code: 'fr',
    sprache: 'Französisch',
    flaeche: '#FF3D67',
    akzent: '#FF8FA3',
    gelernt: 3,
    total: 20,
    xp: 50,
    updatedAt: '2024-01-01T00:00:00.000Z',
  }
];