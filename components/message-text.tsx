"use client";
import { parseLinks } from "@/lib/links";
import { useState } from "react";
import {
  discordEmojiUrl,
  parseEmoji,
  emojiOnlyCount,
  type EmojiPart,
} from "@/lib/emoji";
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
function InlineText({ text }: { text: string }) {
  const parts = parseEmoji(text);
  const count = emojiOnlyCount(parts);
  const large = count > 0 && count <= 6;
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

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {parseLinks(text).map((part, index) =>
        part.href ? (
          <a
            className="chat-link"
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {part.text}
          </a>
        ) : (
          <InlineText key={index} text={part.text} />
        ),
      )}
    </>
  );
}
