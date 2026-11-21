"use client";
import { useState } from "react";

export function CopyLink({ url, label = "Invite link", copyLabel = "Copy link" }: { url: string; label?: string; copyLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-box">
      <input type="text" readOnly value={url} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
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
        {copied ? "Copied" : copyLabel}
      </button>
    </div>
  );
}
