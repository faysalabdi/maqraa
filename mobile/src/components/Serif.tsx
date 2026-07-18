import { Text, StyleSheet, type TextProps } from "react-native";

/** Big page titles in Spectral, matching the web/prototype serif headings. */
export function Serif({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.serif, style]} />;
}

const styles = StyleSheet.create({
  serif: { fontFamily: "Spectral_700Bold" },
});
