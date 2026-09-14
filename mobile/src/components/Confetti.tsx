import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

const COLORS = ["#0f9663", "#e3a72f", "#5b6cf0", "#f0762e", "#0c7a51"];
const COUNT = 28;
const DURATION = 2400;

/**
 * A one-shot burst. Mount with a changing `key` to fire again.
 *
 * Every particle reads from one driver value, interpolated with a per-particle
 * offset, so the whole burst is a single native-driven animation rather than
 * 28 competing ones.
 */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get("window");

  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        left: Math.random() * (width - 16),
        delay: Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 140,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.round(Math.random() * 5),
        tall: 9 + Math.round(Math.random() * 7),
        round: i % 3 === 0,
        spin: 360 + Math.random() * 360,
      })),
    [width],
  );

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.bezier(0.3, 0.6, 0.5, 1),
      useNativeDriver: true,
    });
    animation.start(() => onDone?.());
    return () => animation.stop();
  }, [progress, onDone]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => {
        // Clamping the head of the range is what staggers each particle.
        const range: [number, number] = [p.delay, 1];
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: -30,
              left: p.left,
              width: p.size,
              height: p.tall,
              borderRadius: p.round ? 999 : 2,
              backgroundColor: p.color,
              opacity: progress.interpolate({
                inputRange: [p.delay, 0.75, 1],
                outputRange: [1, 1, 0],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: range,
                    outputRange: [0, height + 60],
                    extrapolate: "clamp",
                  }),
                },
                {
                  translateX: progress.interpolate({
                    inputRange: range,
                    outputRange: [0, p.drift],
                    extrapolate: "clamp",
                  }),
                },
                {
                  rotate: progress.interpolate({
                    inputRange: range,
                    outputRange: ["0deg", `${p.spin}deg`],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
