export type Finish = "holo" | "paper";
export type Sort = "float_asc" | "float_desc" | "updated_desc" | "updated_asc";

export interface Team {
  id: string;
  label: string;
  image: string | null;
}

export interface CraftSticker {
  label: string;
  slot: number;
  /** Raw CSFloat wear: 0 = unscratched, 1 = fully scraped. */
  wear: number;
}

/** One craft, pre-shaped by scripts/snapshot.mjs. */
export interface Craft {
  team: string;
  rank: number | null;
  weapon: string | null;
  skin: string | null;
  title: string;
  statTrak: boolean;
  wear: string | null;
  float: number | null;
  minFloat: number;
  maxFloat: number;
  /** Title colour from the skin's rarity. */
  color: string | null;
  image: string | null;
  seed: string | null;
  value: number | null;
  updated: string | null;
  stickers: CraftSticker[];
}

export interface Dataset {
  generated_at: string;
  teams: Team[];
  stickerImages: Record<string, string | null>;
  crafts: Craft[];
}
