// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL RESOLVER — Musixmatch (licensed, OFF by default)
// ─────────────────────────────────────────────────────────────────────────────
// Same Resolver interface as the free iTunes source, so the propose loop is
// unchanged when this is selected. Musixmatch is now paid-only (no free tier), so
// this adapter is opt-in: it is used only when RESOLVER=musixmatch AND a key is
// present (see ./index.ts). When active it does the two-call catalog check —
// matcher.track.get to confirm the song, then track.snippet.get for the licensed
// hook — and populates the licensed-only fields (lyricSnippet / attribution /
// trackingUrl). The UI renders those only when they're set.
//
// Lyric text is still never stored: the snippet is fetched live per request and
// held only for the response.
//
// Runs SERVER-SIDE only.

import type { Resolution, ResolveInput, Resolver } from "../types";

const MUSIXMATCH_BASE = "https://api.musixmatch.com/ws/1.1";

interface MatcherResponse {
  message: {
    header: { status_code: number };
    body:
      | {
          track?: {
            track_id: number;
            track_name: string;
            artist_name: string;
            album_name?: string;
            track_share_url?: string;
          };
        }
      | "";
  };
}

interface SnippetResponse {
  message: {
    header: { status_code: number };
    body:
      | {
          snippet?: {
            snippet_body: string;
            pixel_tracking_url?: string;
          };
        }
      | "";
  };
}

function notFound(): Resolution {
  return {
    found: false,
    canonical: {
      title: "",
      artist: "",
      album: "",
      artworkUrl: "",
      listenUrl: "",
      previewUrl: "",
    },
  };
}

export class MusixmatchResolver implements Resolver {
  readonly name = "musixmatch";

  constructor(private readonly apiKey: string) {}

  async resolve({ song, artist }: ResolveInput): Promise<Resolution> {
    // STEP 1 — confirm the song is real and get canonical metadata + track_id.
    const track = await this.matchTrack(song, artist);
    if (!track) return notFound();

    // STEP 2 — fetch the licensed snippet for that track_id. If it's missing,
    // fall back to metadata-only (still a valid "found" result — the demo can show
    // the song without a lyric), matching the free-path display.
    const snippet = await this.fetchSnippet(track.trackId);

    return {
      found: true,
      canonical: {
        title: track.title,
        artist: track.artist,
        album: track.album,
        artworkUrl: "", // Musixmatch doesn't provide cover art.
        listenUrl: track.listenUrl,
        previewUrl: "", // …or audio previews.
      },
      ...(snippet
        ? {
            lyricSnippet: snippet.text,
            attribution: "Lyrics powered by Musixmatch",
            trackingUrl: snippet.pixelTrackingUrl,
            lyricKind: "licensed" as const,
          }
        : {}),
    };
  }

  private async matchTrack(song: string, artist: string) {
    const url =
      `${MUSIXMATCH_BASE}/matcher.track.get` +
      `?q_track=${encodeURIComponent(song)}` +
      `&q_artist=${encodeURIComponent(artist)}` +
      `&apikey=${encodeURIComponent(this.apiKey)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as MatcherResponse;
      if (data.message.header.status_code !== 200) return null;
      const body = data.message.body;
      if (!body || typeof body === "string" || !body.track) return null;
      const t = body.track;
      return {
        trackId: t.track_id,
        title: t.track_name,
        artist: t.artist_name,
        album: t.album_name ?? "",
        listenUrl: t.track_share_url ?? "",
      };
    } catch (err) {
      console.error(`[musixmatch] matcher.track.get failed for "${song}":`, err);
      return null;
    }
  }

  private async fetchSnippet(trackId: number) {
    const url =
      `${MUSIXMATCH_BASE}/track.snippet.get` +
      `?track_id=${encodeURIComponent(String(trackId))}` +
      `&apikey=${encodeURIComponent(this.apiKey)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as SnippetResponse;
      if (data.message.header.status_code !== 200) return null;
      const body = data.message.body;
      if (!body || typeof body === "string" || !body.snippet) return null;
      const s = body.snippet;
      if (!s.snippet_body?.trim()) return null;
      return { text: s.snippet_body, pixelTrackingUrl: s.pixel_tracking_url ?? "" };
    } catch (err) {
      console.error(`[musixmatch] track.snippet.get failed for ${trackId}:`, err);
      return null;
    }
  }
}
