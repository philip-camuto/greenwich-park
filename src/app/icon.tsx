import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon. Spectral P glyph on pure black — same DNA as the giant score.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000000",
          color: "#f4f4f4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "serif",
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: -1,
          lineHeight: 1,
        }}
      >
        P
      </div>
    ),
    size,
  );
}
