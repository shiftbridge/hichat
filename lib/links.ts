export type LinkPart = { text: string; href?: string };
export function parseLinks(text: string): LinkPart[] {
  const result: LinkPart[] = [];
  let offset = 0;
  for (const match of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gi)) {
    let url = match[0].replace(/[.,!?;:]+$/, "");
    while (
      url.endsWith(")") &&
      (url.match(/\)/g)?.length || 0) > (url.match(/\(/g)?.length || 0)
    )
      url = url.slice(0, -1);
    while (
      url.endsWith("]") &&
      (url.match(/\]/g)?.length || 0) > (url.match(/\[/g)?.length || 0)
    )
      url = url.slice(0, -1);
    const href = /^www\./i.test(url) ? `https://${url}` : url;
    try {
      const parsed = new URL(href);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      )
        continue;
    } catch {
      continue;
    }
    if (match.index! > offset)
      result.push({ text: text.slice(offset, match.index) });
    result.push({ text: url, href });
    offset = match.index! + url.length;
  }
  if (offset < text.length) result.push({ text: text.slice(offset) });
  return result;
}
