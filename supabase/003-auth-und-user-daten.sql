-- =============================================================================
-- Lexio – Migration 003: Konten, Anmeldung und Nutzerdaten
-- =============================================================================
-- Ausfuehren im Supabase Dashboard -> SQL Editor -> New query -> Run
-- Idempotent: mehrfach ausfuehrbar. Danach 002 nicht erneut ausfuehren.
--
-- WARUM DIESE MIGRATION NOTWENDIG IST
-- ------------------------------------
-- Bisher war jeder, der die App geoeffnet hat, derselbe Nutzer. Die Sets waren
-- oeffentlich lesbar, jede:r konnte sie anlegen und loeschen, und der
-- Lernstand lag auf der Karte selbst. Zwei Konsequenzen, die man nur beim
-- Benutzen sieht:
--
--   1. Jeder konnte die Demodaten loeschen. /api/sets/[slug] hat nur den Slug
--      geprueft, keinen Besitzer.
--   2. Zwei Personen hätten dieselbe Karte nie getrennt gelernt. "gelernt",
--      "stufe" und "faellig_am" standen in public.karten – global. Wer eine
--      Karte beantwortet, hat den Stand für alle überschrieben.
--
-- Diese Migration verschiebt den Lernstand in public.karten_fortschritt und
-- haengt ihn an auth.uid(). Die Demodaten bleiben global (user_id = null),
-- damit die App nach dem Anmelden nicht leer ist – angefasst werden können
-- sie aber nur noch von niemandem ausser von niemandem.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Nutzerprofil
-- -----------------------------------------------------------------------------
-- Bewusst schlank: nur, was nicht schon in auth.users steht. XP und Streak
-- werden aus xp_events berechnet (public.mein_fortschritt) und nicht
-- hierher kopiert – eine zweite Zahl, die man pflegen kann, ist eine, die
-- irgendwann falsch ist.
-- -----------------------------------------------------------------------------

create table if not exists public.profil (
  id         uuid primary key references auth.users (id) on delete cascade,
  vorname    text        not null default '',
  avatar_url text,
  erstellt_am timestamptz not null default now()
);

alter table public.profil enable row level security;

drop policy if exists "eigenes profil lesen" on public.profil;
create policy "eigenes profil lesen"
  on public.profil for select
  using (id = auth.uid());

drop policy if exists "eigenes profil aendern" on public.profil;
create policy "eigenes profil aendern"
  on public.profil for update
  using (id = auth.uid())
  with check (id = auth.uid());


-- -----------------------------------------------------------------------------
-- 2. Profil bei jeder Registrierung anlegen
-- -----------------------------------------------------------------------------
-- Google und GitHub liefern den Namen und das Bild in raw_user_meta_data,
-- Supabase selbst legt dort aber nichts an. Ohne diesen Trigger hat jede
-- angemeldete Person eine Zeile ohne Namen.
--
-- security definer, weil der Trigger mit den Rechten des Funktionsbesitzers
-- laeuft: public.profil hat RLS, und der aufrufende Nutzer ist zu diesem
-- Zeitpunkt noch nicht in auth.uid() enthalten.
-- -----------------------------------------------------------------------------

create or replace function public.profil_bei_neuem_nutzer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profil (id, vorname, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.profil_bei_neuem_nutzer();


-- Fuer Konten, die vor dieser Migration angelegt wurden: Profil nachtragen.
insert into public.profil (id, vorname, avatar_url)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, ''), '@', 1),
    ''
  ),
  coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  )
from auth.users u
on conflict (id) do nothing;


-- -----------------------------------------------------------------------------
-- 3. Sets gehören jetzt einer Person
-- -----------------------------------------------------------------------------
-- null = global. Genau daran erkennen die Demodaten aus schema.sql und
-- seed.sql: sie bekommen kein user_id. Der anonymous-Zugriff darf sie
-- weiterhin lesen, aber niemand kann sie loeschen.
-- -----------------------------------------------------------------------------

alter table public.karteikarten_sets
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists karteikarten_sets_user_id_idx
  on public.karteikarten_sets (user_id);

