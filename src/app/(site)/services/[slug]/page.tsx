import Link from "next/link";
import Image from "next/image";
import { SERVICE_IMG } from "@/content/images";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SERVICES, serviceBySlug } from "@/content/services";
import { FilmPlayer } from "@/components/FilmPlayer";
import { ProjectViewHost } from "@/components/ProjectView";
import { WorkCards } from "@/components/WorkCards";

// The film that shows each service best, and the projects to look at next.
const SVC_FILM: Record<string, { src: string; poster: string; label: string }> = {
  "motion-video": { src: "/films/reel-motion.mp4", poster: "/films/reel-motion.jpg", label: "Motion reel: kinetic type, logo builds, app screens and social posts in motion" },
  "brand-identity": { src: "/films/film-halden.mp4", poster: "/films/film-halden.jpg", label: "Film: the Halden & Co identity in motion" },
  "event-branding": { src: "/films/film-northlight.mp4", poster: "/films/film-northlight.jpg", label: "Film: the Northlight Summit identity, presented and on stage" },
  presentations: { src: "/films/film-northlight.mp4", poster: "/films/film-northlight.jpg", label: "Film: the Northlight Summit proposal deck being presented" },
  "social-ads": { src: "/films/film-boba.mp4", poster: "/films/film-boba.jpg", label: "Film: Boba Bay launch posts in motion, in every size" },
  "web-product": { src: "/films/film-haulo.mp4", poster: "/films/film-haulo.jpg", label: "Film: the Haulo website and tracking app in use" },
};
const SVC_WORK: Record<string, string[]> = {
  "motion-video": ["runa", "boba", "halden", "haulo"],
  "brand-identity": ["halden", "kofi", "ewa", "ozo"],
  "event-branding": ["northlight", "ozo", "halden"],
  presentations: ["northlight", "fernline", "bright"],
  "social-ads": ["boba", "pocketa", "runa"],
  "web-product": ["haulo", "vela", "workspace"],
  "reports-documents": ["bright", "editorial", "books"],
  "print-merch": ["koko", "ori", "ozo", "books"],
};

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
  const img = SERVICE_IMG[service.slug];

  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <Link href="/services" className="crumb">
            Services
          </Link>
          <h1 className="h1">{service.name}</h1>
          <p className="lede">{service.line}</p>
          {SVC_FILM[service.slug] ? (
            <figure className="svc-film">
              <FilmPlayer {...SVC_FILM[service.slug]} />
            </figure>
          ) : img && (
            <figure style={{ margin: 0 }}>
              <Image className="svc-hero-img" src={img.src} alt={img.alt} width={img.w} height={img.h} priority sizes="(max-width: 1240px) 92vw, 1180px" />
            </figure>
          )}
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
      {SVC_WORK[service.slug] && (
        <section className="svc-work">
          <div className="wrap">
            <h2 className="h2">Work like this</h2>
            <WorkCards ids={SVC_WORK[service.slug]} />
          </div>
        </section>
      )}
      <section className="section on-ink">
        <div className="wrap cta-band">
          <h2 className="h2">Need {service.name.toLowerCase()} this month?</h2>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link href={`/demo?need=${encodeURIComponent(service.name)}`} className="btn">
              Start a project
            </Link>
            <Link href="/pricing" className="btn btn-line">
              How pricing works
            </Link>
          </div>
        </div>
      </section>
      <ProjectViewHost />
    </>
  );
}
