import Image from "next/image";
import { SHOW, WALL, type ShowKey } from "@/content/landing";

type Tile = { img: ShowKey; label: string };

function Row({ tiles, reverse }: { tiles: Tile[]; reverse?: boolean }) {
  // Drawn twice so the loop is seamless; the copy is hidden from screen readers.
  return (
    <div className={`wall-row ${reverse ? "wall-rev" : ""}`}>
      <ul className="wall-track">
        {[...tiles, ...tiles].map((t, i) => {
          const p = SHOW[t.img];
          const copy = i >= tiles.length;
          return (
            <li key={i} className="wall-tile" aria-hidden={copy || undefined} style={{ aspectRatio: `${p.w} / ${p.h}` }}>
              <Image src={p.src} alt={copy ? "" : p.alt} width={p.w} height={p.h} sizes="(max-width: 700px) 70vw, 32vw" />
              <span>{t.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Two rows of work drifting in opposite directions. Hover pauses; reduced motion makes them scrollable.
export function WorkWall() {
  return (
    <div className="wall" aria-label="More examples of the kinds of work we make">
      <Row tiles={WALL[0]} />
      <Row tiles={WALL[1]} reverse />
    </div>
  );
}
