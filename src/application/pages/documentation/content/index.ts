import type { DocChapter } from "./types";
import gettingStarted from "./chapters/gettingStarted";
import orchestrationAndChat from "./chapters/orchestrationAndChat";
import agents from "./chapters/agents";
import prompts from "./chapters/prompts";
import models from "./chapters/models";
import crons from "./chapters/crons";
import traces from "./chapters/traces";
import skills from "./chapters/skills";
import memories from "./chapters/memories";
import ragStorage from "./chapters/ragStorage";
import mcpRegistry from "./chapters/mcpRegistry";
import settings from "./chapters/settings";

/**
 * Ordered chapter registry (DOC-01 … DOC-12). The array order is the order
 * of the documentation section navigation; Getting Started is first and
 * therefore the landing section (REQ-003, REQ-004).
 */
export const DOC_CHAPTERS: readonly DocChapter[] = [
  gettingStarted,
  orchestrationAndChat,
  agents,
  prompts,
  models,
  crons,
  traces,
  skills,
  memories,
  ragStorage,
  mcpRegistry,
  settings,
];

/** Slug presented at the landing route /documentation (REQ-003). */
export const DOC_LANDING_SLUG: string = DOC_CHAPTERS[0].slug;

const CHAPTERS_BY_SLUG = new Map<string, DocChapter>(
  DOC_CHAPTERS.map((chapter) => [chapter.slug, chapter]),
);

/**
 * Resolves a section slug from the route to its chapter; an absent slug
 * resolves to the landing chapter, an unknown slug returns undefined so the
 * page can render its safe not-found state (Error Cases).
 */
export function getChapterBySlug(slug: string | undefined): DocChapter | undefined {
  if (slug == null || slug === "") return CHAPTERS_BY_SLUG.get(DOC_LANDING_SLUG);
  return CHAPTERS_BY_SLUG.get(slug);
}

export type { DocChapter, DocBlock, DocLink, DocSpan } from "./types";
