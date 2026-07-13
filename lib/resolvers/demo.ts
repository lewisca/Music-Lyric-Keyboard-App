// ─────────────────────────────────────────────────────────────────────────────
// DEMO RESOLVER — wraps a real metadata source and fills the lyric slot.
// ─────────────────────────────────────────────────────────────────────────────
// The default demo experience: get real song/artist/artwork/preview from the
// keyless iTunes source, then mark the result so the UI renders the lyric slot
// with a PLACEHOLDER. This shows exactly where (and how) the real licensed lyric
// will appear — without shipping any lyric text or needing a lyrics API key.
//
// The moment a licensed resolver is used instead (RESOLVER=musixmatch + key), the
// placeholder is replaced by the real snippet + attribution automatically.

import type { Resolution, ResolveInput, Resolver } from "../types";

export class DemoResolver implements Resolver {
  readonly name = "demo";

  constructor(private readonly inner: Resolver) {}

  async resolve(input: ResolveInput): Promise<Resolution> {
    const result = await this.inner.resolve(input);

    // Only decorate real, found songs. If the inner source already supplied a
    // licensed lyric, leave it alone.
    if (!result.found || result.lyricSnippet) return result;

    return { ...result, lyricKind: "placeholder" };
  }
}
