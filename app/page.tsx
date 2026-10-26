"use client";

// The prototype, presented as a phone. The user "types" a raw feeling on the
// Say It custom keyboard; when they pause on ~3+ words, the propose → resolve →
// verify loop runs behind /api/match and song options surface above the keys.
// Picking one appends that song's next lyric words to the draft (line-completion);
// sending drops the finished line into the thread.
//
// All matching happens server-side; the browser never holds an API key.

import { useCallback, useEffect, useRef, useState } from "react";
import PhoneFrame from "@/components/PhoneFrame";
import MessageThread from "@/components/MessageThread";
import SayItKeyboard from "@/components/SayItKeyboard";
import type { ThreadMessage } from "@/components/MessageThread";
import { GENRES } from "@/lib/types";
import type { ApiResponse, Genre, MatchResult } from "@/lib/types";

const MIN_WORDS = 3;
const DEBOUNCE_MS = 800;
const MAX_LEN = 140;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const SEED_THREAD: ThreadMessage[] = [
  { id: "seed", role: "in", text: "you went quiet on me. you good?" },
];

export default function Home() {
  const [text, setText] = useState("");
  const [genre, setGenre] = useState<Genre>(GENRES[0]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<ThreadMessage[]>(SEED_THREAD);

  const requestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);
  const textRef = useRef("");
  textRef.current = text;
  // After a line-completion is inserted, don't immediately re-match on the new
  // (longer) text — wait until the user edits again.
  const suppressMatch = useRef<string | null>(null);

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

      setResults(data.status === "matches" ? data.results : []);
    } catch {
      if (id !== requestId.current) return;
      setResults([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Debounced trigger — re-runs on text OR genre change (genre is a constraint).
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Just inserted a completion into this exact text → stay collapsed.
    if (text === suppressMatch.current) return;

    if (countWords(text) < MIN_WORDS) {
      requestId.current++; // cancel any in-flight response
      setResults([]);
      setLoading(false);
      return;
    }

    debounceTimer.current = setTimeout(() => void runMatch(text, genre), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [text, genre, runMatch]);

  // ── Keyboard input (on-screen keys + hardware) ────────────────────────────
  const handleChar = useCallback((ch: string) => {
    suppressMatch.current = null; // user is editing again → allow re-matching
    setText((t) => (t + ch).slice(0, MAX_LEN));
  }, []);
  const handleBackspace = useCallback(() => {
    suppressMatch.current = null;
    setText((t) => t.slice(0, -1));
  }, []);

  // Pick a song → append its next lyric words to the draft (line-completion) and
  // collapse the options. The message isn't sent yet — the user reviews, then sends.
  const selectSong = useCallback((r: MatchResult) => {
    if (r.lyricKind === "licensed" && r.trackingUrl) {
      // eslint-disable-next-line no-console
      console.log("[tracking hook] lyric impression — would fire pixel:", r.trackingUrl);
    }
    setText((t) => {
      const next = `${t.trimEnd()} ${r.continuation}`.slice(0, MAX_LEN);
      suppressMatch.current = next; // don't re-open options for the completed line
      return next;
    });
    requestId.current++; // cancel any in-flight response
    setResults([]);
  }, []);

  // Send the composed message (their words + any inserted lyric line) to the thread.
  const sendMessage = useCallback(() => {
    const body = textRef.current.trim();
    if (!body) return;
    setThread((prev) => [...prev, { id: `m${++idRef.current}`, role: "out", text: body }]);
    requestId.current++;
    suppressMatch.current = null;
    setText("");
    setResults([]);
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
        sendMessage();
      } else if (e.key === " ") {
        e.preventDefault();
        handleChar(" ");
      } else if (e.key.length === 1) {
        handleChar(e.key);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleChar, handleBackspace, sendMessage]);

  return (
    <PhoneFrame>
      <MessageThread
        messages={thread}
        draft={text}
        canSend={text.trim().length > 0}
        onSend={sendMessage}
      />
      <SayItKeyboard
        genre={genre}
        loading={loading}
        results={results}
        onGenreChange={setGenre}
        onSelect={selectSong}
        onKey={handleChar}
        onBackspace={handleBackspace}
        onReturn={sendMessage}
      />
    </PhoneFrame>
  );
}
