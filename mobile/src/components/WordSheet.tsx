import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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

  // Subtle rise on the sheet only — the backdrop fades via the Modal, so there's
  // no full-height panel sliding up the page.
  const rise = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    if (visible) {
      rise.setValue(24);
      Animated.spring(rise, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 220,
        mass: 0.7,
      }).start();
    }
  }, [visible, rise]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: c.surface, borderColor: c.border, transform: [{ translateY: rise }] },
          ]}
        >
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
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
