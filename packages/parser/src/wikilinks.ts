import type { WikiLink } from "./types.js";

// Matches ![[embed]] and [[wikilink]] and [[wikilink|alias]]
const WIKILINK_REGEX = /(!?)\[\[([^\]]+)\]\]/g;

export function extractWikilinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;

  WIKILINK_REGEX.lastIndex = 0;
  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    const isEmbed = match[1] === "!";
    const inner = match[2];
    const pipeIdx = inner.indexOf("|");
    if (pipeIdx !== -1) {
      links.push({
        target: inner.slice(0, pipeIdx).trim(),
        alias: inner.slice(pipeIdx + 1).trim(),
        isEmbed,
      });
    } else {
      links.push({ target: inner.trim(), isEmbed });
    }
  }

  return links;
}

/**
 * Slugifies a wikilink target to a URL-safe path segment.
 * "My Note Title" -> "my-note-title"
 */
export function slugify(target: string): string {
  return target
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveWikilinks(links: string[]): string[] {
  return links.map(slugify);
}
