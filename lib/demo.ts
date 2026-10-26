// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE — makes the prototype fully runnable with ZERO API keys.
// ─────────────────────────────────────────────────────────────────────────────
// Two pieces:
//   1. demoPropose() — a keyless stand-in for STAGE 1 when no Anthropic key is set.
//      It picks a real, well-known song from a small per-genre bank (deterministic
//      per feeling), so typing ~3 words always yields a candidate the free iTunes
//      resolver can confirm. The propose → resolve → verify loop is otherwise
//      untouched — only the "brain" of the proposer changes.
//   2. PLACEHOLDER_LYRIC — the honest placeholder shown in the lyric slot so the
//      demo card looks complete and shows exactly where the licensed line lands.

import type { Genre, Proposal } from "./types";

/**
 * The text shown in the lyric slot in demo mode. It is intentionally NOT a real
 * (or realistic-fake) lyric — reproducing licensed lyric text is the exact thing
 * this project's architecture exists to avoid. It marks the slot the real,
 * rights-cleared line will occupy once a lyrics API key is added.
 */
export const PLACEHOLDER_LYRIC =
  "The licensed lyric that finishes your thought lands right here.";

/**
 * Demo stand-in for line-completion. NOT a real lyric — reproducing lyric text is
 * the exact thing the licensing boundary exists to prevent. Marks where the real
 * next words of the chosen song would be inserted once a lyrics license is connected.
 */
export function demoContinuation(title: string): string {
  return `⟨ next lyric line of "${title}" — add a lyrics license ⟩`;
}

/** A small bank of real, easily-resolved songs per genre for the keyless demo. */
const DEMO_SONGS: Record<Genre, ReadonlyArray<{ song: string; artist: string }>> = {
  Pop: [
    { song: "Someone Like You", artist: "Adele" },
    { song: "When I Was Your Man", artist: "Bruno Mars" },
    { song: "Back to December", artist: "Taylor Swift" },
    { song: "Dancing On My Own", artist: "Robyn" },
    { song: "All I Want", artist: "Kodaline" },
  ],
  "Hip-Hop/Rap": [
    { song: "Marvins Room", artist: "Drake" },
    { song: "Song Cry", artist: "Jay-Z" },
    { song: "Love Yourz", artist: "J. Cole" },
    { song: "Passionfruit", artist: "Drake" },
    { song: "u", artist: "Kendrick Lamar" },
  ],
  "R&B/Soul": [
    { song: "Best Part", artist: "Daniel Caesar" },
    { song: "Cranes in the Sky", artist: "Solange" },
    { song: "Ex-Factor", artist: "Lauryn Hill" },
    { song: "Adorn", artist: "Miguel" },
    { song: "Come Through and Chill", artist: "Miguel" },
  ],
  Rock: [
    { song: "The Night We Met", artist: "Lord Huron" },
    { song: "Yellow", artist: "Coldplay" },
    { song: "Creep", artist: "Radiohead" },
    { song: "Everlong", artist: "Foo Fighters" },
    { song: "Fake Plastic Trees", artist: "Radiohead" },
  ],
  "Indie/Alt": [
    { song: "Skinny Love", artist: "Bon Iver" },
    { song: "Motion Sickness", artist: "Phoebe Bridgers" },
    { song: "First Day of My Life", artist: "Bright Eyes" },
    { song: "Re: Stacks", artist: "Bon Iver" },
    { song: "Two", artist: "Sleeping At Last" },
  ],
  Country: [
    { song: "The House That Built Me", artist: "Miranda Lambert" },
    { song: "Whiskey Lullaby", artist: "Brad Paisley" },
    { song: "Cover Me Up", artist: "Jason Isbell" },
    { song: "Tin Man", artist: "Miranda Lambert" },
    { song: "If I Die Young", artist: "The Band Perry" },
  ],
};

/** Stable index from the feeling text, so the same input picks the same song. */
function hashIndex(text: string, length: number): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return length ? h % length : 0;
}

/**
 * Keyless stand-in for the model. Returns the deterministically-picked song for
 * this feeling first, then the rest of the genre bank as fallbacks (so the loop
 * still has alternatives if the top pick somehow fails to resolve).
 */
export function demoPropose(feeling: string, genre: Genre): Proposal[] {
  const bank = DEMO_SONGS[genre];
  const start = hashIndex(feeling.toLowerCase(), bank.length);

  // Rotate the bank so the picked song is first, others follow as backups.
  const ordered = bank.map((_, i) => bank[(start + i) % bank.length]);

  const feltShort = feeling.trim().replace(/\s+/g, " ").slice(0, 60);

  return ordered.map(({ song, artist }) => ({
    song,
    artist,
    why_it_fits: `${artist} already put "${feltShort}" into words in "${song}."`,
  }));
}
