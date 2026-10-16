"use client";
import { useId, useRef, useState, useMemo, useDeferredValue } from "react";
import {
  parseEmoji,
  emojiOnlyCount,
  searchEmoji,
  emojiCategories,
} from "@/lib/emoji";
import { MessageText } from "@/components/message-text";
export function EmojiPicker({
  onInsert,
}: {
  onInsert: (emoji: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(-1);
  const [tone, setTone] = useState(0);
  const [limit, setLimit] = useState(96);
  const deferredQuery = useDeferredValue(query);
  const choices = useMemo(
    () => searchEmoji(deferredQuery, category, tone),
    [deferredQuery, category, tone],
  );
  function insert(emoji: string) {
    dialog.current?.close();
    onInsert(emoji);
    setCode("");
    setError("");
  }
  function insertCustom() {
    const parts = parseEmoji(code.trim());
    if (!emojiOnlyCount(parts)) {
      setError(
        "Enter an emoji, a shortcode such as :sob:, or a complete Discord custom emoji code.",
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
          <div className="emoji-search-controls">
            <label className="sr-only" htmlFor={`${heading}-search`}>
              Search all emoji
            </label>
            <input
              id={`${heading}-search`}
              type="search"
              value={query}
              placeholder="Search emoji or :shortcode:…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(96);
              }}
            />
            <div className="emoji-filters">
              <label>
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(Number(event.target.value));
                    setLimit(96);
                  }}
                >
                  {emojiCategories.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Skin tone
                <select
                  value={tone}
                  onChange={(event) => {
                    setTone(Number(event.target.value));
                    setLimit(96);
                  }}
                >
                  <option value={0}>Default</option>
                  <option value={1}>Light</option>
                  <option value={2}>Medium-light</option>
                  <option value={3}>Medium</option>
                  <option value={4}>Medium-dark</option>
                  <option value={5}>Dark</option>
                  <option value={-1}>All variants</option>
                </select>
              </label>
            </div>
          </div>
          <p className="emoji-result-count" role="status">
            {choices.length} emoji
            {query ? ` matching “${query}”` : " to explore"}
          </p>
          <div className="emoji-results">
            <div className="emoji-grid">
              {choices.slice(0, limit).map((emoji) => (
                <button
                  key={emoji.id}
                  type="button"
                  aria-label={`Insert ${emoji.label}`}
                  title={`${emoji.label}${emoji.aliases[0] ? ` · :${emoji.aliases[0]}:` : ""}`}
                  onClick={() => insert(emoji.native)}
                >
                  {emoji.native}
                </button>
              ))}
            </div>
            {choices.length === 0 && (
              <p className="emoji-no-results">
                No emoji found. Try a different name or category.
              </p>
            )}
            {choices.length > limit && (
              <button
                type="button"
                className="subtle emoji-load-more"
                onClick={() => setLimit((current) => current + 96)}
              >
                Show more ({choices.length - limit} remaining)
              </button>
            )}
          </div>
          <div className="custom-emoji-entry">
            <label htmlFor={`${heading}-code`}>
              Shortcode or Discord custom emoji
            </label>
            <p>
              Try :sob:, :heart:, or &lt;a:name:id&gt; for a custom animated
              emoji.
            </p>
            <input
              id={`${heading}-code`}
              value={code}
              maxLength={160}
              placeholder=":sob: or <:party:123456789012345678>"
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
              Insert emoji
            </button>
            <p className="emoji-note">
              Standard shortcodes work locally. Server-specific custom emoji
              need their full ID code and load from Discord.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
