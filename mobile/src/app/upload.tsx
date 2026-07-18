import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/ui";
import { apiUpload } from "../lib/api";
import { useMe } from "../lib/me-context";
import { purchasesAvailable } from "../lib/purchases";
import { usePalette } from "../lib/use-palette";

export default function UploadScreen() {
  const c = usePalette();
  const { plan } = useMe();
  const [picked, setPicked] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/epub+zip", "text/plain", "application/octet-stream"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    if (!/\.(epub|txt|md)$/i.test(asset.name)) {
      setError("Pick an .epub or .txt file.");
      return;
    }
    if ((asset.size ?? 0) > 30 * 1024 * 1024) {
      setError("File is larger than 30 MB.");
      return;
    }
    setPicked({ uri: asset.uri, name: asset.name, size: asset.size });
  };

  const importBook = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const { slug } = await apiUpload<{ slug: string }>("/api/v1/upload", picked.uri, picked.name);
      router.replace(`/book/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.fg} />
        </Pressable>
        <Text style={[styles.heading, { color: c.fg }]}>Add your own book</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={{ color: c.fgMuted, fontSize: 15, lineHeight: 22 }}>
          Import any Arabic EPUB or text file. Maqraa reads it, splits it into chapters, places it
          on your path, and gives you the same tap-to-translate reader, quizzes, and vocab saving
          as the curated library. Imports are private to you.
        </Text>

        {plan !== "pro" ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="lock-closed" size={22} color={c.accent} />
            <Text style={{ color: c.fg, flex: 1 }}>
              Importing your own books is part of Maqraa Pro.
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={pick}
              style={[
                styles.dropzone,
                { borderColor: picked ? c.brand : c.border, backgroundColor: c.surface },
              ]}
            >
              <Ionicons
                name={picked ? "document-text" : "cloud-upload-outline"}
                size={40}
                color={picked ? c.brand : c.fgMuted}
              />
              <Text style={{ color: c.fg, fontWeight: "600", fontSize: 16 }}>
                {picked ? picked.name : "Choose an .epub or .txt file"}
              </Text>
              {picked?.size ? (
                <Text style={{ color: c.fgMuted, fontSize: 13 }}>
                  {(picked.size / 1024 / 1024).toFixed(1)} MB
                </Text>
              ) : null}
            </Pressable>

            {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}

            <Button
              title={busy ? "Importing…" : "Import book"}
              onPress={importBook}
              loading={busy}
              disabled={!picked}
            />
            {busy ? (
              <Text style={{ color: c.fgMuted, fontSize: 13, textAlign: "center" }}>
                Parsing chapters and placing the book on your path — this can take up to a minute.
              </Text>
            ) : null}
          </>
        )}

        {plan !== "pro" && purchasesAvailable() ? (
          <Button title="Get Maqraa Pro" onPress={() => router.push("/paywall")} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heading: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  dropzone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 44,
    alignItems: "center",
    gap: 10,
  },
});
