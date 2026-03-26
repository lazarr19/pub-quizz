import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo kviz",
  description:
    "Probaj besplatni demo kviz na Ko Zna Zna platformi. Testiraj znanje iz opšte kulture bez registracije.",
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
