import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Maqra — read Arabic, beautifully";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b6644 0%, #16a06a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 120, lineHeight: 1 }}>اِقْرَأْ</div>
        <div style={{ fontSize: 84, fontWeight: 800, marginTop: 28 }}>Maqra</div>
        <div style={{ fontSize: 40, marginTop: 12, opacity: 0.9, maxWidth: 900 }}>
          Read real Arabic books. Tap any word to translate. Build a vocabulary that sticks.
        </div>
      </div>
    ),
    { ...size },
  );
}
