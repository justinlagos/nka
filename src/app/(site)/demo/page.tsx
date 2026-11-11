import type { Metadata } from "next";
import { DemoFlow } from "@/components/DemoFlow";
import { ContactLine } from "@/components/ContactLine";

export const metadata: Metadata = {
  title: "Book a demo",
  description: "Say what you need and add your website. Your Nka workspace opens in your brand, with your first brief written.",
};

const NEXT = [
  { t: "Now", b: "Say what you need, add your website, and confirm your email with a code." },
  { t: "Half a minute later", b: "Your workspace opens with your logo, colours and fonts read from your site, and your first brief written. Have AI make it on the spot for free." },
  { t: "When you're ready", b: "Pick a plan and pay by card to send work to your team. No card until then. Want to talk first? We'll call at the time you picked." },
];

export default async function Demo({ searchParams }: { searchParams: Promise<{ need?: string; plan?: string; cur?: string; interval?: string }> }) {
  const { need, plan, cur, interval } = await searchParams;
  const planChoice =
    plan && ["instant", "starter", "growth", "studio"].includes(plan)
      ? `${plan}|${["usd", "ngn", "gbp"].includes(cur ?? "") ? cur : "usd"}|${interval === "year" ? "year" : "month"}`
      : "";
  return (
    <section className="section demo">
      <div className="wrap demo-grid">
        <div className="demo-intro">
          <p className="eyebrow">Book a demo</p>
          <h1 className="h1">See your own workspace, not a sales deck.</h1>
          <p className="lede">
            Most demos show you someone else&apos;s example. Ours sets up your account from your answers, so the call is about
            your actual work.
          </p>
          <ol className="demo-next">
            {NEXT.map((n) => (
              <li key={n.t}>
                <b>{n.t}</b>
                <span>{n.b}</span>
              </li>
            ))}
          </ol>
          <ContactLine lead="Rather talk now?" />
        </div>
        <DemoFlow initialNeed={(need ?? "").slice(0, 300)} planChoice={planChoice} />
      </div>
    </section>
  );
}
