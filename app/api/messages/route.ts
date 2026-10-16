import { NextResponse } from "next/server";
import { getPusher, validRoom, validUser } from "@/lib/chat";
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
    !body.text.trim() ||
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
  const pusher = getPusher();
  if (!pusher)
    return NextResponse.json(
      { error: "Chat is not configured yet." },
      { status: 503 },
    );
  const payload: Message = {
    id: crypto.randomUUID(),
    room: body.room,
    user: body.user.trim(),
    text: body.text.trim(),
    timestamp: new Date().toISOString(),
  };
  try {
    await pusher.trigger(`presence-room-${body.room}`, "new-message", payload);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Message could not be delivered. Please try again." },
      { status: 502 },
    );
  }
}
