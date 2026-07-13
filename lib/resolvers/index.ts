// Resolver factory. Picks the resolution source from the environment while
// guaranteeing the demo always runs — and, by default, always shows the lyric slot:
//
//   RESOLVER=demo (default)  → real metadata (iTunes) + a PLACEHOLDER lyric slot.
//                              Zero keys. Shows exactly where the licensed line lands.
//   RESOLVER=itunes          → real metadata only, no lyric slot at all.
//   RESOLVER=musixmatch      → licensed adapter (paid): real lyric snippet +
//                              attribution + tracking. Requires MUSIXMATCH_API_KEY;
//                              if the key is missing, falls back to demo mode.
//
// No key is ever required to run.

import { DemoResolver } from "./demo";
import { ITunesResolver } from "./itunes";
import { MusixmatchResolver } from "./musixmatch";
import type { Resolver } from "../types";

export function getResolver(): Resolver {
  const choice = (process.env.RESOLVER ?? "demo").toLowerCase();

  if (choice === "musixmatch") {
    const key = process.env.MUSIXMATCH_API_KEY;
    if (key) return new MusixmatchResolver(key);
    console.warn(
      "[resolver] RESOLVER=musixmatch but MUSIXMATCH_API_KEY is unset — " +
        "falling back to demo mode (real metadata + placeholder lyric slot).",
    );
  }

  // Pure metadata, no lyric slot.
  if (choice === "itunes") return new ITunesResolver();

  // Default: demo mode — real metadata with a placeholder lyric slot.
  return new DemoResolver(new ITunesResolver());
}
