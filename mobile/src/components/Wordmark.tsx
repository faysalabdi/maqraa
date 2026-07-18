import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

/**
 * The Maqraa wordmark — مقرأ ("to read") in a gold→emerald gradient, matching
 * the web Logo. Renders as live SVG text so it stays crisp at any size.
 */
export function Wordmark({ height = 26 }: { height?: number }) {
  const width = (height * 360) / 175;
  return (
    <Svg width={width} height={height} viewBox="0 0 360 175">
      <Defs>
        <LinearGradient id="mq" x1="0" y1="0" x2="1" y2="0.35">
          <Stop offset="0" stopColor="#e3a72f" />
          <Stop offset="0.45" stopColor="#19a06a" />
          <Stop offset="1" stopColor="#0c7a51" />
        </LinearGradient>
      </Defs>
      <SvgText
        x="180"
        y="138"
        fontFamily="NotoNaskhArabic_700Bold"
        fontWeight="700"
        fontSize="128"
        textAnchor="middle"
        fill="url(#mq)"
      >
        مقرأ
      </SvgText>
    </Svg>
  );
}
