import { NextResponse } from "next/server";
import { imageExtension, MAX_IMAGE_BYTES, saveImage } from "@/lib/images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const maxRequestBytes = MAX_IMAGE_BYTES + 64 * 1024;
  const tooLarge = () =>
    NextResponse.json(
      { error: "Choose an image smaller than 5 MB." },
      { status: 413 },
    );
  if (Number(request.headers.get("content-length")) > maxRequestBytes)
    return tooLarge();
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return NextResponse.json(
      { error: "Upload an image using multipart form data." },
      { status: 400 },
    );
  let file: FormDataEntryValue | null;
  try {
    const reader = request.body?.getReader();
    if (!reader)
      return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) {
        await reader.cancel();
        return tooLarge();
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
    file = form.get("image");
  } catch {
    return NextResponse.json(
      { error: "Invalid image upload." },
      { status: 400 },
    );
  }
  if (!(file instanceof File) || !file.size)
    return NextResponse.json({ error: "Choose an image." }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return tooLarge();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageExtension(bytes))
    return NextResponse.json(
      { error: "Choose a PNG, JPEG, GIF or WebP image." },
      { status: 415 },
    );
  try {
    const id = await saveImage(bytes);
    return NextResponse.json(
      { id, name: file.name.slice(0, 120) || "Image" },
      { status: 201 },
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    console.error("Image storage failed", error);
    if (["EROFS", "EACCES", "EPERM", "ENOTDIR"].includes(code || "")) {
      return NextResponse.json(
        {
          error:
            "Image storage is not writable on this server. Set IMAGE_STORAGE_DIR to a writable, persistent folder and restart the app.",
          code: "IMAGE_STORAGE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }
    if (["ENOSPC", "EDQUOT"].includes(code || "")) {
      return NextResponse.json(
        {
          error:
            "The server’s image storage is full. Free disk space before retrying.",
          code: "IMAGE_STORAGE_FULL",
        },
        { status: 507 },
      );
    }
    return NextResponse.json(
      {
        error:
          "Unable to store this image. Check the server log for the storage error.",
        code: "IMAGE_STORAGE_FAILED",
      },
      { status: 500 },
    );
  }
}
