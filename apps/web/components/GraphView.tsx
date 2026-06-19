"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GraphManifest, GraphNode, GraphEdge } from "@vault-publish/db";

// D3 imports — tree-shakeable individual modules
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import { scaleOrdinal } from "d3-scale";
import { schemeTableau10 } from "d3-scale-chromatic";

interface Props {
  manifest: GraphManifest;
  username: string;
  /** Mini mode: shows only current node + 1-hop neighbors. */
  mini?: boolean;
  currentSlug?: string;
  /** Height override for mini mode. */
  height?: number;
}

interface NodeDatum extends SimulationNodeDatum {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  linkCount: number;
}

interface LinkDatum extends SimulationLinkDatum<NodeDatum> {
  source: NodeDatum | string;
  target: NodeDatum | string;
}

const TAG_COLOR = scaleOrdinal(schemeTableau10);

function nodeRadius(linkCount: number, mini: boolean): number {
  const base = mini ? 5 : 6;
  return base + Math.sqrt(linkCount) * (mini ? 1.5 : 2);
}

function nodeColor(tags: string[]): string {
  if (tags.length === 0) return "#9ca3af"; // gray-400
  return TAG_COLOR(tags[0]);
}

export default function GraphView({
  manifest,
  username,
  mini = false,
  currentSlug,
  height,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  const handleNodeClick = useCallback(
    (slug: string) => {
      router.push(`/${username}/${slug}`);
    },
    [router, username]
  );

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const W = rect.width || (mini ? 280 : window.innerWidth);
    const H = rect.height || height || (mini ? 200 : window.innerHeight - 60);

    // In mini mode, filter to 1-hop neighborhood
    let nodes: NodeDatum[];
    let edges: LinkDatum[];

    if (mini && currentSlug) {
      const neighbors = new Set<string>([currentSlug]);
      for (const edge of manifest.edges) {
        const s =
          typeof edge.source === "string" ? edge.source : (edge.source as GraphNode).slug;
        const t =
          typeof edge.target === "string" ? edge.target : (edge.target as GraphNode).slug;
        if (s === currentSlug) neighbors.add(t);
        if (t === currentSlug) neighbors.add(s);
      }
      nodes = manifest.nodes
        .filter((n) => neighbors.has(n.slug))
        .map((n) => ({ ...n, id: n.slug }));
      const slugSet = new Set(nodes.map((n) => n.slug));
      edges = manifest.edges
        .filter((e) => {
          const s = typeof e.source === "string" ? e.source : (e.source as GraphNode).slug;
          const t = typeof e.target === "string" ? e.target : (e.target as GraphNode).slug;
          return slugSet.has(s) && slugSet.has(t);
        })
        .map((e) => ({ ...e }) as LinkDatum);
    } else {
      nodes = manifest.nodes.map((n) => ({ ...n, id: n.slug }));
      edges = manifest.edges.map((e) => ({ ...e }) as LinkDatum);
    }

    // Clear previous render
    select(svg).selectAll("*").remove();

    const root = select(svg)
      .attr("width", W)
      .attr("height", H)
      .style("cursor", "default");

    // Zoom layer (full graph only)
    const g = root.append("g");

    if (!mini) {
      const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform as unknown as string);
        });
      root.call(zoomBehavior);
      root.call(zoomBehavior.transform, zoomIdentity.translate(W / 2, H / 2));
    }

    // Links
    const linkSel = g
      .append("g")
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 1)
      .selectAll<SVGLineElement, LinkDatum>("line")
      .data(edges)
      .join("line");

    // Nodes
    const nodeSel = g
      .append("g")
      .selectAll<SVGCircleElement, NodeDatum>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => nodeRadius(d.linkCount, mini))
      .attr("fill", (d) => nodeColor(d.tags))
      .attr("stroke", (d) =>
        d.slug === currentSlug ? "#7c3aed" : "white"
      )
      .attr("stroke-width", (d) => (d.slug === currentSlug ? 2.5 : 1.5))
      .style("cursor", "pointer");

    // Labels (full graph: show for high-link nodes; mini: always show)
    const labelSel = g
      .append("g")
      .selectAll<SVGTextElement, NodeDatum>("text")
      .data(nodes.filter((d) => mini || d.linkCount > 2))
      .join("text")
      .text((d) => (d.title.length > 24 ? d.title.slice(0, 22) + "…" : d.title))
      .attr("font-size", mini ? 9 : 11)
      .attr("fill", "#374151")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => -(nodeRadius(d.linkCount, mini) + 3))
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Hover behavior — highlight neighbors
    nodeSel
      .on("mouseenter", function (event, d: NodeDatum) {
        const neighborSlugs = new Set<string>([d.slug]);
        for (const edge of edges) {
          const s = typeof edge.source === "string" ? edge.source : (edge.source as NodeDatum).id;
          const t = typeof edge.target === "string" ? edge.target : (edge.target as NodeDatum).id;
          if (s === d.slug) neighborSlugs.add(t);
          if (t === d.slug) neighborSlugs.add(s);
        }
        nodeSel.attr("opacity", (n: NodeDatum) =>
          neighborSlugs.has(n.slug) ? 1 : 0.2
        );
        linkSel.attr("opacity", (e: LinkDatum) => {
          const s = typeof e.source === "string" ? e.source : (e.source as NodeDatum).id;
          const t = typeof e.target === "string" ? e.target : (e.target as NodeDatum).id;
          return s === d.slug || t === d.slug ? 1 : 0.05;
        });
      })
      .on("mouseleave", function () {
        nodeSel.attr("opacity", 1);
        linkSel.attr("opacity", 1);
      })
      .on("click", function (event, d: NodeDatum) {
        handleNodeClick(d.slug);
      });

    // Title tooltip
    nodeSel.append("title").text((d: NodeDatum) => d.title);

    // Force simulation
    const simulation = forceSimulation<NodeDatum>(nodes)
      .force(
        "link",
        forceLink<NodeDatum, LinkDatum>(edges)
          .id((d) => d.id)
          .distance(mini ? 50 : 80)
      )
      .force("charge", forceManyBody().strength(mini ? -60 : -120))
      .force("center", forceCenter(mini ? W / 2 : 0, mini ? H / 2 : 0))
      .force(
        "collide",
        forceCollide<NodeDatum>().radius((d) => nodeRadius(d.linkCount, mini) + 4)
      );

    simulation.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as NodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as NodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as NodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as NodeDatum).y ?? 0);

      nodeSel
        .attr("cx", (d) => d.x ?? 0)
        .attr("cy", (d) => d.y ?? 0);

      labelSel
        .attr("x", (d) => d.x ?? 0)
        .attr("y", (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [manifest, username, mini, currentSlug, height, handleNodeClick]);

  const svgHeight = height ?? (mini ? 200 : undefined);

  return (
    <svg
      ref={svgRef}
      className={mini ? "w-full" : "w-full h-full"}
      style={svgHeight ? { height: svgHeight } : undefined}
    />
  );
}
