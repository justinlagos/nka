// An original line drawing in the spirit of uli: one sweeping line that coils, parallel
// strokes, a comb and a seed. It draws itself once on load; reduced motion shows it complete.
export function UliLine({ className }: { className?: string }) {
  return (
    <svg className={`uli ${className ?? ""}`} viewBox="0 0 600 560" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path
          className="uli-stroke uli-1"
          pathLength={1}
          strokeWidth={3}
          d="M24 452 C110 452 150 372 236 368 S350 440 418 380 S476 226 404 186 S286 186 296 262 S382 306 402 262 S392 212 362 216 S334 242 350 252"
        />
        <path className="uli-stroke uli-2" pathLength={1} strokeWidth={2.2} d="M70 300 Q160 232 252 278" />
        <path className="uli-stroke uli-2" pathLength={1} strokeWidth={2.2} d="M82 270 Q170 204 262 248" />
        <path className="uli-stroke uli-2" pathLength={1} strokeWidth={2.2} d="M96 240 Q182 178 272 220" />
        <path className="uli-stroke uli-3" pathLength={1} strokeWidth={2.4} d="M438 486 L572 486" />
        <path
          className="uli-stroke uli-3"
          pathLength={1}
          strokeWidth={2.4}
          d="M452 486 V514 M474 486 V522 M496 486 V514 M518 486 V522 M540 486 V514 M562 486 V506"
        />
        <path className="uli-stroke uli-4" pathLength={1} strokeWidth={2.4} d="M466 96 Q516 46 568 96 Q516 146 466 96 Z" />
      </g>
      <g className="uli-dots">
        <circle cx="517" cy="96" r="7" />
        <circle cx="140" cy="186" r="4" />
        <circle cx="162" cy="172" r="4" />
        <circle cx="184" cy="162" r="4" />
        <circle cx="356" cy="246" r="5" />
      </g>
    </svg>
  );
}
