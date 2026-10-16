import type { Message } from "@/types/chat";

export const IMAGE_CHUNK_SIZE = 5000;
export const MAX_ENCODED_IMAGE_LENGTH = 350000;
export const MAX_IMAGE_CHUNKS = Math.ceil(
  (MAX_ENCODED_IMAGE_LENGTH + 20000) / IMAGE_CHUNK_SIZE,
);
export const validImageData = (data: unknown): data is string =>
  typeof data === "string" &&
  data.length <= MAX_ENCODED_IMAGE_LENGTH &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(data);

export interface ImageChunk {
  id: string;
  index: number;
  total: number;
  data: string;
}

// Split the whole message so a long Unicode caption isn't repeated in each event.
export function chunkImage(message: Message): ImageChunk[] {
  if (!validImageData(message.image?.data))
    throw new Error("Invalid encoded image");
  const data = JSON.stringify(message);
  const total = Math.ceil(data.length / IMAGE_CHUNK_SIZE);
  if (total > MAX_IMAGE_CHUNKS) throw new Error("Image message too large");
  return Array.from({ length: total }, (_, index) => ({
    id: message.id,
    index,
    total,
    data: data.slice(index * IMAGE_CHUNK_SIZE, (index + 1) * IMAGE_CHUNK_SIZE),
  }));
}

// Bound partial transfers and expire them during incoming traffic.
export function createImageReceiver() {
  const pending = new Map<
    string,
    { at: number; total: number; chunks: Map<number, string> }
  >();
  return {
    clear: () => pending.clear(),
    receive(chunk: ImageChunk): Message | null {
      const now = Date.now();
      for (const [id, transfer] of pending)
        if (now - transfer.at > 120000) pending.delete(id);
      if (
        !chunk ||
        typeof chunk.id !== "string" ||
        chunk.id.length > 64 ||
        !Number.isInteger(chunk.index) ||
        !Number.isInteger(chunk.total) ||
        chunk.total < 1 ||
        chunk.total > MAX_IMAGE_CHUNKS ||
        chunk.index < 0 ||
        chunk.index >= chunk.total ||
        typeof chunk.data !== "string" ||
        chunk.data.length > IMAGE_CHUNK_SIZE
      )
        return null;
      let transfer = pending.get(chunk.id);
      if (!transfer) {
        if (pending.size >= 10) pending.delete(pending.keys().next().value!);
        transfer = { at: now, total: chunk.total, chunks: new Map() };
        pending.set(chunk.id, transfer);
      }
      if (transfer.total !== chunk.total) return null;
      transfer.chunks.set(chunk.index, chunk.data);
      if (transfer.chunks.size !== transfer.total) return null;
      pending.delete(chunk.id);
      try {
        const message = JSON.parse(
          Array.from({ length: transfer.total }, (_, index) =>
            transfer.chunks.get(index)!,
          ).join(""),
        );
        if (
          !message ||
          message.id !== chunk.id ||
          typeof message.user !== "string" ||
          message.user.length > 15 ||
          typeof message.room !== "string" ||
          message.room.length > 20 ||
          typeof message.timestamp !== "string" ||
          typeof message.text !== "string" ||
          message.text.length > 2000 ||
          !message.image ||
          typeof message.image.id !== "string" ||
          typeof message.image.name !== "string" ||
          message.image.name.length > 120 ||
          !validImageData(message.image.data)
        )
          return null;
        return message as Message;
      } catch {
        return null;
      }
    },
  };
}
