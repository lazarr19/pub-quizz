import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statistika",
  description:
    "Prati svoj napredak na Ko Zna Zna platformi. Detaljne statistike po kategorijama, procenat tačnosti i pregled grešaka.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
