-- =============================================================================
-- 006 – Views auf den Sprachcode umstellen
--
-- Erst NACH 005 ausführen. 005 legt public.sprachen an und füllt
-- karteikarten_sets.sprache_code; ohne diese Spalte hat diese Datei nichts
-- umzustellen.
--
-- Worum es hier geht
-- -----------------
-- 005 hat die Sprachliste als Tabelle eingeführt und die Sets über
-- sprache_code daran gehängt. Die beiden Views geben aber weiterhin nur den
-- alten Freitext s.sprache nach außen. Der Anwendungscode müsste damit
-- weiterhin raten – und genau dieses Raten ist der Grund für 005 gewesen:
--
--   - "Welche Farbe gehört zu diesem Satz?" wurde beantwortet, indem man das
--     erste Wort nahm und kleinschrieb (lib/sprachen-farbe.ts, `schluessel`).
--   - "Welche XP gehören zu diesem Set?" wurde über dieselbe Umformung
--     zugeordnet (karteikarten-seite.tsx, `spracheKey`).
--
-- Beide Umformungen fielen bei "Chinesisch (Mandarin)" oder einem Tippfehler
-- stillschweigend auf eine weiße Fläche bzw. auf 0 XP zurück.
--
-- Diese Migration holt die Sprache an einer Stelle nach: die View liefert
-- Code, Namen und die beiden Farben mit. Der Anwendungscode muss danach nichts
-- mehr erraten – er schlägt nach, und wenn nichts dasteht, ist die Sprache
-- wirklich unbekannt.
--
-- Warum die Views neu gebaut und nicht ersetzt werden
-- ---------------------------------------------------
-- create or replace view kann die Spaltenliste einer bestehenden View nicht
-- ändern. Wir fügen Spalten hinzu, also muss es drop + create sein – genau wie
-- in 003:357-360.
--
-- Die Spalte karteikarten_sets.sprache (Freitext) bleibt in der View
-- enthalten. Sie ist der Rückfall für Sets, deren sprache_code leer ist, und
-- erst in Phase 4 fällt sie weg. Deshalb steht im Ausdruck ausdrücklich
-- coalesce(sp.name, s.sprache): ein Set mit unbekannter Sprache zeigt seinen
-- alten Text und nicht NULL.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Views verwerfen
-- -----------------------------------------------------------------------------
-- Reihenfolge ist nicht beliebig: statistik_pro_sprache liest
-- karteikarten_sets_uebersicht, muss also zuerst weg. Sonst bricht der Drop
-- mit "cannot drop view because other objects depend on it" ab – und dann
-- steht die halbe Migration in der Datenbank.
--
-- xp_pro_tag und mein_fortschritt bleiben unberührt. Sie lesen weder Sets noch
-- Sprachen, und sie würden bei einem Drop nur ihre Rechte verlieren.

drop view if exists public.statistik_pro_sprache;
drop view if exists public.karteikarten_sets_uebersicht;

-- -----------------------------------------------------------------------------
-- 2. Sets mit Sprache
-- -----------------------------------------------------------------------------
-- Gegenüber 003 kommen vier Spalten dazu:
--
--   sprache_code        – "en". Der Wert, den speechSynthesis braucht und über
--                         den die Karte ihre Farbe findet. NULL = unbekannt.
--   sprache             – Anzeigename. Aus der Sprachliste, nicht aus dem
--                         Freitext – außer die Liste kennt die Sprache nicht,
--                         dann bleibt der alte Text stehen.
--   sprache_flaeche     – Grundfarbe der Kachel.
--   sprache_akzent      – der hellere Ton für Text und Balken darauf.
--
-- Die beiden Farben stehen bewusst in der View und nicht in einer Tabelle im
-- Code. Sonst hätte die Datenbank eine Sprachliste, die Oberfläche eine
-- zweite, und die beiden könnten auseinanderlaufen: ein Satz wie "Italienisch
-- bekam orange, Englisch gelb" wäre dann nur noch durch Zufall zu lösen.
--
-- Die Zähler bleiben unangetastet. karten_gelernt und karten_faellig kommen aus
-- dem LEFT JOIN auf karten_fortschritt mit auth.uid() und sind damit der Stand
-- der angemeldeten Person. Details in 003:344-355.

