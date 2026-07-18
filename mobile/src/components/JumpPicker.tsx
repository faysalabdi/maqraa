import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePalette } from "../lib/use-palette";
import { ArabicText } from "./ArabicText";

export type JumpOption = { key: string; label: string; arabic?: boolean };

/** Bottom-sheet picker for the reader's page and chapter jump menus. */
export function JumpPicker({
  visible,
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: JumpOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const c = usePalette();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <Text style={[styles.title, { color: c.fg }]}>{title}</Text>
        <ScrollView style={styles.list}>
          {options.map((o) => {
            const active = o.key === selectedKey;
            const Label = o.arabic ? ArabicText : Text;
            return (
              <Pressable
                key={o.key}
                onPress={() => onSelect(o.key)}
                style={[
                  styles.row,
                  { borderColor: c.border },
                  active && { backgroundColor: `${c.brand}14` },
                ]}
              >
                <Label
                  style={[
                    styles.rowText,
                    { color: active ? c.brand : c.fg },
                    o.arabic && { flex: 1, textAlign: "right" },
                  ]}
                  numberOfLines={1}
                >
                  {o.label}
                </Label>
                {active ? <Ionicons name="checkmark" size={18} color={c.brand} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: "70%",
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", paddingHorizontal: 20, paddingBottom: 10 },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 14,
  },
  rowText: { fontSize: 16 },
});
