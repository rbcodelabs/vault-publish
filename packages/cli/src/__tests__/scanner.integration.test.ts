/**
 * Integration tests for scanVault() against the real fixture test vault.
 *
 * Fixture structure at fixtures/test-vault/:
 *
 *   README.md                   — no frontmatter
 *   draft.md                    — publish: false (veto)
 *   Blog/
 *     hello-world.md            — no frontmatter
 *     second-post.md            — no frontmatter
 *     third-draft.md            — publish: false (veto even in included folder)
 *     2024/
 *       year-recap.md           — no frontmatter, nested
 *   Private/
 *     diary.md                  — no frontmatter
 *     public-anyway.md          — publish: true (overrides excluded folder)
 *   Pages/
 *     about-me.md               — publish: true, permalink: about, title, description, image
 *     contact.md                — publish: true, title
 *   Notes/
 *     linked-note.md            — publish: true, wikilinks
 *     tagged-note.md            — publish: true, tags
 *     cover-note.md             — publish: true, cover: (no image:)
 */

import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanVault } from "../scanner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VAULT = join(__dirname, "fixtures/test-vault");

// Helper: extract just the vaultPaths from scan results, sorted for stable assertions
function vaultPaths(notes: Awaited<ReturnType<typeof scanVault>>): string[] {
  return notes.map((n) => n.vaultPath).sort();
}
function slugs(notes: Awaited<ReturnType<typeof scanVault>>): string[] {
  return notes.map((n) => n.slug).sort();
}

// ---------------------------------------------------------------------------
// Default mode — only publish:true notes
// ---------------------------------------------------------------------------

