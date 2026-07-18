import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MeResponse } from "@maqraa/shared";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { usePalette } from "../../lib/use-palette";

export default function SettingsScreen() {
  const c = usePalette();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MeResponse>("/api/v1/me")
      .then(setMe)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: c.fg }]}>Settings</Text>
        {me ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.fg, fontSize: 16 }}>{me.email}</Text>
            <Text style={{ color: me.plan === "pro" ? c.brand : c.fgMuted, fontWeight: "600" }}>
              {me.plan === "pro" ? "Maqraa Pro" : "Free plan"}
            </Text>
          </View>
        ) : (
          <Text style={{ color: error ? c.danger : c.fgMuted }}>{error ?? "Loading…"}</Text>
        )}
        <Button title="Sign out" variant="danger" onPress={() => supabase.auth.signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
});
