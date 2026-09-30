// Genitive-case form of each category name, for natural-sounding copy like
// "Kviz pitanja iz {genitive}" (e.g. "iz istorije", "iz sporta"). Serbian
// grammar requires the noun to decline here - the nominative name alone
// ("Kviz pitanja - Istorija") reads as a label, not a sentence, which is
// exactly the difference between metadata that matches "kviz pitanja iz
// istorije" search intent and metadata that doesn't.
//
// Keyed by the categories.slug column (see migration 016). Keep in sync
// with the (name, slug) pairs seeded there.
export const CATEGORY_GENITIVE: Record<string, string> = {
  "vojska-i-ratovanje": "vojske i ratovanja",
  etnologija: "etnologije",
  privreda: "privrede",
  pravo: "prava",
  "hrana-i-pice": "hrane i pića",
  nauka: "nauke",
  psihologija: "psihologije",
  film: "filma",
  "film-i-tv": "filma i TV serija",
  mitologija: "mitologije",
  "opste-znanje": "opšteg znanja",
  muzika: "muzike",
  umetnost: "umetnosti",
  geografija: "geografije",
  "jezik-i-pismo": "jezika i pisma",
  sport: "sporta",
  knjizevnost: "književnosti",
  literatura: "literature",
  "pop-kultura": "pop kulture",
  tehnologija: "tehnologije",
  istorija: "istorije",
  priroda: "prirode",
  zabava: "zabave",
  religija: "religije",
  medicina: "medicine",
};

export function categoryGenitive(slug: string, fallbackName: string): string {
  return CATEGORY_GENITIVE[slug] ?? fallbackName;
}
