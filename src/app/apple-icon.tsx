import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon (180x180 per Apple spec). Same Spectral P + a small
// Greenwich coordinate mark in mono caps — instrument vibe carries into the
// home screen icon.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000000",
          color: "#f4f4f4",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: 300,
            letterSpacing: -6,
            lineHeight: 1,
            marginTop: -8,
          }}
        >
          P
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 14,
            fontSize: 10,
            letterSpacing: 2.5,
            color: "#8a8a8a",
            fontFamily: "monospace",
            textTransform: "uppercase",
          }}
        >
          41.026°N
        </div>
      </div>
    ),
    size,
  );
}
