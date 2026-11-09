import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/content/site";

export const metadata: Metadata = { title: "About", description: "Who runs Nka, and why it exists." };

export default function About() {
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1 className="h1">About Nka</h1>
          <p className="lede">
            {SITE.meaning} The studio is part of MotionPlay Labs, which also builds learning tools, games and software.
          </p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap split">
          <div className="block">
            <h2 className="h3">Why a plan</h2>
            <p>
              Most teams don't need a full-time designer, and don't want to brief a new freelancer every month. They need the
              same reliable people, who already know their brand, on call for whatever comes up. A plan gives you that for a
              fixed monthly fee, and the workspace keeps every brief, file and decision in one place.
            </p>
            <p>
              We work with teams in the UK and Nigeria, and with organisations that work between them: companies, foundations,
              NGOs and event organisers.
            </p>
          </div>
          <div className="block">
            <h2 className="h3">Who runs it</h2>
            <p>
              Nka is led by Justin Ukaegbu, a brand and communication designer working across identity, event branding,
              editorial design and motion, with more than ten years in agencies and in-house.
            </p>
            <p>
              He started at WPP&apos;s 141 Worldwide in Lagos, rolled out Fidelity Bank&apos;s new identity to branches and
              ATM galleries across Nigeria, and worked on merger communications and the rebrand when Diamond Bank joined
              Access Bank. He holds an MA in Graphic Design with Distinction and is a member of the Design Research Society.
            </p>
            <p>Specialists join for motion, illustration and development when a project needs them.</p>
          </div>
        </div>
      </section>
      <section className="section on-ink">
        <div className="wrap cta-band">
          <h2 className="h2">Talk to us about your next quarter.</h2>
          <Link href="/book" className="btn">
            Book a call
          </Link>
        </div>
      </section>
    </>
  );
}
