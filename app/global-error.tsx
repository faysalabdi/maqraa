"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b0c",
          color: "#fafafa",
          textAlign: "center",
          padding: "0 1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Something went wrong</h1>
        <p style={{ marginTop: 8, opacity: 0.7 }}>
          The app hit an unexpected error{error.digest ? ` (ref: ${error.digest})` : ""}.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "12px 20px",
            borderRadius: 12,
            border: "none",
            background: "#16a06a",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
