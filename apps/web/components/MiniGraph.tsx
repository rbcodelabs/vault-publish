"use client";

import GraphView from "./GraphView";
import type { GraphManifest } from "@vault-publish/db";

interface Props {
  manifest: GraphManifest;
  currentSlug: string;
  username: string;
}

/**
 * Thin wrapper around GraphView in mini mode for the note page sidebar.
 */
export default function MiniGraph({ manifest, currentSlug, username }: Props) {
  return (
    <GraphView
      manifest={manifest}
      username={username}
      mini={true}
      currentSlug={currentSlug}
      height={200}
    />
  );
}
