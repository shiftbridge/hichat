import { MAX_ENCODED_IMAGE_LENGTH } from "@/lib/image-transfer";

// All resizing and encoding happens in the sender's browser.
export async function encodeImage(file: File): Promise<string> {
  if (file.type === "image/gif") {
    if (file.size > 256 * 1024)
      throw new Error(
        "Animated GIF uploads must be 256 KB or smaller. Use the GIF picker for larger animations.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/gif;base64,${btoa(binary)}`;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    let side = 1280;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(
        1,
        side / Math.max(image.naturalWidth, image.naturalHeight),
      );
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL(
        "image/webp",
        Math.max(0.45, 0.82 - attempt * 0.08),
      );
      if (data.length <= MAX_ENCODED_IMAGE_LENGTH) return data;
      side = Math.round(side * 0.75);
    }
    throw new Error("This image is too detailed to send. Try a smaller image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
