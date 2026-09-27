-- =============================================================================
-- 005 – Sprachen und Beispielsätze
--
-- Erst NACH 004 ausführen. Setzt voraus, dass 003 (Besitzrechte,
-- karten_fortschritt) und 004 (Indizes) gelaufen sind.
--
-- Worum es hier geht
-- -----------------
-- Zwei Dinge, die Phase 1 braucht, aber noch nicht haben kann.
--
-- 1. BEISPIELSATZ
--    Eine Karte hat heute genau zwei Felder: frage und antwort. "hallo / hallo"
--    ist eine denkbare, aber schlechte Lernkarte. Erst mit einem Beispielsatz
--    sieht man das Wort im Satz und nicht nur in der Wortliste. Die beiden
--    Spalten hier sind additiv und damit gefahrlos: bestehende Karten haben
--    danach NULL, und NULL heisst "noch keiner" – nicht "leer".
--
-- 2. SPRACHE ALS CODE STATT FREITEXT
--    karteikarten_sets.sprache ist ein text-Feld. Das ist die Wurzel von
--    zwei Instabilitaeten, die beide in lib/sprachen-farbe.ts und
--    app/(app)/karteikarten/karteikarten-seite.tsx standen: "welche Farbe hat
--    dieser Satz?" wurde beantwortet, indem man das ERSTE WORT nahm und
--    kleinschrieb. "Chinesisch (Mandarin)" kollidiert mit "Chinesisch", und
--    ein Tippfehler im Freitext ergab stillschweigend weisse Flaechen.
--
--    Diese Migration fuehrt die Sprachliste als Tabelle ein und haengt die
--    Sets ueber eine Fremdschluesselung daran. Die alte Spalte sprache bleibt
--    vorerst stehen. Sie wird hier bewusst NICHT geloescht – siehe unten.
--
-- Warum additiv und nicht auf einmal
-- ---------------------------------
-- Die alte Spalte sprache und die neue Spalte sprache_code leben nebeneinander,
-- bis der Anwendungscode auf sprache_code umgestellt ist. Ein ALTER TABLE ...
-- DROP COLUMN an dieser Stelle wuerde die Sets zwischen Migration und Deploy
-- kurzzeitig ohne Sprache dastehen lassen, und jede Ansicht, die auf sprache
-- zeigt, faellt dann auf undefined. Der Drop gehoert nach Phase 4, wenn der
-- Code lange genug umgestellt ist.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Die Sprachliste
-- -----------------------------------------------------------------------------

create table if not exists public.sprachen (
  -- code ist der Wert, den der Code und speechSynthesis benutzen. "en", nicht
  -- "Englisch" – Browserstimmen werden nach BCP-47 aufgeloest, und dort
  -- funktioniert nur der Code.
  code       text primary key,

  -- name ist, was der Nutzer sieht.
  name       text not null unique,

  -- key ist die normalisierte Form von name: klein, ohne Umlaute, ohne
  -- Sonderzeichen. Nur dazu da, um den alten Freitext beim Zurueckschreiben
  -- einmalig zuzuordnen. Die Anwendung selbst braucht key nicht – sie hat
  -- danach den code. key wird deshalb bewusst nicht angezeigt.
  key        text not null unique,

  -- flaeche ist die Grundfarbe der Kachel, akzent der hellere Ton fuer Text
  -- und Fortschrittsbalken darauf. Zwei Werte, weil ein dunkler Akzent auf der
  -- hellen Flaeche nicht mehr zu lesen waere.
  flaeche    text not null,
  akzent     text not null,

  -- sortierung legt die Reihenfolge im Auswahlfeld fest, statt sie vom
  -- Alphabet abhaengig zu machen.
  sortierung integer not null
);

comment on table public.sprachen is
  'Feste Sprachliste. karteikarten_sets.sprache_code verweist hierauf. '
  'Die Freitextspalte karteikarten_sets.sprache ist Altlast und wird in Phase 4 entfernt.';

