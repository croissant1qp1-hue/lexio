-- =============================================================================
-- Lexio – Migration 011: Demo-Platzhalter entfernen
-- =============================================================================
-- Plan 2.1: Die drei globalen Demo-Sets (englisch-grundlagen,
-- italienisch-urlaub, spanisch-alltag) bestehen nur aus Platzhalterkarten
-- "Frage n" / "Antwort n". Frische Nutzer sehen darauf 65/32/48 % Fortschritt
-- und lernen Nonsense. Das Starter-Set mit echtem Inhalt folgt in 2.2.
--
-- Mit den Sets verschwinden per ON DELETE CASCADE auch ihre Karten
-- (002) und damit der persoenliche Lernstand auf diesen Karten
-- (karten_fortschritt, 003:181) — gewollt, denn er bezog sich auf Platzhalter.
--
-- In den drei Sets lagen ausserdem die Testreste __conntest__ (Spanisch),
-- probe-a / probe-b (Italienisch) sowie ciao -> hallo und bella -> mädchen
-- im englischen Set. Sie sind Teil dieser Sets und werden hier namentlich
-- genannt, damit niemand sie fuer echten Inhalt haelt. Sie sind doppelt
-- falsch einsortiert und verschwinden mit den Sets.
--
-- Idempotent: bereits geloeschte Sets werden nicht erneut gefunden.
-- Die Bedingung `user_id is null` schuetzt eigene Sets; wer zufaellig
-- denselben slug hat, behaelt sein Set.

delete from public.karteikarten_sets
 where slug in ('englisch-grundlagen', 'italienisch-urlaub', 'spanisch-alltag')
   and user_id is null;

-- Kontrolle: es duerfen keine Demo-Sets mehr uebrig sein, eigene bleiben.
select count(*) as verbliebene_demo_sets
  from public.karteikarten_sets
 where slug in ('englisch-grundlagen', 'italienisch-urlaub', 'spanisch-alltag')
   and user_id is null;