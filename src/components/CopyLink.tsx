"use client";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-box">
      <input type="text" readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn btn-small btn-line"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
