// The messaging half of the mock: a contact header, the conversation thread, and
// the compose field. The draft mirrors what the user "types" on the Say It
// keyboard below — their words plus any lyric line-completion they picked. Sending
// drops the finished line into the thread.

import { useEffect, useRef } from "react";

/** A message in the mock thread. */
export type ThreadMessage = { id: string; role: "in" | "out"; text: string };

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

          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role}`}>
              {m.text}
            </div>
          ))}
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
