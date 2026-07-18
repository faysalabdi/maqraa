import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePalette } from "../lib/use-palette";
import { ArabicText } from "./ArabicText";
import { Button } from "./ui";

export type WordInfo = {
  surface: string;
  surfaceKey: string;
  lemma_ar: string;
  gloss_en: string;
  pos: string | null;
  example_ar: string | null;
};

export function WordSheet({
  word,
  loading,
  error,
  onSave,
  onClose,
  saved,
}: {
  word: WordInfo | null;
  loading: boolean;
  error: string | null;
  onSave: () => Promise<void>;
  onClose: () => void;
  saved: boolean;
}) {
  const c = usePalette();
  const [saving, setSaving] = useState(false);
  const visible = loading || !!word || !!error;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        {loading ? (
          <ActivityIndicator style={{ paddingVertical: 24 }} />
        ) : error ? (
          <Text style={{ color: c.danger, paddingVertical: 12 }}>{error}</Text>
        ) : word ? (
          <>
            <View style={styles.row}>
              {word.pos ? (
                <Text style={[styles.pos, { color: c.fgMuted }]}>{word.pos}</Text>
              ) : (
                <View />
              )}
              <ArabicText style={[styles.lemma, { color: c.fg }]}>{word.lemma_ar}</ArabicText>
            </View>
            <Text style={[styles.gloss, { color: c.fg }]}>{word.gloss_en}</Text>
            {word.example_ar ? (
              <ArabicText style={[styles.example, { color: c.fgMuted }]}>
                {word.example_ar}
              </ArabicText>
            ) : null}
            <Button
              title={saved ? "Saved to deck" : "Save word"}
              disabled={saved}
              loading={saving}
              onPress={async () => {
                setSaving(true);
                try {
                  await onSave();
                } finally {
                  setSaving(false);
                }
              }}
            />
          </>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 6,
  },
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  lemma: { fontSize: 30 },
  pos: { fontSize: 13, fontStyle: "italic" },
  gloss: { fontSize: 18, fontWeight: "600" },
  example: { fontSize: 18, lineHeight: 30 },
});