create or replace view public.karteikarten_sets_uebersicht
with (security_invoker = true) as
select
  s.id,
  s.slug,
  s.name,
  s.sprache_code,
  coalesce(sp.name, s.sprache)     as sprache,
  coalesce(sp.flaeche, '#17232B')  as sprache_flaeche,
  coalesce(sp.akzent,  '#E7B14A')  as sprache_akzent,
  s.anzahl_karten,
  s.user_id,
  s.eigenes_set,
  count(k.id)                                                          as karten_gesamt,
  count(k.id) filter (where f.gelernt)                                  as karten_gelernt,
  count(k.id)
    filter (where coalesce(f.faellig_am, current_date) <= current_date) as karten_faellig,
  -- null, wenn das Set noch nie gelernt wurde. Die Oberflaeche zeigt dafuer
  -- "–" statt eines erfundenen Datums.
  max(f.letzte_wiederholung)                                           as zuletzt_gelernt,
  case
    when count(k.id) = 0 then 0
    else round(count(k.id) filter (where f.gelernt) * 100.0 / count(k.id))::int
  end                                                                  as fortschritt_prozent
from public.karteikarten_sets s
left join public.sprachen sp
       on sp.code = s.sprache_code
left join public.karten k on k.set_id = s.id
left join public.karten_fortschritt f
       on f.karte_id = k.id
      and f.user_id = auth.uid()
group by
  s.id, s.slug, s.name, s.sprache_code, s.sprache, s.anzahl_karten, s.user_id, s.eigenes_set,
  sp.name, sp.flaeche, sp.akzent;

-- -----------------------------------------------------------------------------
-- 3. XP und Karten je Sprache
-- -----------------------------------------------------------------------------
-- Die entscheidende Änderung ist das group by: in 003:408 stand dort noch
-- v.sprache, also der Freitext. Zwei Sätze mit dem Wort "Englisch" darin und
-- unterschiedlichem Rest wären zwei Zeilen gewesen – bei XP je Sprache eine
-- erfundene Aufteilung, die sich beim Lernen als falsch herausstellt.
--
--   order by min(v.sprache) statt order by v.sprache:
--   v.sprache ist hier ein Grouping-Ausdruck, v.sprache_code ebenfalls. Ohne
--   min() wäre "order by v.sprache" zweideutig und die Sortierung läge in den
--   Händen von Postgres. Nach dem Namen zu sortieren ist richtig, weil danach
--   gesucht wird ("Statistiken → Spanisch").
--
--   min(v.sprache_flaeche) / min(v.sprache_akzent):
--   Die Statistik braucht dieselbe Farbe je Sprache wie die Kachel. Sie kommt
--   deshalb aus derselben View und damit aus derselben Quelle. min() ist
--   hier richtig und coalesce() überflüssig: In public.sprachen sind beide
--   Werte NOT NULL, und null entsteht nur dort, wo es keine Zeile zum Join
--   gab – dann sind alle Zeilen dieser Gruppe NULL, und min() liefert NULL.
--   Die Oberfläche hat dafür einen Rückfall (UNBEKANNTE_SPRACHE).
-- -----------------------------------------------------------------------------

create or replace view public.statistik_pro_sprache
with (security_invoker = true) as
with xp_je_set as (
  select set_id, sum(xp)::int as xp
  from public.xp_events
  where set_id is not null
  group by set_id
)
select
  v.sprache_code,
  min(v.sprache)                 as sprache,
  min(v.sprache_flaeche)         as sprache_flaeche,
  min(v.sprache_akzent)          as sprache_akzent,
  sum(v.karten_gelernt)::int     as gelernt,
  sum(v.karten_gesamt)::int      as total,
  coalesce(sum(x.xp), 0)::int    as xp
