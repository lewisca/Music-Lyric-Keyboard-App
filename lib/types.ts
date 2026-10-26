// Shared types for the propose → resolve → verify loop.
//
// The loop is source-agnostic: STAGE 1 (propose) asks the model for candidate
// songs, then a pluggable Resolver confirms each candidate against a real catalog.
// Which catalog answers (free iTunes vs. licensed Musixmatch) is an implementation
// detail the loop never sees — it only reads the Resolution below.

/** The seed genres shown in the UI. User-mutable at runtime; this is just the starting list. */
export const GENRES = [
  "Pop",
  "Hip-Hop/Rap",
  "R&B/Soul",
  "Rock",
  "Indie/Alt",
  "Country",
] as const;

export type Genre = (typeof GENRES)[number];

/**
 * STAGE 1 output. A single candidate the model believes fits the feeling.
 * `why_it_fits` is the model's ORIGINAL sentence — it, not any lyric, is what
 * makes the result feel coherent. Treat this as a hypothesis, never fact.
 */
export interface Proposal {
  song: string;
  artist: string;
  why_it_fits: string;
}

/** Input to a Resolver: the model's guess at a song + artist. */
export interface ResolveInput {
  song: string;
  artist: string;
}

/** Canonical metadata proving a song exists. Not every source fills every field. */
export interface Canonical {
  title: string;
  artist: string;
  album: string;
  /** Cover art URL (iTunes). Empty when the source doesn't provide one. */
  artworkUrl: string;
  /** Where to go listen to the full track. */
  listenUrl: string;
  /** 30s audio preview URL (iTunes). Empty when unavailable. */
  previewUrl: string;
}

/**
 * A Resolver's answer. `found` is the suppression gate. The licensed-only fields
 * (lyricSnippet / attribution / trackingUrl) are populated ONLY by a licensed
 * source; on the free path they stay empty and no lyric text is ever shown.
 */
export interface Resolution {
  found: boolean;
  canonical: Canonical;
  lyricSnippet?: string;
  attribution?: string;
  trackingUrl?: string;
  /**
   * How to treat the lyric slot in the UI:
   *   "licensed"    → a real, rights-cleared snippet (render text + attribution + tracking)
   *   "placeholder" → demo mode: show the lyric slot styled, but with a placeholder,
   *                    marking exactly where the licensed line will appear.
   * Absent → no lyric slot at all (pure metadata path).
   */
  lyricKind?: "licensed" | "placeholder";
}

/**
 * The pluggable resolution source. Both the free (iTunes) and licensed
 * (Musixmatch) implementations satisfy this one method; the loop calls it
 * without knowing or caring which source answered.
 */
export interface Resolver {
  readonly name: string;
  resolve(input: ResolveInput): Promise<Resolution>;
}

/**
 * The verified result the API returns to the client. Always carries the model's
 * `why_it_fits` line + canonical metadata. The licensed-only fields appear only
 * when a licensed resolver populated them.
 */
export interface MatchResult {
  whyItFits: string;
  canonical: Canonical;
  /**
   * The lyric words to append to the user's message when this option is picked
   * (line-completion). Real lyric words on a licensed source; a clearly-marked
   * placeholder in the keyless demo (no lyric license).
   */
  continuation: string;
  /** Present only on a licensed resolution — the UI renders these when set. */
  lyricSnippet?: string;
  attribution?: string;
  trackingUrl?: string;
  /** See Resolution.lyricKind. Drives whether the lyric slot renders (and how). */
  lyricKind?: "licensed" | "placeholder";
}

export interface EmptyResult {
  status: "empty";
  /** Human-readable reason, surfaced in the UI empty state. */
  reason: string;
}

/** The verified song options for a feeling, best fit first. */
export interface MatchesResult {
  status: "matches";
  results: MatchResult[];
}

export type ApiResponse = MatchesResult | EmptyResult;
