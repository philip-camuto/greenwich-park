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
          background: "#F2F2F7",
          color: "#000000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 130, fontWeight: 700, lineHeight: 1 }}>P</div>
        <div
          style={{
            position: "absolute",
            bottom: 14,
            fontSize: 11,
            letterSpacing: 1.5,
            color: "rgba(60,60,67,0.6)",
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