from public.karteikarten_sets_uebersicht v
left join xp_je_set x on x.set_id = v.id
group by v.sprache_code
order by min(v.sprache);

-- -----------------------------------------------------------------------------
-- 4. Rechte wiedergeben
-- -----------------------------------------------------------------------------
-- Das ist der Teil, den man leicht übersieht: ein drop view nimmt die Rechte
-- mit. Ohne diese beiden Zeilen schlägt jede Abfrage mit "permission denied
-- for view" fehl – bei angemeldeten Nutzern genauso wie anonym, und der Fehler
-- sieht nach einem Rechteproblem in der App aus statt nach einer halb
-- gelaufenen Migration. Die Migration sieht in beiden Fällen erfolgreich aus.
--
-- Warum anonym bei, authenticated nicht übersehen wird: die View rechnet mit
-- auth.uid(), das für Anonyme NULL ist. Ausführung braucht die Rechte der
-- Rolle, also genau diese beiden Rollen. Mehr nicht: Schreiben darf hier
-- niemand, und eine View ist ohnehin nur lesbar.
--
-- grant usage on schema public und die Rechte auf xp_events /
-- karten_fortschritt aus 003 bleiben unberührt – dort wurde nichts verworfen.

grant select on public.karteikarten_sets_uebersicht to anon, authenticated;
grant select on public.statistik_pro_sprache        to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Was hier bewusst NICHT passiert
-- -----------------------------------------------------------------------------
--   - karteikarten_sets.sprache wird nicht gelöscht. Sie ist not null, und ein
--     Drop würde die alten Zeilen zwischen Migration und Deploy kurzzeitig
--     ohne Sprache dastehen lassen. Gehört nach Phase 4.
--   - Die Zähler in karten_gesamt / karten_gelernt / karten_faellig bleiben
--     dieselbe Rechnung wie in 003. Die ehrlichen Werte für die Fortschritts-
--     balken kommen in Phase 1.5, zusammen mit der Definition von "gelernt",
--     und die gehoert in beide Views.
--   - anzahl_karten wird nicht repariert. Die Spalte zaehlt nicht, sie behauptet
--     nur etwas (Live: 120/80/95 gegen count(k.id) = 122/82/96). Gehoert nach
--     Phase 4.
--   - Die Sprachliste wird nicht um Sprachen ergänzt. public.sprachen ist die
--     Wahrheit; eine hier eingefügte Sprache ohne Datenbankeintrag wäre wieder
--     eine zweite Quelle.

-- -----------------------------------------------------------------------------
-- 6. Prüfen, dass es geklappt hat
-- -----------------------------------------------------------------------------
-- Diese Abfrage im SQL Editor laufen lassen. Sie liefert drei Zeilen und
-- verrät sofort, ob die Migration durchgelaufen ist:
--
--   select v.sprache_code,
--          min(v.sprache)   as sprache,
--          count(*)         as sets,
--          sum(v.karten_gesamt) as karten
--   from public.karteikarten_sets_uebersicht v
--   group by v.sprache_code
--   order by 2;
--
-- Erwartung: je Sprache eine Zeile, `sets` = 1 für Englisch/Spanisch/
-- Italienisch (die drei Demo-Sets aus dem Seed), alle mit Code und nicht null.
--
-- Bleibt eine Zeile ohne Code stehen, ist das kein Fehler dieser Datei: 005
-- konnte die Sprache nicht zuordnen, weil sie nicht in public.sprachen steht.
-- Dann von Hand eintragen:
--
--   update public.karteikarten_sets
--      set sprache_code = 'zh'
--    where slug = 'der-slug-des-sets';
-- =============================================================================
