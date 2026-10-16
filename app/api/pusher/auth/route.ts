import { NextResponse } from "next/server";
import { getPusher, validRoom, validUser } from "@/lib/chat";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const socketId = formData.get("socket_id") as string;
    const channelName = formData.get("channel_name") as string;
    const username = formData.get("username") as string; // Passed from frontend

    if (
      typeof socketId !== "string" ||
      !/^\d+\.\d+$/.test(socketId) ||
      typeof channelName !== "string" ||
      !channelName.startsWith("presence-room-") ||
      !validRoom(channelName.slice(14)) ||
      !validUser(username)
    ) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 },
      );
    }

    const pusher = getPusher();
    if (!pusher)
      return NextResponse.json(
        { error: "Chat is not configured yet." },
        { status: 503 },
      );

    // 1. Check if the username is already taken in this specific channel
    const channelInfo = await pusher.get({
      path: `/channels/${channelName}/users`,
    });

    if (channelInfo.status !== 200)
      return NextResponse.json(
        { error: "Unable to verify room members." },
        { status: 502 },
      );
    if (channelInfo.status === 200) {
      const result = await channelInfo.json();
      const existingUsers = result.users.map((u: { id: string }) =>
        u.id.toLowerCase(),
      );

      if (existingUsers.includes(username.toLowerCase().trim())) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 403 },
        );
      }
    }

    // 2. Authorize the presence channel with custom user data
    const presenceData = {
      user_id: username.trim(), // Unique ID used to identify the user
      user_info: { name: username.trim() },
    };

    const authResponse = pusher.authorizeChannel(
      socketId,
      channelName,
      presenceData,
    );
    return NextResponse.json(authResponse);
  } catch {
    return NextResponse.json(
      { error: "Unable to join the room. Please try again." },
      { status: 500 },
    );
  }
}
