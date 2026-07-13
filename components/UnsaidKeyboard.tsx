// The "Unsaid" custom keyboard. Three stacked surfaces, top to bottom:
//   1. a genre strip (the repurposed predictive-text bar) — user-mutable mood,
//   2. the Unsaid suggestion panel — the live song match above the keys,
//   3. a functional QWERTY keyboard (letters + a symbols layer, shift, space,
//      backspace, return).
//
// The keys drive the draft text in the parent. `onKey` receives a ready-to-insert
// character (shift/layer already applied); backspace/return are separate.

import { useState } from "react";
import GenreSelector from "./GenreSelector";
import SuggestionCard from "./SuggestionCard";
import type { EmptyResult, Genre, MatchResult } from "@/lib/types";

const LETTER_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'],
  [".", ",", "?", "!", "'"],
];

interface Props {
  genre: Genre;
  loading: boolean;
  status: string;
  result: MatchResult | null;
  empty: EmptyResult | null;
  onGenreChange: (g: Genre) => void;
  onKey: (char: string) => void;
  onBackspace: () => void;
  onReturn: () => void;
}

export default function UnsaidKeyboard({
  genre,
  loading,
  status,
  result,
  empty,
  onGenreChange,
  onKey,
  onBackspace,
  onReturn,
}: Props) {
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);

  const rows = symbols ? SYMBOL_ROWS : LETTER_ROWS;

  function pressChar(raw: string) {
    const ch = !symbols && shift ? raw.toUpperCase() : raw;
    onKey(ch);
    if (shift) setShift(false);
  }

  return (
    <div className="keyboard">
      {/* 1 — genre / mood strip */}
      <div className="genre-strip">
        <span className="lbl">Mood</span>
        <GenreSelector value={genre} onChange={onGenreChange} />
      </div>

      {/* 2 — Unsaid suggestion panel */}
      <div className="panel">
        <div className="panel-head">
          <span className="wordmark">
            Unsaid<span className="dot">.</span>
          </span>
          <span className={`panel-status${loading ? " loading" : ""}`}>
            {loading ? "finding the words…" : status}
          </span>
        </div>

        {result ? (
          <SuggestionCard result={result} onInsert={onReturn} />
        ) : empty ? (
          <p className="hint">{empty.reason}</p>
        ) : (
          <p className="hint">
            Type what you can&rsquo;t quite say — Unsaid finds the song that already
            said it.
          </p>
        )}
      </div>

      {/* 3 — QWERTY keys */}
      <div className="keys">
        <div className="krow">
          {rows[0].map((k) => (
            <button key={k} className="key" onClick={() => pressChar(k)}>
              {!symbols && shift ? k.toUpperCase() : k}
            </button>
          ))}
        </div>

        <div className="krow indent">
          {rows[1].map((k) => (
            <button key={k} className="key" onClick={() => pressChar(k)}>
              {!symbols && shift ? k.toUpperCase() : k}
            </button>
          ))}
        </div>

        <div className="krow">
          {!symbols ? (
            <button
              className={`key special${shift ? " active" : ""}`}
              onClick={() => setShift((s) => !s)}
              aria-label="Shift"
            >
              ⇧
            </button>
          ) : null}
          {rows[2].map((k) => (
            <button key={k} className="key" onClick={() => pressChar(k)}>
              {!symbols && shift ? k.toUpperCase() : k}
            </button>
          ))}
          <button className="key special" onClick={onBackspace} aria-label="Backspace">
            ⌫
          </button>
        </div>

        <div className="krow">
          <button
            className="key special"
            onClick={() => {
              setSymbols((s) => !s);
              setShift(false);
            }}
          >
            {symbols ? "ABC" : "123"}
          </button>
          <button className="key wide" onClick={() => onKey(" ")}>
            space
          </button>
          <button className="key special return" onClick={onReturn}>
            return
          </button>
        </div>
      </div>
    </div>
  );
}
