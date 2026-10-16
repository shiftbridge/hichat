import { expect, test } from "bun:test";
import { discordEmojiUrl, parseEmoji } from "@/lib/emoji";
test("parses static and animated custom emoji mixed with normal text", () => {
  expect(
    parseEmoji("Hi <:wave:123456789012345678> <a:party:123456789012345679>!"),
  ).toEqual([
    { type: "text", value: "Hi " },
    {
      type: "custom",
      value: "<:wave:123456789012345678>",
      name: "wave",
      id: "123456789012345678",
      animated: false,
    },
    { type: "text", value: " " },
    {
      type: "custom",
      value: "<a:party:123456789012345679>",
      name: "party",
      id: "123456789012345679",
      animated: true,
    },
    { type: "text", value: "!" },
  ]);
});
test("supports common shortcodes and preserves Unicode and unknown names", () => {
  expect(
    parseEmoji("😀 :smile: :+1: :unknown: :constructor: :__proto__:")
      .map((part) => part.value)
      .join(""),
  ).toBe("😀 😄 👍 :unknown: :constructor: :__proto__:");
});
test("keeps malformed emoji and HTML as plain text", () => {
  for (const text of [
    "<:x:abc>",
    "<:x:123>",
    '<img src=x onerror="alert(1)">',
    "<:x:123456789012345678901>",
  ])
    expect(parseEmoji(text).every((part) => part.type === "text")).toBe(true);
  expect(() => discordEmojiUrl("../../evil")).toThrow();
  expect(discordEmojiUrl("123456789012345678", true)).toBe(
    "https://cdn.discordapp.com/emojis/123456789012345678.gif?size=96",
  );
});

test("covers the full catalog and Discord-style aliases", async () => {
  const { emojiShortcodes, searchEmoji, resolveShortcode } =
    await import("@/lib/emoji");
  expect(Object.keys(emojiShortcodes).length).toBeGreaterThan(9000);
  expect(searchEmoji("").length).toBeGreaterThan(1900);
  expect(resolveShortcode("sob")).toBe("😭");
  expect(resolveShortcode("melting_face")).toBe("🫠");
  expect(resolveShortcode("woman_technologist")).toBe("👩‍💻");
  expect(resolveShortcode("flag_us")).toBe("🇺🇸");
  expect(resolveShortcode("thumbsup", 4)).toBe("👍🏽");
  expect(resolveShortcode("woman_technologist", 4)).toBe("👩🏽‍💻");
  expect(
    parseEmoji(
      ":sob: :thumbsup::skin-tone-4: :woman_technologist::skin-tone-4:",
    )
      .map((part) => part.value)
      .join(""),
  ).toBe("😭 👍🏽 👩🏽‍💻");
});
test("searches aliases, categories, Unicode and skin variants", async () => {
  const { searchEmoji } = await import("@/lib/emoji");
  expect(searchEmoji(":sob:").some((entry) => entry.native === "😭")).toBe(
    true,
  );
  expect(searchEmoji("", 9).every((entry) => entry.group === 9)).toBe(true);
  expect(
    searchEmoji("thumbs up", -1, 5).some((entry) => entry.native === "👍🏿"),
  ).toBe(true);
  expect(searchEmoji("", -1, -1).length).toBeGreaterThan(3900);
  expect(searchEmoji("👩‍💻").some((entry) => entry.native === "👩‍💻")).toBe(true);
  expect(searchEmoji("no_such_emoji_zyx")).toEqual([]);
});
test("recognizes emoji-only messages including flags, families and mixed custom emoji", async () => {
  const { emojiOnlyCount } = await import("@/lib/emoji");
  expect(emojiOnlyCount(parseEmoji(":sob: 🇺🇸 👨‍👩‍👧‍👦"))).toBe(3);
  expect(emojiOnlyCount(parseEmoji("👍🏽 <:wave:123456789012345678>"))).toBe(2);
  expect(emojiOnlyCount(parseEmoji("hello 😭"))).toBe(0);
  expect(emojiOnlyCount(parseEmoji(":unrecognized_name:"))).toBe(0);
});
