import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prijava",
  description:
    "Prijavi se na Ko Zna Zna platformu i započni vežbanje kviz pitanja iz opšteg znanja.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
