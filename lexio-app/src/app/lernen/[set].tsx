import { BEWERTUNGEN } from "@lexio/lernlogik";
import { schwerChance } from "@lexio/reihenfolge";
import { xpFormatieren } from "@lexio/profil";
import type { LernAntwort, LernKarte } from "@lexio/types";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiFehler, holeJson, sendeJson } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { spreche, stoppe } from "@/lib/vorlesen";

type Bewertung = (typeof BEWERTUNGEN)[number]["id"];

/** Würfel in der Modul-Ebene, damit kein Zufall im Render-Kontext fällt. */
function entscheideSchwer(chance: number): boolean {
  return Math.random() < chance;
}

export default function Lernen() {
  const { set, modus, runde } = useLocalSearchParams<{
    set: string;
    modus?: string;
    runde?: string;
  }>();

  const slug = typeof set === "string" ? set : "";
  const istUeben = modus === "ueben";
  const istLeech = modus === "leech";
  const naechsteRunde = (parseInt(String(runde ?? "1"), 10) || 1) + 1;

  const [antwort, setAntwort] = useState<LernAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const [neustart, setNeustart] = useState(0);
  const [schwerZaehler, setSchwerZaehler] = useState<Record<string, number>>({});

  const [stapel, setStapel] = useState<LernKarte[]>([]);
  const [index, setIndex] = useState(0);
  const [fertig, setFertig] = useState(false);
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [bewertend, setBewertend] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);
  const [letzteAntwort, setLetzteAntwort] = useState<{
    kartenId: string;
    xp: number;
  } | null>(null);

  const urlRunde = useCallback(() => {
    const pruef = [encodeURIComponent(slug)];
    if (modus === "ueben" || modus === "leech") pruef.push(`modus=${encodeURIComponent(modus)}`);
    if (modus === "ueben" && runde) pruef.push(`runde=${encodeURIComponent(String(runde))}`);
    return `/api/lernen?set=${pruef.join("&")}`;
  }, [slug, modus, runde]);

  /*
   * Eine Runde laden. `neustart` ist das Signal fuer Neuladen (Erneut
   * versuchen, Ruecknahme): ein Inkrement laesst den Effect hierunter noch
   * einmal laufen. TS React-State setzt der Effect nur im dann/catch der
   * Abfrage – synchron setzen darf nur ein Ereignis-Handler.
   */
  useEffect(() => {
    let gestoppt = false;
    supabase.auth.getSession().then(({ data }) => {
      if (gestoppt) return;
      if (!data.session) {
        router.replace("/anmelden");
        return;
      }
      holeJson<LernAntwort>(urlRunde())
        .then((daten) => {
          if (gestoppt) return;
          setAntwort(daten);
          setStapel(daten.karten);
          setFertig(false);
          setAufgedeckt(false);
          setIndex(0);
          setSchwerZaehler({});
          setFehler(null);
          setMeldung(null);
          setLaden(false);
        })
        .catch((grund: unknown) => {
          if (gestoppt) return;
          setFehler(grund instanceof ApiFehler ? grund.message : "Unerwarteter Fehler.");
          setLaden(false);
        });
    });
    return () => {
      gestoppt = true;
    };
  }, [urlRunde, neustart]);

  useEffect(() => () => stoppe(), []);

  const karte = stapel[index];

  const neuladen = () => {
    setLaden(true);
    setNeustart((n) => n + 1);
  };

  const bewerten = async (karteId: string, bewertung: Bewertung) => {
    if (!karte || bewertend) return;
    setBewertend(true);
    setMeldung(null);
    try {
      const ergebnis = await sendeJson<{ xp?: number; streak?: number | null }>(
        "/api/lernen/antwort",
        { kartenId: karteId, bewertung },
      );
      const xpErhalten = ergebnis.xp ?? 0;
      setXp((vorher) => vorher + xpErhalten);
      if (ergebnis.streak !== undefined && ergebnis.streak !== null) {
        setStreak(ergebnis.streak);
      }
      setLetzteAntwort({ kartenId: karteId, xp: xpErhalten });

      /*
       * "nochmal" (und "schwer" je nach Würfel) legt die Karte ans Ende der
       * Runde. Wird eine Karte endgültig entnommen, rutscht die nächste in
       * dieselbe Position – der Index wandert beim Entnehmen also nicht mit,
       * sonst würde eine Karte übersprungen. Die Runde ist zu Ende, sobald
       * der Index hinter der (geschrumpften) Länge liegt: alles entnommen,
       * nichts neu nachgelegt. Würfel fallen hier im Client, damit die Runde
       * widerspruchsfrei bleibt – dieselbe Regie wie im Web (schwerChance).
       */
      const bleibtInRunde =
        bewertung === "nochmal" ||
        (bewertung === "schwer" &&
          entscheideSchwer(schwerChance(karte.schwierigkeit, schwerZaehler[karteId] ?? 0)));
      if (bewertung === "schwer") {
        setSchwerZaehler((zaehler) => ({
          ...zaehler,
          [karteId]: (zaehler[karteId] ?? 0) + 1,
        }));
      }

      if (bleibtInRunde) {
        setStapel((s) => [...s.filter((k) => k.id !== karteId), karte]);
      } else {
        setStapel((s) => s.filter((k) => k.id !== karteId));
        if (index >= stapel.length - 1) {
          setFertig(true);
        }
      }

      setAufgedeckt(false);
      stoppe();
    } catch (grund) {
      setMeldung(grund instanceof ApiFehler ? grund.message : "Unerwarteter Fehler.");
    }
    setBewertend(false);
  };

  const rueckgaengig = async () => {
    if (!letzteAntwort) return;
    setBewertend(true);
    setMeldung(null);
    try {
      const ergebnis = await sendeJson<{ streak?: number | null }>(
        "/api/lernen/antwort/rueckgaengig",
        { kartenId: letzteAntwort.kartenId },
      );
      setXp((vorher) => Math.max(0, vorher - letzteAntwort.xp));
      if (ergebnis.streak !== undefined && ergebnis.streak !== null) {
        setStreak(ergebnis.streak);
      }
      setLetzteAntwort(null);
      neuladen();
    } catch (grund) {
      setMeldung(grund instanceof ApiFehler ? grund.message : "Unerwarteter Fehler.");
    }
    setBewertend(false);
  };

  if (laden && !fehler) {
    return (
      <SafeAreaView style={styles.schirm}>
        <View style={styles.mitte}>
          <ActivityIndicator color="#332B1E" />
        </View>
      </SafeAreaView>
    );
  }

  if (fehler) {
    return (
      <SafeAreaView style={styles.schirm}>
        <View style={styles.mitte}>
          <Text style={styles.fehlerText}>{fehler}</Text>
          <Pressable style={styles.breiterKnopf} onPress={neuladen}>
            <Text style={styles.breiterKnopfText}>Erneut versuchen</Text>
          </Pressable>
          <Pressable style={styles.breiterKnopfW} onPress={() => router.replace("/")}>
            <Text style={styles.breiterKnopfWText}>Zur Übersicht</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (fertig && !karte) {
    return (
      <Endschirm
        antwort={antwort}
        xp={xp}
        streak={streak}
        istUeben={istUeben}
        istLeech={istLeech}
        aufNeueRunde={() => {
          if (istUeben) {
            router.replace(`/lernen/${encodeURIComponent(slug)}?modus=ueben&runde=${naechsteRunde}`);
          } else {
            router.replace(`/lernen/${encodeURIComponent(slug)}?modus=ueben`);
          }
        }}
        aufZurueck={() => router.replace("/")}
        aufZuruecknehmen={rueckgaengig}
        kannRueckgaengig={letzteAntwort !== null}
      />
    );
  }

  if (!karte) {
    const leer0 = antwort?.kartenGesamt === 0;
    return (
      <SafeAreaView style={styles.schirm}>
        <View style={styles.mitte}>
          <Text style={styles.ankuendigung}>
            {leer0 ? "Noch keine Vokabeln in diesem Set." : `Nichts fällig in „${antwort?.set.name ?? ""}“.`}
          </Text>
          {!leer0 && (
            <Pressable style={styles.breiterKnopf} onPress={() => router.replace(`/lernen/${encodeURIComponent(slug)}?modus=ueben`)}>
              <Text style={styles.breiterKnopfText}>Nochmal lernen</Text>
            </Pressable>
          )}
          <Pressable style={styles.breiterKnopfW} onPress={() => router.replace("/")}>
            <Text style={styles.breiterKnopfWText}>Zur Übersicht</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.schirm} edges={["top", "bottom"]}>
      <View style={styles.kopf}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.zurueck}>Zurück</Text>
        </Pressable>
        <Text style={styles.titel} numberOfLines={1}>
          {antwort?.set.name ?? ""}
        </Text>
        <Text style={styles.xp}>{xpFormatieren(xp)}</Text>
      </View>

      <Text style={styles.fortschritt}>
        {Math.min(index, stapel.length)} / {stapel.length}
        {streak !== null ? ` · ${streak} Tage Serie` : ""}
      </Text>

      <View style={styles.kartenfach}>
        <Pressable
          style={[styles.karte, aufgedeckt && { borderColor: antwort?.set.sprache.akzent }]}
          onPress={() => {
            if (aufgedeckt) return;
            setAufgedeckt(true);
            spreche([karte.antwort, karte.beispielsatz], antwort?.set.sprache.code ?? null);
          }}
        >
          {!aufgedeckt ? (
            <>
              <Text style={styles.vorderseiteHint}>Frage</Text>
              <Text style={styles.vorderseite}>{karte.frage}</Text>
              <Text style={styles.umdrehenHint}>Tippen zum Umdrehen</Text>
            </>
          ) : (
            <>
              <Text style={styles.rueckseite}>{karte.antwort}</Text>
              {karte.beispielsatz ? (
                <View style={styles.beispielBox}>
                  <Text style={[styles.beispielText, { color: antwort?.set.sprache.akzent }]}>
                    {karte.beispielsatz}
                  </Text>
                  {karte.beispielUebersetzung ? (
                    <Text style={styles.beispielUebersetzung}>{karte.beispielUebersetzung}</Text>
                  ) : null}
                </View>
              ) : null}
              {karte.leech ? <Text style={styles.leechTag}>Problemskarte</Text> : null}
              <Pressable
                style={styles.lesenKnopf}
                onPress={() => spreche([karte.antwort, karte.beispielsatz], antwort?.set.sprache.code ?? null)}
                hitSlop={8}
              >
                <Text style={styles.lesenText}>Vorlesen</Text>
              </Pressable>
            </>
          )}
        </Pressable>
        {aufgedeckt && (
          <Text style={styles.modeHinweis}>
            {istUeben
              ? "Übungsrunde"
              : istLeech
                ? "Reparaturrunde · nur Problemskarten"
                : karte.leech
                  ? "Karte meldet ihre Fehler nicht mehr in der normalen Runde."
                  : `Noch ${antwort?.faelligGesamt ?? stapel.length - 1} ${(antwort?.faelligGesamt ?? 2) === 1 ? "Karte" : "Karten"} fällig`}
          </Text>
        )}
      </View>

      {meldung ? <Text style={styles.meldung}>{meldung}</Text> : null}

      <View style={styles.fuss}>
        {letzteAntwort && (
          <Pressable style={styles.rueckgaengig} onPress={rueckgaengig} disabled={bewertend}>
            <Text style={styles.rueckgaengigText}>Letzte Antwort zurücknehmen</Text>
          </Pressable>
        )}
        <View style={styles.bewertungsZeile}>
          {BEWERTUNGEN.map((bewertung) => {
            const aktiv = aufgedeckt && !bewertend;
            return (
              <Pressable
                key={bewertung.id}
                style={[styles.bewertungsKnopf, bewertung.id === "nochmal" && styles.bewertungsKnopfNochmal]}
                disabled={!aktiv}
                onPress={() => bewerten(karte.id, bewertung.id)}
              >
                <Text style={[styles.bewertungsLabel, bewertung.id === "nochmal" && styles.bewertungsLabelNochmal]}>
                  {bewertung.label}
                </Text>
                <Text style={[styles.bewertungsXp, bewertung.id === "nochmal" && styles.bewertungsXpNochmal]}>
                  +{bewertung.xp} XP
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Endschirm({
  antwort,
  xp,
  streak,
  istUeben,
  istLeech,
  aufNeueRunde,
  aufZurueck,
  aufZuruecknehmen,
  kannRueckgaengig,
}: {
  antwort: LernAntwort | null;
  xp: number;
  streak: number | null;
  istUeben: boolean;
  istLeech: boolean;
  aufNeueRunde: () => void;
  aufZurueck: () => void;
  aufZuruecknehmen: () => void;
  kannRueckgaengig: boolean;
}) {
  const gesamt = antwort?.faelligGesamt ?? 0;
  const zusatz = antwort?.setZuGross
    ? `Teile dieses Set lieber auf – es hat mehr als 1001 Karten.`
    : "";
  return (
    <SafeAreaView style={styles.schirm}>
      <ScrollView contentContainerStyle={styles.endschirm}>
        <Text style={styles.endTitel}>
          {istLeech ? "Reparaturrunde geschafft" : istUeben ? "Übungsrunde geschafft" : "Runde geschafft"}
        </Text>
        <Text style={styles.endAktion}>
          „{antwort?.set.name ?? ""}“ · {gesamt} {gesamt === 1 ? "Karte" : "Karten"} · {xpFormatieren(xp)}
        </Text>
        {streak !== null ? <Text style={styles.endSerie}>{streak} Tage Serie</Text> : null}
        {zusatz ? <Text style={styles.endHinweis}>{zusatz}</Text> : null}

        <Pressable style={styles.breiterKnopf} onPress={aufNeueRunde}>
          <Text style={styles.breiterKnopfText}>
            {istUeben ? "Weitere Runde" : istLeech ? "Nochmal als Übung" : "Nochmal lernen"}
          </Text>
        </Pressable>
        {kannRueckgaengig && (
          <Pressable style={styles.breiterKnopfW} onPress={aufZuruecknehmen}>
            <Text style={styles.breiterKnopfWText}>Letzte Antwort zurücknehmen</Text>
          </Pressable>
        )}
        <Pressable style={styles.breiterKnopfW} onPress={aufZurueck}>
          <Text style={styles.breiterKnopfWText}>Zur Übersicht</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  schirm: {
    flex: 1,
    backgroundColor: "#F7F2E9",
  },
  kopf: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  zurueck: {
    fontSize: 16,
    color: "#6B5F4B",
  },
  titel: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#332B1E",
    textAlign: "center",
  },
  xp: {
    fontSize: 15,
    color: "#332B1E",
    fontWeight: "500",
  },
  fortschritt: {
    textAlign: "center",
    fontSize: 13,
    color: "#92876F",
    paddingBottom: 8,
  },
  kartenfach: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  karte: {
    minHeight: 260,
    backgroundColor: "#FFFDF7",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5DCC8",
    padding: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  vorderseiteHint: {
    fontSize: 13,
    color: "#92876F",
    marginBottom: 10,
  },
  vorderseite: {
    fontSize: 26,
    fontWeight: "600",
    color: "#332B1E",
    textAlign: "center",
  },
  umdrehenHint: {
    marginTop: 14,
    fontSize: 13,
    color: "#B3A98F",
  },
  rueckseite: {
    fontSize: 24,
    fontWeight: "600",
    color: "#332B1E",
    textAlign: "center",
  },
  beispielBox: {
    marginTop: 14,
    alignItems: "center",
  },
  beispielText: {
    fontSize: 18,
    fontStyle: "italic",
    textAlign: "center",
  },
  beispielUebersetzung: {
    marginTop: 4,
    fontSize: 14,
    color: "#92876F",
    textAlign: "center",
  },
  leechTag: {
    marginTop: 12,
    fontSize: 12,
    color: "#A03B2B",
    borderWidth: 1,
    borderColor: "#A03B2B",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lesenKnopf: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#CBBFA0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  lesenText: {
    fontSize: 13,
    color: "#6B5F4B",
  },
  modeHinweis: {
    marginTop: 12,
    fontSize: 13,
    color: "#92876F",
    textAlign: "center",
  },
  meldung: {
    marginTop: 8,
    fontSize: 13,
    color: "#A03B2B",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  fuss: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  rueckgaengig: {
    alignItems: "center",
    paddingVertical: 4,
  },
  rueckgaengigText: {
    fontSize: 14,
    color: "#6B5F4B",
    textDecorationLine: "underline",
  },
  bewertungsZeile: {
    flexDirection: "row",
    gap: 8,
  },
  bewertungsKnopf: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#FFFDF7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5DCC8",
    paddingVertical: 10,
  },
  bewertungsKnopfNochmal: {
    backgroundColor: "#F1E7DB",
  },
  bewertungsLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#332B1E",
  },
  bewertungsLabelNochmal: {
    color: "#6B5F4B",
  },
  bewertungsXp: {
    marginTop: 2,
    fontSize: 12,
    color: "#92876F",
  },
  bewertungsXpNochmal: {
    color: "#B3A98F",
  },
  mitte: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  ankuendigung: {
    fontSize: 16,
    color: "#332B1E",
    textAlign: "center",
    marginBottom: 6,
  },
  fehlerText: {
    color: "#A03B2B",
    fontSize: 15,
    textAlign: "center",
  },
  breiterKnopf: {
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: "#332B1E",
    borderRadius: 12,
    paddingVertical: 13,
  },
  breiterKnopfText: {
    color: "#F7F2E9",
    fontSize: 15,
    fontWeight: "600",
  },
  breiterKnopfW: {
    alignSelf: "stretch",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBBFA0",
    borderRadius: 12,
    paddingVertical: 13,
  },
  breiterKnopfWText: {
    color: "#332B1E",
    fontSize: 15,
    fontWeight: "600",
  },
  endschirm: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  endTitel: {
    fontSize: 24,
    fontWeight: "700",
    color: "#332B1E",
    textAlign: "center",
  },
  endAktion: {
    fontSize: 15,
    color: "#6B5F4B",
    textAlign: "center",
  },
  endSerie: {
    fontSize: 15,
    color: "#6B5F4B",
    textAlign: "center",
  },
  endHinweis: {
    fontSize: 13,
    color: "#92876F",
    textAlign: "center",
  },
});