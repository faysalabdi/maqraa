import { Text, type TextProps, StyleSheet } from "react-native";

/**
 * Arabic body text: Noto Naskh, RTL writing direction, right-aligned. The app
 * chrome stays LTR; only Arabic content blocks render through this component.
 */
export function ArabicText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.arabic, style]} />;
}

const styles = StyleSheet.create({
  arabic: {
    fontFamily: "NotoNaskhArabic_400Regular",
    writingDirection: "rtl",
    textAlign: "right",
  },
});
