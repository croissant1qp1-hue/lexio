import type { SetUebersicht } from "@lexio/types";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiFehler, holeJson } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function Uebersicht() {
  const [sets, setSets] = useState<SetUebersicht[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let gestoppt = false;
    supabase.auth.getSession().then(({ data }) => {
      if (gestoppt) return;
      if (!data.session) {
        router.replace("/anmelden");
        return;
      }
      holeJson<SetUebersicht[]>("/api/karteikarten")
        .then((daten) => {
          if (gestoppt) return;
          setSets(daten);
          setFehler(null);
        })
        .catch((grund: unknown) => {
          if (gestoppt) return;
          setFehler(grund instanceof ApiFehler ? grund.message : "Unerwarteter Fehler.");
        });
    });
    return () => {
      gestoppt = true;
    };
  }, []);

  const abmelden = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace("/anmelden");
  }, []);

  return (
    <SafeAreaView style={styles.schirm} edges={["top", "bottom"]}>
      <View style={styles.kopf}>
        <Text style={styles.titel}>Lexio</Text>
        <Pressable onPress={() => abmelden()} hitSlop={8}>
          <Text style={styles.abmelden}>Abmelden</Text>
        </Pressable>
      </View>

      {sets === null && !fehler && (
        <View style={styles.mitte}>
          <ActivityIndicator color="#332B1E" />
        </View>
      )}

      {fehler && !sets && (
        <View style={styles.mitte}>
          <Text style={styles.fehlerText}>{fehler}</Text>
        </View>
      )}

      {sets && (
        <FlatList
          data={sets}
          keyExtractor={(set) => set.id}
          contentContainerStyle={styles.liste}
          ItemSeparatorComponent={() => <View style={styles.trenner} />}
          renderItem={({ item }) => <SetKachel set={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function SetKachel({ set }: { set: SetUebersicht }) {
  const antwort3 = `${Math.round(set.fortschrittProzent)} % gelernt`;
  return (
    <Pressable style={styles.kachel} onPress={() => router.push(`/lernen/${encodeURIComponent(set.id)}`)}>
      <View style={[styles.balkenMarker, { backgroundColor: set.sprache.flaeche }]} />
      <View style={styles.kachelInhalt}>
        <Text style={styles.setName}>{set.name}</Text>
        <Text style={styles.setMeta}>
          {set.sprache.name} · {set.anzahlKarten} Karten · {antwort3}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  schirm: {
    flex: 1,
    backgroundColor: "#F7F2E9",
  },
  kopf: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titel: {
    fontSize: 30,
    fontWeight: "700",
    color: "#332B1E",
  },
  abmelden: {
    fontSize: 15,
    color: "#6B5F4B",
  },
  mitte: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  fehlerText: {
    color: "#A03B2B",
    fontSize: 15,
    textAlign: "center",
  },
  liste: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  trenner: {
    height: 10,
  },
  kachel: {
    flexDirection: "row",
    backgroundColor: "#FFFDF7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5DCC8",
    overflow: "hidden",
  },
  balkenMarker: {
    width: 6,
  },
  kachelInhalt: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 3,
  },
  setName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#332B1E",
  },
  setMeta: {
    fontSize: 14,
    color: "#6B5F4B",
  },
});