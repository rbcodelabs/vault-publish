export type { WikiLink, ParsedNote, ASTNode } from "./types.js";
export { resolveWikilinks, slugify } from "./wikilinks.js";

import { parseFrontmatter } from "./frontmatter.js";
import { extractWikilinks } from "./wikilinks.js";
import { extractBodyTags, extractFrontmatterTags } from "./tags.js";
import { markdownToHtml, countWords } from "./markdown.js";
import type { ParsedNote } from "./types.js";

/**
 * Parses Obsidian-flavored markdown into a structured ParsedNote.
 *
 * @param content - raw markdown string
 * @param usernamePrefix - optional username for generating wikilink hrefs
 */
export function parseObsidianMarkdown(
  content: string,
  usernamePrefix: string = ""
): ParsedNote {
  const { frontmatter, body } = parseFrontmatter(content);
  const wikilinks = extractWikilinks(body);
  const embeds = wikilinks.filter((l) => l.isEmbed).map((l) => l.target);
  const bodyTags = extractBodyTags(body);
  const fmTags = extractFrontmatterTags(frontmatter);
  const tags = [...new Set([...fmTags, ...bodyTags])];
  const wordCount = countWords(body);
  const html = markdownToHtml(body, usernamePrefix);

  // Title: frontmatter title > first H1 > empty string
  let title = "";
  if (typeof frontmatter["title"] === "string") {
    title = frontmatter["title"];
  } else {
    const h1Match = /^#\s+(.+)$/m.exec(body);
    if (h1Match) title = h1Match[1];
  }

  return { frontmatter, html, wikilinks, embeds, tags, wordCount, title };
}
