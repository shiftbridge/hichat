import { NextResponse } from "next/server";
import { getPusher, validRoom, validUser } from "@/lib/chat";
import { loadImage, validImageId, imageExtension } from "@/lib/images";
import { chunkImage, validImageData } from "@/lib/image-transfer";
import type { Message } from "@/types/chat";

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body ||
    !validRoom(body.room) ||
    !validUser(body.user) ||
    typeof body.text !== "string" ||
    (!body.text.trim() && !body.image) ||
    body.text.length > 2000
  ) {
    return NextResponse.json(
      {
        error:
          "Provide a valid room, name and message (up to 2,000 characters).",
      },
      { status: 400 },
    );
  }
  if (
    body.image !== undefined &&
    (!body.image ||
      !validImageId(body.image.id) ||
      (body.image.data !== undefined && !validImageData(body.image.data)) ||
      typeof body.image.name !== "string" ||
      body.image.name.length > 120)
  ) {
    return NextResponse.json(
      { error: "Invalid image attachment." },
      { status: 400 },
    );
  }
  if (body.image?.data) {
    const bytes = Buffer.from(body.image.data.split(",")[1], "base64");
    if (!imageExtension(bytes))
      return NextResponse.json(
        { error: "Invalid image content." },
        { status: 400 },
      );
  }
  if (body.image && !body.image.data && !(await loadImage(body.image.id))) {
    return NextResponse.json(
      { error: "This image is no longer available. Please attach it again." },
      { status: 400 },
    );
  }
  const pusher = getPusher();
  if (!pusher)
    return NextResponse.json(
      { error: "Chat is not configured yet." },
      { status: 503 },
    );
  const payload: Message = {
    id: body.image?.data ? body.image.id.slice(0, 36) : crypto.randomUUID(),
    room: body.room,
    user: body.user.trim(),
    text: body.text.trim(),
    timestamp: new Date().toISOString(),
    ...(body.image
      ? {
          image: {
            id: body.image.id,
            name: body.image.name,
            ...(body.image.data ? { data: body.image.data } : {}),
          },
        }
      : {}),
  };
  try {
    if (payload.image?.data) {
      const chunks = chunkImage(payload);
      for (let index = 0; index < chunks.length; index += 10) {
        await pusher.triggerBatch(
          chunks.slice(index, index + 10).map((chunk) => ({
            channel: `presence-room-${body.room}`,
            name: "image-message-chunk",
            data: chunk,
          })),
        );
      }
    } else {
      await pusher.trigger(
        `presence-room-${body.room}`,
        "new-message",
        payload,
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Message could not be delivered. Please try again." },
      { status: 502 },
    );
  }
}
