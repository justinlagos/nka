import Link from "next/link";
import type { Metadata } from "next";
import { SERVICES } from "@/content/services";

export const metadata: Metadata = { title: "Services", description: "What the Nka studio designs, and which plans include it." };

export default function ServicesPage() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1 className="h1">Services</h1>
          <p className="lede">Eight kinds of work, one team. Each page lists what you get and which plans include it.</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <ul className="index">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`}>
                  <span className="index-name">{s.name}</span>
                  <span className="index-line">
                    {s.line} <span className="small">({s.plans})</span>
                  </span>
                  <span className="index-go">Details</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
