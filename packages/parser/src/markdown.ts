import { slugify } from "./wikilinks.js";

/**
 * Converts Obsidian-flavored markdown to HTML.
 * Handles: wikilinks, embeds, callouts, bold, italic, code blocks,
 * inline code, headings, paragraphs, and horizontal rules.
 */
export function markdownToHtml(
  markdown: string,
  usernamePrefix: string = ""
): string {
  let html = markdown;

  // Fenced code blocks — preserve before other transforms
  const codeBlocks: string[] = [];
  html = html.replace(/```[\s\S]*?```/g, (block) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre><code>${escapeHtml(block.slice(3, -3).replace(/^\w+\n/, ""))}</code></pre>`
    );
    return `\x00CODE${idx}\x00`;
  });

  // Callouts: > [!type] Title
  html = html.replace(
    /^> \[!(\w+)\]\s*(.*)\n((?:^>.*\n?)*)/gm,
    (_, type, title, body) => {
      const cleanBody = body.replace(/^> ?/gm, "").trim();
      return `<div class="callout callout-${type.toLowerCase()}"><div class="callout-title">${escapeHtml(title)}</div><div class="callout-body">${escapeHtml(cleanBody)}</div></div>\n`;
    }
  );

  // Embeds: ![[file]]
  html = html.replace(/!\[\[([^\]]+)\]\]/g, (_, target) => {
    const slug = slugify(target);
    return `<div class="embed-note" data-slug="${slug}"><em>Embedded: ${escapeHtml(target)}</em></div>`;
  });

  // Wikilinks: [[Target|Alias]] and [[Target]]
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const pipeIdx = inner.indexOf("|");
    if (pipeIdx !== -1) {
      const target = inner.slice(0, pipeIdx).trim();
      const alias = inner.slice(pipeIdx + 1).trim();
      const slug = slugify(target);
      const href = usernamePrefix ? `/${usernamePrefix}/${slug}` : `/${slug}`;
      return `<a href="${href}" class="wikilink">${escapeHtml(alias)}</a>`;
    }
    const slug = slugify(inner.trim());
    const href = usernamePrefix ? `/${usernamePrefix}/${slug}` : `/${slug}`;
    return `<a href="${href}" class="wikilink">${escapeHtml(inner.trim())}</a>`;
  });

  // Headings
  html = html.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
    const level = hashes.length;
    return `<h${level}>${text}</h${level}>`;
  });

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr />");

  // Tags — make them span elements
  html = html.replace(
    /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g,
    (_, tag) => ` <span class="tag">#${tag}</span>`
  );

  // Paragraphs — wrap lines separated by blank lines
  const lines = html.split(/\n\n+/);
  html = lines
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Don't wrap HTML blocks or placeholders
      if (
        trimmed.startsWith("<") ||
        trimmed.startsWith("\x00CODE") ||
        trimmed.startsWith("\x00")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, " ")}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  // Restore code blocks
  html = html.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeBlocks[Number(idx)]);

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function countWords(text: string): number {
  const stripped = text
    .replace(/```[\s\S]*?```/g, "")        // fenced code blocks
    .replace(/`[^`]+`/g, "")               // inline code
    .replace(/!\[\[[^\]]+\]\]/g, "")       // embeds
    .replace(/\[\[[^\]]+\]\]/g, (m) => {   // wikilinks → alias or text
      const pipe = m.indexOf("|");
      return pipe !== -1 ? m.slice(pipe + 1, -2) : m.slice(2, -2);
    })
    .replace(/^#{1,6}\s+.+$/gm, "")        // headings (excluded from word count)
    .replace(/#[a-zA-Z][a-zA-Z0-9_/-]*/g, ""); // inline tags
  return stripped.trim().split(/\s+/).filter(Boolean).length;
}