-- eigenes_set wird hier ebenfalls angelegt, obwohl es schon 002 tut.
--
-- Warum: 003 benutzt die Spalte weiter unten in der View
-- public.karteikarten_sets_uebersicht, und dort bricht der Lauf ab, wenn sie
-- fehlt:
--
--   ERROR: 42703: column s.eigenes_set does not exist
--
-- Das ist keine theoretische Sorge. Genau dieser Fehler ist aufgetreten,
-- weil 002 nie gelaufen war – 003 wurde zuerst ausgefuehrt, und
-- idempotent heisst hier nur "mehrfach ausfuehrbar", nicht "unabhaengig von
-- der Reihenfolge".
--
-- "if not exists" macht den zweiten Aufruf zur No-op, falls 002 doch schon
-- gelaufen ist. Die update-Zeile darunter setzt die Demo-Sets auf false,
-- damit die Uebersicht sie weiterhin als fremde Kacheln erkennt.
alter table public.karteikarten_sets
  add column if not exists eigenes_set boolean not null default false;

update public.karteikarten_sets
   set eigenes_set = false
 where slug in ('englisch-grundlagen', 'italienisch-urlaub', 'spanisch-alltag')
   and eigenes_set is distinct from false;

-- Bestandsschutz: Wenn Auth schon lief, gehoeren die eigenen Sets niemandem.
-- Sie bleiben vorerst global (user_id = null) und sind damit lesbar, aber
-- nicht mehr loeschbar. Das ist die sichere Richtung – lieber zu viel
-- sichtbar als fremder Besitz.
--
-- Wer seine Sets zuordnen will, setzt user_id von Hand in einem UPDATE.


-- -----------------------------------------------------------------------------
-- 4. Lernstand pro Person
-- -----------------------------------------------------------------------------
-- Das ist der eigentliche Fix. Vorher standen gelernt/stufe/faellig_am in
-- public.karten – eine Zeile, die alle gemeinsam benutzt haben. Der neue
-- Primary Key (karte_id, user_id) macht daraus eine Zeile je Paar.
--
-- Die alten Spalten in public.karten bleiben vorerst bestehen, werden aber
-- nicht mehr gelesen. Sie zu loeschen waere der naechste Schritt, sobald
-- 003b den Demostand umgezogen hat; vorher waeren sie der einzige Ort, an
-- dem der alte Fortschritt noch nachzusehen waere.
-- -----------------------------------------------------------------------------

