import { describe, it, expect } from "vitest";
import {
  hasPublishTrue,
  parseFrontmatter,
  filterChanged,
} from "../scanner.js";
import type { ScannedNote, PushCache } from "../scanner.js";

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe("parseFrontmatter", () => {
  it("detects publish:true", () => {
    const fm = parseFrontmatter("---\npublish: true\n---\nBody.");
    expect(fm.publishTrue).toBe(true);
    expect(fm.publishFalse).toBe(false);
  });

  it("detects publish:false", () => {
    const fm = parseFrontmatter("---\npublish: false\n---\nBody.");
    expect(fm.publishTrue).toBe(false);
    expect(fm.publishFalse).toBe(true);
  });

  it("returns neither when publish is absent", () => {
    const fm = parseFrontmatter("---\ntitle: My Note\n---\nBody.");
    expect(fm.publishTrue).toBe(false);
    expect(fm.publishFalse).toBe(false);
  });

  it("parses permalink", () => {
    const fm = parseFrontmatter("---\npermalink: about\n---\nBody.");
    expect(fm.permalink).toBe("about");
  });

  it("strips quotes from permalink", () => {
    const fm = parseFrontmatter('---\npermalink: "my/custom/url"\n---\nBody.');
    expect(fm.permalink).toBe("my/custom/url");
  });

  it("parses title", () => {
    const fm = parseFrontmatter("---\ntitle: My Great Post\n---\nBody.");
    expect(fm.title).toBe("My Great Post");
  });

  it("parses description", () => {
    const fm = parseFrontmatter("---\ndescription: A short blurb.\n---\nBody.");
    expect(fm.description).toBe("A short blurb.");
  });

  it("parses image", () => {
    const fm = parseFrontmatter("---\nimage: attachments/hero.png\n---\nBody.");
    expect(fm.image).toBe("attachments/hero.png");
  });

  it("parses cover as image fallback", () => {
    const fm = parseFrontmatter("---\ncover: attachments/cover.png\n---\nBody.");
    expect(fm.image).toBe("attachments/cover.png");
  });

  it("image takes precedence over cover", () => {
    const fm = parseFrontmatter(
      "---\nimage: img.png\ncover: cover.png\n---\nBody."
    );
    expect(fm.image).toBe("img.png");
  });

  it("returns no fields when there is no frontmatter", () => {
    const fm = parseFrontmatter("Just body text.");
    expect(fm.publishTrue).toBe(false);
    expect(fm.permalink).toBeUndefined();
    expect(fm.description).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// hasPublishTrue (legacy wrapper)
// ---------------------------------------------------------------------------

describe("hasPublishTrue", () => {
  it("returns true when frontmatter has publish: true", () => {
    expect(hasPublishTrue("---\ntitle: x\npublish: true\n---\nBody.")).toBe(true);
  });

  it("returns false when publish is false", () => {
    expect(hasPublishTrue("---\npublish: false\n---\nBody.")).toBe(false);
  });

  it("returns false when no publish key", () => {
    expect(hasPublishTrue("---\ntags: [a, b]\n---\nBody.")).toBe(false);
  });

  it("returns false with no frontmatter", () => {
    expect(hasPublishTrue("Just body text.")).toBe(false);
  });

  it("returns true with extra whitespace around value", () => {
    expect(hasPublishTrue("---\npublish:   true\n---\nBody.")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterChanged
// ---------------------------------------------------------------------------

const makeNote = (vaultPath: string, sha256: string): ScannedNote => ({
  absolutePath: `/vault/${vaultPath}.md`,
  slug: vaultPath,
  vaultPath,
  content: "content",
  sha256,
  meta: {},
});

describe("filterChanged", () => {
  it("returns all notes when cache is empty", () => {
    const notes = [makeNote("note-a", "aaa"), makeNote("note-b", "bbb")];
    expect(filterChanged(notes, {})).toHaveLength(2);
  });

  it("skips notes whose sha256 matches the cache", () => {
    const notes = [makeNote("note-a", "aaa"), makeNote("note-b", "bbb")];
    const cache: PushCache = { "note-a": "aaa" };
    const result = filterChanged(notes, cache);
    expect(result).toHaveLength(1);
    expect(result[0].vaultPath).toBe("note-b");
  });

  it("returns note when sha256 has changed", () => {
    const notes = [makeNote("note-a", "new-sha")];
    const cache: PushCache = { "note-a": "old-sha" };
    expect(filterChanged(notes, cache)).toHaveLength(1);
  });

  it("returns empty array when all notes are unchanged", () => {
    const notes = [makeNote("note-a", "aaa"), makeNote("note-b", "bbb")];
    const cache: PushCache = { "note-a": "aaa", "note-b": "bbb" };
    expect(filterChanged(notes, cache)).toHaveLength(0);
  });

  it("uses vaultPath for cache key, not slug (permalink case)", () => {
    const note: ScannedNote = {
      absolutePath: "/vault/notes/my-post.md",
      slug: "about",           // permalink overrides slug
      vaultPath: "notes/my-post",
      content: "content",
      sha256: "sha1",
      meta: {},
    };
    const cache: PushCache = { "notes/my-post": "sha1" }; // keyed by vaultPath
    expect(filterChanged([note], cache)).toHaveLength(0);  // unchanged
  });
});
