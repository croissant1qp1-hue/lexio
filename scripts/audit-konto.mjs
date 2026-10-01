/**
 * Legt ein Wegwerf-Konto an und gibt Cookie + UUID zurück.
 *
 * Aufruf: node scripts/audit-konto.mjs
 *        node scripts/audit-konto.mjs --loeschen <uuid>
 * Läuft nur für Phase 5 (Responsive-Audit). Das Konto wird nach dem
 * Audit wieder gelöscht (--loeschen <uuid>).
 *
 * Warum ein eigenes Konto und nicht das echte: der Audit soll die Seiten
 * so sehen, wie sie nach dem Anmelden aussehen, aber ohne dass echte
 * Lerndaten angefasst werden. Ein Konto aus dem Test sieht dieselben
 * Demokarten wie ein echtes, hat aber keine Historie.
 *
 * Muster aus Phase 3.10: der Service-Role-Key in .env ist nur ein
 * Platzhalter, deshalb über den anon-Client mit mailer_autoconfirm. Und
 * die Session geht als Cookie rein, nicht als Bearer – der Server-Client
 * liest Cookies.
 */
import { createClient } from "@supabase/supabase-js";

const praefix = "kiro.audit.";
const email = `${praefix}${Date.now()}@lexio.test`;
const passwort = `Audit-${Math.random().toString(36).slice(2)}-9`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/*
 * Löschen zuerst prüfen.
 *
 * Der Anon-Client kann kein Konto entfernen – dazu braucht es die
 * Management-API mit dem Access Token. Der Aufruf unten nutzt deshalb
 * bewusst nicht den Supabase-Client, sondern POST /database/query auf
 * auth.users. `delete from auth.users` nimmt die Zeile und per ON DELETE
 * CASCADE auch alles, was an ihr hängt (karten_fortschritt, Sets des
 * Nutzers). Deshalb ist das Löschen vollständig und nicht halb.
 *
 * Der Token kommt aus .env (SUPABASE_ACCESS_TOKEN) und wird nur für diesen
 * einen Aufruf gelesen, nicht gespeichert und nicht ausgegeben.
 */
const loeschen = process.argv[2];
if (loeschen === "--loeschen") {
  const uuid = process.argv[3];
  if (!uuid) {
    console.error("Aufruf: node scripts/audit-konto.mjs --loeschen <uuid>");
    process.exit(1);
  }
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN fehlt. .env laden.");
    process.exit(1);
  }
  // Nur eine UUID als SQL-Literal zulassen. Der Wert kommt aus der
  // Kommandozeile, und das hier ist der einzige Weg, ein Löschkommando
  // zusammenzubauen – deshalb die Prüfung, statt String-Interpolation
  // ohne Kontrolle.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    console.error(`Keine gültige UUID: ${uuid}`);
    process.exit(1);
  }
  const projekt = process.env.SUPABASE_PROJECT_REF ?? "vvdouxtdvnhrptkptohp";
  const antwort = await fetch(
    `https://api.supabase.com/v1/projects/${projekt}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `delete from auth.users where id = '${uuid}' returning id`,
      }),
    },
  );
  const ergebnis = await antwort.json();
  if (!antwort.ok) {
    console.error("Löschen fehlgeschlagen:", JSON.stringify(ergebnis));
    process.exit(1);
  }
  const geloescht = Array.isArray(ergebnis) ? ergebnis.length : 0;
  if (geloescht === 0) {
    console.log(`Konto ${uuid} war schon weg (oder existierte nie).`);
  } else {
    console.log(`Konto ${uuid} gelöscht (${geloescht} Zeile).`);
  }
  process.exit(0);
}

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY fehlen. .env laden.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.signUp({
  email,
  password: passwort,
  options: { emailRedirectTo: undefined },
});

// mailer_autoconfirm ist in Supabase per Dashboard einstellbar. Ist es
// nicht gesetzt, gibt es hier keine Session – dann muss der Audit über
// eine andere Anmeldung laufen.
if (error) {
  console.error("Konto anlegen fehlgeschlagen:", error.message);
  process.exit(1);
}
if (!data.session) {
  console.error(
    "Keine Session nach signUp. Vermutlich ist mailer_autoconfirm nicht " +
      "aktiv (Supabase → Authentication → Providers → E-Mail).",
  );
  process.exit(2);
}

const cookieName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const cookieValue = encodeURIComponent(JSON.stringify({
  access_token: data.session.access_token,
  refresh_token: data.session.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + data.session.expires_in,
  token_type: data.session.token_type,
  user: data.user,
}));

console.log(JSON.stringify({
  email,
  passwort,
  userId: data.user.id,
  cookieName,
  cookieValue,
}, null, 2));