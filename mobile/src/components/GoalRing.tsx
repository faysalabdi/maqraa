import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { usePalette } from "../lib/use-palette";

/** Circular daily-goal ring: amber arc filling toward the goal, XP in the centre. */
export function GoalRing({ value, goal, size = 116 }: { value: number; goal: number; size?: number }) {
  const c = usePalette();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, value / Math.max(1, goal));
  const reached = value >= goal;
  const arc = reached ? c.brand : c.accent;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.bgMuted} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={arc}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.value, { color: c.fg }]}>{value}</Text>
        <Text style={{ color: c.fgMuted, fontSize: 12 }}>/ {goal} XP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 28, fontWeight: "800" },
});