describe("scanVault — default mode (publish:true required)", () => {
  it("returns only notes with explicit publish:true", async () => {
    const notes = await scanVault(VAULT);
    expect(vaultPaths(notes)).toEqual([
      "Notes/cover-note",
      "Notes/linked-note",
      "Notes/tagged-note",
      "Pages/about-me",
      "Pages/contact",
      "Private/public-anyway",
    ]);
  });

  it("excludes draft.md (publish:false)", async () => {
    const notes = await scanVault(VAULT);
    expect(notes.some((n) => n.vaultPath === "draft")).toBe(false);
  });

  it("excludes README.md (no frontmatter)", async () => {
    const notes = await scanVault(VAULT);
    expect(notes.some((n) => n.vaultPath === "README")).toBe(false);
  });

  it("excludes Blog/ notes that have no publish:true", async () => {
    const notes = await scanVault(VAULT);
    const blogNotes = notes.filter((n) => n.vaultPath.startsWith("Blog/"));
    expect(blogNotes).toHaveLength(0);
  });

  it("excludes Private/diary.md (no frontmatter, no publish:true)", async () => {
    const notes = await scanVault(VAULT);
    expect(notes.some((n) => n.vaultPath === "Private/diary")).toBe(false);
  });

  it("includes Private/public-anyway.md (publish:true overrides)", async () => {
    const notes = await scanVault(VAULT);
    expect(notes.some((n) => n.vaultPath === "Private/public-anyway")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// include-all mode
// ---------------------------------------------------------------------------

describe("scanVault — includeAll mode", () => {
  it("includes every note except those with publish:false", async () => {
    const notes = await scanVault(VAULT, { includeAll: true });
    // Total notes: 12. publish:false: draft.md + Blog/third-draft.md = 2 excluded.
    expect(vaultPaths(notes)).toEqual([
      "Blog/2024/year-recap",
      "Blog/hello-world",
      "Blog/second-post",
      "Notes/cover-note",
      "Notes/linked-note",
      "Notes/tagged-note",
      "Pages/about-me",
      "Pages/contact",
      "Private/diary",
      "Private/public-anyway",
      "README",
    ]);
  });

  it("still excludes draft.md with publish:false", async () => {
    const notes = await scanVault(VAULT, { includeAll: true });
    expect(notes.some((n) => n.vaultPath === "draft")).toBe(false);
  });

  it("still excludes Blog/third-draft.md with publish:false", async () => {
    const notes = await scanVault(VAULT, { includeAll: true });
    expect(notes.some((n) => n.vaultPath === "Blog/third-draft")).toBe(false);
  });

  it("includes README.md (no frontmatter, but includeAll is true)", async () => {
    const notes = await scanVault(VAULT, { includeAll: true });
    expect(notes.some((n) => n.vaultPath === "README")).toBe(true);
  });

  it("includes Private/diary.md (no veto, no excluded folder rule)", async () => {
    const notes = await scanVault(VAULT, { includeAll: true });
    expect(notes.some((n) => n.vaultPath === "Private/diary")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// includedFolders mode
// ---------------------------------------------------------------------------

describe("scanVault — includedFolders: ['Blog']", () => {
  it("includes Blog notes and publish:true notes, excludes vetoed and others", async () => {
    const notes = await scanVault(VAULT, { includedFolders: ["Blog"] });
    expect(vaultPaths(notes)).toEqual([
      "Blog/2024/year-recap",
      "Blog/hello-world",
      "Blog/second-post",
      "Notes/cover-note",
      "Notes/linked-note",
      "Notes/tagged-note",
      "Pages/about-me",
      "Pages/contact",
      "Private/public-anyway",
    ]);
  });

  it("excludes Blog/third-draft.md (publish:false veto wins)", async () => {
    const notes = await scanVault(VAULT, { includedFolders: ["Blog"] });
    expect(notes.some((n) => n.vaultPath === "Blog/third-draft")).toBe(false);
  });

  it("includes Blog/2024/year-recap.md via prefix match", async () => {
    const notes = await scanVault(VAULT, { includedFolders: ["Blog"] });
    expect(notes.some((n) => n.vaultPath === "Blog/2024/year-recap")).toBe(true);
  });

  it("excludes README.md (not in Blog, no publish:true)", async () => {
    const notes = await scanVault(VAULT, { includedFolders: ["Blog"] });
    expect(notes.some((n) => n.vaultPath === "README")).toBe(false);
  });

  it("includes Blog + Notes folders when both are listed", async () => {
    const notes = await scanVault(VAULT, { includedFolders: ["Blog", "Notes"] });
    const paths = vaultPaths(notes);
    expect(paths).toContain("Blog/hello-world");
    expect(paths).toContain("Notes/tagged-note");
    // README still excluded — not in either folder, no publish:true
    expect(paths).not.toContain("README");
  });
});

// ---------------------------------------------------------------------------
// excludedFolders mode
// ---------------------------------------------------------------------------

describe("scanVault — excludedFolders: ['Private']", () => {
  it("excludes Private/diary.md (in excluded folder, no publish:true)", async () => {
    const notes = await scanVault(VAULT, { excludedFolders: ["Private"] });
    expect(notes.some((n) => n.vaultPath === "Private/diary")).toBe(false);
  });

  it("includes Private/public-anyway.md (publish:true overrides exclusion)", async () => {
    const notes = await scanVault(VAULT, { excludedFolders: ["Private"] });
    expect(notes.some((n) => n.vaultPath === "Private/public-anyway")).toBe(true);
  });
});

describe("scanVault — includeAll + excludedFolders: ['Private']", () => {
  it("includes everything except publish:false and excluded-folder notes without override", async () => {
    const notes = await scanVault(VAULT, {
      includeAll: true,
      excludedFolders: ["Private"],
    });
    // Private/diary.md is excluded (excluded folder, no publish:true)
    // Private/public-anyway.md is INCLUDED (publish:true overrides)
    expect(vaultPaths(notes)).toEqual([
      "Blog/2024/year-recap",
      "Blog/hello-world",
      "Blog/second-post",
      "Notes/cover-note",
      "Notes/linked-note",
      "Notes/tagged-note",
      "Pages/about-me",
      "Pages/contact",
      "Private/public-anyway",
      "README",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Combined: includedFolders + excludedFolders
// ---------------------------------------------------------------------------

describe("scanVault — includedFolders: ['Blog', 'Notes'] + excludedFolders: ['Private']", () => {
  it("respects both rules simultaneously", async () => {
    const notes = await scanVault(VAULT, {
      includedFolders: ["Blog", "Notes"],
      excludedFolders: ["Private"],
    });
    expect(vaultPaths(notes)).toEqual([
      "Blog/2024/year-recap",
      "Blog/hello-world",
      "Blog/second-post",
      "Notes/cover-note",
      "Notes/linked-note",
      "Notes/tagged-note",
      "Pages/about-me",
      "Pages/contact",
      "Private/public-anyway",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Permalink — slug overrides vaultPath
// ---------------------------------------------------------------------------

describe("scanVault — permalink handling", () => {
  it("uses permalink as slug, keeps vaultPath as original", async () => {
    const notes = await scanVault(VAULT);
    const aboutMe = notes.find((n) => n.vaultPath === "Pages/about-me");
    expect(aboutMe).toBeDefined();
    expect(aboutMe!.slug).toBe("about");
    expect(aboutMe!.vaultPath).toBe("Pages/about-me");
    expect(aboutMe!.slug).not.toBe(aboutMe!.vaultPath);
  });

  it("notes without permalink have slug === vaultPath", async () => {
    const notes = await scanVault(VAULT);
    const contact = notes.find((n) => n.vaultPath === "Pages/contact");
    expect(contact).toBeDefined();
    expect(contact!.slug).toBe("Pages/contact");
    expect(contact!.slug).toBe(contact!.vaultPath);
  });

  it("the published slugs list includes 'about' (not 'Pages/about-me')", async () => {
    const notes = await scanVault(VAULT);
    expect(slugs(notes)).toContain("about");
    expect(slugs(notes)).not.toContain("Pages/about-me");
  });
});

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

describe("scanVault — meta extraction", () => {
  it("extracts title, description, and image from Pages/about-me.md", async () => {
    const notes = await scanVault(VAULT);
    const about = notes.find((n) => n.vaultPath === "Pages/about-me");
    expect(about!.meta.title).toBe("About Me");
    expect(about!.meta.description).toBe(
      "Builder, writer, and Obsidian enthusiast. This is my corner of the web."
    );
    expect(about!.meta.image).toBe("https://example.com/avatar.jpg");
  });

  it("extracts title from Pages/contact.md (no description or image)", async () => {
    const notes = await scanVault(VAULT);
    const contact = notes.find((n) => n.vaultPath === "Pages/contact");
    expect(contact!.meta.title).toBe("Get in Touch");
    expect(contact!.meta.description).toBeUndefined();
    expect(contact!.meta.image).toBeUndefined();
  });

  it("falls back to cover: when image: is absent (Notes/cover-note.md)", async () => {
    const notes = await scanVault(VAULT);
    const cover = notes.find((n) => n.vaultPath === "Notes/cover-note");
    expect(cover!.meta.image).toBe("https://example.com/cover-photo.jpg");
  });

  it("notes without any meta fields have empty meta object", async () => {
    const notes = await scanVault(VAULT, { includeAll: true });
    const readme = notes.find((n) => n.vaultPath === "README");
    expect(readme!.meta.title).toBeUndefined();
    expect(readme!.meta.description).toBeUndefined();
    expect(readme!.meta.image).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SHA-256 stability
// ---------------------------------------------------------------------------

describe("scanVault — sha256 content hashing", () => {
  it("produces a non-empty sha256 for every note", async () => {
    const notes = await scanVault(VAULT, { includeAll: true });
    for (const note of notes) {
      expect(note.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("two scans of the same vault produce identical sha256 values", async () => {
    const [a, b] = await Promise.all([
      scanVault(VAULT, { includeAll: true }),
      scanVault(VAULT, { includeAll: true }),
    ]);
    const hashA = new Map(a.map((n) => [n.vaultPath, n.sha256]));
    const hashB = new Map(b.map((n) => [n.vaultPath, n.sha256]));
    expect(Object.fromEntries(hashA)).toEqual(Object.fromEntries(hashB));
  });
});
