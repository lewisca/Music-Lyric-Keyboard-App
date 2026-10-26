# Say It

An emotional-articulation prototype. You type a raw, half-formed feeling; Say It
finds a song whose *meaning* captures it — so a thought you couldn't finish gets
finished for you.

This is a **non-commercial proof-of-concept for a portfolio**. It demonstrates an
interaction model and an architecture pattern; it is not a shipped product. The
web UI *mocks* a keyboard surface — there is no iOS keyboard extension here.

## The pattern (the whole point)

`propose → resolve → verify`

1. **Propose** — your feeling + the selected genre go to Claude, which proposes
   1–3 songs whose meaning fits (semantic, not keyword, matching). Output is
   strict JSON, treated as a *hypothesis*.
2. **Resolve** — each proposal is checked against a real catalog through a
   **pluggable resolver**. If the song doesn't resolve, it's dropped.
3. **Verify / suppress** — the first proposal that resolves is shown; unresolved
   ones are dropped silently. An unverified suggestion is never shown.

The resolution *source* is swappable behind one interface, and it's the only
thing that changed when Musixmatch dropped its free tier:

- **Default — iTunes Search API (free, keyless).** Confirms the song and returns
  title, artist, album, cover art, a "listen" link, and a 30s preview. **No
  lyrics** — so the demo shows no lyric text and sidesteps lyric licensing.
- **Optional — Musixmatch (licensed, off by default).** Same interface; when
  enabled with a key, it adds a lyric snippet + attribution + the tracking hook.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the loop, the no-store lyric policy,
and the demo → upgrade → endgame licensing ladder.

## Run it

```bash
npm install
cp .env.example .env   # add your Anthropic key; the resolver defaults to free iTunes
npm run dev            # http://localhost:3000
```

You need **one** key to get real matches:

- `ANTHROPIC_API_KEY` — for the propose step ([console.anthropic.com](https://console.anthropic.com/)).

The resolver defaults to the **free, keyless iTunes source** — no second key
required. Without the Anthropic key the app still runs and degrades gracefully to
the empty state.

### Using the licensed resolver (optional)

Set `RESOLVER=musixmatch` and provide `MUSIXMATCH_API_KEY` (paid plan). The
propose loop is unchanged; the result card then also renders the lyric snippet,
its attribution, and fires the tracking hook. If the key is missing, Say It falls
back to iTunes — no key is ever *required* to run.

## The interface — a keyboard, mocked

Because the real product is an **iOS keyboard extension**, the demo is presented
as a phone: an iMessage-style thread on top, and the **Say It custom keyboard**
below (a Mood/genre strip, a live suggestion panel, and a working QWERTY). You
"type" a feeling on the on-screen keys (a hardware keyboard also works); when you
pause on ~3+ words, the matched song surfaces in the keyboard's suggestion panel
the way a keyboard extension would offer it. Tapping **Send** drops the song into
the thread — the unsaid thought, finished.

Change the Mood chip at any time to re-run the match on the same text: the same
feeling in a different genre yields a different song, because genre is a
*constraint on matching*, not a filter.

## Stack

- **Next.js (App Router)** — one app; the external calls live in a single server
  route (`app/api/match/route.ts`), so keys never reach the client.
- **React** — a lightweight, single-screen front end styled to mimic a phone.

Readability is prioritized over cleverness — this is meant to be read.

## Layout

```
app/
  page.tsx                controller: keyboard input, debounce, fetch, thread state
  api/match/route.ts      the only endpoint the client hits; runs all 3 stages
lib/
  propose.ts              STAGE 1 — Claude proposes candidate songs (strict JSON)
  demo.ts                 keyless demo proposer + lyric-slot placeholder
  types.ts                shared types, seed genres, and the Resolver interface
  resolvers/
    index.ts              factory — picks the source from env (defaults to demo)
    demo.ts               real metadata (iTunes) + placeholder lyric slot
    itunes.ts             free, keyless metadata + preview
    musixmatch.ts         optional licensed adapter — adds snippet + attribution
components/
  PhoneFrame.tsx          device shell — status bar, dynamic island, bezel
  MessageThread.tsx       iMessage-style thread + composer + song "share" bubble
  SayItKeyboard.tsx       Mood strip + song-options panel + functional QWERTY
  GenreSelector.tsx       user-mutable Mood/genre chips
```
