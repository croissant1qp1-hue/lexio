import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

function fehlermeldung(error: { message: string }): string {
  if (/invalid login credentials/i.test(error.message)) {
    return "E-Mail oder Passwort stimmt nicht.";
  }
  return error.message;
}

export default function Anmelden() {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, []);

  async function anmelden() {
    if (!email.trim() || !passwort) {
      setFehler("E-Mail und Passwort eintragen.");
      return;
    }
    setBusy(true);
    setFehler(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: passwort,
    });
    setBusy(false);
    if (error) {
      setFehler(fehlermeldung(error));
      return;
    }
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.schirm} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.formular}>
          <Text style={styles.titel}>Lexio</Text>
          <Text style={styles.untertitel}>Anmelden – derselbe Lernstand wie im Web.</Text>

          <TextInput
            style={styles.eingabe}
            placeholder="E-Mail"
            placeholderTextColor="#9A8C74"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.eingabe}
            placeholder="Passwort"
            placeholderTextColor="#9A8C74"
            secureTextEntry
            value={passwort}
            onChangeText={setPasswort}
            onSubmitEditing={() => anmelden()}
          />

          {fehler && <Text style={styles.fehler}>{fehler}</Text>}

          <Pressable
            style={({ pressed }) => [styles.knopf, pressed && styles.knopfGedrueckt]}
            onPress={() => anmelden()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#F7F2E9" />
            ) : (
              <Text style={styles.knopfText}>Anmelden</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  schirm: {
    flex: 1,
    backgroundColor: "#F7F2E9",
  },
  wrapper: {
    flex: 1,
    justifyContent: "center",
  },
  formular: {
    padding: 24,
    gap: 12,
  },
  titel: {
    fontSize: 34,
    fontWeight: "700",
    color: "#332B1E",
  },
  untertitel: {
    fontSize: 16,
    color: "#6B5F4B",
    marginBottom: 8,
  },
  eingabe: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8CFBB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#332B1E",
  },
  fehler: {
    color: "#A03B2B",
    fontSize: 14,
  },
  knopf: {
    backgroundColor: "#332B1E",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  knopfGedrueckt: {
    opacity: 0.85,
  },
  knopfText: {
    color: "#F7F2E9",
    fontSize: 16,
    fontWeight: "600",
  },
});