create table if not exists public.karten_fortschritt (
  karte_id            uuid not null references public.karten (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  stufe               integer     not null default 0,
  gelernt             boolean     not null default false,
  faellig_am          date        not null default current_date,
  letzte_wiederholung timestamptz,
  treffer             integer     not null default 0,
  fehler              integer     not null default 0,
  primary key (karte_id, user_id)
);

-- Die Lernsitzung fragt "welche Karten sind heute faellig" sortiert nach
-- Stufe. Ohne diesen Index laeuft das ueber die ganze Tabelle.
create index if not exists karten_fortschritt_faellig_idx
  on public.karten_fortschritt (user_id, faellig_am, stufe);

alter table public.karten_fortschritt enable row level security;

drop policy if exists "eigenen fortschritt lesen" on public.karten_fortschritt;
create policy "eigenen fortschritt lesen"
  on public.karten_fortschritt for select
  using (user_id = auth.uid());

drop policy if exists "eigenen fortschritt schreiben" on public.karten_fortschritt;
create policy "eigenen fortschritt schreiben"
  on public.karten_fortschritt for insert
  with check (user_id = auth.uid());

drop policy if exists "eigenen fortschritt aendern" on public.karten_fortschritt;
create policy "eigenen fortschritt aendern"
  on public.karten_fortschritt for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "eigenen fortschritt loeschen" on public.karten_fortschritt;
create policy "eigenen fortschritt loeschen"
  on public.karten_fortschritt for delete
  using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 5. Entwicklungs-Policies entfernen
-- -----------------------------------------------------------------------------
-- schema.sql und 002 haben vier Policies mit `with check (true)` /
-- `using (true)` angelegt. Sie waren der Grund, warum die App ueberhaupt
-- speichern konnte, bevor es Auth gab. Mit Auth laufen sind sie ein
-- Loch: jeder mit dem anon Key koennte weiterhin beliebige Sets loeschen.
--
-- Ein `drop policy if exists` auf einen Namen, den es nicht gibt, ist
-- kein Fehler. Deshalb stehen die Zeilen unbedingt hier, auch wenn jemand
-- 002 nicht ausgefuehrt hat.
-- -----------------------------------------------------------------------------

drop policy if exists "sets anlegen (nur entwicklung)"  on public.karteikarten_sets;
drop policy if exists "sets loeschen (nur entwicklung)" on public.karteikarten_sets;
drop policy if exists "sets aendern (nur entwicklung)"  on public.karteikarten_sets;
drop policy if exists "karten anlegen (nur entwicklung)" on public.karten;
drop policy if exists "karten aktualisieren (nur entwicklung)" on public.karten;

-- Und die oeffentlichen Leserechte neu gefasst: globale Sets bleiben offen,
-- eigene Sets sind privat.
drop policy if exists "sets sind oeffentlich lesbar" on public.karteikarten_sets;
-- Auch der neue Name wird gedroppt: 003 ist idempotent gebaut, damit ein
-- halb gelaufener Lauf wiederholbar ist. Ohne diese Zeile bricht der
-- zweite Lauf mit 42710 ab, sobald "sets lesen" schon existiert.
drop policy if exists "sets lesen" on public.karteikarten_sets;
create policy "sets lesen"
  on public.karteikarten_sets for select
  using (user_id is null or user_id = auth.uid());

drop policy if exists "eigene sets anlegen" on public.karteikarten_sets;
create policy "eigene sets anlegen"
  on public.karteikarten_sets for insert
  with check (user_id = auth.uid());

drop policy if exists "eigene sets aendern" on public.karteikarten_sets;
create policy "eigene sets aendern"
  on public.karteikarten_sets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "eigene sets loeschen" on public.karteikarten_sets;
create policy "eigene sets loeschen"
  on public.karteikarten_sets for delete
  using (user_id = auth.uid());

-- Karten: sichtbar, sobald ihr Set sichtbar ist. Die EXISTS-Abfrage laeuft
-- mit den Rechten der aufrufenden Rolle, greift also ebenfalls die
-- Policy von karteikarten_sets. Ohne diese Policy wuerde die Abfrage den
-- Satz finden und eine fremde Karte preisgeben.
drop policy if exists "karten sind oeffentlich lesbar" on public.karten;
drop policy if exists "karten lesen" on public.karten;
create policy "karten lesen"
  on public.karten for select
  using (exists (select 1 from public.karteikarten_sets s where s.id = set_id));

-- Schreiben darf nur in eigene Sets. Die globale Demokarte ist damit auch
-- vor dem Anhaengen von Vokabeln geschuetzt.
drop policy if exists "eigene karten anlegen" on public.karten;
create policy "eigene karten anlegen"
  on public.karten for insert
  with check (
    exists (
      select 1 from public.karteikarten_sets s
      where s.id = set_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "eigene karten aendern" on public.karten;
create policy "eigene karten aendern"
  on public.karten for update
  using (
    exists (
      select 1 from public.karteikarten_sets s
      where s.id = set_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "eigene karten loeschen" on public.karten;
create policy "eigene karten loeschen"
  on public.karten for delete
  using (
    exists (
      select 1 from public.karteikarten_sets s
      where s.id = set_id and s.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5b. XP-Zeilen: die drei Aktionen, die es braucht
-- -----------------------------------------------------------------------------
-- schema.sql hatte nur SELECT und INSERT. public.antwort_verbuchen in
-- Abschnitt 9 schreibt aber ein `insert ... on conflict (user_id, datum)
-- do update`: Der Konfliktfall – die zweite Antwort am selben Tag – ist
-- genau der Normalfall, und er braucht ein UPDATE-Recht auf der Policy-Ebene.
--
-- Was passiert war: Die erste Antwort eines Tages wurde gespeichert, die
-- zweite scheiterte mit 42501, ohne dass eine Zeile halb geschrieben
-- wurde. Im Lernmodul sah das wie ein Serverausfall aus, in der Kopfzeile
-- standen XP, die der Server nicht kannte, und die Karte blieb liegen.
-- Die Funktion selbst hat die Rechte nicht – sie laeuft mit
-- security invoker, also mit den Rechten der aufrufenden Person.
--
-- `using` beschreibt, welche Zeilen geaendert werden duerfen, `with check`
-- welche danach noch die eigene sein duerfen. Beides auf user_id, damit
-- niemand seine Tageszeile auf eine fremde schieben kann.
-- -----------------------------------------------------------------------------

drop policy if exists "eigene xp lesen" on public.xp_events;
create policy "eigene xp lesen"
  on public.xp_events for select
  using (auth.uid() = user_id);

drop policy if exists "eigene xp schreiben" on public.xp_events;
create policy "eigene xp schreiben"
  on public.xp_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "eigene xp fortschreiben" on public.xp_events;
create policy "eigene xp fortschreiben"
  on public.xp_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 6. Views neu aufbauen
-- -----------------------------------------------------------------------------
-- create or replace view kann die Spaltenliste nicht aendern. Deshalb
-- drop + create. Reihenfolge: abhaengige Views zuerst.
--
-- Der entscheidende Unterschied zu 002: karten_gelernt und karten_faellig
-- kommen aus dem LEFT JOIN auf karten_fortschritt und damit aus dem Stand
-- DER ANGEMELDETEN PERSON. Fuer jeden Nutzer zaehlt die Karte anders.
--
-- coalesce(f.faellig_am, current_date) ist wichtig: eine Karte ohne
-- Fortschrittszeile ist neu, und eine neue Karte ist heute faellig. Ohne das
-- coalesce waere der Vergleich NULL, und NULL gilt nicht – die Karte
-- wuerde in keinem Set als faellig erscheinen und niemand koennte anfangen.
-- -----------------------------------------------------------------------------

drop view if exists public.statistik_pro_sprache;
drop view if exists public.xp_pro_tag;
drop view if exists public.mein_fortschritt;
drop view if exists public.karteikarten_sets_uebersicht;

create or replace view public.karteikarten_sets_uebersicht
with (security_invoker = true) as
select
  s.id,
  s.slug,
  s.name,
  s.sprache,
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
left join public.karten k on k.set_id = s.id
left join public.karten_fortschritt f
       on f.karte_id = k.id
      and f.user_id = auth.uid()
group by s.id, s.slug, s.name, s.sprache, s.anzahl_karten, s.user_id, s.eigenes_set;


-- XP je Sprache. Die Sets kommen aus der Uebersichts-View und sind damit
-- schon auf die sichtbaren Sets der angemeldeten Person begrenzt.
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
  sum(v.karten_gesamt)::int   as total,
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


-- -----------------------------------------------------------------------------
-- 7. Eine Zeile: XP gesamt und Streak
-- -----------------------------------------------------------------------------
-- Die Navbar und die Uebersicht brauchen dieselben zwei Zahlen. Sie hier
-- einmal zu berechnen ist guenstiger und vor allem konsistenter als zwei
-- Abfragen an zwei Stellen, die auseinanderlaufen duerfen.
--
-- Die Serie zaehlt die aufeinanderfolgenden Tage mit XP. reihe_start.erster
-- verschiebt den Anfang um einen Tag, wenn heute noch nicht gelernt wurde –
-- sonst verliert man die Serie schon morgens vor dem ersten Klick.
-- -----------------------------------------------------------------------------

create or replace view public.mein_fortschritt
with (security_invoker = true) as
with tage as (
  select generate_series(current_date - 399, current_date, interval '1 day')::date as datum
),
taetig as (
  select datum, sum(xp)::int as xp
  from public.xp_events
  where datum >= current_date - 399
  group by datum
),
reihe as (
  select
    t.datum,
    row_number() over (order by t.datum desc) as abstand,  -- 1 = heute
    coalesce(a.xp, 0) as xp
  from tage t
  left join taetig a on a.datum = t.datum
),
reihe_start as (
  /*
   * Frueher hiess dieses CTE `start`. START ist ein SQL-Schluesselwort, und
   * ein Bezeichner, der an der einen Stelle ein Schluesselwort ist und an der
   * anderen nicht, ist eine Fehlerquelle mit Verzoegerung: der Editor
   * markiert es, Postgres nimmt es, und beim naechsten Supabase-Update
   * moeglicherweise nicht mehr.
   *
   * Zusaetzlich stand zwischen ihm und `streak` noch ein zweites CTE, das
   * nichts tat ausser `erster` durchzureichen. Beide sind hier zu einem
   * verschmolzen: dasselbe Ergebnis, eine Stufe weniger zu lesen.
   */
  select case
    when max(xp) filter (where abstand = 1) > 0 then 1
    when max(xp) filter (where abstand = 2) > 0 then 2
    else 0
  end as erster
  from reihe
),
streak as (
  select count(*)::int as tage
  from reihe, reihe_start
  -- erster = 0 heisst "gar nicht heute und gar nicht gestern gelernt" und
  -- darf nicht die 400 Tage der Historie zaehlen.
  where reihe_start.erster > 0
    and reihe.abstand >= reihe_start.erster
    and reihe.xp > 0
)
select
  (select coalesce(sum(xp), 0)::int from public.xp_events) as xp_gesamt,
  (select count(*)::int from taetig)                      as lerntage,
  (select count(distinct set_id)::int
     from public.xp_events where set_id is not null)      as sets_gelernt,
  streak.tage                                            as streak
from streak;


-- -----------------------------------------------------------------------------
-- 8. Rechte
-- -----------------------------------------------------------------------------
-- RLS entscheidet, WELCHE Zeilen jemand sehen darf. Grants entscheiden, OB
-- die Rolle die Anfrage ueberhaupt stellen darf. Beides wird gebraucht, und
-- die zweite Hälfte fehlt in schema.sql und 002 komplett.
--
-- Kein GRANT fuer anon. Wer nicht angemeldet ist, soll die Demodaten lesen
-- können – das geben die alten Rechte, die Supabase bei neuen Tabellen
-- automatisch setzt, und die hier unveraendert bleiben. Schreiben darf anon
-- nirgends.
-- -----------------------------------------------------------------------------

-- Die Basisrechte, die Supabase sonst aus den Default-Privilegien zieht.
grant usage on schema public to authenticated, anon;

grant select on public.karteikarten_sets to anon, authenticated;
grant select, insert, update, delete on public.karteikarten_sets to authenticated;

grant select on public.karten to anon, authenticated;
grant select, insert, update, delete on public.karten to authenticated;

grant select on public.profil to authenticated;
grant update on public.profil to authenticated;

grant select, insert, update, delete on public.karten_fortschritt to authenticated;

-- update ist noetig, weil /api/lernen/antwort per on-conflict do update
-- aufsummiert. Ein reines insert wuerde bei jedem zweiten Klick einer
-- Karte am Tag an der unique-Regel (user_id, datum) scheitern.
grant select, insert, update on public.xp_events to authenticated;

-- Views mit security_invoker brauchen ihre eigenen Rechte. auth.uid() ist
-- in einer security_invoker-View NULL, wenn der Aufrufer anonym ist – die
-- Rechte kommen also von der Rolle, nicht von der Policy. Fuer angemeldete
-- Nutzer genuegt die Ausfuehrungsrechte auf die View.
grant select on public.karteikarten_sets_uebersicht to anon, authenticated;
grant select on public.statistik_pro_sprache        to authenticated;
grant select on public.xp_pro_tag                  to authenticated;
grant select on public.mein_fortschritt            to authenticated;

-- Die Views lesen xp_events und karten_fortschritt. Ohne diese Zeile darf
-- die angemeldete Rolle in die View hineinsehen, aber nicht in die
-- Tabellen darunter – und die Migration sieht erfolgreich aus, waehrend
-- jede Abfrage mit "permission denied for table" fehlschlaegt.
grant select on public.xp_events, public.karten_fortschritt to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Eine Antwort in einem Zug verbuchen
-- -----------------------------------------------------------------------------
-- Der entscheidende Teil. /api/lernen/antwort schreibt an zwei Stellen: den
-- Fortschritt der Karte und die XP des Tages. Zwei HTTP-Aufrufe an Supabase
-- sind zwei Transaktionen.
--
-- Das Problem: antwortet man schnell genug, laeuft die zweite Transaktion ab,
-- bevor die erste fertig ist. Dann ist der Fortschritt gespeichert und die XP
-- nicht, oder umgekehrt. Beides sieht harmlos aus – die Karte wandert
-- weiter, der Zaehler bleibt stehen.
--
-- Ein Aufruf an diese Funktion ist eine Transaktion. Geht etwas schief,
-- passiert nichts.
--
-- Die Stufenlogik kommt bewusst NICHT hier herein. Intervalle und Stufen
-- stehen in lib/lernlogik.ts, und eine zweite, in SQL abgeschriebene Fassung
-- waere eine Definition, die man beim Aendern der einen vergisst. Die Route
-- rechnet und uebergibt das Ergebnis; diese Funktion schreibt es.
-- -----------------------------------------------------------------------------

create or replace function public.antwort_verbuchen (
  p_karte_id    uuid,
  p_set_id      uuid,
  p_bewertung   text,
  p_neue_stufe  integer,
  p_gelernt     boolean,
  p_faellig_am  date,
  p_xp          integer
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_ganz bigint;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  if p_bewertung not in ('nochmal', 'schwer', 'gut', 'einfach') then
    raise exception 'Unbekannte Bewertung: %', p_bewertung using errcode = '22023';
  end if;

  /*
   * Die Karte muss zu einem Set gehoeren, das diese Person sehen darf.
   * Die EXISTS-Abfrage laeuft mit den Rechten der aufrufenden Rolle, greift
   * also die Policy auf karteikarten_sets: ein fremdes privates Set liefert
   * false, ein Demoset true, ein nicht existierendes false.
   */
  if not exists (
    select 1
    from public.karten k
    join public.karteikarten_sets s on s.id = k.set_id
    where k.id = p_karte_id
      and k.set_id = p_set_id
      and (s.user_id is null or s.user_id = v_user)
  ) then
    raise exception 'Karte nicht gefunden.' using errcode = 'P0002';
  end if;

  /*
   * Fortschritt. on conflict do update statt vorherigem Lesen und dann
   * Schreiben: das Lesen und das Schreiben einer Zeile, die zwischen zwei
   * Karten im selben Set angefasst werden koennte, sind ohne Sperre nicht
   * konsistent. Treffer und Fehler werden im UPDATE aus dem bestehenden Wert
   * berechnet, nicht aus einem vorher gelesenen – sonst wuerde der zweite
   * Klick die Zaehlung des ersten ueberschreiben.
   */
  insert into public.karten_fortschritt
    (karte_id, user_id, stufe, gelernt, faellig_am, treffer, fehler, letzte_wiederholung)
  values
    (p_karte_id, v_user, p_neue_stufe, p_gelernt, p_faellig_am,
     case when p_gelernt then 1 else 0 end,
     case when p_gelernt then 0 else 1 end,
     now())
  on conflict (karte_id, user_id) do update
    set stufe               = excluded.stufe,
        gelernt             = excluded.gelernt,
        faellig_am          = excluded.faellig_am,
        letzte_wiederholung = now(),
        treffer             = public.karten_fortschritt.treffer
                               + case when excluded.gelernt then 1 else 0 end,
        fehler              = public.karten_fortschritt.fehler
                               + case when excluded.gelernt then 0 else 1 end;

  /*
   * XP des Tages. xp_events hat unique (user_id, datum), also pro Tag genau
   * eine Zeile.
   *
   * `on conflict do update` ist keine Optimierung, sondern zwingend: Ab der
   * zweiten Antwort am selben Tag waere es ohne das ein Fehler. Und dieser
   * Fehler waere ausgerechnet der am schwersten zu findenden, weil er erst
   * nach dem ersten richtigen Klick auftritt und die RLS betrifft – die
   * Funktion laeuft mit security invoker, das UPDATE braucht also eine
   * Policy. Siehe Abschnitt 5b.
   */
  insert into public.xp_events (user_id, set_id, datum, xp, ziel)
  values (v_user, p_set_id, current_date, greatest(p_xp, 0), 20)
  on conflict (user_id, datum) do update
    set xp    = public.xp_events.xp + greatest(p_xp, 0),
        -- set_id wird nachgezogen, wenn der Tag bisher ohne Set verlief.
        set_id = coalesce(public.xp_events.set_id, excluded.set_id);

  select coalesce(sum(xp), 0) into v_ganz
  from public.xp_events
  where user_id = v_user;

  return jsonb_build_object(
    'xp',        p_xp,
    'neueStufe', p_neue_stufe,
    'xpGesamt',  v_ganz::int
  );
end;
$$;

-- Die Funktion laeuft mit den Rechten der aufrufenden Rolle, nicht mit
-- eigenen. Ein security definer wuerde hier jede RLS-Pruefung aufheben – die
-- Funktion waere dann ein Loch, durch das jeder die Fortschrittszeilen aller
-- schreiben koennte.
revoke execute on function public.antwort_verbuchen(uuid, uuid, text, integer, boolean, date, integer) from public;
grant execute on function public.antwort_verbuchen(uuid, uuid, text, integer, boolean, date, integer) to authenticated;


-- -----------------------------------------------------------------------------
-- Fertig. Danach noch 003b ausfuehren, wenn die Demokarten einen
-- Fortschritt zeigen sollen.
-- =============================================================================
