import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PdfImportStatus } from "@maqraa/shared";
import { Button, Input } from "../components/ui";
import { api, apiUpload } from "../lib/api";
import { usePalette } from "../lib/use-palette";

const TIERS = [
  { label: "Beginner", level: 1 },
  { label: "Intermediate", level: 3 },
  { label: "Advanced", level: 5 },
];
const GENRES = [
  { value: "classical", label: "Classical" },
  { value: "islamic", label: "Islamic" },
  { value: "arabic_literature", label: "Arabic lit" },
  { value: "translated", label: "Translated" },
  { value: "graded_reader", label: "Graded" },
];

// Index matches the CLI's [n/6] stage markers; 0 = not started yet.
const STAGE_LABELS = [
  "Waiting for the runner",
  "Extracting the PDF",
  "Normalizing text",
  "Chunking pages",
  "Cleaning & chaptering with AI",
  "Stitching chapters",
  "Writing to the database",
];

type ActiveJob = { jobId: string; slug: string; title: string };
const STORAGE_KEY = "pdf-import-job";

export default function PdfImportScreen() {
  const c = usePalette();
  const [picked, setPicked] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [authorAr, setAuthorAr] = useState("");
  const [level, setLevel] = useState(3);
  const [genre, setGenre] = useState("classical");
  const [difficulty, setDifficulty] = useState(3);
  const [forceOcr, setForceOcr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ActiveJob | null>(null);
  const [status, setStatus] = useState<PdfImportStatus | null>(null);

  // Resume tracking a job started earlier — the import runs in the cloud, so
  // leaving this screen never cancels it.
  useFocusEffect(
    useCallback(() => {
      if (job) return;
      AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
        if (raw) {
          try {
            setJob(JSON.parse(raw) as ActiveJob);
          } catch {
            AsyncStorage.removeItem(STORAGE_KEY);
          }
        }
      });
    }, [job]),
  );

  useEffect(() => {
    if (!job) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;

    const tick = async () => {
      try {
        const s = await api<PdfImportStatus>(`/api/v1/admin/pdf-import/${job.jobId}`);
        if (stopped) return;
        failures = 0;
        setStatus(s);
        if (s.status === "done" || s.status === "failed") {
          AsyncStorage.removeItem(STORAGE_KEY);
          return;
        }
      } catch (e) {
        if (stopped) return;
        if (++failures >= 6) {
          setStatus({
            status: "failed",
            error: e instanceof Error ? e.message : "Status check failed.",
          });
          AsyncStorage.removeItem(STORAGE_KEY);
          return;
        }
      }
      timer = setTimeout(tick, 10_000);
    };

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [job]);

  const pick = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    if (!/\.pdf$/i.test(asset.name)) {
      setError("Pick a .pdf file.");
      return;
    }
    if ((asset.size ?? 0) > 45 * 1024 * 1024) {
      setError("File is larger than 45 MB — import it with the CLI instead.");
      return;
    }
    setPicked({ uri: asset.uri, name: asset.name, size: asset.size });
  };

  const start = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiUpload<{ jobId: string; slug: string }>(
        "/api/v1/admin/pdf-import",
        picked.uri,
        picked.name,
        {
          titleAr,
          titleEn,
          authorAr,
          level: String(level),
          genre,
          difficulty: String(difficulty),
          forceOcr: String(forceOcr),
        },
      );
      const active: ActiveJob = { jobId: res.jobId, slug: res.slug, title: titleEn || titleAr };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(active));
      setStatus({ status: "queued" });
      setJob(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setJob(null);
    setStatus(null);
    setPicked(null);
    setError(null);
  };

  const terminal = status?.status === "done" || status?.status === "failed";
  const progress = status?.progress;
  const stageLabel =
    status?.status === "queued" ? "Queued — waiting for the runner" : STAGE_LABELS[progress?.stage ?? 0];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={c.fg} />
        </Pressable>
        <Text style={[styles.heading, { color: c.fg }]}>Import PDF</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={{ color: c.fgMuted, fontSize: 14, lineHeight: 20 }}>
          Admin only: import a PDF into the public catalogue. Same pipeline as the CLI — it runs in
          the cloud and takes a few minutes. You can leave this screen once it starts.
        </Text>

        {job ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.fg, fontWeight: "700", fontSize: 16 }}>{job.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={
                  status?.status === "done"
                    ? "checkmark-circle"
                    : status?.status === "failed"
                      ? "alert-circle"
                      : "cloud-upload-outline"
                }
                size={20}
                color={status?.status === "failed" ? c.danger : c.brand}
              />
              <View style={{ flex: 1 }}>
                {status?.status === "done" ? (
                  <Text style={{ color: c.brand, fontWeight: "600" }}>Imported into the catalogue.</Text>
                ) : status?.status === "failed" ? (
                  <Text style={{ color: c.danger, fontWeight: "600" }}>
                    {status.error ?? "Import failed."}
                  </Text>
                ) : (
                  <>
                    <Text style={{ color: c.fg, fontWeight: "600" }}>{stageLabel}…</Text>
                    {progress?.chunkDone != null && progress.chunkTotal != null ? (
                      <Text style={{ color: c.fgMuted, fontSize: 12 }}>
                        chunk {progress.chunkDone} of {progress.chunkTotal}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>
            {!terminal ? (
              <Text style={{ color: c.fgMuted, fontSize: 12 }}>
                Safe to close the app — check back here anytime.
              </Text>
            ) : null}
            {status?.status === "done" ? (
              <Button title="Open the book" onPress={() => router.push(`/book/${status.slug ?? job.slug}`)} />
            ) : null}
            {terminal ? <Button title="Import another PDF" variant="ghost" onPress={reset} /> : null}
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
                size={36}
                color={picked ? c.brand : c.fgMuted}
              />
              <Text style={{ color: c.fg, fontWeight: "600" }}>
                {picked ? picked.name : "Choose a .pdf file"}
              </Text>
              {picked?.size ? (
                <Text style={{ color: c.fgMuted, fontSize: 12 }}>
                  {(picked.size / 1024 / 1024).toFixed(1)} MB
                </Text>
              ) : null}
            </Pressable>

            <Field label="TITLE (ARABIC)">
              <Input value={titleAr} onChangeText={setTitleAr} textAlign="right" />
            </Field>
            <Field label="TITLE (ENGLISH)">
              <Input value={titleEn} onChangeText={setTitleEn} autoCapitalize="words" />
            </Field>
            <Field label="AUTHOR (ARABIC, OPTIONAL)">
              <Input value={authorAr} onChangeText={setAuthorAr} textAlign="right" />
            </Field>

            <Field label="LEVEL">
              <Chips
                options={TIERS.map((t) => ({ value: t.level, label: t.label }))}
                selected={level}
                onSelect={setLevel}
              />
            </Field>
            <Field label="GENRE">
              <Chips
                options={GENRES.map((g) => ({ value: g.value, label: g.label }))}
                selected={genre}
                onSelect={setGenre}
              />
            </Field>
            <Field label="DIFFICULTY">
              <Chips
                options={[1, 2, 3, 4, 5].map((d) => ({ value: d, label: String(d) }))}
                selected={difficulty}
                onSelect={setDifficulty}
              />
            </Field>

            <View style={styles.switchRow}>
              <Text style={{ color: c.fg, flex: 1, fontWeight: "600" }}>Force OCR (scanned PDF)</Text>
              <Switch value={forceOcr} onValueChange={setForceOcr} />
            </View>

            {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}

            <Button
              title={busy ? "Uploading…" : "Start the import"}
              onPress={start}
              loading={busy}
              disabled={!picked || !titleAr || !titleEn}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.fgMuted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      {children}
    </View>
  );
}

function Chips<T extends string | number>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  const c = usePalette();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const active = o.value === selected;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onSelect(o.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? c.brand : c.surface,
                borderColor: active ? c.brand : c.border,
              },
            ]}
          >
            <Text style={{ color: active ? c.brandFg : c.fg, fontWeight: "600", fontSize: 13 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  dropzone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 36,
    alignItems: "center",
    gap: 8,
  },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
});
