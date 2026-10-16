import { expect, test } from "bun:test";
import { parseLinks } from "@/lib/links";
import { normalizeGifs, validGif } from "@/lib/gifs";
import { encodeImage } from "@/lib/encode-image";
import { chunkImage, createImageReceiver } from "@/lib/image-transfer";
import { trimHistories } from "@/lib/browser-storage";
import { POST } from "@/app/api/messages/route";

test("linkifies HTTP, HTTPS and www links while retaining punctuation", () => {
  const text =
    "See https://example.com/a_(b). Also (https://example.com/help). WWW.example.org :sob:";
  const parts = parseLinks(text);
  expect(parts.map((part) => part.text).join("")).toBe(text);
  expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual([
    "https://example.com/a_(b)",
    "https://example.com/help",
    "https://WWW.example.org",
  ]);
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@example.com",
  ])
    expect(parseLinks(value).every((part) => !part.href)).toBe(true);
});
const gif = {
  provider: "giphy" as const,
  url: "https://media.giphy.com/media/test/200w.gif",
  preview: "https://media.giphy.com/media/test/200w_s.gif",
  title: "Test",
  pageUrl: "https://giphy.com/gifs/test",
};
test("normalizes GIPHY and KLIPY results and validates only trusted HTTPS media", () => {
  expect(
    normalizeGifs(
      {
        data: [
          {
            title: "Test",
            url: gif.pageUrl,
            images: {
              fixed_width: { url: gif.url },
              fixed_width_still: { url: gif.preview },
            },
          },
        ],
      },
      "giphy",
    ),
  ).toEqual([gif]);
  const klipy = normalizeGifs(
    {
      data: {
        data: [
          {
            title: "Cat",
            slug: "cat",
            file: { md: { gif: { url: "https://static.klipy.com/cat.gif" } } },
          },
        ],
      },
    },
    "klipy",
  );
  expect(klipy[0].url).toBe("https://static.klipy.com/cat.gif");
  expect(validGif(gif)).toBe(true);
  for (const url of [
    "javascript:alert(1)",
    "https://media.giphy.com.evil.com/a.gif",
    "http://media.giphy.com/a.gif",
    "https://user:pass@media.giphy.com/a.gif",
  ])
    expect(validGif({ ...gif, url })).toBe(false);
  expect(normalizeGifs({ data: null }, "giphy")).toEqual([]);
});
test("preserves uploaded GIF bytes and animation through encoding, relay and history", async () => {
  const bytes = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );
  const data = await encodeImage(
    new File([bytes], "animation.gif", { type: "image/gif" }),
  );
  expect(data.startsWith("data:image/gif;base64,")).toBe(true);
  expect(Buffer.from(data.split(",")[1], "base64").equals(bytes)).toBe(true);
  const message = {
    id: crypto.randomUUID(),
    room: "general",
    user: "Alex",
    text: "",
    timestamp: new Date().toISOString(),
    image: { id: `${crypto.randomUUID()}.gif`, name: "animation.gif", data },
  };
  const receiver = createImageReceiver();
  let result = null;
  for (const chunk of chunkImage(message)) result = receiver.receive(chunk);
  expect(result).toEqual(message);
  expect(trimHistories({ general: [message] }).general[0].image?.data).toBe(
    data,
  );
  await expect(
    encodeImage(
      new File([new Uint8Array(256 * 1024 + 1)], "large.gif", {
        type: "image/gif",
      }),
    ),
  ).rejects.toThrow("256 KB");
});
test("retains provider GIFs in saved history and rejects unsafe GIF submissions", async () => {
  const message = {
    id: "gif",
    room: "general",
    user: "Alex",
    text: "",
    timestamp: new Date().toISOString(),
    gif,
  };
  expect(trimHistories({ general: [message] }).general[0].gif).toEqual(gif);
  const response = await POST(
    new Request("http://localhost/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: "general",
        user: "Alex",
        text: "",
        gif: { ...gif, url: "javascript:alert(1)" },
      }),
    }),
  );
  expect(response.status).toBe(400);
});
