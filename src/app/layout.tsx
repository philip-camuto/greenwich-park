import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Spectral } from "next/font/google";
import "./globals.css";

const spectral = Spectral({
  variable: "--font-display",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parking on Greenwich Avenue",
  description: "Shows you when Greenwich Avenue is busy before you drive there.",
  appleWebApp: {
    capable: true,
    title: "Greenwich Ave",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--fg)] flex flex-col">
        {children}
      </body>
    </html>
  );
}
