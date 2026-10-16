import { describe, expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { POST } from "@/app/api/images/route";
import { GET } from "@/app/api/images/[id]/route";
import { POST as sendMessage } from "@/app/api/messages/route";
import { imageExtension, MAX_IMAGE_BYTES, validImageId } from "@/lib/images";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==",
  "base64",
);
function upload(data: BlobPart, name = "photo.png", type = "image/png") {
  const body = new FormData();
  body.append("image", new File([data], name, { type }));
  return POST(
    new Request("http://localhost/api/images", { method: "POST", body }),
  );
}

describe("local image sharing", () => {
  test("uploaded image downloads byte-for-byte with safe image headers", async () => {
    const response = await upload(png);
    expect(response.status).toBe(201);
    const image = await response.json();
    try {
      expect(validImageId(image.id)).toBe(true);
      expect(image.name).toBe("photo.png");
      const download = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: image.id }),
      });
      expect(download.status).toBe(200);
      expect(download.headers.get("content-type")).toBe("image/png");
      expect(download.headers.get("x-content-type-options")).toBe("nosniff");
      expect(Buffer.from(await download.arrayBuffer()).equals(png)).toBe(true);
    } finally {
      await unlink(path.join(process.cwd(), ".data/images", image.id));
    }
  });
  test("does not trust the filename or MIME type for executable content", async () => {
    expect(
      (
        await upload(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        )
      ).status,
    ).toBe(415);
    expect((await upload("not an image")).status).toBe(415);
    expect(imageExtension(png)).toBe("png");
  });
  test("rejects empty, missing and oversized uploads", async () => {
    expect((await upload("")).status).toBe(400);
    expect(
      (
        await POST(
          new Request("http://localhost", {
            method: "POST",
            body: new FormData(),
          }),
        )
      ).status,
    ).toBe(400);
    expect((await upload(new Uint8Array(MAX_IMAGE_BYTES + 1))).status).toBe(
      413,
    );
    expect(
      (
        await POST(
          new Request("http://localhost", {
            method: "POST",
            headers: { "content-length": String(MAX_IMAGE_BYTES + 100000) },
          }),
        )
      ).status,
    ).toBe(413);
  });
  test("rejects path traversal and handles missing images", async () => {
    for (const id of [
      "../../package.json",
      "file.svg",
      `${crypto.randomUUID()}.png`,
    ]) {
      expect(
        (
          await GET(new Request("http://localhost"), {
            params: Promise.resolve({ id }),
          })
        ).status,
      ).toBe(404);
    }
  });
  test("rejects foreign image references in messages", async () => {
    const response = await sendMessage(
      new Request("http://localhost/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: "general",
          user: "Alex",
          text: "",
          image: { id: "https://example.com/photo.jpg", name: "photo" },
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
