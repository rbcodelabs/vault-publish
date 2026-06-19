import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepositories } from "@/lib/repositories";
import GraphView from "@/components/GraphView";
import type { GraphManifest } from "@vault-publish/db";

export const revalidate = 60;

interface Props {
  params: Promise<{ username: string }>;
}

export default async function GraphPage({ params }: Props) {
  const { username } = await params;
  const repos = await getRepositories();

  const user = await repos.users.findByUsername(username);
  if (!user) notFound();

  const manifest = await repos.graphs.findByUser(user.id);
  if (!manifest || manifest.nodes.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500">No published notes yet.</p>
        <Link
          href={`/${username}`}
          className="mt-4 text-purple-600 hover:text-purple-800"
        >
          &larr; Back to vault
        </Link>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col">
      <header className="px-4 py-3 border-b flex items-center justify-between bg-white">
        <div>
          <Link
            href={`/${username}`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; {user.displayName ?? username}
          </Link>
          <h1 className="text-lg font-semibold">Knowledge Graph</h1>
        </div>
        <span className="text-sm text-gray-400">
          {manifest.nodes.length} notes &middot; {manifest.edges.length} links
        </span>
      </header>
      <div className="flex-1">
        <GraphView
          manifest={manifest as GraphManifest}
          username={username}
        />
      </div>
    </main>
  );
}
