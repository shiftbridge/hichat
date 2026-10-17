"use client";
import { useId, useRef, useState } from "react";
import { validGif, type ChatGif } from "@/lib/gifs";
export function GifPicker({
  onSelect,
  disabled,
}: {
  onSelect: (gif: ChatGif) => void;
  disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [provider, setProvider] = useState<ChatGif["provider"]>("giphy");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatGif[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  async function search(selected: ChatGif["provider"] | null = provider) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError("");
    setResults([]);
    const url = new URL("/api/gifs", window.location.origin);
    if (selected) url.searchParams.set("provider", selected);
    if (query.trim()) url.searchParams.set("q", query.trim());
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to search GIFs.");
      if (!controller.signal.aborted) {
        setResults(
          Array.isArray(body.results) ? body.results.filter(validGif) : [],
        );
        if (body.provider === "giphy" || body.provider === "klipy")
          setProvider(body.provider);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error ? error.message : "Unable to search GIFs.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="attach-button gif-trigger"
        disabled={disabled}
        aria-label="Choose GIF"
        title="Search GIPHY or KLIPY"
        onClick={() => {
          dialog.current?.showModal();
          void search(null);
        }}
      >
        GIF
      </button>
      <dialog
        ref={dialog}
        className="emoji-dialog gif-dialog"
        aria-labelledby={id}
        onClose={() => active.current?.abort()}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="emoji-picker-content">
          <header>
            <h2 id={id}>Find the perfect GIF</h2>
            <button
              className="subtle"
              type="button"
              aria-label="Close GIF picker"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <div className="gif-search">
            <label className="sr-only" htmlFor={`${id}-provider`}>
              GIF provider
            </label>
            <select
              id={`${id}-provider`}
              value={provider}
              onChange={(event) => {
                const next = event.target.value as ChatGif["provider"];
                setProvider(next);
                void search(next);
              }}
            >
              <option value="giphy">GIPHY</option>
              <option value="klipy">KLIPY</option>
            </select>
            <label className="sr-only" htmlFor={`${id}-search`}>
              Search GIFs
            </label>
            <input
              id={`${id}-search`}
              type="search"
              placeholder={
                provider === "klipy" ? "Search KLIPY" : "Search GIPHY"
              }
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void search();
                }
              }}
            />
            <button
              type="button"
              className="subtle"
              onClick={() => void search()}
            >
              Search
            </button>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          <p className="gif-status" role="status">
            {loading
              ? "Finding GIFs…"
              : results.length
                ? `${results.length} GIFs · Tap to attach`
                : error
                  ? ""
                  : "No GIFs found. Try another search."}
          </p>
          <div className="gif-results">
            {results.map((gif) => (
              <button
                key={gif.url}
                type="button"
                aria-label={`Attach ${gif.title}`}
                onClick={() => {
                  onSelect(gif);
                  dialog.current?.close();
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.url}
                  alt={gif.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </button>
            ))}
          </div>
          <a
            className="gif-attribution"
            href={
              provider === "giphy" ? "https://giphy.com" : "https://klipy.com"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by {provider.toUpperCase()} ↗
          </a>
        </div>
      </dialog>
    </>
  );
}
