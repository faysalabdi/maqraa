import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { usePalette } from "../lib/use-palette";

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost" | "danger" | "accent";
}) {
  const c = usePalette();
  const bg =
    variant === "primary"
      ? c.brand
      : variant === "danger"
        ? c.danger
        : variant === "accent"
          ? c.accent
          : "transparent";
  const fg =
    variant === "ghost" ? c.fgMuted : variant === "accent" ? c.accentFg : c.brandFg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const c = usePalette();
  return (
    <TextInput
      placeholderTextColor={c.fgMuted}
      {...props}
      style={[
        styles.input,
        { backgroundColor: c.surface, borderColor: c.border, color: c.fg },
        props.style,
      ]}
    />
  );
}

export function FormError({ message }: { message: string | null }) {
  const c = usePalette();
  if (!message) return null;
  return (
    <View style={[styles.error, { backgroundColor: `${c.danger}18`, borderColor: c.danger }]}>
      <Text style={{ color: c.danger, fontSize: 14 }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
});
