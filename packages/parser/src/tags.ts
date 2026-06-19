/**
 * Extracts #tags from the body text.
 * Also merges tags from frontmatter `tags:` field.
 */
export function extractBodyTags(body: string): string[] {
  const TAG_REGEX = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g;
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = TAG_REGEX.exec(body)) !== null) {
    tags.push(match[1]);
  }
  return [...new Set(tags)];
}

export function extractFrontmatterTags(
  frontmatter: Record<string, unknown>
): string[] {
  const raw = frontmatter["tags"];
  if (!raw) return [];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.replace(/^#/, ""));
  }
  return [];
}
