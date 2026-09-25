-- =============================================================================
-- Lexio – Datenbankschema
-- =============================================================================
-- Ausführen im Supabase Dashboard → SQL Editor → New query → Run
-- Idempotent: kann mehrfach ausgeführt werden, ohne Fehler.
-- =============================================================================

create table if not exists public.karteikarten_sets (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  sprache       text not null,
  anzahl_karten integer not null default 0,
  erstellt_am   timestamptz not null default now()
);

create table if not exists public.karten (
  id         uuid primary key default gen_random_uuid(),
  set_id     uuid not null references public.karteikarten_sets (id) on delete cascade,
  frage      text not null,
  antwort    text not null,
  gelernt    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  set_id     uuid references public.karteikarten_sets (id) on delete set null,
  datum      date not null,
  xp         integer not null default 0,
  ziel       integer not null default 20,
  unique (user_id, datum)
);

-- set_id ordnet den XP einer Sprache zu. Wird per Migration nachgezogen,
-- falls die Tabelle schon aus einem früheren Schema-Stand existiert.
alter table public.xp_events
  add column if not exists set_id uuid references public.karteikarten_sets (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- RLS ist der Grund, warum der anon Key allein nicht ausreicht, um fremde
-- Daten zu lesen. Ohne diese Policies gibt die API nach dem Aktivieren
-- grundsätzlich 0 Zeilen zurück. Das ist korrekt, nicht kaputt.
-- -----------------------------------------------------------------------------

alter table public.karteikarten_sets enable row level security;
alter table public.karten            enable row level security;
alter table public.xp_events         enable row level security;

-- Karten & Karten-Sets sind zunächst frei lesbar (Lerninhalte, kein Nutzerbezug)
drop policy if exists "sets sind oeffentlich lesbar" on public.karteikarten_sets;
create policy "sets sind oeffentlich lesbar"
  on public.karteikarten_sets for select
  using (true);

drop policy if exists "karten sind oeffentlich lesbar" on public.karten;
create policy "karten sind oeffentlich lesbar"
  on public.karten for select
  using (true);

-- XP ist nutzergebunden: jeder sieht nur seine eigenen Zeilen
drop policy if exists "eigene xp lesen" on public.xp_events;
create policy "eigene xp lesen"
  on public.xp_events for select
  using (auth.uid() = user_id);

drop policy if exists "eigene xp schreiben" on public.xp_events;
create policy "eigene xp schreiben"
  on public.xp_events for insert
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Startdaten
-- -----------------------------------------------------------------------------
insert into public.karteikarten_sets (slug, name, sprache, anzahl_karten)
values
  ('englisch-grundlagen', 'Englisch Grundlagen', 'Englisch', 120),
  ('italienisch-urlaub',  'Italienisch Urlaub',  'Italienisch', 80),
  ('spanisch-alltag',     'Spanisch Alltag',     'Spanisch', 95)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------
-- Aggregationen über eine Tabelle laufen in SQL, nicht in TypeScript. Dadurch
-- kommt nur das fertige Ergebnis über die Leitung, statt erst jeder einzelnen
-- Karte zu demselben Nutzer.
--
-- security_invoker = true erzwingt, dass die RLS-Policies der zugrunde
-- liegenden Tabellen greifen. Ohne das würde die View mit den Rechten des
-- Eigentümers laufen und RLS umgehen.
-- -----------------------------------------------------------------------------

-- create or replace view kann die Spaltenreihenfolge einer bestehenden View
-- nicht aendern. Deshalb werden die Views vorher explizit verworfen.
-- Reihenfolge beachten: Abhaengige Views zuerst.
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
  count(k.id)                                              as karten_gesamt,
  count(k.id) filter (where k.gelernt)                    as karten_gelernt,
  case
    when count(k.id) = 0 then 0
    else round(count(k.id) filter (where k.gelernt) * 100.0 / count(k.id))::int
  end                                                     as fortschritt_prozent
from public.karteikarten_sets s
left join public.karten k on k.set_id = s.id
group by s.id, s.slug, s.name, s.sprache, s.anzahl_karten;

-- xp wird pro Set VOR dem Join verdichtet. Sonst vervielfacht der Join die
-- Zeilen und die Kartenzaehler werden mit hochgezaehlt.
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

create or replace view public.xp_pro_tag
with (security_invoker = true) as
select
  x.datum,
  coalesce(sum(x.xp), 0)::int as xp,
  max(x.ziel)::int           as ziel
from public.xp_events x
where x.datum >= current_date - 6
group by x.datum;
