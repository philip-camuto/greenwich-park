import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://parking.philipcamuto.com"),
  title: "Greenwich Parking",
  description:
    "Live Greenwich Avenue parking demand, block scores, and arrival planning.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Greenwich Parking",
    description:
      "Live Greenwich Avenue parking demand, block scores, and arrival planning.",
    url: "https://parking.philipcamuto.com",
    siteName: "Greenwich Parking",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Greenwich Parking",
    description:
      "Live Greenwich Avenue parking demand, block scores, and arrival planning.",
  },
  appleWebApp: {
    capable: true,
    title: "Greenwich Parking",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--bg-group)] text-[var(--label-primary)] flex flex-col">
        {children}
      </body>
    </html>
  );
}
