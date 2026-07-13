"use client";

// The prototype, presented as a phone. The user "types" a raw feeling on the
// Unsaid custom keyboard (or a hardware keyboard); when they pause on ~3+ words,
// the propose → resolve → verify loop runs behind /api/match and the matched song
// surfaces in the keyboard's suggestion panel. Sending it drops the song into the
// message thread — the unsaid thought, finished.
//
// All matching happens server-side; the browser never holds an API key.

import { useCallback, useEffect, useRef, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import MessageThread from "@/components/MessageThread";
import UnsaidKeyboard from "@/components/UnsaidKeyboard";
import type { ThreadMessage } from "@/components/MessageThread";
import { GENRES } from "@/lib/types";
import type { ApiResponse, EmptyResult, Genre, MatchResult } from "@/lib/types";

const MIN_WORDS = 3;
const DEBOUNCE_MS = 800;
const MAX_LEN = 140;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const SEED_THREAD: ThreadMessage[] = [
  { id: "seed", role: "in", kind: "text", text: "you went quiet on me. you good?" },
];

export default function Home() {
  const [text, setText] = useState("");
  const [genre, setGenre] = useState<Genre>(GENRES[0]);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [empty, setEmpty] = useState<EmptyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [thread, setThread] = useState<ThreadMessage[]>(SEED_THREAD);

  const requestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultRef = useRef<MatchResult | null>(null);
  const idRef = useRef(0);
  resultRef.current = result;

  // ── The propose → resolve → verify call ──────────────────────────────────
  const runMatch = useCallback(async (feeling: string, forGenre: Genre) => {
    const id = ++requestId.current;
    setLoading(true);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeling, genre: forGenre }),
      });
      const data = (await res.json()) as ApiResponse;
      if (id !== requestId.current) return; // superseded

      if (data.status === "match") {
        setResult(data);
        setEmpty(null);
      } else {
        setResult(null);
        setEmpty(data);
      }
    } catch {
      if (id !== requestId.current) return;
      setResult(null);
      setEmpty({ status: "empty", reason: "Couldn't reach the matcher." });
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setStatus("");
      }
    }
  }, []);

  // Debounced trigger — re-runs on text OR genre change (genre is a constraint).
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (countWords(text) < MIN_WORDS) {
      requestId.current++; // cancel any in-flight response
      setResult(null);
      setEmpty(null);
      setLoading(false);
      setStatus("");
      return;
    }

    setStatus("…");
    debounceTimer.current = setTimeout(() => void runMatch(text, genre), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [text, genre, runMatch]);

  // ── Keyboard input (on-screen keys + hardware) ────────────────────────────
  const handleChar = useCallback(
    (ch: string) => setText((t) => (t + ch).slice(0, MAX_LEN)),
    [],
  );
  const handleBackspace = useCallback(() => setText((t) => t.slice(0, -1)), []);

  // Insert the matched song into the thread and reset the draft.
  const insertSong = useCallback(() => {
    const r = resultRef.current;
    if (!r) return;
    setThread((prev) => [
      ...prev,
      {
        id: `m${++idRef.current}`,
        role: "out",
        kind: "song",
        whyItFits: r.whyItFits,
        title: r.canonical.title,
        artist: r.canonical.artist,
        artworkUrl: r.canonical.artworkUrl,
        listenUrl: r.canonical.listenUrl,
      },
    ]);
    requestId.current++; // cancel any in-flight response
    setText("");
    setResult(null);
    setEmpty(null);
  }, []);

  // Hardware keyboard convenience (nice on desktop; the on-screen keys are primary).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertSong();
      } else if (e.key === " ") {
        e.preventDefault();
        handleChar(" ");
      } else if (e.key.length === 1) {
        handleChar(e.key);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleChar, handleBackspace, insertSong]);

  return (
    <PhoneFrame>
      <MessageThread
        messages={thread}
        draft={text}
        canSend={!!result}
        onSend={insertSong}
      />
      <UnsaidKeyboard
        genre={genre}
        loading={loading}
        status={status}
        result={result}
        empty={empty}
        onGenreChange={setGenre}
        onKey={handleChar}
        onBackspace={handleBackspace}
        onReturn={insertSong}
      />
    </PhoneFrame>
  );
}
