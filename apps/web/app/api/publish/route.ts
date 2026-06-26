import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import { parseObsidianMarkdown, resolveWikilinks } from "@vault-publish/parser";
import { buildGraphManifest } from "@vault-publish/db";
import { authenticateRequest } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";

// POST /api/publish
// Body: multipart form fields:
//   slug        string  required  URL slug (or original vault path; permalink overrides)
//   markdown    string  required  Raw Obsidian markdown
//   title       string  optional  Page title (falls back to H1 or slug)
//   description string  optional  Meta description (from frontmatter `description`)
//   image       string  optional  OG image URL (from frontmatter `image` or `cover`)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const markdown = String(formData.get("markdown") ?? "").trim();

  if (!slug || !markdown) {
    return NextResponse.json(
      { error: "slug and markdown are required" },
      { status: 400 }
    );
  }

  // Parse Obsidian markdown — this also extracts frontmatter, tags, outlinks, etc.
  const parsed = parseObsidianMarkdown(markdown, user.username);
  const outlinks = resolveWikilinks(
    parsed.wikilinks.filter((l) => !l.isEmbed).map((l) => l.target)
  );

  // Merge any extra metadata passed by the CLI (description, image) into
  // the stored frontmatter so the web app can render them as meta tags.
  // CLI already extracts these from YAML, but sending them explicitly is
  // more reliable than depending on the parser to surface them.
  const extraDescription = formData.get("description");
  const extraImage = formData.get("image");
  const mergedFrontmatter: Record<string, unknown> = {
    ...(parsed.frontmatter as Record<string, unknown>),
    ...(extraDescription ? { description: String(extraDescription) } : {}),
    ...(extraImage ? { image: String(extraImage) } : {}),
  };

  // Upload raw markdown to Vercel Blob.
  // Blob is keyed by username+slug (the effective published slug, which may
  // be a permalink). This keeps blob keys stable if a note is renamed but
  // keeps the same permalink.
  const blobPath = `${user.username}/${slug}.md`;
  const blob = await put(blobPath, markdown, {
    access: "public",
    contentType: "text/markdown",
    addRandomSuffix: false,
  });

  const repos = await getRepositories();

  // Upsert note in DB
  await repos.notes.upsert({
    userId: user.id,
    slug,
    title: title || parsed.title || slug,
    blobUrl: blob.url,
    frontmatter: mergedFrontmatter,
    outlinks,
    tags: parsed.tags,
    wordCount: parsed.wordCount,
  });

  // Rebuild graph manifest from all user notes
  const allNotes = await repos.notes.listByUser(user.id);
  const manifest = buildGraphManifest(allNotes);
  await repos.graphs.upsert(user.id, manifest);

  // Invalidate ISR cache for affected paths
  revalidatePath(`/${user.username}`);
  revalidatePath(`/${user.username}/${slug}`);
  revalidatePath(`/${user.username}/graph`);

  return NextResponse.json({
    success: true,
    slug,
    url: `/${user.username}/${slug}`,
  });
}

// DELETE /api/publish?slug=<slug>  OR  body: { slug: string }
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Accept slug from query string OR JSON body
  let slug = new URL(req.url).searchParams.get("slug") ?? "";
  if (!slug) {
    try {
      const body = await req.json() as { slug?: string };
      slug = String(body.slug ?? "").trim();
    } catch {
      // ignore parse errors
    }
  }
  slug = slug.trim();

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const repos = await getRepositories();

  const existing = await repos.notes.findBySlug(user.id, slug);
  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Delete from Vercel Blob
  try {
    await del(existing.blobUrl);
  } catch {
    console.warn(`Failed to delete blob for ${slug}: ${existing.blobUrl}`);
  }

  await repos.notes.delete(user.id, slug);

  // Rebuild graph without deleted note
  const remaining = await repos.notes.listByUser(user.id);
  const manifest = buildGraphManifest(remaining);
  await repos.graphs.upsert(user.id, manifest);

  revalidatePath(`/${user.username}`);
  revalidatePath(`/${user.username}/${slug}`);
  revalidatePath(`/${user.username}/graph`);

  return NextResponse.json({ success: true, slug });
}
