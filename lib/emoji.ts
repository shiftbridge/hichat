export const emojiShortcodes: Record<string, string> = {
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
    /<(a?):([A-Za-z0-9_]{1,32}):(\d{17,20})>|:([A-Za-z0-9_+\-]+):/g;
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
        value: Object.hasOwn(emojiShortcodes, match[4])
          ? emojiShortcodes[match[4]]
          : match[0],
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
