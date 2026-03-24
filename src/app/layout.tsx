import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Ko Zna Zna (KZZ) - Priprema za kvizove i testove opšteg znanja",
    template: "%s | KZZ",
  },
  description:
    "Besplatna online platforma za pripremu za Slagalicu, Poteru, pub kvizove i prijemne ispite iz opšteg znanja.",
  keywords: [
    "kviz",
    "opšte znanje",
    "slagalica",
    "potera",
    "pub kviz",
    "Ko Zna Zna",
    "KZZ",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000",
  ),
  openGraph: {
    title: "Ko Zna Zna - Tvoja priprema za kvizove",
    description:
      "Vežbaj hiljade pitanja iz opšteg znanja. Pripremi se za Slagalicu, Poteru, pub kvizove i fakultetske prijemne ispite.",
    type: "website",
    locale: "sr_RS",
    siteName: "Ko Zna Zna",
  },
  icons: {
    icon: "/kzz-logo.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f0f1a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr">
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
