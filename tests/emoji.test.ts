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
