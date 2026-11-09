// The Nka mark: a single arch (the n, drawn the way uli lines are drawn) and a dot.
export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M8 33 V18 C8 6.5 26 6.5 26 18 V33"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <circle cx="34" cy="8" r="3.6" className="mark-dot" />
    </svg>
  );
}

// Plain name until the living logo (built from the three approved marks) replaces it.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className ?? ""}`}>
      <span className="wordmark-text">nka.studio</span>
    </span>
  );
}
