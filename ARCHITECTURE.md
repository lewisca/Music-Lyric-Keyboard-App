# Architecture

Unsaid is built around one loop — **propose → resolve → verify** — and one hard
rule: **lyric text is never stored.** The resolution *source* sits behind a single
interface, so what the demo can legally display is a function of which source is
plugged in — not of the architecture, which never changes.

## Why this shape exists

A language model is very good at reading an emotion and naming a song that fits
it. It is *not* a source of truth about whether that song exists, who recorded
it, or what its lyrics are — models hallucinate titles, misattribute artists, and
cannot legally reproduce lyrics. So Unsaid uses the model for what it's good at
(semantic matching) and a catalog for what it's good at (existence, canonical
metadata, and — with a license — a rights-cleared snippet).

The loop is the seam between those two responsibilities. Everything the model
says is a **hypothesis** until a catalog confirms it.

```
  user's feeling  ─┐
  selected genre  ─┴─▶  [1 PROPOSE]  Claude → 1–3 candidate songs (strict JSON)
                                        │      each = { song, artist, why_it_fits }
                                        │      HYPOTHESIS, never fact
                                        ▼
                        [2 RESOLVE]  Resolver.resolve({ song, artist })
                                        │      pluggable source (iTunes | Musixmatch)
                                        │      found?    → canonical metadata (+ maybe snippet)
                                        │      not found → drop, try next proposal
                                        ▼
                        [3 VERIFY]   `found` is the suppress gate
                                        │      shown only if a source confirmed it
                                        ▼
                        result card: why_it_fits → metadata + listen/preview
                                     (+ snippet + attribution, licensed source only)
```

All three stages run **server-side**, inside a single route (`app/api/match/route.ts`).
The browser sends a feeling and a genre and receives either a verified match or a
graceful empty state — it never holds an API key and never talks to the model or
any catalog directly.

## The Resolver interface

Resolution is pluggable. Both sources implement one method:

```ts
interface Resolver {
  resolve({ song, artist }): Promise<{
    found: boolean;
    canonical: { title, artist, album, artworkUrl, listenUrl, previewUrl };
    lyricSnippet?: string;   // licensed source only
    attribution?: string;    // licensed source only
    trackingUrl?: string;    // licensed source only
  }>;
}
```

The loop calls `resolve()` and does not know or care which source answered. It
reads `found` to decide whether to suppress, and passes through whatever licensed
fields the source populated. Swapping the source changes what may be *displayed*;
it changes nothing about the loop. A factory (`lib/resolvers/index.ts`) picks the
source from `RESOLVER`, defaulting to the free one and falling back to it if a
licensed key is missing — so the demo always runs.

### Stage 1 — Propose (`lib/propose.ts`)

The feeling is sent to Claude with the selected **genre injected as a constraint**.
Genre narrows the candidate space *before* the model proposes; it is not a filter
applied to results afterward. That's why switching genre on the same text yields a
different song — the UI re-reads the genre on every query, so it tracks the user's
shifting mood. The model returns strict JSON:

```json
[{ "song": "...", "artist": "...", "why_it_fits": "<one original sentence>" }]
```

`why_it_fits` is the model's own sentence about the emotional bridge between the
feeling and the song. **This is where the product's coherence lives** — see below.

### Stage 2 — Resolve (`lib/resolvers/*`)

For the top proposal, the active resolver confirms the song against a real
catalog and returns canonical metadata. This is the gate that turns a hypothesis
into a fact.

- **iTunes (default, free, keyless):** `GET /search?term=<artist song>&entity=song&limit=1`.
  Maps the top hit → title, artist, album, artwork, listen link, and a 30s
  preview. Returns **no lyrics** — intended; the licensed fields stay empty.
- **Musixmatch (optional, licensed):** `matcher.track.get` then `track.snippet.get`,
  populating the licensed fields with a rights-cleared snippet, attribution, and a
  tracking pixel URL.

### Stage 3 — Verify / suppress (`app/api/match/route.ts`)

`found` is the verify gate. The route walks proposals best-first and returns the
first that resolves; anything that doesn't resolve is **dropped silently**. If none
resolve, it returns an empty state. **An unverified suggestion is never displayed.**

## Why lyrics are never stored

Two reasons, one legal and one architectural, pointing the same way:

- **Licensing.** On the free path there are simply no lyrics to store. On the
  licensed path, the snippet is rights-cleared *for live display via the API*,
  with its attribution and tracking pixel attached — persisting it (to a database,
  cache, log, or the repo) would be reproducing licensed text outside those terms.
  So a snippet is fetched fresh per request and held only for that response.
- **Architecture honesty.** The point of the prototype is that a lyric, when
  shown at all, is a *borrowed, verified artifact* — not owned content. There is
  no lyric string anywhere in this repository, none written to disk, and the match
  route is `force-dynamic` so nothing about a response is cached.

Every *licensed* snippet the UI renders carries, enforced in `ResultCard.tsx`:
(a) the attribution/copyright notice, (b) a tracking hook (a clearly commented
placeholder for the required impression pixel — it logs rather than beacons, since
this is a demo), and (c) a "listen" link. On the free path none of these lyric
concerns apply; the card shows metadata, a listen link, and the preview.

## Coherence comes from the model, not a lyric

The demo shows **no lyric text at all** (iTunes has none), yet it still feels
coherent — because coherence is carried by the model's original `why_it_fits`
line, which is written against the user's actual input. The UI renders that line
prominently, above everything else.

Even on the licensed path this holds: `track.snippet.get` returns a **fixed hook**
— a set sequence of words from the song that does *not* echo the user's feeling.
So the lyric is proof-of-song, not the emotional match; the sentence is the match.

## The licensing ladder — demo → upgrade → endgame

Same architecture at every rung. Licensing only widens what may be displayed.

| Rung | Resolution source | What's shown | What it is |
|------|-------------------|--------------|------------|
| **Demo** (now) | iTunes (free) | why-it-fits · metadata · artwork · listen + 30s preview | Mood → verified song. No lyric text, no lyric licensing. |
| **Upgrade** | Musixmatch Basic (licensed) | the above **+ lyric snippet + attribution** | Same loop; a rights-cleared hook is added to the card. |
| **Endgame** | Full commercial lyric license | the above **+ full-lyric access + server-side line selection** | True **line-completion**: resolve to the exact line that finishes the user's thought, offered in place as they type. |

The `propose → resolve → verify` loop is identical across all three; only the
resolver behind Stage 2 (and therefore the licensed fields it may return) changes.
The seam is already where the endgame needs it.

## Free-tier realities that shaped the design

- The default resolver (iTunes) is free and keyless, so the demo has no per-call
  cost pressure — but debouncing the input and waiting for ~3+ words is still the
  right behavior, and it becomes a real cost control the moment a paid resolver or
  the model calls are in play.
- On the licensed path, `track.snippet.get` returns a fixed hook (see the
  coherence note), and its attribution + tracking pixel come back in the response
  and must be rendered — the card treats them as required parts of the result, not
  optional chrome.
