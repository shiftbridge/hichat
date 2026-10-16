export interface ChatGif {
  provider: "giphy" | "klipy";
  url: string;
  preview: string;
  title: string;
  pageUrl: string;
}
function providerUrl(value: unknown, provider: ChatGif["provider"]) {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    const domain = provider === "giphy" ? "giphy.com" : "klipy.com";
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === domain || url.hostname.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}
export function validGif(value: unknown): value is ChatGif {
  if (!value || typeof value !== "object") return false;
  const gif = value as ChatGif;
  return (
    ["giphy", "klipy"].includes(gif.provider) &&
    typeof gif.title === "string" &&
    gif.title.length <= 120 &&
    providerUrl(gif.url, gif.provider) &&
    providerUrl(gif.preview, gif.provider) &&
    providerUrl(gif.pageUrl, gif.provider)
  );
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
export function normalizeGifs(
  body: unknown,
  provider: ChatGif["provider"],
): ChatGif[] {
  const root = record(body);
  const entries = provider === "giphy" ? root.data : record(root.data).data;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    const item = record(entry);
    if (item.type === "ad") return [];
    const images = record(item.images);
    const files = record(item.file);
    const media =
      provider === "giphy"
        ? record(images.fixed_width)
        : record(record(files.md || files.hd || files.sm).gif);
    const original = provider === "giphy" ? record(images.original) : media;
    const url = media.url || original.url;
    const gif = {
      provider,
      url,
      preview:
        provider === "giphy"
          ? record(images.fixed_width_still).url || url
          : item.preview_url || url,
      title: String(item.title || "GIF").slice(0, 120),
      pageUrl:
        item.url ||
        (provider === "klipy" && typeof item.slug === "string"
          ? `https://klipy.com/gifs/${encodeURIComponent(item.slug)}`
          : url),
    };
    return validGif(gif) ? [gif] : [];
  });
}
