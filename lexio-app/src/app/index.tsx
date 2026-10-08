import { BEWERTUNGEN, INTERVALLE } from '@lexio/lernlogik';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/*
 * Phase-7-Geruest. Diese eine Seite beweist den Kern des Umbaus: Der Client
 * importiert lib/lernlogik.ts aus der Web-App direkt (@lexio/*), statt die
 * Bewertungs- und Intervallwerte zu kopieren. Die echte Uebersicht folgt.
 */
export default function Uebersicht() {
  return (
    <SafeAreaView style={styles.schirm} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.inhalt}>
        <Text style={styles.titel}>Lexio</Text>
        <Text style={styles.untertitel}>Phase 7 – App fuer Telefon und Web</Text>
        <Text style={styles.zeile}>
          Bewertungen: {BEWERTUNGEN.map((b) => b.label).join(' · ')}
        </Text>
        <Text style={styles.zeile}>Intervalle in Tagen: {INTERVALLE.join(' – ')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  schirm: {
    flex: 1,
    backgroundColor: '#F7F2E9',
  },
  inhalt: {
    padding: 24,
    gap: 12,
  },
  titel: {
    fontSize: 34,
    fontWeight: '700',
    color: '#332B1E',
  },
  untertitel: {
    fontSize: 16,
    color: '#6B5F4B',
  },
  zeile: {
    fontSize: 16,
    lineHeight: 24,
    color: '#332B1E',
  },
});