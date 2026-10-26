// ─────────────────────────────────────────────────────────────────────────────
// /api/match — the ONLY endpoint the client calls.
// ─────────────────────────────────────────────────────────────────────────────
// It runs the full propose → resolve → verify loop server-side and returns only
// verified data (or a graceful empty state). API keys stay on the server by
// construction: the client never talks to the model or any catalog directly.
//
// The resolution SOURCE is pluggable (see lib/resolvers). This route doesn't know
// or care which source answered — it just reads `Resolution.found` to suppress,
// and passes through any licensed-only fields the source happened to populate.

import { NextResponse } from "next/server";
import { propose } from "@/lib/propose";
import { getResolver } from "@/lib/resolvers";
import { demoContinuation } from "@/lib/demo";
import { GENRES } from "@/lib/types";
import type { ApiResponse, Genre, MatchResult } from "@/lib/types";

/** First ~10 words of a licensed snippet — the words line-completion inserts. */
function firstWords(text: string, n = 10): string {
  return text.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

// Always run this fresh — never cache a match (matches are per-request, and a
// licensed resolver's lyric snippet must never be persisted).
export const dynamic = "force-dynamic";

interface MatchRequest {
  feeling?: string;
  genre?: string;
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse>> {
  let payload: MatchRequest;
  try {
    payload = (await request.json()) as MatchRequest;
  } catch {
    return NextResponse.json(
      { status: "empty", reason: "Invalid request body." },
      { status: 400 },
    );
  }

  const feeling = (payload.feeling ?? "").trim();
  const genre = payload.genre as Genre;

  if (!feeling) {
    return NextResponse.json({ status: "empty", reason: "Say something first." });
  }
  if (!GENRES.includes(genre)) {
    return NextResponse.json(
      { status: "empty", reason: "Pick a genre." },
      { status: 400 },
    );
  }

  // STAGE 1 — PROPOSE: get 1–3 hypotheses from the model, constrained by genre.
  const proposals = await propose(feeling, genre);
  if (proposals.length === 0) {
    return NextResponse.json({
      status: "empty",
      reason: "Couldn't find the words for that yet. Try rephrasing.",
    });
  }

  // STAGE 2 + 3 — RESOLVE then VERIFY every proposal (in parallel). The resolver
  // confirms each song against a real catalog; `found` is the verify/suppress gate.
  // Proposals that don't resolve are dropped SILENTLY — we never show an unverified
  // suggestion. The survivors become the song options the user picks from.
  const resolver = getResolver();

  const resolved = await Promise.all(
    proposals.slice(0, 4).map((p) => resolver.resolve({ song: p.song, artist: p.artist })),
  );

  const results: MatchResult[] = [];
  resolved.forEach((resolution, i) => {
    if (!resolution.found) return;
    results.push({
      whyItFits: proposals[i].why_it_fits,
      canonical: resolution.canonical,
      // Line-completion words: real licensed lyric words, else a demo placeholder.
      continuation: resolution.lyricSnippet
        ? firstWords(resolution.lyricSnippet)
        : demoContinuation(resolution.canonical.title),
      ...(resolution.lyricKind ? { lyricKind: resolution.lyricKind } : {}),
      ...(resolution.lyricSnippet ? { lyricSnippet: resolution.lyricSnippet } : {}),
      ...(resolution.attribution ? { attribution: resolution.attribution } : {}),
      ...(resolution.trackingUrl ? { trackingUrl: resolution.trackingUrl } : {}),
    });
  });

  if (results.length === 0) {
    return NextResponse.json({
      status: "empty",
      reason: "Found a feeling, but no verified song to match it. Try again.",
    });
  }

  return NextResponse.json({ status: "matches", results });
}
