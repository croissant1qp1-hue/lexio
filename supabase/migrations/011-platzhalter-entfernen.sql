-- =============================================================================
-- Lexio – Migration 011: Demo-Platzhalter entfernen
-- =============================================================================
-- Lesen, bevor du diese Datei ausführst (Stand 2026-10-04): Der Slug
-- `englisch-grundlagen` war zur Zeit dieser Migration ein Platzhalter-Set aus
-- "Frage n"/"Antwort n". Heute trägt derselbe Slug die kuratierte Wortliste
-- ngsl-top100 mit 100 echten Karten (scripts/wortlisten-importieren.mjs).
--
-- Die Datei ist deshalb NICHT ungefährlich mehr, weil sie unten eine
-- Löschsperre bekommen hat: sie löscht nur noch Sets, deren Karten sämtlich
-- dem Platzhalter-Muster entsprechen. `englisch-grundlagen` übersteht sie
-- nachweislich. Wer die Sperre entfernt, stellt genau die geladene Wanne wieder
-- her, vor der dieser Kommentar warnt — und diese Warnung allein hat noch
-- niemanden aufgehalten.
--
-- Wer diese Migration historisch nachvollziehen will, findet den ursprünglichen
-- Zustand im Commit vor der Sperre. Für den heutigen Datenbestand ist sie reine
-- Buchhaltung.
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
--
-- LOESCHSPERRE, 2026-10-04: Ein Set wird nur geloescht, wenn seine Karten
-- bis heute unverändert dem Platzhalter-Muster entsprechen — jede Karte
-- `Frage n` / `Antwort n`, wie es der Seed erzeugt hat. Das ist die
-- Invariante, die diese Migration eigentlich meint: "bestehen nur aus
-- Platzhalterkarten". Die Slug-Liste allein sagt das nicht mehr, seit
-- `englisch-grundlagen` eine echte Wortliste traegt.
--
-- Warum nicht eine Slug-Sperre (`slug not in (...)` mit allen fuenf
-- Wortlisten): Sie muss bei jedem Import nachgezogen werden und schuetzt
-- keine sechste, die morgen kommt. Das Muster ist die Regel, die Slug-Liste
-- nur noch der Anlass. Und die Fehlrichtung ist die harmlose: wer die
-- Sperre zu streng fasst, loescht nichts und merkt es an der Kontrolle unten;
-- wer sie zu weit laesst, loescht Wortlisten.
--
-- Wirft diese Bedingung je eine Karte aus dem Muster, bleibt der Satz stehen.

delete from public.karteikarten_sets s
 where s.slug in ('englisch-grundlagen', 'italienisch-urlaub', 'spanisch-alltag')
   and s.user_id is null
   and not exists (
         select 1
           from public.karten k
          where k.set_id = s.id
            and (k.frage  !~ '^Frage [0-9]+$'
              or k.antwort !~ '^Antwort [0-9]+$')
       );

-- Kontrolle: es duerfen keine Demo-Sets mehr uebrig sein, eigene bleiben.
-- Zaehlt bewusst nur noch die beiden Slugs, die wirklich Platzhalter waren:
-- `englisch-grundlagen` ist eine Wortliste und darf hier nicht als Fehler
-- erscheinen, sonst laedt die Kontrolle zum Loeschen ein.
select count(*) as verbliebene_demo_sets
  from public.karteikarten_sets
 where slug in ('italienisch-urlaub', 'spanisch-alltag')
   and user_id is null;

-- Gegenprobe der Sperre, ohne etwas zu loeschen: welche der drei Slugs
-- wuerden die Bedingung oben noch treffen? Erwartet: keiner.
select s.slug,
       (select count(*) from public.karten k where k.set_id = s.id) as karten,
       not exists (
         select 1 from public.karten k
          where k.set_id = s.id
            and (k.frage  !~ '^Frage [0-9]+$'
              or k.antwort !~ '^Antwort [0-9]+$')
       ) as wuerde_geloescht
  from public.karteikarten_sets s
 where s.slug in ('englisch-grundlagen', 'italienisch-urlaub', 'spanisch-alltag')
   and s.user_id is null;
