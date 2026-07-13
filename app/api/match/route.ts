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
import { GENRES } from "@/lib/types";
import type { ApiResponse, Genre } from "@/lib/types";

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

  // STAGE 2 + 3 — RESOLVE then VERIFY, best proposal first. The resolver confirms
  // the song against a real catalog; `found` is the verify/suppress gate. Take the
  // first proposal that resolves — anything that doesn't is dropped SILENTLY. We
  // never show an unverified suggestion.
  const resolver = getResolver();

  for (const proposal of proposals) {
    const resolution = await resolver.resolve({
      song: proposal.song,
      artist: proposal.artist,
    });
    if (!resolution.found) continue;

    return NextResponse.json({
      status: "match",
      // Coherence comes from the model's original sentence — always shown.
      whyItFits: proposal.why_it_fits,
      canonical: resolution.canonical,
      // Lyric slot: "licensed" carries real snippet fields; "placeholder" tells the
      // UI to render the demo slot where the licensed line will appear.
      ...(resolution.lyricKind ? { lyricKind: resolution.lyricKind } : {}),
      ...(resolution.lyricSnippet ? { lyricSnippet: resolution.lyricSnippet } : {}),
      ...(resolution.attribution ? { attribution: resolution.attribution } : {}),
      ...(resolution.trackingUrl ? { trackingUrl: resolution.trackingUrl } : {}),
    });
  }

  // Nothing resolved → graceful empty state.
  return NextResponse.json({
    status: "empty",
    reason: "Found a feeling, but no verified song to match it. Try again.",
  });
}
