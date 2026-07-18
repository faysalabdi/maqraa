import { StyleSheet, View, type ViewProps } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { usePalette } from "../lib/use-palette";

/**
 * The web body's calm brand/accent radial wash: a green glow from the top-left,
 * amber from the top-right, fading out by mid-screen. Sits behind screen content.
 */
export function Washed({ children, style, ...props }: ViewProps) {
  const c = usePalette();
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }, style]} {...props}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="brandWash" cx="0%" cy="0%" r="55%">
            <Stop offset="0" stopColor={c.brand} stopOpacity={0.08} />
            <Stop offset="1" stopColor={c.brand} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="accentWash" cx="100%" cy="0%" r="52%">
            <Stop offset="0" stopColor={c.accent} stopOpacity={0.09} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#brandWash)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#accentWash)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
