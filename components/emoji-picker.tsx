"use client";
import { useId, useRef, useState } from "react";
import { parseEmoji } from "@/lib/emoji";
import { MessageText } from "@/components/message-text";
const choices = [
  "😀",
  "😄",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🤔",
  "😭",
  "😎",
  "💀",
  "❤️",
  "🔥",
  "🎉",
  "✨",
  "👋",
  "👍",
  "👏",
  "🙏",
  "👀",
  "🚀",
];
export function EmojiPicker({
  onInsert,
}: {
  onInsert: (emoji: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function insert(emoji: string) {
    dialog.current?.close();
    onInsert(emoji);
    setCode("");
    setError("");
  }
  function insertCustom() {
    const parts = parseEmoji(code.trim());
    if (parts.length !== 1 || parts[0].type !== "custom") {
      setError(
        "Paste a complete Discord custom emoji code, including its numeric ID.",
      );
      return;
    }
    insert(code.trim());
  }
  return (
    <>
      <button
        type="button"
        className="attach-button"
        aria-label="Choose emoji"
        title="Emoji and Discord custom emoji"
        onClick={() => dialog.current?.showModal()}
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14a4.5 4.5 0 0 0 8 0" />
          <path d="M8.5 8.5h.01M15.5 8.5h.01" strokeWidth="3" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        className="emoji-dialog"
        aria-labelledby={heading}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="emoji-picker-content">
          <header>
            <h2 id={heading}>Say it with an emoji</h2>
            <button
              className="subtle"
              type="button"
              aria-label="Close emoji picker"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="emoji-grid">
            {choices.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Insert ${emoji}`}
                onClick={() => insert(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="custom-emoji-entry">
            <label htmlFor={`${heading}-code`}>Discord custom emoji</label>
            <p>Paste a code such as &lt;:name:id&gt; or &lt;a:name:id&gt;.</p>
            <input
              id={`${heading}-code`}
              value={code}
              maxLength={80}
              placeholder="<:party:123456789012345678>"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertCustom();
                }
              }}
              onChange={(event) => {
                setCode(event.target.value);
                setError("");
              }}
            />
            <div className="emoji-preview">
              <MessageText text={code} />
            </div>
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
            <button type="button" className="primary" onClick={insertCustom}>
              Insert custom emoji
            </button>
            <p className="emoji-note">
              Custom emoji images load from Discord. Names alone, like :party:,
              need a full custom code.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
