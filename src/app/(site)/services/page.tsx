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
          <p className="lede">Eight kinds of work, one team. Each page lists what you get.</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap">
          <ul className="rows">
            {SERVICES.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`} className="row">
                  <span className="row-name">{s.name}</span>
                  <span className="row-text">{s.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
