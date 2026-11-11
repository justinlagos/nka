"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { briefTurn, sendBrief, type ChatMessage } from "@/app/app/brief-actions";

type Shown = ChatMessage & { options?: string[] };
type Ready = { projectId: string; title: string; summary: string; deliverables: string; deadline: string | null };

// Browsers that support dictation expose this under one of two names.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

// Talk-to-brief: say what you need, answer up to two quick questions, then choose
// Instant (AI, about a minute) or your designer.
export function BriefChat({ instant, instantLeft, compact = false }: { instant: boolean; instantLeft: number; compact?: boolean }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Shown[]>([]);
  const [text, setText] = useState("");
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState("");
  const [errorPath, setErrorPath] = useState("");
  const [thinking, startThinking] = useTransition();
  const [sending, setSending] = useState<"" | "instant" | "designer">("");
  const [listening, setListening] = useState(false);
  const [canTalk, setCanTalk] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setCanTalk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [msgs, ready, thinking]);

  const ask = (said: string) => {
    const t = said.trim();
    if (!t || thinking) return;
    const next: Shown[] = [...msgs, { from: "you", text: t }];
    setMsgs(next);
    setText("");
    setError("");
    startThinking(async () => {
      const r = await briefTurn(next.map(({ from, text }) => ({ from, text })));
      if (r.kind === "ask") setMsgs((m) => [...m, { from: "nka", text: r.text, options: r.options }]);
      else if (r.kind === "brief") setReady(r);
      else setError(r.text);
    });
  };

  const talk = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-GB";
    r.interimResults = true;
    r.continuous = false;
    const before = text ? text + " " : "";
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setText(before + said);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const go = async (lane: "instant" | "designer") => {
    if (!ready) return;
    setSending(lane);
    setError("");
    const r = await sendBrief(ready.projectId, lane);
    if (!r.ok) {
      setSending("");
      setError(r.error ?? "Couldn't send it. Try again.");
      setErrorPath(r.path ?? "");
      return;
    }
    router.push(r.path!);
  };

  return (
    <div className={`chat ${compact ? "chat-compact" : ""}`}>
      <div className="chat-log" aria-live="polite">
        {msgs.length === 0 && !ready && (
          <div className="chat-msg nka">
            <p>What do you need designed? Say it how you&apos;d say it to a colleague.</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`chat-msg ${m.from}`}>
            <p>{m.text}</p>
            {m.options && m.options.length > 0 && i === msgs.length - 1 && !thinking && !ready && (
              <div className="chips">
                {m.options.map((o) => (
                  <button key={o} type="button" className="chip" onClick={() => ask(o)}>
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="chat-msg nka">
            <p className="typing" aria-label="Writing">
              <span />
              <span />
              <span />
            </p>
          </div>
        )}
        {ready && (
          <div className="brief-card">
            <p className="eyebrow">Your brief is ready</p>
            <h3>{ready.title}</h3>
            <p>{ready.summary}</p>
            {ready.deliverables && (
              <ul className="ticks">
                {ready.deliverables
                  .split("\n")
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((d) => (
                    <li key={d}>{d}</li>
                  ))}
              </ul>
            )}
            <div className="lanes">
              {instant && (
                <button type="button" className="lane lane-ai" disabled={Boolean(sending) || instantLeft <= 0} onClick={() => go("instant")}>
                  <b>{sending === "instant" ? "Starting…" : "Make it now with AI"}</b>
                  <span>
                    {instantLeft > 0
                      ? `Three options in about a minute, in your brand. ${instantLeft} left this month.`
                      : "You've used this month's instant briefs."}
                  </span>
                </button>
              )}
              <button type="button" className="lane lane-human" disabled={Boolean(sending)} onClick={() => go("designer")}>
                <b>{sending === "designer" ? "Sending…" : "Send to my team"}</b>
                <span>Made by your team on your plan hours. You&apos;ll see the hours and a delivery date straight away.</span>
              </button>
            </div>
            <p className="small muted">
              <Link href={`/app/projects/${ready.projectId}/edit`}>Edit the details first</Link>
            </p>
          </div>
        )}
        <div ref={end} />
      </div>
      {!ready && (
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <label className="skip" htmlFor="chat-text">
            Message
          </label>
          <textarea
            id="chat-text"
            rows={compact ? 2 : 3}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(text);
              }
            }}
            placeholder={msgs.length ? "Type your answer, or tap one above" : "A 10-slide deck for our investor update on 3 December"}
          />
          <div className="chat-actions">
            {canTalk && (
              <button type="button" className={`btn btn-small btn-line ${listening ? "is-live" : ""}`} onClick={talk} aria-pressed={listening}>
                {listening ? "Stop" : "Speak"}
              </button>
            )}
            <button type="submit" className="btn btn-small" disabled={thinking || !text.trim()}>
              Send
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-result is-error" role="status">
          {error}
          {errorPath && (
            <>
              {" "}
              <a href={errorPath}>See the plans</a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
