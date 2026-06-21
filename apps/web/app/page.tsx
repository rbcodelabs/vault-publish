import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">vault-publish</h1>
        <p className="text-xl text-gray-600 mb-8">
          Open-source Obsidian publishing. Deploy your own instance.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href="https://vercel.com/new/clone?repository-url=https://github.com/rbcodelabs/vault-publish"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Deploy to Vercel
          </a>
          <a
            href="https://github.com/rbcodelabs/vault-publish"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            View on GitHub
          </a>
        </div>

        <div className="text-left bg-gray-50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3">Quick start</h2>
          <ol className="space-y-2 text-gray-700">
            <li className="flex gap-2">
              <span className="font-mono text-purple-600">1.</span>
              Deploy this repo to Vercel and configure DSQL + env vars
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-purple-600">2.</span>
              Run the migration:{" "}
              <code className="bg-white border px-1 rounded text-sm">
                POST /api/admin/migrate
              </code>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-purple-600">3.</span>
              Create a user:{" "}
              <code className="bg-white border px-1 rounded text-sm">
                POST /api/admin/users
              </code>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-purple-600">4.</span>
              Install the CLI and push your vault:
            </li>
          </ol>
          <pre className="mt-3 bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
            {`npx vault-publish init\nnpx vault-publish push ./my-vault`}
          </pre>
        </div>

        <p className="text-sm text-gray-500">
          Built with Next.js, AWS Aurora DSQL, Vercel Blob, and Tailwind CSS.
        </p>
      </div>
    </main>
  );
}
