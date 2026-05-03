import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtry — Keys of the Kingdom Try-On",
  description:
    "Virtry is a virtual try-on built for Christ Dominion · Keys of the Kingdom Youth Week. Upload a photo, try on tees, hoodies, caps and more, and share.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FAF8F4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
