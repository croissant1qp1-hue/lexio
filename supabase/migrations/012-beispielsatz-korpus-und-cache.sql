-- =============================================================================
-- 012 – Beispielsatz: Tatoeba-Korpus und Ergebnis-Cache
--
-- Wofuer Phase 2.5-Beispielsatz (Plan: Automatische Beispielsaetze)
-- -----------------------------------------------------------------------------
-- Im Vokabel-Wizard soll ein Wort, das man eintippt, auf Wunsch einen
-- Beispielsatz mitbekommen. Zwei Quellen, in dieser Reihenfolge:
--
--   1. TATOEBE-KORPUS  – echte Saetzepaare (EN -> DE) aus der Tatoeba
--      Datenbank, einmalig per Skript importiert. Kostenlos, deterministisch,
--      qualitativ solide. Die Tabelle speichert je Wort den kuerzesten
--      brauchbaren Satz (4-15 Woerter) samt uebersetzung.
--
--   2. KI-CACHE        – wenn der Korpus kein Wort kennt, erzeugt eine
--      kostenlose KI-API (Groq, Llama) einen Satz. Das Ergebnis wird hier
--      gecacht, damit dasselbe Wortspaar nicht zweimal an die API geht.
--
-- Der Server-Call stroemnt also: erst Korpus, dann Cache, zuletzt KI.
--
-- Warum der Korpus in der Datenbank liegt und nicht als Datei
-- -----------------------------------------------------------------------------
-- Der Generator woertet einmal pro Nacht; die App fragt Wort fuer Wort. Eine
-- 35k-Zeilen-Datei bei jedem Request zu parsen ist Verschwendung und laesst
-- sich nicht indexieren. In der Tabelle ist `wort` Primarschluessel, und die
-- Suche ist ein Index-Lookup.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tatoeba-Korpus
-- -----------------------------------------------------------------------------

create table if not exists public.beispielsatz_korpus (
  -- Normalisierte Form des Wortes: klein, ohne Satzzeichen. Eindeutig je
  -- Wort – der kuerzeste Satz gewinnt (siehe Import-Skript).
  wort         text primary key,

  -- Satz auf Englisch. Immer der kuerzeste brauchbare, der das Wort enthaelt.
  satz         text not null,

  -- Deutsche Uebersetzung von satz.
  uebersetzung text not null
);

comment on table public.beispielsatz_korpus is
  'Tatoeba-Index: normalisiertes englisches Wort -> kuerzester Beispielsatz '
  'mit deutscher Uebersetzung. Einmalig per Skript befuellt.';

-- -----------------------------------------------------------------------------
-- 2. Ergebnis-Cache (vor allem fuer KI-generierte Saetze)
-- -----------------------------------------------------------------------------

create table if not exists public.beispielsatz_cache (
  id           uuid primary key default gen_random_uuid(),

  -- Das eingegebene Begriffspaar, genau wie es der Wizard gesendet hat:
  -- frage = das Wort, antwort = die vom Nutzer gesehene Uebersetzung.
  frage        text not null,
  antwort      text not null,

  -- Satz in der Zielsprache + deutsche Uebersetzung.
  satz         text not null,
  uebersetzung text not null,

  -- 'tatoeba' oder 'ki'. Eher Dokumentation; der Wert steuert nichts.
  quelle       text not null default 'ki',

  erstellt_am  timestamptz not null default now()
);

-- Ein Wortspaar wird hoechstens einmal erzeugt. Wiederholte Anfragen treffen
-- den Cache, nicht die KI – das haelt das Gratis-Kontingent frei.
create unique index if not exists beispielsatz_cache_paar_idx
  on public.beispielsatz_cache (lower(frage), lower(antwort));

comment on table public.beispielsatz_cache is
  'Cache fuer automatisch erzeugte Beispielsaetze. Tieftreffer beim selben '
  'Wortspaar greifen hier, statt die KI erneut zu fragen.';

-- -----------------------------------------------------------------------------
-- 3. Sichtbarkeit
-- -----------------------------------------------------------------------------
-- Beide Tabellen sind reine Lesedaten fuer die Route (authenticated liest
-- und schreibt Cache, anon nur lesen). Das Schreiben des Korpus laeuft ueber
-- die Management-API und umgeht RLS ohnehin – fuer die Anwendung reicht es,
-- wenn saemtlicher Zugriff lesend ist. Beim Cache kommen authentifizierte
-- Inserts dazu, denn die Route speichert das KI-Ergebnis mit dem
-- angemeldeten User-Client.

alter table public.beispielsatz_korpus enable row level security;
alter table public.beispielsatz_cache  enable row level security;

drop policy if exists "beispielsatz-korpus ist oeffentlich lesbar" on public.beispielsatz_korpus;
create policy "beispielsatz-korpus ist oeffentlich lesbar"
  on public.beispielsatz_korpus for select
  using (true);

drop policy if exists "beispielsatz-cache ist lesbar fuer authentifizierte" on public.beispielsatz_cache;
create policy "beispielsatz-cache ist lesbar fuer authentifizierte"
  on public.beispielsatz_cache for select
  using (true);

-- Die Route schreibt das KI-Ergebnis mit dem User-Client. Ohne diese Policy
-- waere ein Insert "row-level security violation" und jeder neue Satz ginge
-- verloren.
drop policy if exists "beispielsatz-cache darf erzeugt werden" on public.beispielsatz_cache;
create policy "beispielsatz-cache darf erzeugt werden"
  on public.beispielsatz_cache for insert
  with check (true);

grant select on public.beispielsatz_korpus to anon, authenticated;
grant select, insert on public.beispielsatz_cache  to authenticated;

-- =============================================================================
-- Fertig. Diese Datei kann jederzeit erneut laufen.
-- =============================================================================