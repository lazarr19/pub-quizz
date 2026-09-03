import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Predloži pitanje",
  description:
    "Predloži novo kviz pitanje za Ko Zna Zna platformu. Pomozi u izgradnji najveće baze pitanja iz opšteg znanja.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SuggestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
