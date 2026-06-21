import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepositories } from "@/lib/repositories";
import { parseObsidianMarkdown } from "@vault-publish/parser";
import MiniGraph from "@/components/MiniGraph";
import type { GraphManifest } from "@vault-publish/db";

export const revalidate = 60;

interface Props {
  params: Promise<{ username: string; slug: string }>;
}

export default async function NotePage({ params }: Props) {
  const { username, slug } = await params;
  const repos = await getRepositories();

  const user = await repos.users.findByUsername(username);
  if (!user) notFound();

  const note = await repos.notes.findBySlug(user.id, slug);
  if (!note) notFound();

  // Fetch raw markdown from Vercel Blob and re-render
  const response = await fetch(note.blobUrl, { next: { revalidate: 60 } });
  if (!response.ok) notFound();
  const markdown = await response.text();
  const parsed = parseObsidianMarkdown(markdown, username);

  // Find backlinks: notes whose outlinks include this slug
  const allNotes = await repos.notes.listByUser(user.id);
  const backlinks = allNotes.filter(
    (n) => n.slug !== slug && n.outlinks.includes(slug)
  );

  // Graph for mini view
  const manifest = await repos.graphs.findByUser(user.id);

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-6">
        <Link
          href={`/${username}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; {user.displayName ?? username}
        </Link>
      </div>

      <div className="flex gap-8">
        {/* Note content */}
        <article className="flex-1 min-w-0">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              {note.title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <time dateTime={note.updatedAt.toISOString()}>
                {note.updatedAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span>{note.wordCount.toLocaleString()} words</span>
            </div>
            {note.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-purple-100 text-purple-700 rounded-full px-3 py-1 text-xs font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: parsed.html }}
          />
        </article>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 space-y-6">
          {/* Mini graph */}
          {manifest && (
            <section className="border rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Note graph
              </h2>
              <MiniGraph
                manifest={manifest as GraphManifest}
                currentSlug={slug}
                username={username}
              />
            </section>
          )}

          {/* Backlinks */}
          {backlinks.length > 0 && (
            <section className="border rounded-xl p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Linked from ({backlinks.length})
              </h2>
              <ul className="space-y-2">
                {backlinks.map((bl) => (
                  <li key={bl.slug}>
                    <Link
                      href={`/${username}/${bl.slug}`}
                      className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      {bl.title || bl.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
