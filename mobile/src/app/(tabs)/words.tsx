import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "../../lib/use-palette";

export default function WordsScreen() {
  const c = usePalette();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.hint, { color: c.fgMuted }]}>Saved words arrive in the next build.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 15 },
});
