-- =============================================================================
-- 004 – Leistung
--
-- Erst NACH 003 ausführen. Diese Datei setzt Besitzrechte und
-- personenbezogene Fortschritte voraus (profil, karten_fortschritt,
-- xp_events mit eigenem Zugriff).
--
-- Worum es hier geht
-- -----------------
-- Lexio hält alle Daten in einer Supabase-Datenbank, und jede Anfrage landet
-- direkt dort. Das skaliert gut, solange die Datenbank an den Stellen einen
-- Index hat, an denen die App am häufigsten nachfragt – und nicht an den
-- Stellen, an denen man einen Index für hübsch hält.
--
-- Diese Datei ist bewusst kurz. Beim ersten Entwurf standen hier sechs
-- Indizes, und vier davon waren nutzlos:
--
--   - (karte_id, user_id) auf karten_fortschritt: das ist exakt der Primary
--     Key derselben Tabelle. Postgres legt für den Primary Key bereits einen
--     Index über genau diese Spalten in genau dieser Reihenfolge an. Ein
--     zweiter kostet Speicher und Schreibzeit, ohne eine einzige Abfrage
--     schneller zu machen.
--   - (user_id) auf karten_fortschritt: 003 legt (user_id, faellig_am,
--     stufe) an. Eine Abfrage auf user_id allein bedient ein solcher Index
--     genauso gut wie ein Index, der nach user_id aufhört.
--   - (user_id, faellig_am) where gelernt = false: ebenfalls ein Präfix von
--     003s Index. Der Teilindex wäre kleiner, aber die Zeilen, die er
--     einsparen würde, sind genau die, die ohnehin vorher gefunden werden.
--   - (slug) auf karteikarten_sets: schema.sql deklariert die Spalte bereits
--     als `unique`. Diese Eindeutigkeit ist ein Index. Ein zweiter Index auf
--     dieselbe Spalte ist der klassische Fall von zwei Waagen, die
--     unterschiedlich viel wiegen.
--
-- Was bleibt, beantwortet jeweils eine konkrete Abfrage der App. Alles
-- IF NOT EXISTS: die Datei kann mehrfach laufen, ohne Fehler.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Karten je Set, nach Fälligkeit
--
-- Die Lernsitzung fragt die Karten eines Sets und sortiert sie nach
-- Fälligkeit. schema.sql hat zwei Einzelindizes, (set_id) und (faellig_am);
-- keiner davon kann die Sortierung liefern, weil Postgres bei einer
-- Gleichheitsbedingung auf set_id nur die erste Indexspalte zum Sortieren
-- verwenden darf. Der zusammengesetzte Index beantwortet Frage und
-- Sortierung in einem Durchgang.
--
-- set_id allein ist nicht noch einmal nötig: diesen Index gibt es seit
-- schema.sql, und er ist der linke Präfix dieses hier.
-- -----------------------------------------------------------------------------
create index if not exists karten_set_faellig_idx
  on public.karten (set_id, faellig_am);

-- -----------------------------------------------------------------------------
-- 2. XP nach Set
--
-- Zwei Abfragen brauchen das, und beide kommen aus den Statistik-Views:
--
--   - public.mein_fortschritt zählt "in wie vielen Sets habe ich geübt"
--     (count(distinct set_id)),
--   - public.statistik_pro_sprache summiert XP je Set, um daraus XP je
--     Sprache zu machen.
--
-- unique (user_id, datum) aus schema.sql ist der linke Präfix davon und
-- deckt "meine Zeilen" ab, aber set_id steht dort nicht drin. Diese Abfragen
-- sortieren nach set_id, also brauchen sie ihn.
-- -----------------------------------------------------------------------------
create index if not exists xp_events_user_set_idx
  on public.xp_events (user_id, set_id);

-- -----------------------------------------------------------------------------
-- 3. XP nach Datum
--
-- public.xp_pro_tag (letzte sieben Tage) und public.mein_fortschritt (Streak
-- über 400 Tage) filtern in der Abfrage nur auf dem Datum:
--
--     where datum >= current_date - 6
--
-- Der Nutzer kommt nicht als Bedingung im Text vor – die Views holen ihn
-- über die Zeilenregeln (user_id = auth.uid()). Für die Sortierung und den
-- Bereich auf dem Datum kann Postgres den Index unique (user_id, datum) aber
-- nur verwenden, wenn die Zeilenregel als Indexbedingung durchgereicht wird.
-- Darauf zu vertrauen wäre Optimismus mit Datenbankteil: die Tabelle wächst
-- mit jedem Klick jedes Nutzers unbegrenzt, und ein fehlender Index fällt
-- erst auf, wenn es weh tut. Deshalb der eigene Index auf dem Datum.
--
-- Sobald den Views ein ausdrückliches where user_id = auth.uid() gegeben wird,
-- ist dieser Index überflüssig und sollte gelöscht werden. Bei einer Tabelle
-- mit vielen Nutzern lohnt der Blick auf:
--
--     explain analyze select * from public.xp_pro_tag;
-- -----------------------------------------------------------------------------
create index if not exists xp_events_datum_idx
  on public.xp_events (datum);

-- -----------------------------------------------------------------------------
-- 4. Sets
--
-- 003 legt karteikarten_sets_user_id_idx an, und die Zeilenregel auf
-- karteikarten_sets lautet "user_id is null or user_id = auth.uid()" – ein
-- ODER, das die allermeisten Indizes auf dieser Tabelle wertlos macht. Solange
-- jeder Mensch ein paar Dutzend Sets hat, ist das eine Mengenfrage, keine
-- Geschwindigkeitsfrage, und ein weiterer Index würde nur beim Schreiben
-- nerven. Was fehlt, ist hier also nichts.
--
-- Was hier auch nicht fehlen darf: ein Trigger, der den Slug selbst vergibt.
-- Die API bildet ihn aus dem Namen und hängt bei Kollision ein Suffix an.
-- Zwei Wege für dieselbe Sache sind einer zu viel.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 5. Aufräumen
--
-- Karten ohne Inhalt und Sets ohne Karten sind Datenmüll, der jede Zählung
-- verfälscht: ein leeres Set zeigt 100 % und bindet Platz in der Ansicht.
-- Die Abfrage löscht nichts, sie zeigt nur – absichtlich. Wer die Zeilen
-- wirklich entfernen will, entscheidet das im SQL Editor, nicht beim
-- nächsten Deploy.
-- -----------------------------------------------------------------------------
do $$
declare
  v_leer integer;
begin
  select count(*) into v_leer
  from public.karteikarten_sets s
  where not exists (select 1 from public.karten k where k.set_id = s.id);

  if v_leer > 0 then
    raise notice '% Set(s) ohne Karten gefunden. Sie zählen als 100 %% Fortschritt.', v_leer;
  end if;
end;
$$;

-- =============================================================================
-- Fertig. Diese Datei kann jederzeit erneut laufen.
-- =============================================================================
