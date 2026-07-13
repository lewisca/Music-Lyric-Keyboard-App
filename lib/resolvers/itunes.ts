// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT RESOLVER — iTunes Search API (free, keyless)
// ─────────────────────────────────────────────────────────────────────────────
// Apple's iTunes Search API confirms a song exists and returns rich metadata
// (title, artist, album, artwork, a "listen" link, and a 30s preview clip) with
// NO key and NO OAuth. It returns NO lyrics — that is intended. On this path the
// licensed-only fields (lyricSnippet / attribution / trackingUrl) stay empty, so
// the demo never displays lyric text and sidesteps lyric licensing entirely.
//
// Runs SERVER-SIDE only (like every resolver).

import type { Resolution, ResolveInput, Resolver } from "../types";

const ITUNES_SEARCH = "https://itunes.apple.com/search";

/** The fields we read from an iTunes song result. */
interface ITunesResult {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
  previewUrl?: string;
}

interface ITunesResponse {
  resultCount: number;
  results: ITunesResult[];
}

/** An empty resolution — used for "not found" and error paths. */
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

export class ITunesResolver implements Resolver {
  readonly name = "itunes";

  async resolve({ song, artist }: ResolveInput): Promise<Resolution> {
    const term = `${artist} ${song}`.trim();
    const url =
      `${ITUNES_SEARCH}?term=${encodeURIComponent(term)}` +
      `&entity=song&limit=1`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[itunes] HTTP ${res.status} for "${term}"`);
        return notFound();
      }

      const data = (await res.json()) as ITunesResponse;
      const top = data.results?.[0];
      if (!data.resultCount || !top?.trackName) return notFound();

      // Bump the artwork to a larger size — iTunes returns 100px thumbnails but
      // the URL scales by swapping the dimension segment.
      const artwork = (top.artworkUrl100 ?? "").replace(
        "100x100bb",
        "300x300bb",
      );

      return {
        found: true,
        canonical: {
          title: top.trackName,
          artist: top.artistName ?? artist,
          album: top.collectionName ?? "",
          artworkUrl: artwork,
          listenUrl: top.trackViewUrl ?? "",
          previewUrl: top.previewUrl ?? "",
        },
        // No lyrics on this path — licensed-only fields intentionally left empty.
      };
    } catch (err) {
      console.error(`[itunes] request failed for "${term}":`, err);
      return notFound();
    }
  }
}
