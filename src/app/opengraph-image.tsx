import { ImageResponse } from "next/og";

// Static text card for link previews (iMessage, Slack, X). Programmatic so
// it stays on-brand without maintaining a binary asset.

export const alt = "Greenwich Parking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafafa",
          color: "#111111",
          padding: 72,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#8a8a8a",
          }}
        >
          parking.philipcamuto.com
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Greenwich Parking
          </div>
          <div style={{ fontSize: 38, color: "#555555" }}>
            Know when Greenwich Avenue is busy before you drive there.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ width: 120, height: 14, background: "#34a853", borderRadius: 7 }} />
          <div style={{ width: 120, height: 14, background: "#f5a623", borderRadius: 7 }} />
          <div style={{ width: 120, height: 14, background: "#e5483f", borderRadius: 7 }} />
        </div>
      </div>
    ),
    size,
  );
}
