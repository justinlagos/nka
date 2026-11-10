import Image from "next/image";
import { HERO_COLS, SHOW } from "@/content/landing";

// Three columns of work drifting at different speeds, the middle one against the others.
export function HeroColumns() {
  return (
    <div className="hc" aria-hidden="true">
      {HERO_COLS.map((col, c) => (
        <div key={c} className={`hc-col hc-col-${c}`}>
          <div className="hc-track">
            {[...col, ...col].map((t, i) => {
              const p = SHOW[t.img];
              return (
                <figure key={i} className="hc-tile">
                  <Image src={p.src} alt="" width={p.w} height={p.h} sizes="(max-width: 900px) 30vw, 15vw" priority={i < 2} />
                  <figcaption>{t.label}</figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
