"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendBrief } from "@/app/app/brief-actions";

// The two ways to get a brief made: Instant (AI, about a minute) or the client's designer.
export function LaneChoice({ projectId, instant, instantLeft }: { projectId: string; instant: boolean; instantLeft: number }) {
  const router = useRouter();
  const [sending, setSending] = useState<"" | "instant" | "designer">("");
  const [error, setError] = useState("");
  const [errorPath, setErrorPath] = useState("");
  const go = async (lane: "instant" | "designer") => {
    setSending(lane);
    setError("");
    const r = await sendBrief(projectId, lane);
    if (!r.ok) {
      setSending("");
      setError(r.error ?? "Couldn't send it. Try again.");
      setErrorPath(r.path ?? "");
      return;
    }
    router.push(r.path!);
  };
  return (
    <>
      <div className="lanes">
        {instant && (
          <button type="button" className="lane lane-ai" disabled={Boolean(sending) || instantLeft <= 0} onClick={() => go("instant")}>
            <b>{sending === "instant" ? "Starting…" : "Make it now with AI"}</b>
            <span>
              {instantLeft > 0 ? `Three options in about a minute, in your brand. ${instantLeft} left this month.` : "You've used this month's instant briefs."}
            </span>
          </button>
        )}
        <button type="button" className="lane lane-human" disabled={Boolean(sending)} onClick={() => go("designer")}>
          <b>{sending === "designer" ? "Sending…" : "Send to my team"}</b>
          <span>Made by your team on your plan hours. You&apos;ll see the hours and a delivery date straight away.</span>
        </button>
      </div>
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
    </>
  );
}
