// The Unsaid suggestion — rendered inside the keyboard panel, the way a keyboard
// extension surfaces a rich suggestion above the keys. Shows:
//   1. the model's why_it_fits line (coherence),
//   2. song metadata + artwork,
//   3. the lyric slot (licensed snippet, or the demo placeholder),
//   4. actions: listen + "Send" (insert the song into the thread).

import { useEffect } from "react";
import { PLACEHOLDER_LYRIC } from "@/lib/demo";
import type { MatchResult } from "@/lib/types";

/**
 * STUBBED TRACKING HOOK (demo placeholder).
 * A licensed lyric source (Musixmatch) requires firing an impression pixel when a
 * snippet is displayed. We only LOG it so the integration point is visible; we do
 * not beacon. Fires on the licensed path only.
 */
function fireLyricImpressionTracking(trackingUrl: string): void {
  // eslint-disable-next-line no-console
  console.log("[tracking hook] lyric impression — would fire pixel:", trackingUrl);
}

interface Props {
  result: MatchResult;
  onInsert: () => void;
}

export default function SuggestionCard({ result, onInsert }: Props) {
  const { whyItFits, canonical, lyricSnippet, attribution, trackingUrl, lyricKind } =
    result;

  useEffect(() => {
    if (lyricKind === "licensed" && trackingUrl) fireLyricImpressionTracking(trackingUrl);
  }, [lyricKind, trackingUrl]);

  return (
    <div className="suggestion">
      {/* (1) the coherence line */}
      <p className="why">{whyItFits}</p>

      {/* (2) metadata + artwork */}
      <div className="sug-track">
        {canonical.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="art" src={canonical.artworkUrl} alt={`${canonical.title} cover`} />
        ) : null}
        <div className="meta">
          <span className="t">{canonical.title}</span>
          <span className="a">
            {canonical.artist}
            {canonical.album ? ` · ${canonical.album}` : ""}
          </span>
        </div>
      </div>

      {/* (3) lyric slot */}
      {lyricKind === "licensed" && lyricSnippet ? (
        <blockquote className="snippet">{lyricSnippet}</blockquote>
      ) : lyricKind === "placeholder" ? (
        <blockquote className="snippet snippet--placeholder">
          <span className="snippet-tag">licensed lyric</span>
          {PLACEHOLDER_LYRIC}
          <span className="snippet-caption">
            Add a lyrics API key (e.g. Musixmatch) to show the real line.
          </span>
        </blockquote>
      ) : null}

      {/* preview clip when available (iTunes) */}
      {canonical.previewUrl ? (
        <audio className="preview" controls preload="none" src={canonical.previewUrl}>
          Your browser doesn&rsquo;t support audio previews.
        </audio>
      ) : null}

      {/* (4) actions */}
      <div className="sug-actions">
        {canonical.listenUrl ? (
          <a
            className="link-listen"
            href={canonical.listenUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Listen ↗
          </a>
        ) : null}
        <button className="btn-insert" onClick={onInsert}>
          Send ↑
        </button>
      </div>

      {/* attribution — licensed path shows Musixmatch; free path credits iTunes */}
      <p className="attribution">
        {attribution ? (
          <>
            {attribution.replace(/ Musixmatch$/, " ")}
            <a href="https://www.musixmatch.com" target="_blank" rel="noreferrer noopener">
              Musixmatch
            </a>
          </>
        ) : (
          "Metadata via Apple iTunes"
        )}
      </p>
    </div>
  );
}
