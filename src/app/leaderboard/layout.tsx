import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rang lista",
  description:
    "Pogledaj rang listu najboljih igrača na Ko Zna Zna platformi. Takmič se sa drugima u znanju iz opšte kulture.",
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