-- Die zwölf Sprachen. Namen so, wie sie im Deutschen ueblich geschrieben
-- werden; key so, wie sie im Code und in der URL stehen.
insert into public.sprachen (code, name, key, flaeche, akzent, sortierung) values
  ('en', 'Englisch',        'englisch',        '#FFC857', '#FFCE73', 10),
  ('es', 'Spanisch',        'spanisch',        '#FF6B5B', '#FF9E8F', 20),
  ('fr', 'Französisch',     'franzosisch',     '#FF3D67', '#FF8FA3', 30),
  ('it', 'Italienisch',     'italienisch',     '#42D6A4', '#6FE0BA', 40),
  ('pt', 'Portugiesisch',   'portugiesisch',   '#C86BE8', '#E0A6F0', 50),
  ('nl', 'Niederländisch',  'niederlandisch',  '#FF9F45', '#FFC287', 60),
  ('pl', 'Polnisch',        'polnisch',        '#F06292', '#F79BBB', 70),
  ('ru', 'Russisch',        'russisch',        '#5B8DEF', '#93B4F5', 80),
  ('tr', 'Türkisch',        'turkisch',        '#E85D9E', '#F293C0', 90),
  ('ar', 'Arabisch',        'arabisch',        '#14B8A6', '#5FD9CB', 100),
  ('ja', 'Japanisch',       'japanisch',       '#FF7A85', '#FFADB4', 110),
  ('zh', 'Chinesisch',      'chinesisch',      '#D9B44A', '#EBD089', 120)
on conflict (code) do update
  set name       = excluded.name,
      key        = excluded.key,
      flaeche    = excluded.flaeche,
      akzent     = excluded.akzent,
      sortierung = excluded.sortierung;

-- -----------------------------------------------------------------------------
-- 2. Beispielsatz an der Karte
-- -----------------------------------------------------------------------------
-- add column if not exists heisst: diese Datei kann mehrfach laufen. Genau
-- wie 003 es mit den Lernstandsspalten macht.

alter table public.karten        add column if not exists beispielsatz          text;
alter table public.karten        add column if not exists beispiel_uebersetzung text;

comment on column public.karten.beispielsatz is
  'Beispielsatz in der Zielsprache. NULL = noch keiner vorhanden.';
comment on column public.karten.beispiel_uebersetzung is
  'Deutsche Uebersetzung des Beispielsatzes. NULL = noch keiner vorhanden.';

-- -----------------------------------------------------------------------------
-- 3. Sprachcode am Set
-- -----------------------------------------------------------------------------

alter table public.karteikarten_sets
  add column if not exists sprache_code text
    references public.sprachen (code) on update cascade on delete restrict;

create index if not exists karteikarten_sets_sprache_code_idx
  on public.karteikarten_sets (sprache_code);

comment on column public.karteikarten_sets.sprache_code is
  'Sprache als Code, z. B. "en". Fuehlt den Freitext in sprache ab. '
  'Erst in Phase 4 wird sprache entfernt.';

-- -----------------------------------------------------------------------------
-- 4. Bestehende Sets zuordnen
-- -----------------------------------------------------------------------------
-- Das ist der einmalige Schritt, der den Freitext in einen Code ueberfuehrt.
--
-- Die Zuordnung laeuft in zwei Stufen:
--
--   a) Der gesamte normalisierte Text trifft einen key. Das ist der Fall, den
--      es live gibt: "Englisch", "Italienisch", "Spanisch" – je ein Wort.
--
--   b) Trifft der ganze Text nichts, wird das erste Wort genommen. Das ist der
--      alte schluessel()-Hinweis aus lib/sprachen-farbe.ts, und genau der soll
--      hier verschwinden. Fuer die Migration ist er aber noetig, weil ein Set
--      wie "Chinesisch (Mandarin)" unterwegs noch entstehen koennte – ohne
--      diesen Schritt bekaeme es sprache_code = NULL und die Oberflaeche
--      zeigte fuer eine bestehende Sprache nichts an.
--
-- Was danach NULL bleibt, ist kein Fehler, sondern eine Meldung: die Liste in
-- public.sprachen kennt die Sprache nicht. Dann ist es eine Entscheidung fuer
-- Menschen, nicht fuer diese Datei.
--
-- translate() bildet die Umlaute und die haeufigen Akzente auf ihre
-- Grundbuchstaben ab. Die Uebersetzungsliste hat exakt so viele Zeichen wie
-- die Quellliste, sonst verschiebt sich die Zuordnung still.

