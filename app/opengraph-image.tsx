import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Maqraa — get through real Arabic books";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Latin-only by design: Satori (the renderer) can't shape Arabic, so we keep the
// share card to type it renders correctly.
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
          padding: "90px",
          background: "linear-gradient(135deg, #0b6644 0%, #16a06a 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#f4cf83",
            fontWeight: 700,
          }}
        >
          Maqraa
        </div>
        <div style={{ fontSize: 96, fontWeight: 800, marginTop: 16, lineHeight: 1.05, maxWidth: 980 }}>
          Get through real Arabic books.
        </div>
        <div style={{ fontSize: 38, marginTop: 24, opacity: 0.92, maxWidth: 940 }}>
          Tap any word to translate. Build a vocabulary that sticks. Bring your own books.
        </div>
      </div>
    ),
    { ...size },
  );
}
