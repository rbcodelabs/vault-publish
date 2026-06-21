import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepositories } from "@/lib/repositories";

export const revalidate = 60;

interface Props {
  params: Promise<{ username: string }>;
}

export default async function VaultHomePage({ params }: Props) {
  const { username } = await params;
  const repos = await getRepositories();

  const user = await repos.users.findByUsername(username);
  if (!user) notFound();

  const notes = await repos.notes.listByUser(user.id);

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{user.displayName ?? username}</h1>
          <p className="text-gray-500 mt-1">@{username}</p>
        </div>
        <Link
          href={`/${username}/graph`}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          View graph
        </Link>
      </div>

      {notes.length === 0 ? (
        <p className="text-gray-500 text-center py-16">No published notes yet.</p>
      ) : (
        <ul className="space-y-4">
          {notes.map((note) => (
            <li key={note.slug}>
              <Link
                href={`/${username}/${note.slug}`}
                className="block p-4 border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-medium text-gray-900">
                    {note.title || note.slug}
                  </h2>
                  <span className="text-xs text-gray-400 whitespace-nowrap mt-1">
                    {note.updatedAt.toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                  <span>{note.wordCount.toLocaleString()} words</span>
                  {note.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {note.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 4 && (
                        <span className="text-xs text-gray-400">
                          +{note.tags.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
