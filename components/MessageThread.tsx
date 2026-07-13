// The messaging half of the mock: a contact header, the conversation thread, and
// the compose field. The draft mirrors what the user "types" on the Unsaid
// keyboard below. Tapping send (or inserting a match) drops a song bubble into
// the thread — the completed, unsaid thought.

import { useEffect, useRef } from "react";

/** A message in the mock thread. Text bubbles, plus the Unsaid "song share". */
export type ThreadMessage =
  | { id: string; role: "in" | "out"; kind: "text"; text: string }
  | {
      id: string;
      role: "out";
      kind: "song";
      whyItFits: string;
      title: string;
      artist: string;
      artworkUrl: string;
      listenUrl: string;
    };

interface Props {
  messages: ThreadMessage[];
  draft: string;
  canSend: boolean;
  onSend: () => void;
}

export default function MessageThread({ messages, draft, canSend, onSend }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the latest bubble in view as the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <>
      <span className="back" aria-hidden>
        ‹
      </span>
      <header className="msg-header">
        <div className="avatar" aria-hidden>
          ♡
        </div>
        <div className="who">
          Sam <span className="chev">›</span>
        </div>
      </header>

      <div className="messages">
        <div className="thread">
          <div className="stamp">Today 9:41 AM</div>

          {messages.map((m) =>
            m.kind === "text" ? (
              <div key={m.id} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="song-bubble">
                <p className="why">{m.whyItFits}</p>
                <div className="song-row">
                  {m.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="art" src={m.artworkUrl} alt="" />
                  ) : null}
                  <div className="meta">
                    <span className="t">{m.title}</span>
                    <span className="a">{m.artist}</span>
                  </div>
                  {m.listenUrl ? (
                    <a
                      className="play"
                      href={m.listenUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Listen"
                    >
                      ▶
                    </a>
                  ) : null}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        <div className="composer">
          <div className={`field${draft ? "" : " empty"}`}>
            {draft || "iMessage"}
            {draft ? <span className="caret" /> : null}
          </div>
          <button
            className="send-btn"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
