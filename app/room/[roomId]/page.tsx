"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Pusher, { type PresenceChannel } from "pusher-js";
import { encodeImage } from "@/lib/encode-image";
import { createImageReceiver, type ImageChunk } from "@/lib/image-transfer";
import type { Message } from "@/types/chat";
import { MessageText } from "@/components/message-text";
import { GifPicker } from "@/components/gif-picker";
import type { ChatGif } from "@/lib/gifs";
import { EmojiPicker } from "@/components/emoji-picker";
import { BrandMark } from "@/components/brand-mark";
import { SettingsMenu } from "@/components/settings-menu";
import {
  appendHistory,
  rememberRoom,
  useBrowserState,
} from "@/lib/browser-storage";

type Members = { each: (callback: (member: { id: string }) => void) => void };
const configured = Boolean(
  process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
);

const emptyMessages: Message[] = [];

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const username = useSearchParams().get("username")?.trim() || "";
  const router = useRouter();
  const { histories, preferences, warning } = useBrowserState();
  const messages = Object.hasOwn(histories, roomId)
    ? histories[roomId]
    : emptyMessages;
  const [input, setInput] = useState("");
  const [gif, setGif] = useState<ChatGif | null>(null);
  const [attachment, setAttachment] = useState<{
    file: File;
    id: string;
    data: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const preparation = useRef(0);
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const membersDialog = useRef<HTMLDialogElement>(null);
  const shell = useRef<HTMLElement>(null);
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
    rememberRoom(username, roomId);
    if (!configured) return;
    const receiver = createImageReceiver();
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
    room.bind("image-message-chunk", (chunk: ImageChunk) => {
      const message = receiver.receive(chunk);
      if (!message) return;
      appendHistory(message);
      setTyping((prev) => prev.filter((name) => name !== message.user));
    });
    room.bind("new-message", (message: Message) => {
      appendHistory(message);
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
      receiver.clear();
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
    const viewport = window.visualViewport;
    const mobile = window.matchMedia(
      "(max-width: 760px), (max-width: 1024px) and (max-height: 500px) and (pointer: coarse)",
    );
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (mobile.matches && viewport && viewport.scale === 1) {
          shell.current?.style.setProperty(
            "--chat-height",
            `${viewport.height}px`,
          );
          shell.current?.style.setProperty(
            "--chat-top",
            `${viewport.offsetTop}px`,
          );
          if (follow.current && scroll.current)
            scroll.current.scrollTop = scroll.current.scrollHeight;
        } else {
          shell.current?.style.removeProperty("--chat-height");
          shell.current?.style.removeProperty("--chat-top");
        }
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  async function selectImage(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
        file.type,
      )
    ) {
      setError("Choose a PNG, JPEG, GIF or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024 || !file.size) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    const attempt = ++preparation.current;
    setPreparing(true);
    setError("");
    try {
      const data = await encodeImage(file);
      if (attempt === preparation.current) {
        setAttachment({
          file,
          id: `${crypto.randomUUID()}.${data.startsWith("data:image/gif") ? "gif" : "webp"}`,
          data,
        });
        setGif(null);
      }
    } catch (error) {
      if (attempt === preparation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Unable to prepare this image.",
        );
    } finally {
      if (attempt === preparation.current) setPreparing(false);
    }
  }

  async function send(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    const draftAttachment = attachment;
    const draftGif = gif;
    if (
      (!text && !draftAttachment && !draftGif) ||
      !connected ||
      preparing ||
      sendingRef.current
    )
      return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    try {
      const image = draftAttachment
        ? {
            id: draftAttachment.id,
            name: draftAttachment.file.name.slice(0, 120),
            data: draftAttachment.data,
          }
        : undefined;
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          user: username,
          text,
          image,
          ...(draftGif ? { gif: draftGif } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Unable to send your message.");
      }
      setInput((current) => (current.trim() === text ? "" : current));
      setAttachment((current) =>
        current === draftAttachment ? null : current,
      );
      setGif((current) => (current === draftGif ? null : current));
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

  const memberContent = (
    <>
      <div className="members-heading">
        <span className="eyebrow">
          IN THIS ROOM <span>{connected ? members.length : 0}</span>
        </span>
        <button
          className="drawer-close subtle"
          onClick={() => membersDialog.current?.close()}
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
      {preferences.rooms.length > 1 && (
        <div className="sidebar-recents">
          <span className="eyebrow">RECENT ROOMS</span>
          {preferences.rooms
            .filter((name) => name !== roomId)
            .slice(0, 5)
            .map((room) => (
              <Link
                key={room}
                href={`/room/${encodeURIComponent(room)}?username=${encodeURIComponent(username)}`}
                onClick={() => membersDialog.current?.close()}
              >
                # {room}
                <span>↗</span>
              </Link>
            ))}
        </div>
      )}
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
    </>
  );

  return (
    <main className="chat-shell" ref={shell}>
      <aside className="rail">
        <Link className="brand-icon" href="/" aria-label="HiChat home">
          <BrandMark />
        </Link>
        <span className="rail-room">#</span>
        <div className="rail-recents">
          {preferences.rooms
            .filter((name) => name !== roomId)
            .slice(0, 5)
            .map((room) => (
              <Link
                key={room}
                href={`/room/${encodeURIComponent(room)}?username=${encodeURIComponent(username)}`}
                title={`Join ${room}`}
                aria-label={`Join ${room}`}
              >
                {room.slice(0, 2).toUpperCase()}
              </Link>
            ))}
        </div>
        <span className="rail-bottom">✦</span>
      </aside>
      <section className="chat-main">
        <header className="chat-header">
          <Link
            className="mobile-home brand-icon"
            href="/"
            aria-label="Go to home"
          >
            <BrandMark />
          </Link>
          <div className="room-title">
            <div className="eyebrow">YOUR CONVERSATION SPACE</div>
            <h1>
              <span className="accent">#</span> {roomId}
            </h1>
          </div>
          <div className="header-actions">
            <SettingsMenu />
            <button
              className="subtle member-toggle"
              onClick={() => membersDialog.current?.showModal()}
              aria-haspopup="dialog"
              aria-label="View room members and recent rooms"
              aria-controls="room-members"
            >
              <i className={`status-dot ${connected ? "" : "offline"}`} />
              {connected ? `${members.length} online` : "Offline"}
              <span> ☷</span>
            </button>
          </div>
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
              <div
                className={`bubble ${message.image || message.gif ? "image-bubble" : ""}`}
              >
                {message.image && (
                  <a
                    className="chat-image-link"
                    href={
                      message.image.data ||
                      `/api/images/${encodeURIComponent(message.image.id)}`
                    }
                    download={
                      message.image.data
                        ? message.image.data.startsWith("data:image/gif")
                          ? "chat-image.gif"
                          : "chat-image.webp"
                        : undefined
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${message.image.data ? "Save" : "Open"} image: ${message.image.name}`}
                  >
                    {/* Images are reconstructed in this browser; legacy uploads are served directly. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="chat-image"
                      src={
                        message.image.data ||
                        `/api/images/${encodeURIComponent(message.image.id)}`
                      }
                      alt={message.image.name}
                      loading="lazy"
                      onLoad={() => {
                        if (follow.current)
                          bottom.current?.scrollIntoView({
                            behavior: "instant",
                          });
                      }}
                      onError={(event) => {
                        event.currentTarget.alt = "Image unavailable";
                      }}
                    />
                    <span className="image-open">Save image ↓</span>
                  </a>
                )}
                {message.gif && (
                  <a
                    className="chat-image-link"
                    href={message.gif.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="chat-image"
                      src={message.gif.url}
                      alt={message.gif.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <span className="image-open">
                      GIF · {message.gif.provider.toUpperCase()} ↗
                    </span>
                  </a>
                )}
                {message.text && (
                  <div>
                    <MessageText text={message.text} />
                  </div>
                )}
              </div>
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
          {(error || warning) && (
            <div className="alert" role="alert">
              {error || warning}
            </div>
          )}
          {gif && (
            <div className="attachment-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gif.preview} alt={gif.title} />
              <div>
                <strong>{gif.title}</strong>
                <small>
                  GIF · {gif.provider.toUpperCase()} · Ready to send
                </small>
              </div>
              <button
                type="button"
                className="subtle"
                disabled={sending}
                aria-label="Remove GIF"
                onClick={() => setGif(null)}
              >
                ×
              </button>
            </div>
          )}
          {attachment && (
            <div className="attachment-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.data} alt="Selected attachment preview" />
              <div>
                <strong>{attachment.file.name}</strong>
                <small>
                  {sending
                    ? "Sending image…"
                    : `${Math.round((attachment.data.length * 0.75) / 1024)} KB · Ready to send`}
                </small>
              </div>
              <button
                type="button"
                className="subtle"
                disabled={sending || preparing}
                aria-label="Remove image"
                onClick={() => {
                  setAttachment(null);
                }}
              >
                ×
              </button>
            </div>
          )}
          <form className="composer" onSubmit={send}>
            <input
              className="image-file-input"
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              aria-label="Choose an image"
              tabIndex={-1}
              disabled={sending || preparing}
              onChange={(event) => {
                selectImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              className="attach-button"
              aria-label="Attach image"
              title="Attach image (up to 5 MB)"
              disabled={sending || preparing || !connected}
              onClick={() => fileInput.current?.click()}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="8" cy="8" r="1.5" />
                <path d="m3 17 5-5 4 4 4-6 5 7" />
              </svg>
            </button>
            <GifPicker
              disabled={sending || preparing || !connected}
              onSelect={(selected) => {
                setAttachment(null);
                setGif(selected);
              }}
            />
            <EmojiPicker
              onInsert={(emoji) => {
                const field = messageInput.current;
                const start = field?.selectionStart ?? input.length;
                const end = field?.selectionEnd ?? start;
                const next = input.slice(0, start) + emoji + input.slice(end);
                if (next.length > 2000) {
                  setError("Messages can contain up to 2,000 characters.");
                  return;
                }
                setInput(next);
                requestAnimationFrame(() => {
                  field?.focus();
                  field?.setSelectionRange(
                    start + emoji.length,
                    start + emoji.length,
                  );
                });
              }}
            />
            <input
              ref={messageInput}
              aria-label={`Message ${roomId}`}
              placeholder={
                connected ? `Message #${roomId}…` : "Waiting for connection…"
              }
              value={input}
              enterKeyHint="send"
              autoComplete="off"
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
              disabled={
                (!input.trim() && !attachment && !gif) ||
                !connected ||
                sending ||
                preparing
              }
              aria-label="Send message"
            >
              {sending ? "…" : "↑"}
            </button>
          </form>
          <div className="composer-caption">
            <span>
              {sending && attachment
                ? "Sending image…"
                : preparing
                  ? "Preparing image locally…"
                  : "Images up to 5 MB · Prepared in your browser"}
            </span>
            <span>
              {input.length ? `${input.length}/2000` : "Enter to send ↵"}
            </span>
          </div>
        </div>
      </section>
      <aside
        className="members-panel"
        aria-label="Room members and recent rooms"
      >
        {memberContent}
      </aside>
      <dialog
        id="room-members"
        className="room-drawer"
        ref={membersDialog}
        aria-label="Room members and recent rooms"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            membersDialog.current?.close();
        }}
      >
        <div className="drawer-content">{memberContent}</div>
      </dialog>
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
