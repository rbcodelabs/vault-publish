import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, generateApiKey, hashApiKey } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";

// POST /api/admin/users
// Body: JSON { username: string, displayName?: string }
// Returns the plaintext API key once — not stored.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { username?: string; displayName?: string };
  try {
    body = await req.json() as { username?: string; displayName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }
  if (!/^[a-z0-9_-]{1,50}$/.test(username)) {
    return NextResponse.json(
      { error: "username must be 1-50 chars: letters, numbers, hyphens, underscores" },
      { status: 400 }
    );
  }

  const repos = await getRepositories();

  const existing = await repos.users.findByUsername(username);
  if (existing) {
    return NextResponse.json(
      { error: `User '${username}' already exists` },
      { status: 409 }
    );
  }

  const plainKey = generateApiKey();
  const apiKeyHash = hashApiKey(plainKey);

  await repos.users.create({
    username,
    apiKeyHash,
    displayName: body.displayName?.trim() || undefined,
  });

  return NextResponse.json(
    {
      username,
      apiKey: plainKey,
      message: "Save this key — it won't be shown again.",
    },
    { status: 201 }
  );
}
