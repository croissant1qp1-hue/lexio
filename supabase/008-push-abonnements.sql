-- =============================================================================
-- 008 – Push-Abonnements für die tägliche Erinnerung
--
-- Erst NACH 007 ausführen.
--
-- Worum es hier geht
-- ------------------
-- Plan 3.1 macht den toten Regler "Tägliche Erinnerung" zum echten Schalter.
-- Damit eine Erinnerung ankommt, braucht es ein Web-Push-Abonnement pro
-- Gerät: der Browser meldet dem Server einen Endpoint (Push-Dienst des
-- Browsers) plus zwei Schlüssel, mit denen Nachrichten verschlüsselt werden.
--
-- Wie das hier zusammenpasst
-- ---------------------------
--   1. Diese Tabelle speichert die Abonnements. Ein Abo gehört zu genau
--      einem Konto (user_id) und einem Gerät (endpoint eindeutig je Konto).
--   2. Die App-Route app/api/push/abonnement/route.ts legt Abos an und
--      entfernt sie – jeweils mit RLS, also nur für das eigene Konto.
--   3. scripts/erinnerung-senden.mjs liest die Abos (über die
--      Management-API, wie db-migrieren.mjs) und schickt die tägliche
--      Erinnerung an alle, die eingeschaltet haben. Ein lokaler Cron
--      (crontab) ruft das Skript einmal am Tag auf.
--   4. Abgelaufene Abos (Push-Dienst kennt den Endpoint nicht mehr) werden
--      beim Senden entfernt und tauchen nie wieder auf.
--
-- Was hier bewusst NICHT passiert
-- -------------------------------
--   - Kein Zeitplan in der Datenbank: "wann am Tag" entscheidet die
--     crontab-Zeile, nicht diese Tabelle.
--   - Kein "welche Sprache": die Meldung ist deutsch, Lexio ist eine
--     deutsche App (Übersetzung liegt im Einstellungen-Punkt "Sprache",
--     der bewusst Attrappe bleibt).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabelle: ein Abo pro Zeile, pro Konto und Gerät eindeutig
-- -----------------------------------------------------------------------------
create table if not exists public.push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Endpoint der Push-Dienste. Lang, aber je Gerät fest.
  endpoint text not null,
  -- Für die Verschlüsselung der Nachricht (VAPID, RFC 8291).
  keys_p256dh text not null,
  keys_auth text not null,
  erstellt_am timestamptz not null default now(),
  zeit_aktuallisiert timestamptz not null default now(),
  -- Wer dasselbe Abo mehrmals schickt (Browser start neu), soll nicht
  -- zwei Zeilen bekommen, sondern dieselbe aktualisieren.
  unique (user_id, endpoint)
);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security: nur das eigene Konto darf seine Abos sehen und ändern
-- -----------------------------------------------------------------------------
alter table public.push_abonnements enable row level security;

drop policy if exists "eigene abos lesen" on public.push_abonnements;
create policy "eigene abos lesen"
  on public.push_abonnements
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "eigene abos anlegen" on public.push_abonnements;
create policy "eigene abos anlegen"
  on public.push_abonnements
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "eigene abos aktualisieren" on public.push_abonnements;
create policy "eigene abos aktualisieren"
  on public.push_abonnements
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "eigene abos entfernen" on public.push_abonnements;
create policy "eigene abos entfernen"
  on public.push_abonnements
  for delete
  to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. Rechte: anonym nichts, angemeldete alles über die Policies
-- -----------------------------------------------------------------------------
revoke all on public.push_abonnements from anon;
revoke all on public.push_abonnements from authenticated;
grant select, insert, update, delete on public.push_abonnements to authenticated;