"use client";
import { useState } from "react";
import { discordEmojiUrl, parseEmoji, type EmojiPart } from "@/lib/emoji";
function CustomEmoji({
  emoji,
}: {
  emoji: Extract<EmojiPart, { type: "custom" }>;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{emoji.value}</>;
  return (
    <picture>
      {emoji.animated && (
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet={discordEmojiUrl(emoji.id)}
        />
      )}
      {/* Discord serves these assets directly; failed/deleted emoji preserve their original text. */}
      <img
        className="discord-emoji"
        src={discordEmojiUrl(emoji.id, emoji.animated)}
        alt={`:${emoji.name}:`}
        title={`:${emoji.name}:`}
        width={24}
        height={24}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </picture>
  );
}
export function MessageText({ text }: { text: string }) {
  const parts = parseEmoji(text);
  const large =
    parts.some((part) => part.type === "custom") &&
    parts.filter((part) => part.type === "custom").length <= 6 &&
    parts.every((part) => part.type === "custom" || !part.value.trim());
  return (
    <span className={large ? "message-text emoji-only" : "message-text"}>
      {parts.map((part, index) =>
        part.type === "custom" ? (
          <CustomEmoji key={`${index}-${part.value}`} emoji={part} />
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </span>
  );
}
