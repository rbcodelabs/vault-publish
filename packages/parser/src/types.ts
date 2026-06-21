export interface WikiLink {
  /** The raw target, e.g. "My Note" in [[My Note|Alias]] */
  target: string;
  /** Display alias if provided, e.g. "Alias" */
  alias?: string;
  /** Whether this is an embed (![[file]]) */
  isEmbed: boolean;
}

export interface ASTNode {
  type: string;
  content?: string;
  children?: ASTNode[];
  [key: string]: unknown;
}

export interface ParsedNote {
  /** Raw frontmatter key-value pairs */
  frontmatter: Record<string, unknown>;
  /** Note body with wikilinks resolved to HTML anchors */
  html: string;
  /** All wikilinks found in the document */
  wikilinks: WikiLink[];
  /** All embed references found in the document */
  embeds: string[];
  /** All #tags found in frontmatter and body */
  tags: string[];
  /** Plain-text word count of the body */
  wordCount: number;
  /** Title derived from first H1 or frontmatter title */
  title: string;
}
