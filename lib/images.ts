import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const directory = path.join(process.cwd(), ".data", "images");
const mimeTypes = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
} as const;

export function imageExtension(
  bytes: Uint8Array,
): keyof typeof mimeTypes | null {
  const data = Buffer.from(bytes);
  if (
    data.length >= 24 &&
    data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.toString("ascii", 12, 16) === "IHDR"
  )
    return "png";
  if (data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255)
    return "jpg";
  if (
    data.length >= 13 &&
    ["GIF87a", "GIF89a"].includes(data.toString("ascii", 0, 6))
  )
    return "gif";
  if (
    data.length >= 20 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  return null;
}

export function validImageId(id: unknown): id is string {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/.test(
      id,
    )
  );
}

export async function saveImage(data: Uint8Array) {
  const extension = imageExtension(data);
  if (!extension || !data.length || data.length > MAX_IMAGE_BYTES)
    throw new Error("Invalid image");
  const id = `${crypto.randomUUID()}.${extension}`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, id), data, { flag: "wx", mode: 0o600 });
  return id;
}

export async function loadImage(id: string) {
  if (!validImageId(id)) return null;
  try {
    const data = await readFile(path.join(directory, id));
    const extension = id.split(".").pop() as keyof typeof mimeTypes;
    return { data, mime: mimeTypes[extension] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
