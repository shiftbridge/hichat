import { describe, expect, test, spyOn } from "bun:test";
import Pusher from "pusher";
import {
  chunkImage,
  createImageReceiver,
  MAX_IMAGE_CHUNKS,
} from "@/lib/image-transfer";
import { POST } from "@/app/api/messages/route";
import type { Message } from "@/types/chat";

const message: Message = {
  id: crypto.randomUUID(),
  room: "general",
  user: "Alex",
  text: "Photo caption",
  timestamp: new Date().toISOString(),
  image: {
    id: `${crypto.randomUUID()}.png`,
    name: "photo.png",
    data: "data:image/png;base64," + "a".repeat(40000),
  },
};

describe("disk-free image delivery", () => {
  test("reassembles out-of-order chunks and tolerates duplicate chunks", () => {
    const chunks = chunkImage(message);
    const receiver = createImageReceiver();
    expect(receiver.receive(chunks.at(-1)!)).toBeNull();
    expect(receiver.receive(chunks.at(-1)!)).toBeNull();
    for (const chunk of chunks.slice(1, -1).reverse())
      expect(receiver.receive(chunk)).toBeNull();
    expect(receiver.receive(chunks[0])).toEqual(message);
  });
  test("keeps Unicode captions and filenames below the relay's 10 KB event limit", () => {
    const payload = {
      ...message,
      text: "😀".repeat(1000),
      image: { ...message.image!, name: "😀".repeat(60) },
    };
    const chunks = chunkImage(payload);
    expect(
      chunks.every(
        (chunk) =>
          new TextEncoder().encode(JSON.stringify(chunk)).length < 10000,
      ),
    ).toBe(true);
    const receiver = createImageReceiver();
    let result: Message | null = null;
    for (const chunk of chunks) result = receiver.receive(chunk);
    expect(result).toEqual(payload);
  });
  test("ignores malformed, excessive and non-image transfers", () => {
    const receiver = createImageReceiver();
    expect(
      receiver.receive({
        id: "bad",
        index: 0,
        total: MAX_IMAGE_CHUNKS + 1,
        data: "x",
      }),
    ).toBeNull();
    expect(
      receiver.receive({ id: "bad", index: -1, total: 1, data: "x" }),
    ).toBeNull();
    expect(
      receiver.receive({
        id: "bad",
        index: 0,
        total: 1,
        data: JSON.stringify({
          ...message,
          id: "bad",
          image: { data: "javascript:alert(1)" },
        }),
      }),
    ).toBeNull();
  });
  test("sends an image without touching server disk, using batches of at most ten", async () => {
    const envKeys = [
      "PUSHER_APP_ID",
      "NEXT_PUBLIC_PUSHER_KEY",
      "PUSHER_SECRET",
      "NEXT_PUBLIC_PUSHER_CLUSTER",
    ] as const;
    const previous = envKeys.map((key) => process.env[key]);
    envKeys.forEach((key) => {
      process.env[key] = key === "NEXT_PUBLIC_PUSHER_CLUSTER" ? "mt1" : "test";
    });
    const batches: Parameters<Pusher["triggerBatch"]>[0][] = [];
    const trigger = spyOn(Pusher.prototype, "triggerBatch").mockImplementation(
      async (batch) => {
        batches.push(batch);
        return {} as Awaited<ReturnType<Pusher["triggerBatch"]>>;
      },
    );
    try {
      const png =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==";
      const data =
        "data:image/png;base64," +
        Buffer.concat([
          Buffer.from(png, "base64"),
          Buffer.alloc(75000),
        ]).toString("base64");
      const response = await POST(
        new Request("http://localhost/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room: "general",
            user: "Alex",
            text: "",
            image: {
              id: `${crypto.randomUUID()}.png`,
              name: "photo.png",
              data,
            },
          }),
        }),
      );
      expect(response.status).toBe(200);
      expect(batches.length).toBeGreaterThan(1);
      expect(batches.every((batch) => batch.length <= 10)).toBe(true);
      const receiver = createImageReceiver();
      let result: Message | null = null;
      for (const batch of batches)
        for (const event of batch) result = receiver.receive(event.data);
      expect(result?.image?.data).toBe(data);
      expect(result?.text).toBe("");
    } finally {
      trigger.mockRestore();
      envKeys.forEach((key, index) => {
        if (previous[index] === undefined) delete process.env[key];
        else process.env[key] = previous[index];
      });
    }
  });
});
