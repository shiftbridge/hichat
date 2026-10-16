import data from "emojibase-data/en/data.json";
import iamcal from "emojibase-data/en/shortcodes/iamcal.json";
import standard from "emojibase-data/en/shortcodes/emojibase.json";
import cldr from "emojibase-data/en/shortcodes/cldr.json";
import joypixels from "emojibase-data/en/shortcodes/joypixels.json";
import type { Emoji } from "emojibase";

const compatibilityAliases: Record<string, string> = {
  smile: "😄",
  grinning: "😀",
  joy: "😂",
  rofl: "🤣",
  slightly_smiling_face: "🙂",
  wink: "😉",
  heart_eyes: "😍",
  thinking: "🤔",
  thinking_face: "🤔",
  sob: "😭",
  cry: "😢",
  angry: "😠",
  sunglasses: "😎",
  scream: "😱",
  skull: "💀",
  heart: "❤️",
  blue_heart: "💙",
  fire: "🔥",
  tada: "🎉",
  sparkles: "✨",
  wave: "👋",
  thumbsup: "👍",
  "+1": "👍",
  thumbsdown: "👎",
  "-1": "👎",
  clap: "👏",
  pray: "🙏",
  eyes: "👀",
  rocket: "🚀",
  white_check_mark: "✅",
  laughing: "😆",
  blush: "😊",
  sweat_smile: "😅",
  ok_hand: "👌",
  raised_hands: "🙌",
};

export const emojiCategories = [
  { id: -1, name: "All emoji" },
  { id: 0, name: "Smileys & emotion" },
  { id: 1, name: "People & body" },
  { id: 3, name: "Animals & nature" },
  { id: 4, name: "Food & drink" },
  { id: 5, name: "Travel & places" },
  { id: 6, name: "Activities" },
  { id: 7, name: "Objects" },
  { id: 8, name: "Symbols" },
  { id: 9, name: "Flags" },
  { id: 2, name: "Components" },
];
export const emojiShortcodes: Record<string, string> = Object.create(null);
const aliasesByHex = new Map<string, Set<string>>();
const byHex = new Map<string, Emoji>();
const byNative = new Map<string, Emoji>();
for (const emoji of data) {
  for (const entry of [emoji, ...(emoji.skins || [])]) {
    byHex.set(entry.hexcode, entry);
    byNative.set(entry.emoji, entry);
  }
}
for (const dataset of [cldr, standard, joypixels, iamcal]) {
  for (const [hex, names] of Object.entries(dataset)) {
    const glyph =
      byHex.get(hex)?.emoji ||
      String.fromCodePoint(...hex.split("-").map((part) => parseInt(part, 16)));
    const aliases = aliasesByHex.get(hex) || new Set<string>();
    for (const name of typeof names === "string" ? [names] : names) {
      emojiShortcodes[name] = glyph;
      aliases.add(name);
    }
    aliasesByHex.set(hex, aliases);
  }
}
Object.assign(emojiShortcodes, compatibilityAliases);
export interface EmojiChoice {
  id: string;
  native: string;
  label: string;
  group: number;
  aliases: string[];
  search: string;
  tone?: number | number[];
}
function choice(emoji: Emoji, parent?: Emoji): EmojiChoice {
  const aliases = [...(aliasesByHex.get(emoji.hexcode) || [])];
  return {
    id: emoji.hexcode,
    native: emoji.emoji,
    label: emoji.label,
    group: emoji.group ?? parent?.group ?? 2,
    aliases,
    search: [emoji.label, ...aliases, ...(emoji.tags || parent?.tags || [])]
      .join(" ")
      .toLowerCase()
      .replace(/[_-]/g, " "),
    tone: emoji.tone,
  };
}
export const emojiCatalog = data
  .filter((emoji) => emoji.group !== undefined)
  .sort((a, b) => (a.order || 0) - (b.order || 0));
const baseChoices = emojiCatalog.map((emoji) => choice(emoji));
const allChoices = emojiCatalog.flatMap((emoji) => [
  choice(emoji),
  ...(emoji.skins || []).map((skin) => choice(skin, emoji)),
]);
const sameTone = (value: number | number[] | undefined, tone: number) =>
  Array.isArray(value) ? value.every((n) => n === tone) : value === tone;
export function searchEmoji(
  query: string,
  category = -1,
  tone = 0,
): EmojiChoice[] {
  const terms = query
    .toLowerCase()
    .replace(/:/g, "")
    .replace(/[_-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const choices =
    tone === -1
      ? allChoices
      : tone === 0
        ? baseChoices
        : emojiCatalog.map((emoji) =>
            choice(
              emoji.skins?.find((skin) => sameTone(skin.tone, tone)) || emoji,
              emoji,
            ),
          );
  return choices.filter(
    (entry) =>
      (category === -1 || entry.group === category) &&
      terms.every(
        (term) => entry.search.includes(term) || entry.native === term,
      ),
  );
}
export function resolveShortcode(name: string, tone?: number): string | null {
  const key = Object.hasOwn(emojiShortcodes, name)
    ? name
    : name.replace(/-/g, "_");
  if (!Object.hasOwn(emojiShortcodes, key)) return null;
  const native = emojiShortcodes[key];
  if (tone === undefined) return native;
  const variant = byNative
    .get(native)
    ?.skins?.find((skin) => sameTone(skin.tone, tone - 1));
  return variant?.emoji || native + String.fromCodePoint(0x1f3fb + tone - 2);
}
const nativeEmoji = new Set(
  [...byNative.keys(), ...Object.values(emojiShortcodes)].map((glyph) =>
    glyph.replace(/\uFE0F/g, ""),
  ),
);
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
export function emojiOnlyCount(parts: EmojiPart[]): number {
  let count = 0;
  for (const part of parts) {
    if (part.type === "custom") {
      count++;
      continue;
    }
    for (const { segment } of segmenter.segment(part.value)) {
      if (!segment.trim()) continue;
      if (!nativeEmoji.has(segment.replace(/\uFE0F/g, ""))) return 0;
      count++;
    }
  }
  return count;
}

export type EmojiPart =
  | { type: "text"; value: string }
  | {
      type: "custom";
      value: string;
      name: string;
      id: string;
      animated: boolean;
    };
export function parseEmoji(text: string): EmojiPart[] {
  const parts: EmojiPart[] = [];
  const pattern =
    /<(a?):([A-Za-z0-9_]{1,32}):(\d{17,20})>|:([A-Za-z0-9_+\-]+):(?::skin-tone-([2-6]):)?/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > offset)
      parts.push({ type: "text", value: text.slice(offset, match.index) });
    if (match[3])
      parts.push({
        type: "custom",
        value: match[0],
        animated: match[1] === "a",
        name: match[2],
        id: match[3],
      });
    else
      parts.push({
        type: "text",
        value:
          resolveShortcode(match[4], match[5] ? Number(match[5]) : undefined) ??
          match[0],
      });
    offset = match.index! + match[0].length;
  }
  if (offset < text.length)
    parts.push({ type: "text", value: text.slice(offset) });
  return parts;
}
export function discordEmojiUrl(id: string, animated = false) {
  if (!/^\d{17,20}$/.test(id)) throw new Error("Invalid Discord emoji ID");
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=96`;
}
