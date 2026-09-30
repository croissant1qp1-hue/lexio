-- =============================================================================
-- Lexio – Migration 002: Vokabel-Sets anlegen und loeschen
-- =============================================================================
-- Ausfuehren im Supabase Dashboard -> SQL Editor -> New query -> Run
-- Idempotent: mehrfach ausfuehrbar.
--
-- WARUM DIESE DATEI NOTWENDIG IST
-- ------------------------------
-- schema.sql legt fuer public.karteikarten_sets nur eine SELECT-Policy an
-- ("sets sind oeffentlich lesbar"). Insert und Delete fehlen komplett.
-- Supabase lehnt Schreibbefehle ohne passende Policy mit 401 ab:
--
--   POST   /rest/v1/karteikarten_sets  -> 401 new row violates row-level security
--   DELETE /rest/v1/karteikarten_sets  -> 401
--
-- Die App kann deshalb keine eigenen Vokabel-Sets anlegen und keine loeschen.
-- Genau das brauchen der Wizard (Set nach "Fertig" benennen) und die
-- Uebersicht (Set loeschen).
--
-- Die Karten eines Sets loescht Postgres ueber ON DELETE CASCADE mit, es
-- braucht also keine eigene Policy auf public.karten.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sets anlegen
-- -----------------------------------------------------------------------------
drop policy if exists "sets anlegen (nur entwicklung)" on public.karteikarten_sets;
create policy "sets anlegen (nur entwicklung)"
  on public.karteikarten_sets for insert
  with check (true);

-- -----------------------------------------------------------------------------
-- Sets loeschen und umbenennen
-- -----------------------------------------------------------------------------
drop policy if exists "sets loeschen (nur entwicklung)" on public.karteikarten_sets;
create policy "sets loeschen (nur entwicklung)"
  on public.karteikarten_sets for delete
  using (true);

drop policy if exists "sets aendern (nur entwicklung)" on public.karteikarten_sets;
create policy "sets aendern (nur entwicklung)"
  on public.karteikarten_sets for update
  using (true)
  with check (true);

-- -----------------------------------------------------------------------------
-- Sets als eigenstaendige Sets kennzeichnen
-- -----------------------------------------------------------------------------
-- Die Demodaten aus schema.sql (englisch-grundlagen, italienisch-urlaub,
-- spanisch-alltag) sind über ihre slug erkennbar. Selbst angelegte Sets
-- bekommen 'eigenes_set = true', damit die Uebersicht sie als eigene
-- Kacheln gruppieren und kraeftiger anbieten kann.
--
-- Bestehende Zeilen bekommen hier rückwirkend true, falls ihre slug nicht
-- zu einem der Seed-Sets passt – sonst bleibt die Spalte beim ersten Lauf
-- ungenutzt.
-- -----------------------------------------------------------------------------
alter table public.karteikarten_sets
  add column if not exists eigenes_set boolean not null default false;

update public.karteikarten_sets
   set eigenes_set = true
 where slug not in ('englisch-grundlagen', 'italienisch-urlaub', 'spanisch-alltag')
   and eigenes_set = false;

-- -----------------------------------------------------------------------------
-- Sets duerfen 0 Karten haben
-- -----------------------------------------------------------------------------
-- Ein Set entsteht in Schritt 3 des Wizards, also nachdem die Woerter schon
-- getippt sind. Wer den Wizard abbricht, hinterlaesst trotzdem ein leeres Set.
-- anzahl_karten hat deshalb keinen NOT NULL-Zwang mehr; die Kachel zeigt
-- einfach "0 Karten".
-- -----------------------------------------------------------------------------
alter table public.karteikarten_sets
  alter column anzahl_karten drop not null,
  alter column anzahl_karten set default 0;

-- -----------------------------------------------------------------------------
-- View um eigenes_set erweitern
-- -----------------------------------------------------------------------------
-- Die Uebersicht braucht die Spalte, um eigene Sets von den Demodaten zu
-- unterscheiden. create or replace view kann die Spaltenliste einer
-- bestehenden View nicht aendern, deshalb wird sie verworfen und neu
-- angelegt. Reihenfolge: abhaengige Views zuerst.
-- -----------------------------------------------------------------------------
drop view if exists public.statistik_pro_sprache;
drop view if exists public.xp_pro_tag;
drop view if exists public.karteikarten_sets_uebersicht;

create or replace view public.karteikarten_sets_uebersicht
with (security_invoker = true) as
select
  s.id,
  s.slug,
  s.name,
  s.sprache,
  s.anzahl_karten,
  s.eigenes_set,
  count(k.id)                                              as karten_gesamt,
  count(k.id) filter (where k.gelernt)                    as karten_gelernt,
  count(k.id) filter (where k.faellig_am <= current_date) as karten_faellig,
  -- "Zuletzt gelernt" fuer die Wortschatz-Tabelle. max() ueber null ergibt
  -- null, wenn das Set noch nie gelernt wurde – das ist korrekt und wird in
  -- der Oberflaeche als "–" angezeigt.
  max(k.letzte_wiederholung)                              as zuletzt_gelernt,
  case
    when count(k.id) = 0 then 0
    else round(count(k.id) filter (where k.gelernt) * 100.0 / count(k.id))::int
  end                                                     as fortschritt_prozent
from public.karteikarten_sets s
left join public.karten k on k.set_id = s.id
group by s.id, s.slug, s.name, s.sprache, s.anzahl_karten, s.eigenes_set;

create or replace view public.statistik_pro_sprache
with (security_invoker = true) as
with xp_je_set as (
  select set_id, sum(xp)::int as xp
  from public.xp_events
  where set_id is not null
  group by set_id
)
select
  v.sprache,
  sum(v.karten_gelernt)::int  as gelernt,
  sum(v.anzahl_karten)::int   as total,
  coalesce(sum(x.xp), 0)::int as xp
from public.karteikarten_sets_uebersicht v
left join xp_je_set x on x.set_id = v.id
group by v.sprache
order by v.sprache;

-- xp_pro_tag haengt zwar nicht an der Uebersichts-View, wird hier aber
-- trotzdem neu erstellt: sie stand in derselben drop-Liste, und eine Migration,
-- die eine View entfernt, muss sie auch wiederherstellen. Sonst faellt die
-- Wochenleiste auf der Ueberseite mit "relation xp_pro_tag does not exist"
-- aus, sobald die View nach dem Neuaufbau referenziert wird.
create or replace view public.xp_pro_tag
with (security_invoker = true) as
select
  x.datum,
  coalesce(sum(x.xp), 0)::int as xp,
  max(x.ziel)::int           as ziel
from public.xp_events x
where x.datum >= current_date - 6
group by x.datum;
