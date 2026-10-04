-- =============================================================================
-- Lexio – Migration 011: Demo-Platzhalter entfernen
-- =============================================================================
-- ACHTUNG, 2026-10-04: DIESE DATEI NICHT ERNEUT LAUFEN LASSEN.
--
-- Der Slug `englisch-grundlagen` war zur Zeit dieser Migration ein
-- Platzhalter-Set aus "Frage n"/"Antwort n". Heute trägt derselbe Slug die
-- kuratierte Wortliste ngsl-top100 mit 100 echten Karten
-- (scripts/wortlisten-importieren.mjs). Wortlisten stehen wie die alten
-- Demo-Sets auf `user_id is null`, die Bedingung unten greift also bei ihnen
-- genauso — ein zweiter Lauf löscht 100 Karten samt Lernstand.
--
-- Geprüft und gefunden: `italienisch-urlaub` und `spanisch-alltag` sind
-- weg, `englisch-grundlagen` steht mit seinen 100 Karten. Der Zustand ist
-- damit richtig; diese Datei ist nur historisch. Was wirklich fehlt, sagt
-- `npm run db:pruefen` — und dessen Eintrag für 011 prüft aus genau diesem
-- Grund nur die beiden echten Platzhalter.
--
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