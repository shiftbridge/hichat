"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Pusher, { type PresenceChannel } from "pusher-js";
import type { Message } from "@/types/chat";

type Members = { each: (callback: (member: { id: string }) => void) => void };
const configured = Boolean(
  process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
);

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const username = useSearchParams().get("username")?.trim() || "";
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [sidebar, setSidebar] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(
    configured
      ? ""
      : "Chat isn’t configured yet. Add your Pusher credentials to enable conversations.",
  );
  const channel = useRef<PresenceChannel | null>(null);
  const typingAt = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (
      !username ||
      username.length > 15 ||
      !/^[a-z0-9_-]{1,20}$/.test(roomId)
    ) {
      router.replace("/");
      return;
    }
    if (!configured) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
        params: { username },
      },
    });
    const room = client.subscribe(`presence-room-${roomId}`) as PresenceChannel;
    channel.current = room;
    client.connection.bind(
      "state_change",
      ({ current }: { current: string }) => {
        if (current !== "connected") setConnected(false);
      },
    );
    room.bind("pusher:subscription_succeeded", (roster: Members) => {
      const names: string[] = [];
      roster.each((member) => names.push(member.id));
      setMembers(names);
      setConnected(true);
      setError("");
    });
    room.bind("pusher:subscription_error", ({ status }: { status: number }) => {
      setConnected(false);
      if (status === 403) router.replace("/?error=taken");
      else
        setError(
          "Unable to join this room. Check your connection and try reloading.",
        );
    });
    room.bind("pusher:member_added", ({ id }: { id: string }) =>
      setMembers((prev) => (prev.includes(id) ? prev : [...prev, id])),
    );
    room.bind("pusher:member_removed", ({ id }: { id: string }) => {
      setMembers((prev) => prev.filter((name) => name !== id));
      setTyping((prev) => prev.filter((name) => name !== id));
    });
    room.bind("new-message", (message: Message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
      setTyping((prev) => prev.filter((name) => name !== message.user));
    });
    room.bind("client-typing", (data: { user?: string }) => {
      const name = data.user;
      if (!name || name === username) return;
      setTyping((prev) => (prev.includes(name) ? prev : [...prev, name]));
      clearTimeout(timers.get(name));
      timers.set(
        name,
        setTimeout(() => {
          setTyping((prev) => prev.filter((n) => n !== name));
          timers.delete(name);
        }, 2500),
      );
    });
    return () => {
      timers.forEach(clearTimeout);
      channel.current = null;
      room.unbind_all();
      client.unsubscribe(room.name);
      client.disconnect();
    };
  }, [roomId, username, router]);

  useEffect(() => {
    if (follow.current)
      bottom.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [messages, typing]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebar(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  async function send(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || !connected || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, user: username, text }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Unable to send your message.");
      }
      setInput((current) => (current.trim() === text ? "" : current));
      follow.current = true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to send. Please try again.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <main className="chat-shell">
      <aside className="rail">
        <Link className="brand-icon" href="/" aria-label="HiChat home">
          h<span>•</span>
        </Link>
        <span className="rail-room">#</span>
        <span className="rail-bottom">✦</span>
      </aside>
      <section className="chat-main">
        <header className="chat-header">
          <div>
            <div className="eyebrow">YOUR CONVERSATION SPACE</div>
            <h1>
              <span className="accent">#</span> {roomId}
            </h1>
          </div>
          <button
            className="subtle member-toggle"
            onClick={() => setSidebar(!sidebar)}
            aria-expanded={sidebar}
            aria-controls="members"
          >
            <i className={`status-dot ${connected ? "" : "offline"}`} />
            {connected ? `${members.length} online` : "Offline"}
            <span> ☷</span>
          </button>
        </header>
        <div
          className="message-scroll"
          ref={scroll}
          onScroll={() => {
            const el = scroll.current;
            if (el)
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }}
        >
          <div className={`room-welcome ${messages.length ? "compact" : ""}`}>
            <div className="welcome-symbol">#</div>
            <span className="eyebrow">A NEW CONVERSATION AWAITS</span>
            <h2>Welcome to {roomId}.</h2>
            <p>
              This is your space to connect. Say hello and see where the
              conversation takes you.
            </p>
            <span className="welcome-rule">
              The beginning of something good
            </span>
          </div>
          {messages.map((message) => (
            <article
              key={message.id}
              className={`message enter ${message.user === username ? "mine" : ""}`}
            >
              <div className="message-meta">
                <span>{message.user === username ? "You" : message.user}</span>
                <time>
                  {Number.isNaN(Date.parse(message.timestamp))
                    ? message.timestamp
                    : new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </time>
              </div>
              <div className="bubble">{message.text}</div>
            </article>
          ))}
          <div className="typing" role="status">
            {typing.length > 0 && (
              <>
                <span className="typing-dots">•••</span> {typing.join(", ")}{" "}
                {typing.length === 1 ? "is" : "are"} typing
              </>
            )}
          </div>
          <div ref={bottom} />
        </div>
        <div className="composer-wrap">
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <form className="composer" onSubmit={send}>
            <input
              aria-label={`Message ${roomId}`}
              placeholder={
                connected ? `Message #${roomId}…` : "Waiting for connection…"
              }
              value={input}
              maxLength={2000}
              onChange={(event) => {
                setInput(event.target.value);
                if (
                  connected &&
                  channel.current &&
                  Date.now() - typingAt.current > 1000
                ) {
                  channel.current.trigger("client-typing", { user: username });
                  typingAt.current = Date.now();
                }
              }}
            />
            <button
              className="primary"
              disabled={!input.trim() || !connected || sending}
              aria-label="Send message"
            >
              {sending ? "…" : "↑"}
            </button>
          </form>
          <div className="composer-caption">
            <span>Good conversations start with kindness.</span>
            <span>
              {input.length ? `${input.length}/2000` : "Enter to send ↵"}
            </span>
          </div>
        </div>
      </section>
      {sidebar && (
        <button
          className="drawer-overlay"
          aria-label="Close members"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside id="members" className={`members-panel ${sidebar ? "open" : ""}`}>
        <div className="members-heading">
          <span className="eyebrow">
            IN THIS ROOM <span>{connected ? members.length : 0}</span>
          </span>
          <button
            className="drawer-close subtle"
            onClick={() => setSidebar(false)}
            aria-label="Close members"
          >
            ×
          </button>
        </div>
        <div className="roster">
          {connected ? (
            members.map((name) => (
              <div className="member" key={name}>
                <div className="avatar">
                  {name.charAt(0).toUpperCase()}
                  <i className="status-dot" />
                </div>
                <div>
                  <strong>{name}</strong>
                  <small>
                    {name === username
                      ? "You, making connections"
                      : "Here for the conversation"}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">
              {configured
                ? "Connecting to your room…"
                : "Members will appear once chat is configured."}
            </p>
          )}
        </div>
        <div className="room-note">
          <span>✦</span>
          <h3>A little room. A lot of possibility.</h3>
          <p>
            Share this room name with a friend to bring them into the
            conversation.
          </p>
        </div>
        <Link className="leave-link" href="/">
          ↖ Leave room
        </Link>
      </aside>
    </main>
  );
}
export default function ChatRoomPage() {
  return (
    <Suspense fallback={<main className="loading">Opening your room…</main>}>
      <Room />
    </Suspense>
  );
}
