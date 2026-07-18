import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArabicText } from "../../components/ArabicText";
import { usePalette } from "../../lib/use-palette";

export default function PathScreen() {
  const c = usePalette();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <ArabicText style={[styles.logo, { color: c.brand }]}>مقرأة</ArabicText>
        <Text style={[styles.hint, { color: c.fgMuted }]}>
          The reading path arrives in the next build.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  logo: { fontSize: 48 },
  hint: { fontSize: 15 },
});
