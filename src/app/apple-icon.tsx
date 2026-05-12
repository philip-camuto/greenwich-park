import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FAFAF8",
          color: "#111111",
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
            fontStyle: "italic",
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
            color: "#6B6B6B",
            fontFamily: "monospace",
            textTransform: "uppercase",
          }}
        >
          Greenwich Ave
        </div>
      </div>
    ),
    size,
  );
}
