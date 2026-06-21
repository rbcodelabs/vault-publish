/**
 * Parses YAML-like frontmatter from the top of a markdown document.
 * Only handles the subset Obsidian actually uses: string, number, boolean,
 * and flat arrays. Does not require a full YAML parser dependency.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const FM_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = FM_REGEX.exec(content);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const raw = match[1];
  const body = content.slice(match[0].length);
  const frontmatter: Record<string, unknown> = {};

  for (const line of raw.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valueRaw = line.slice(colonIdx + 1).trim();
    if (!key) continue;
    frontmatter[key] = parseYamlValue(valueRaw);
  }

  return { frontmatter, body };
}

function parseYamlValue(raw: string): unknown {
  if (raw === "" || raw === "null" || raw === "~") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const num = Number(raw);
  if (!isNaN(num) && raw !== "") return num;
  // Inline array: [a, b, c]
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((s) => parseYamlValue(s.trim()));
  }
  // Strip surrounding quotes
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}
