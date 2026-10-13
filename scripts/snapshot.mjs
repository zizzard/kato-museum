// Refreshes public/data/ from the source API. Run manually and commit the result.
// Owner and sale/listing data are left out on purpose.
import { mkdir, writeFile } from "node:fs/promises";

const API = "https://api.skinsales.gg";
const PAGE_SIZE = 200; // API maximum
const OUT_DIR = new URL("../public/data/", import.meta.url);

const TEAMS = [
  ["3dmax", "3DMAX"],
  ["cm", "Clan-Mystik"],
  ["complexity", "compLexity Gaming"],
  ["dignitas", "Team Dignitas"],
  ["fnatic", "Fnatic"],
  ["hellraiser", "HellRaisers"],
  ["ibp", "iBUYPOWER"],
  ["ldlc", "Team LDLC.com"],
  ["lgb", "LGB eSports"],
  ["mouse", "mousesports"],
  ["navi", "Natus Vincere"],
  ["nip", "Ninjas in Pyjamas"],
  ["reason", "Reason Gaming"],
  ["titan", "Titan"],
  ["virtus_pro", "Virtus.Pro"],
  ["vox", "Vox Eminor"],
];

// Title colours by skin rarity.
const RARITY_COLORS = {
  Classified: "#d32ce6",
  Covert: "#eb4b4b",
  Extraordinary: "#eb4b4b",
  "Mil-Spec Grade": "#4b69ff",
  Restricted: "#8847ff",
  "Industrial Grade": "#5e98d9",
  "Consumer Grade": "#b0c3d9",
  Contraband: "#e4ae39",
};

const WEAR_SUFFIX =
  / \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;

async function getJson(path) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`);
    if (res.ok) return res.json();
    if (attempt >= 3) throw new Error(`${path}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

async function getAllCrafts(finish) {
  const crafts = [];
  for (let page = 1; ; page++) {
    const query = `page=${page}&page_size=${PAGE_SIZE}${finish === "paper" ? "&finish=paper" : ""}`;
    const data = await getJson(`/kato-museum/crafts?${query}`);
    crafts.push(...data.crafts);
    if (page >= data.total_pages) return crafts;
  }
}

const norm = (s) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const stickerLabel = (name) => name.replace(/^Sticker \|\s*/i, "").trim();

function wearLabel(float) {
  if (float < 0.07) return "Factory New";
  if (float < 0.15) return "Minimal Wear";
  if (float < 0.38) return "Field-Tested";
  if (float < 0.45) return "Well-Worn";
  return "Battle-Scarred";
}

const [weapons, skins, stickers] = await Promise.all([
  getJson("/weapons"),
  getJson("/skins"),
  getJson("/stickers"),
]);
const weaponsLongestFirst = [...weapons].sort((a, b) => b.name.length - a.name.length);
const stickerImageByName = new Map();
for (const s of stickers) {
  if (!s.image) continue;
  if (s.short_name) stickerImageByName.set(norm(s.short_name), s.image);
  if (s.name) stickerImageByName.set(norm(stickerLabel(s.name)), s.image);
}

function parseName(itemName) {
  let base = itemName.trim();
  const statTrak = base.startsWith("StatTrak™ ");
  if (statTrak) base = base.slice("StatTrak™ ".length);
  if (base.startsWith("Souvenir ")) base = base.slice("Souvenir ".length);
  const wearMatch = base.match(WEAR_SUFFIX);
  if (wearMatch) base = base.slice(0, -wearMatch[0].length).trim();

  let weaponName = null;
  let skinName = null;
  if (base.includes(" | ")) {
    [weaponName, skinName] = base.split(" | ", 2).map((s) => s.trim() || null);
  } else {
    const weapon = weaponsLongestFirst.find(
      (w) => base === w.name || base.startsWith(`${w.name} `),
    );
    if (weapon) {
      weaponName = weapon.name;
      skinName = base.slice(weapon.name.length).trim() || null;
    }
  }
  return { statTrak, weaponName, skinName, base, wearFromName: wearMatch?.[1] ?? null };
}

function findSkin(weaponName, skinName) {
  if (!weaponName || !skinName) return null;
  const weapon = weapons.find((w) => norm(w.name) === norm(weaponName));
  if (!weapon) return null;
  const target = norm(skinName);
  const skin = skins.find(
    (s) =>
      s.weapon_id === weapon.def_index &&
      (norm(s.short_name) === target ||
        norm(s.name).endsWith(`| ${target}`) ||
        norm(s.name) === target),
  );
  return skin ? { weapon, skin } : null;
}

function toCard(craft) {
  const name = parseName(craft.item_name);
  const match = findSkin(name.weaponName, name.skinName);
  const float = Number.parseFloat(craft.float_value);
  const katoStickers = craft.sticker_details?.length
    ? craft.sticker_details.filter((s) => s.name.toLowerCase().includes("katowice 2014"))
    : craft.stickers
        .filter((s) => s.toLowerCase().includes("katowice 2014"))
        .map((name, slot) => ({ name, slot, wear: null }));

  let minFloat = 0;
  let maxFloat = 1;
  if (match) {
    const lo = Math.min(Math.max(match.skin.min_float, 0), 1);
    const hi = Math.min(Math.max(match.skin.max_float, 0), 1);
    if (Number.isFinite(lo) && Number.isFinite(hi) && lo < hi) {
      minFloat = lo;
      maxFloat = hi;
    }
  }

  return {
    team: craft.sticker_team,
    rank: craft.rank ?? null,
    weapon: name.weaponName,
    skin: name.skinName,
    title: name.weaponName && name.skinName ? `${name.weaponName} | ${name.skinName}` : name.base,
    statTrak: name.statTrak,
    wear: Number.isFinite(float) ? wearLabel(float) : (name.wearFromName ?? craft.wear ?? null),
    float: Number.isFinite(float) ? float : null,
    minFloat,
    maxFloat,
    color: match ? (RARITY_COLORS[match.skin.rarity] ?? null) : null,
    image: craft.screenshot_url?.trim() || match?.skin.image || match?.weapon.image || null,
    seed: craft.paint_seed || null,
    value: craft.kato_holo_value_usd ?? null,
    updated: craft.last_updated ?? null,
    stickers: katoStickers.map((s, i) => ({
      label: stickerLabel(s.name),
      slot: Number.isInteger(s.slot) ? s.slot + 1 : i + 1,
      wear: s.wear ?? 0,
    })),
  };
}

await mkdir(OUT_DIR, { recursive: true });
for (const finish of ["holo", "paper"]) {
  const crafts = await getAllCrafts(finish);
  const suffix = finish === "holo" ? " (Holo)" : "";
  const teams = TEAMS.map(([id, label]) => ({
    id,
    label,
    image: stickerImageByName.get(norm(`${label}${suffix} | Katowice 2014`)) ?? null,
  }));
  const cards = crafts.map(toCard);
  // Sticker art is stored once per sticker rather than on every craft.
  const stickerImages = {};
  for (const card of cards) {
    for (const { label } of card.stickers) {
      stickerImages[label] ??= stickerImageByName.get(norm(label)) ?? null;
    }
  }
  const data = {
    generated_at: new Date().toISOString(),
    teams,
    stickerImages,
    crafts: cards,
  };
  await writeFile(new URL(`${finish}.json`, OUT_DIR), JSON.stringify(data));
  const unmatched = data.crafts.filter((c) => !c.color).length;
  console.log(`${finish}: ${data.crafts.length} crafts (${unmatched} without catalog match)`);
}