update public.karteikarten_sets s
set sprache_code = ziel.code
from (
  with normalisiert as (
    select
      s2.id,
      s2.sprache,
      translate(
        lower(btrim(s2.sprache)),
        'äöüßáàâãéèêëíìîïóòôõúùûñç',
        'aoousaaaaeeeeiiiioooouuuunc'
      ) as k
    from public.karteikarten_sets s2
    where s2.sprache_code is null
  ),
  ganzer_treffer as (
    select n.id, sp.code
    from normalisiert n
    join public.sprachen sp on sp.key = n.k
  ),
  erstes_wort as (
    select n.id, sp.code
    from normalisiert n
    join public.sprachen sp
      on sp.key = (split_part(regexp_replace(n.k, '[^a-z0-9]+', ' ', 'g'), ' ', 1))
    where n.id not in (select id from ganzer_treffer)
  )
  select id, code from ganzer_treffer
  union all
  select id, code from erstes_wort
) ziel
where s.id = ziel.id
  and s.sprache_code is null;

-- Was hat die Liste nicht erkannt? Das will man wissen, bevor die Oberflaeche
-- an einer Stelle "Englisch" und an anderer "englisch" anzeigt.
do $$
declare
  v_zeilen record;
begin
  for v_zeilen in
    select s.slug, s.sprache
    from public.karteikarten_sets s
    where s.sprache_code is null
    order by s.slug
  loop
    raise notice 'Set "%" hat die Sprache "%" – nicht in public.sprachen. '
                 'sprache_code bleibt leer, bitte von Hand zuordnen.',
                 v_zeilen.slug, v_zeilen.sprache;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Sichtbarkeit
-- -----------------------------------------------------------------------------
-- Die Sprachliste ist kein Nutzerbezug. Wie die Karten und die globalen Sets
-- frei lesbar, mit einer Policy und den Grants fuer beide Rollen – sonst
-- funktioniert die Abfrage nur fuer angemeldete Nutzer, und das Auswahlfeld
-- beim Import waere fuer alle anderen leer.

alter table public.sprachen enable row level security;

drop policy if exists "sprachen sind oeffentlich lesbar" on public.sprachen;
create policy "sprachen sind oeffentlich lesbar"
  on public.sprachen for select
  using (true);

grant select on public.sprachen to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Was hier bewusst NICHT passiert
-- -----------------------------------------------------------------------------
--   - karteikarten_sets.sprache wird nicht geloescht. Siehe Kopf.
--   - Die Views werden nicht umgestellt. karteikarten_sets_uebersicht zeigt
--     weiterhin s.sprache. Das Umstellen gehoert in die Code-Phase von 0.1,
--     und create or replace view kann die Spaltenreihenfolge einer bestehenden
--     View nicht aendern – die Views muessen also vorher verworfen werden,
--     genau wie es 003:357-360 macht.
--   - Die 5 Testkarten (__conntest__, probe-a, probe-b, ciao, bella) werden
--     nicht angefasst. Die gehoeren in Phase 2, zusammen mit dem Rest der
--     Platzhalter.
--   - anzahl_karten wird nicht repariert. Die Spalte zaehlt nicht, sie
--     behauptet nur etwas. Live sagt sie 120/80/95, count(k.id) sagt
--     122/82/96. statistik_pro_sprache rechnet inzwischen ueber karten_gesamt
--     (003:404), die Statistik stimmt also – die Spalte wird nur weiter
--     mitgeliefert. Gehoert als Aufraeumpunkt in Phase 4.
-- =============================================================================

-- =============================================================================
-- Fertig. Diese Datei kann jederzeit erneut laufen.
-- =============================================================================
