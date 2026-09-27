// Link detection extracts unique safe bare HTTP(S) URLs from inbound text while filtering SSRF targets.
import { findMarkdownLinkSourceSpans } from "../../packages/markdown-core/src/link-spans.js";
import { isBlockedHostnameOrIp } from "../infra/net/ssrf.js";
import { DEFAULT_MAX_LINKS } from "./defaults.js";

const BARE_LINK_RE = /https?:\/\/\S+/gi;

// Prose delimiters that are trimmed off a bare link when they follow word characters,
// mirroring GitHub's GFM autolink extension behavior. Unlike GFM, trimming applies only
// when the punctuation follows the path region (not inside query/fragment).
const TRAILING_PUNCTUATION = ",.;:?!\"'…";
// Closers are trailing punctuation only when unbalanced by their opener inside the
// path region, so destinations like https://en.wikipedia.org/wiki/Foo_(bar) keep
// their suffix. In the query or fragment region they are never trimmed.
const UNPAIRED_CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{", ">": "<" };

/**
 * Trim trailing prose punctuation from a URL when it appears after word content.
 * Preserves punctuation that is clearly part of the intended path (e.g., intentional
 * punctuation-ending URLs). Also preserves everything from a query (# or ?) onward,
 * as those are authored values.
 */
function trimTrailingProsePunctuation(url: string): string {
  // Find where the path ends (before query or fragment)
  const delimiterIndex = /[?#]/.exec(url);
  const pathEnd = delimiterIndex ? delimiterIndex.index : url.length;
  
  let end = url.length;
  
  // Only trim punctuation that comes within the path region
  while (end > 0 && end - 1 < pathEnd) {
    const last = url.slice(end - 1, end);
    
    // Handle unmatched closers by counting opens vs closes in the portion before this char
    const opener = UNPAIRED_CLOSERS[last];
    if (opener) {
      let opens = 0;
      let closes = 0;
      for (let i = 0; i < end; i += 1) {
        const char = url[i];
        if (char === opener) {
          opens += 1;
        } else if (char === last) {
          closes += 1;
        }
      }
      // Only trim if there are more closes than opens (unbalanced closer)
      if (closes > opens) {
        end -= 1;
        continue;
      }
      break;
    }
    
    // Trim prose punctuation only if it follows word/alphanumeric content
    if (TRAILING_PUNCTUATION.includes(last)) {
      const prevChar = end > 1 ? url[end - 2] : "";
      // Only trim if preceded by alphanumeric or underscore (prose context)
      if (prevChar && /[a-zA-Z0-9_]/.test(prevChar)) {
        end -= 1;
        continue;
      }
    }
    
    break;
  }
  
  return url.slice(0, end);
}

function stripMarkdownLinks(message: string): string {
  const chunks: string[] = [];
  let cursor = 0;
  for (const [start, end] of findMarkdownLinkSourceSpans(message)) {
    chunks.push(message.slice(cursor, start), " ");
    cursor = end;
  }
  chunks.push(message.slice(cursor));
  return chunks.join("");
}

function resolveMaxLinks(value?: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_MAX_LINKS;
}

function isAllowedUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (isBlockedHostnameOrIp(parsed.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts unique, SSRF-filtered bare HTTP(S) links from inbound text.
 * Markdown links are ignored so display-only citations do not trigger fetches.
 * 
 * Trims trailing prose punctuation (commas, periods, etc.) from bare URLs when
 * they appear after word content, matching GitHub's GFM autolink behavior.
 * Preserves intentional punctuation-ending paths and query/fragment regions.
 * 
 * Use angle-bracket syntax (<url>) or markdown links [[text]](url) for literal
 * URLs ending in punctuation that should be preserved exactly.
 */
export function extractLinksFromMessage(message: string, opts?: { maxLinks?: number }): string[] {
  const source = message?.trim();
  if (!source) {
    return [];
  }

  const maxLinks = resolveMaxLinks(opts?.maxLinks);
  const sanitized = stripMarkdownLinks(source);
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of sanitized.matchAll(BARE_LINK_RE)) {
    const raw = match[0]?.trim();
    if (!raw) {
      continue;
    }
    
    // Trim only prose-ending punctuation, preserving intentional punctuation paths
    const trimmed = trimTrailingProsePunctuation(raw);
    
    if (!trimmed) {
      continue;
    }
    
    if (!isAllowedUrl(trimmed)) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    results.push(trimmed);
    if (results.length >= maxLinks) {
      break;
    }
  }

  return results;
}
