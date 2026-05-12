import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#f2f2f7",
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
