import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";

/**
 * Push-Abonnement des angemeldeten Kontos verwalten.
 *
 * POST speichert ein Gerät-Abo (Web-Push), DELETE entfernt es. Beides nur
 * für das eigene Konto: die RLS-Policies der Tabelle push_abonnements
 * koppeln jede Zeile an user_id, und der Server reicht die Session aus dem
 * Cookie weiter. Ein Abo, das über dieses API angelegt wird, gehört also zur
 * Person, die das Cookie hat – nicht zu irgendwem.
 *
 * Wofür die Schlüssel da sind: der Browser bekommt vom Push-Dienst einen
 * endpoint plus zwei Schlüssel (p256dh für die Nachricht, auth für die
 * Berechtigung). Der Server speichert sie, und scripts/erinnerung-senden.mjs
 * liest sie beim täglichen Versand.
 */

export async function POST(request: Request) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (!user) return antwort ?? NextResponse.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const abo = (body ?? {}) as {
    endpoint?: unknown;
    keys?: unknown;
  };

  if (typeof abo.endpoint !== "string" || !abo.endpoint.startsWith("https://", 0)) {
    return NextResponse.json({ error: "endpoint fehlt oder ist keine URL" }, { status: 400 });
  }
  const schluessel = (abo.keys ?? {}) as { p256dh?: unknown; auth?: unknown };
  if (
    typeof schluessel.p256dh !== "string" ||
    schluessel.p256dh.length === 0 ||
    typeof schluessel.auth !== "string" ||
    schluessel.auth.length === 0
  ) {
    return NextResponse.json({ error: "Verschlüsselungsschlüssel fehlen" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("push_abonnements")
    .upsert(
      {
        user_id: user.id,
        endpoint: abo.endpoint,
        keys_p256dh: schluessel.p256dh,
        keys_auth: schluessel.auth,
        zeit_aktuallisiert: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 200 });
}

export async function DELETE(request: Request) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (!user) return antwort ?? NextResponse.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

  let body: { endpoint?: unknown } = {};
  try {
    const roh: unknown = await request.json();
    if (roh && typeof roh === "object") {
      body = roh as { endpoint?: unknown };
    }
  } catch {
    /* Default: ohne endpoint wird trotzdem gelöscht (alle eigenen Abos). */
  }

  let query = supabase.from("push_abonnements").delete().eq("user_id", user.id);
  if (typeof body.endpoint === "string" && body.endpoint.length > 0) {
    query = query.eq("endpoint", body.endpoint);
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}