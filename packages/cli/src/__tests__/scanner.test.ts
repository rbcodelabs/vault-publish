import { describe, it, expect } from "@jest/globals";
import { hasPublishTrue, filterChanged } from "../scanner.js";
import type { ScannedNote, PushCache } from "../scanner.js";

describe("hasPublishTrue", () => {
  it("returns true when frontmatter has publish: true", () => {
    const md = `---
title: My Note
publish: true
---
Body text.`;
    expect(hasPublishTrue(md)).toBe(true);
  });

  it("returns false when publish is false", () => {
    const md = `---
title: My Note
publish: false
---
Body text.`;
    expect(hasPublishTrue(md)).toBe(false);
  });

  it("returns false when no publish key", () => {
    const md = `---
title: My Note
tags: [a, b]
---
Body text.`;
    expect(hasPublishTrue(md)).toBe(false);
  });

  it("returns false with no frontmatter", () => {
    expect(hasPublishTrue("Just body text.")).toBe(false);
  });

  it("returns true with extra whitespace around value", () => {
    const md = `---
title: My Note
publish:   true
---
Body.`;
    expect(hasPublishTrue(md)).toBe(true);
  });
});

describe("filterChanged", () => {
  const makeNote = (slug: string, sha256: string): ScannedNote => ({
    absolutePath: `/vault/${slug}.md`,
    slug,
    content: "content",
    sha256,
  });

  it("returns all notes when cache is empty", () => {
    const notes = [makeNote("note-a", "aaa"), makeNote("note-b", "bbb")];
    const result = filterChanged(notes, {});
    expect(result).toHaveLength(2);
  });

  it("skips notes whose sha256 matches the cache", () => {
    const notes = [makeNote("note-a", "aaa"), makeNote("note-b", "bbb")];
    const cache: PushCache = { "note-a": "aaa" };
    const result = filterChanged(notes, cache);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("note-b");
  });

  it("returns note when sha256 has changed", () => {
    const notes = [makeNote("note-a", "new-sha")];
    const cache: PushCache = { "note-a": "old-sha" };
    const result = filterChanged(notes, cache);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when all notes are unchanged", () => {
    const notes = [makeNote("note-a", "aaa"), makeNote("note-b", "bbb")];
    const cache: PushCache = { "note-a": "aaa", "note-b": "bbb" };
    expect(filterChanged(notes, cache)).toHaveLength(0);
  });
});
