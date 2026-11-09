import Link from "next/link";
import type { Metadata } from "next";
import { visibleWork } from "@/content/work";
import { serviceBySlug } from "@/content/services";

export const metadata: Metadata = { title: "Work", description: "Selected work by the Nka studio team." };

export default function WorkPage() {
  const work = visibleWork();
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1 className="h1">Work</h1>
          <p className="lede">Selected projects by the studio team, for companies, foundations and events in the UK and Nigeria.</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <ul className="work-list">
            {work.map((w) => (
              <li key={w.slug} id={w.slug}>
                <div>
                  <div className="work-client">{w.client}</div>
                  <div className="work-project">{w.project}</div>
                  <div className="tags">
                    {w.services.map((s) => (
                      <Link key={s} href={`/services/${s}`} className="tag">
                        {serviceBySlug(s)?.name ?? s}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <p>{w.summary}</p>
                  <ul className="ticks work-made">
                    {w.made.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
