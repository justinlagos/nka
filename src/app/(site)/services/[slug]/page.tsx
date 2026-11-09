import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SERVICES, serviceBySlug } from "@/content/services";
import { visibleWork } from "@/content/work";

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = serviceBySlug((await params).slug);
  return s ? { title: s.name, description: s.line } : {};
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const service = serviceBySlug((await params).slug);
  if (!service) notFound();
  const related = visibleWork().filter((w) => w.services.includes(service.slug));

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <Link href="/services" className="crumb">
            Services
          </Link>
          <h1 className="h1">{service.name}</h1>
          <p className="lede">{service.line}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap split">
          <div className="block">
            <h2 className="h3">What you get</h2>
            <ul className="ticks">
              {service.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="block">
            <h2 className="h3">What clients ask for</h2>
            <ul className="ticks">
              {service.asks.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <dl className="kv" style={{ marginTop: 24 }}>
              <dt>Included in</dt>
              <dd>{service.plans}</dd>
              <dt>Timing</dt>
              <dd>{service.firstDraft}</dd>
            </dl>
          </div>
        </div>
      </section>
      {related.length > 0 && (
        <section className="section">
          <div className="wrap">
            <h2 className="h2" style={{ marginBottom: 24 }}>
              Related work
            </h2>
            <ul className="work-list">
              {related.map((w) => (
                <li key={w.slug}>
                  <div>
                    <div className="work-client">{w.client}</div>
                    <div className="work-project">{w.project}</div>
                  </div>
                  <p>{w.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <section className="section on-ink">
        <div className="wrap cta-band">
          <h2 className="h2">Need {service.name.toLowerCase()} this month?</h2>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href="/pricing" className="btn">
              See plans
            </Link>
            <Link href={`/book?interest=project`} className="btn btn-line">
              Book a call
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
