import { describe, it, expect } from "vitest";
import { parseObsidianMarkdown, resolveWikilinks } from "../index.js";

describe("parseObsidianMarkdown", () => {
  it("extracts frontmatter correctly", () => {
    const md = `---
title: My Note
tags: [research, ai]
publish: true
---

Body text here.`;
    const result = parseObsidianMarkdown(md);
    expect(result.frontmatter["title"]).toBe("My Note");
    expect(result.frontmatter["tags"]).toEqual(["research", "ai"]);
    expect(result.frontmatter["publish"]).toBe(true);
  });

  it("returns title from frontmatter", () => {
    const md = `---
title: Frontmatter Title
---
# H1 Title`;
    expect(parseObsidianMarkdown(md).title).toBe("Frontmatter Title");
  });

  it("falls back to H1 for title when no frontmatter title", () => {
    const md = `---
publish: true
---
# My H1 Title

Some body.`;
    expect(parseObsidianMarkdown(md).title).toBe("My H1 Title");
  });

  it("extracts wikilinks", () => {
    const md = `Check out [[Another Note]] and [[Third Note|Alias]] for more.`;
    const result = parseObsidianMarkdown(md);
    expect(result.wikilinks).toHaveLength(2);
    expect(result.wikilinks[0]).toMatchObject({ target: "Another Note", isEmbed: false });
    expect(result.wikilinks[1]).toMatchObject({ target: "Third Note", alias: "Alias", isEmbed: false });
  });

  it("extracts embeds", () => {
    const md = `![[my-image.png]] is embedded here.`;
    const result = parseObsidianMarkdown(md);
    expect(result.embeds).toEqual(["my-image.png"]);
  });

  it("extracts body tags", () => {
    const md = `Some text with #research and #ai/ml tags.`;
    const result = parseObsidianMarkdown(md);
    expect(result.tags).toContain("research");
    expect(result.tags).toContain("ai/ml");
  });

  it("merges frontmatter and body tags", () => {
    const md = `---
tags: [meta]
---
Body has #extra tag.`;
    const result = parseObsidianMarkdown(md);
    expect(result.tags).toContain("meta");
    expect(result.tags).toContain("extra");
  });

  it("counts words correctly", () => {
    const md = `---
title: Test
---
One two three four five.`;
    const result = parseObsidianMarkdown(md);
    expect(result.wordCount).toBe(5);
  });

  it("renders wikilinks as anchors in HTML", () => {
    const md = `See [[Target Note]] for details.`;
    const result = parseObsidianMarkdown(md, "alice");
    expect(result.html).toContain('href="/alice/target-note"');
    expect(result.html).toContain("Target Note");
  });

  it("renders wikilink aliases in HTML", () => {
    const md = `See [[Target Note|click here]] for details.`;
    const result = parseObsidianMarkdown(md, "alice");
    expect(result.html).toContain("click here");
    expect(result.html).toContain('href="/alice/target-note"');
  });

  it("handles document with no frontmatter", () => {
    const md = `# Plain Note\n\nJust text.`;
    const result = parseObsidianMarkdown(md);
    expect(result.frontmatter).toEqual({});
    expect(result.title).toBe("Plain Note");
    expect(result.wordCount).toBe(2);
  });
});

describe("resolveWikilinks", () => {
  it("slugifies link targets", () => {
    expect(resolveWikilinks(["My Note Title", "Another Note"])).toEqual([
      "my-note-title",
      "another-note",
    ]);
  });

  it("handles special characters", () => {
    expect(resolveWikilinks(["Note: With Colon"])).toEqual(["note-with-colon"]);
  });
});
