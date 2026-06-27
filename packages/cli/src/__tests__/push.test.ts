/**
 * Tests for pushVault() — exercises the full push pipeline with a mocked
 * fetch (no real network calls) and a temp vault dir.
 *
 * These test the coordination logic in push.ts:
 *  - Which notes are sent to the API
 *  - Cache read/write (skip unchanged, update after success)
 *  - Prune (DELETE) removed notes
 *  - Error handling per note
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { pushVault } from "../push.js";
import type { VaultPublishConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONFIG: VaultPublishConfig = {
  apiEndpoint: "https://vault.example.com",
  apiKey: "test-api-key",
};

/** Create a temporary vault directory with the given notes. */
async function makeTempVault(
  notes: Record<string, string>
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = join(tmpdir(), `vault-push-test-${randomBytes(4).toString("hex")}`);
  await mkdir(dir, { recursive: true });
  for (const [relPath, content] of Object.entries(notes)) {
    const fullPath = join(dir, relPath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** Returns a Response-like object that fetch resolves to. */
function mockOk(body: object = { success: true }): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

function mockError(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => ({ error: body }),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup: mock global fetch and the cache dir to avoid ~/.vault-publish writes
// ---------------------------------------------------------------------------

// We mock the home directory so cache files land in tmp, not ~/.vault-publish
vi.mock("node:os", async (importOriginal) => {
  const orig = await importOriginal<typeof import("node:os")>();
  return {
    ...orig,
    homedir: () => join(tmpdir(), "vault-push-test-home"),
  };
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Basic push
// ---------------------------------------------------------------------------

describe("pushVault — basic push", () => {
  it("POSTs each publishable note to /api/publish", async () => {
    const { dir, cleanup } = await makeTempVault({
      "note-a.md": "---\npublish: true\ntitle: Note A\n---\n# Note A\n",
      "note-b.md": "---\npublish: true\ntitle: Note B\n---\n# Note B\n",
      "draft.md": "---\npublish: false\n---\n# Draft\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());

    const logs: string[] = [];
    const result = await pushVault(CONFIG, dir, {}, (m) => logs.push(m));

    await cleanup();

    expect(result.pushed).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(0);

    // fetch called twice — once per published note
    expect(fetch).toHaveBeenCalledTimes(2);

    // Both calls go to the right endpoint with the right auth header
    for (const call of vi.mocked(fetch).mock.calls) {
      expect(call[0]).toBe("https://vault.example.com/api/publish");
      const init = call[1] as RequestInit;
      expect((init.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer test-api-key"
      );
      expect(init.method).toBe("POST");
    }
  });

  it("sends slug, markdown, and title form fields", async () => {
    const { dir, cleanup } = await makeTempVault({
      "my-note.md": "---\npublish: true\ntitle: My Note\n---\n# My Note\nBody text.\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    const logs: string[] = [];
    await pushVault(CONFIG, dir, {}, (m) => logs.push(m));
    await cleanup();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("slug")).toBe("my-note");
    expect(fd.get("title")).toBe("My Note");
    expect(typeof fd.get("markdown")).toBe("string");
  });

  it("sends description and image when present in frontmatter", async () => {
    const { dir, cleanup } = await makeTempVault({
      "rich.md": [
        "---",
        "publish: true",
        "title: Rich Note",
        "description: A note with metadata",
        "image: https://example.com/img.png",
        "---",
        "# Rich Note",
      ].join("\n"),
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    await pushVault(CONFIG, dir, {}, () => {});
    await cleanup();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("description")).toBe("A note with metadata");
    expect(fd.get("image")).toBe("https://example.com/img.png");
  });

  it("uses permalink as the slug form field", async () => {
    const { dir, cleanup } = await makeTempVault({
      "Pages/about-me.md": "---\npublish: true\npermalink: about\n---\n# About\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    await pushVault(CONFIG, dir, {}, () => {});
    await cleanup();

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("slug")).toBe("about");
  });
});

// ---------------------------------------------------------------------------
// Cache — skip unchanged
// ---------------------------------------------------------------------------

describe("pushVault — cache (skip unchanged notes)", () => {
  it("skips notes whose sha256 hasn't changed since last push", async () => {
    const content = "---\npublish: true\ntitle: Stable\n---\n# Stable\n";
    const { dir, cleanup } = await makeTempVault({ "stable.md": content });

    vi.mocked(fetch).mockResolvedValue(mockOk());

    // First push — should upload
    const logs: string[] = [];
    const r1 = await pushVault(CONFIG, dir, {}, (m) => logs.push(m));
    expect(r1.pushed).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.mocked(fetch).mockClear();

    // Second push — same content, should skip
    const r2 = await pushVault(CONFIG, dir, {}, () => {});
    expect(r2.pushed).toBe(0);
    expect(r2.skipped).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(0);

    await cleanup();
  });

  it("re-uploads after content changes", async () => {
    const { dir, cleanup } = await makeTempVault({
      "editable.md": "---\npublish: true\n---\n# Original\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    await pushVault(CONFIG, dir, {}, () => {});
    vi.mocked(fetch).mockClear();

    // Modify the note
    await writeFile(
      join(dir, "editable.md"),
      "---\npublish: true\n---\n# Updated\n",
      "utf8"
    );

    const r2 = await pushVault(CONFIG, dir, {}, () => {});
    expect(r2.pushed).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    await cleanup();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("pushVault — error handling", () => {
  it("records an error per note when the API returns non-OK", async () => {
    const { dir, cleanup } = await makeTempVault({
      "fail.md": "---\npublish: true\n---\n# Fail\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockError(500, "Internal Server Error"));

    const result = await pushVault(CONFIG, dir, {}, () => {});
    await cleanup();

    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("500");
  });

  it("continues pushing remaining notes after a per-note error", async () => {
    const { dir, cleanup } = await makeTempVault({
      "a.md": "---\npublish: true\ntitle: A\n---\n# A\n",
      "b.md": "---\npublish: true\ntitle: B\n---\n# B\n",
    });

    // First call fails, second succeeds
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockError(500, "oops"))
      .mockResolvedValueOnce(mockOk());

    const result = await pushVault(CONFIG, dir, {}, () => {});
    await cleanup();

    expect(result.pushed).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it("handles network errors (fetch throws) gracefully", async () => {
    const { dir, cleanup } = await makeTempVault({
      "net-fail.md": "---\npublish: true\n---\n# Net Fail\n",
    });

    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await pushVault(CONFIG, dir, {}, () => {});
    await cleanup();

    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("ECONNREFUSED");
  });
});

// ---------------------------------------------------------------------------
// Prune — delete removed notes
// ---------------------------------------------------------------------------

describe("pushVault — prune", () => {
  it("sends DELETE for notes in cache that are no longer in the vault", async () => {
    // First push: two notes
    const { dir, cleanup } = await makeTempVault({
      "keep.md": "---\npublish: true\n---\n# Keep\n",
      "remove.md": "---\npublish: true\n---\n# Remove\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    await pushVault(CONFIG, dir, {}, () => {});
    vi.mocked(fetch).mockClear();

    // Delete the note from the vault
    await rm(join(dir, "remove.md"));

    // Second push with --prune
    vi.mocked(fetch).mockResolvedValue(mockOk());
    const result = await pushVault(CONFIG, dir, { prune: true }, () => {});
    await cleanup();

    expect(result.deleted).toBe(1);

    // Should have sent a DELETE request
    const deleteCalls = vi.mocked(fetch).mock.calls.filter(
      ([, init]) => (init as RequestInit).method === "DELETE"
    );
    expect(deleteCalls).toHaveLength(1);
  });

  it("does not prune when the prune flag is false (default)", async () => {
    const { dir, cleanup } = await makeTempVault({
      "keep.md": "---\npublish: true\n---\n# Keep\n",
      "remove.md": "---\npublish: true\n---\n# Remove\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    await pushVault(CONFIG, dir, {}, () => {});

    await rm(join(dir, "remove.md"));
    vi.mocked(fetch).mockClear();

    const result = await pushVault(CONFIG, dir, {}, () => {});
    await cleanup();

    expect(result.deleted).toBe(0);
    const deleteCalls = vi.mocked(fetch).mock.calls.filter(
      ([, init]) => (init as RequestInit).method === "DELETE"
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it("gracefully handles 404 on DELETE (note already gone)", async () => {
    const { dir, cleanup } = await makeTempVault({
      "gone.md": "---\npublish: true\n---\n# Gone\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    await pushVault(CONFIG, dir, {}, () => {});

    await rm(join(dir, "gone.md"));
    vi.mocked(fetch).mockClear();

    // DELETE returns 404 — should be treated as success (already deleted)
    vi.mocked(fetch).mockResolvedValue(mockError(404, "Not Found"));
    const result = await pushVault(CONFIG, dir, { prune: true }, () => {});
    await cleanup();

    expect(result.deleted).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// include-all + folder filters via push options
// ---------------------------------------------------------------------------

describe("pushVault — ScanOptions passthrough", () => {
  it("publishes all notes when includeAll is set", async () => {
    const { dir, cleanup } = await makeTempVault({
      "a.md": "# No frontmatter A\n",
      "b.md": "# No frontmatter B\n",
      "draft.md": "---\npublish: false\n---\n# Draft\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    const result = await pushVault(CONFIG, dir, { includeAll: true }, () => {});
    await cleanup();

    // 2 notes (draft excluded by veto)
    expect(result.pushed).toBe(2);
  });

  it("publishes folder notes when includedFolders is set", async () => {
    const { dir, cleanup } = await makeTempVault({
      "Blog/post.md": "# Blog post\n",
      "Notes/private.md": "# Private note\n",
      "explicit.md": "---\npublish: true\n---\n# Explicit\n",
    });

    vi.mocked(fetch).mockResolvedValue(mockOk());
    const result = await pushVault(
      CONFIG,
      dir,
      { includedFolders: ["Blog"] },
      () => {}
    );
    await cleanup();

    // Blog/post + explicit — Notes/private excluded
    expect(result.pushed).toBe(2);
  });
});
