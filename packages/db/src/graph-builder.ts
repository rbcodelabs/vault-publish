import type { Note, GraphManifest, GraphNode, GraphEdge } from "./types.js";

/**
 * Builds a graph manifest from the full list of a user's notes.
 * Edges are created when a note's outlinks contain the slug of another note.
 */
export function buildGraphManifest(notes: Note[]): GraphManifest {
  const slugSet = new Set(notes.map((n) => n.slug));

  const nodes: GraphNode[] = notes.map((note) => ({
    id: note.slug,
    slug: note.slug,
    title: note.title,
    tags: note.tags,
    // Link count tallied after edges are built
    linkCount: 0,
  }));

  const edges: GraphEdge[] = [];
  for (const note of notes) {
    for (const outlink of note.outlinks) {
      if (slugSet.has(outlink)) {
        edges.push({ source: note.slug, target: outlink });
      }
    }
  }

  // Compute link counts (in-degree + out-degree)
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
  }
  for (const node of nodes) {
    node.linkCount = counts.get(node.slug) ?? 0;
  }

  return { nodes, edges };
}
