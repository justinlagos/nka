"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { from: "nka" | "you"; text: string };
type Saved = { msgs: Msg[]; conversationId: string | null };

// Abigail, the support assistant, in the corner of the client workspace. The browser only sends the
// text and the conversation it's in; the server works out who is asking (see /api/support/chat).
// The chat is kept for this browser tab, per person and organisation, so moving between pages
// doesn't lose it and someone else signing in on the same tab doesn't see it.

// Replies are plain text. Links (bare, or written [like this](https://...)) become links; ** is dropped.
const LINK_RE = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'")\]])/g;

function Linked({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const at = m.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at).replace(/\*\*/g, ""));
    const href = m[2] ?? m[3];
    const own = href.startsWith(window.location.origin);
    const label = m[1] ?? (own ? href.slice(window.location.origin.length) || "/" : href);
    nodes.push(
      <a key={at} href={href} {...(own ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
        {label}
      </a>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last).replace(/\*\*/g, ""));
  return <p>{nodes}</p>;
}

function load(key: string): Saved {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (Array.isArray(s.msgs)) return { msgs: s.msgs.slice(-60), conversationId: typeof s.conversationId === "string" ? s.conversationId : null };
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return { msgs: [], conversationId: null };
}

export function SupportChat({ userId, orgId, firstName }: { userId: string; orgId: string; firstName: string }) {
  const key = `nka-support-${userId}-${orgId}`;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = load(key);
    setMsgs(s.msgs);
    setConversationId(s.conversationId);
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return; // don't overwrite the saved chat before it's been read
    try {
      sessionStorage.setItem(key, JSON.stringify({ msgs, conversationId }));
    } catch {
      /* not saved: the chat still works */
    }
  }, [key, loaded, msgs, conversationId]);

  useEffect(() => {
    if (open) {
      end.current?.scrollIntoView({ block: "end" });
      input.current?.focus();
    }
  }, [open, msgs, thinking]);

  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || thinking) return;
    setError("");
    setText("");
    setMsgs((m) => [...m, { from: "you", text: message }]);
    setThinking(true);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; conversationId?: string | null; error?: string };
      if (!res.ok || !data.reply) {
        setError(data.error ?? "Something went wrong. Try again.");
        if (res.status !== 429) setText(message);
        setMsgs((m) => m.slice(0, -1));
      } else {
        setMsgs((m) => [...m, { from: "nka", text: data.reply! }]);
        setConversationId(data.conversationId ?? null);
      }
    } catch {
      setError("You seem to be offline. Try again.");
      setText(message);
      setMsgs((m) => m.slice(0, -1));
    } finally {
      setThinking(false);
    }
  }

  function startOver() {
    setMsgs([]);
    setConversationId(null);
    setError("");
    input.current?.focus();
  }

  return (
    <div className="support">
      {open && (
        <section
          className="support-panel"
          role="dialog"
          aria-label="Support chat with Abigail"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <header className="support-head">
            <div>
              <b>Abigail</b>
              <span>Nka support assistant (AI)</span>
            </div>
            <div className="support-head-actions">
              {msgs.length > 0 && (
                <button type="button" className="support-link" onClick={startOver}>
                  New chat
                </button>
              )}
              <button type="button" className="support-close" onClick={close} aria-label="Close support chat">
                ×
              </button>
            </div>
          </header>

          <div className="chat-log support-log" aria-live="polite">
            <div className="chat-msg nka">
              <p>
                Hi{firstName ? ` ${firstName}` : ""}, I&apos;m Abigail. I can check your projects, dates, team hours and files, and
                explain how Nka works. I can&apos;t change anything; if you need a person, I&apos;ll pass it to the studio.
              </p>
            </div>
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.from}`}>
                {m.from === "nka" ? <Linked text={m.text} /> : <p>{m.text}</p>}
              </div>
            ))}
            {thinking && (
              <div className="chat-msg nka">
                <p className="typing" aria-label="Abigail is writing">
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            )}
            <div ref={end} />
          </div>

          {error && (
            <p className="support-error" role="alert">
              {error}
            </p>
          )}

          <form
            className="chat-input support-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <label className="skip" htmlFor="support-text">
              Message Abigail
            </label>
            <textarea
              id="support-text"
              ref={input}
              rows={2}
              value={text}
              maxLength={1500}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              placeholder="When is my next delivery due?"
            />
            <div className="chat-actions">
              <button type="submit" className="btn btn-small" disabled={thinking || !text.trim()}>
                Send
              </button>
            </div>
            <p className="support-note">
              Abigail is an AI assistant run on Custard AI. Don&apos;t share passwords, card numbers or sign-in codes.{" "}
              <a href="/legal/privacy" target="_blank" rel="noopener">
                Privacy
              </a>
            </p>
          </form>
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        className="support-launch"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? "Close help" : "Help"}
      </button>
    </div>
  );
}
