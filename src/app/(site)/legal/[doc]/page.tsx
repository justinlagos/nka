import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITE } from "@/content/site";
import { FLEX } from "@/lib/plans";

// Plain-English starting points. Have them reviewed before taking payment.
const DOCS: Record<string, { title: string; updated: string; body: { h: string; p: string[] }[] }> = {
  terms: {
    title: "Terms of service",
    updated: "9 November 2026",
    body: [
      {
        h: "Who we are",
        p: [
          `Nka is a design service run by ${SITE.company} (company no. ${SITE.companyNumber}, ${SITE.registered}). "We" means ${SITE.company}; "you" means the organisation that signs up.`,
        ],
      },
      {
        h: "Plans",
        p: [
          "Plans are paid monthly in advance by card through Stripe. Your plan sets how many requests we work on at the same time. Requests beyond that wait in your queue and start in the order you sent them.",
          "You can change or cancel your plan from Billing. Changes and cancellations take effect at the end of the month you have paid for. We don't refund part months.",
          `Flex is a monthly budget with a ${FLEX.minimumMonths}-month minimum term. Each project is estimated, and the estimate is taken from your budget when an owner or admin approves it. Unused budget rolls over for ${FLEX.rolloverMonths} months and then expires.`,
        ],
      },
      {
        h: "Briefs and revisions",
        p: [
          "We work to the brief you approve. We revise work until it meets that brief. If you change the brief, we'll tell you what that means for timing or cost before we continue.",
          "Delivery dates in estimates assume you reply to questions and reviews within two working days.",
        ],
      },
      {
        h: "Ownership",
        p: [
          "When the month a piece of work was made in has been paid, you own the final approved files and their source files. Fonts, stock images and other third-party material stay under their own licences; we tell you when a licence needs buying.",
          "We may show work in our portfolio unless you ask us not to.",
        ],
      },
      {
        h: "Your material",
        p: [
          "You confirm you have the right to use the logos, images, text and data you give us, and that they don't break anyone else's rights.",
        ],
      },
      {
        h: "Liability",
        p: [
          "Our total liability under these terms is limited to the fees you paid in the three months before the claim. We are not liable for indirect losses such as lost profit. Nothing here limits liability that the law does not allow to be limited.",
        ],
      },
      { h: "Law", p: ["These terms are governed by the law of England and Wales."] },
    ],
  },
  privacy: {
    title: "Privacy notice",
    updated: "9 November 2026",
    body: [
      {
        h: "Who looks after your data",
        p: [`${SITE.company} is the controller for personal data collected through Nka.`],
      },
      {
        h: "What we collect",
        p: [
          "Account details: your name, email address and the organisation you belong to.",
          "Work: briefs, comments, files and approvals you add to the workspace.",
          "Billing: Stripe processes card payments. We see the plan, payment status and invoices, not your full card number.",
          "Enquiries: what you send through Book a call.",
        ],
      },
      {
        h: "Why",
        p: [
          "To provide the service you signed up for (contract), to reply to enquiries you send (legitimate interest), and to keep tax and accounting records (legal obligation).",
        ],
      },
      {
        h: "Where it's stored",
        p: [
          "The workspace database and files are hosted by Supabase in London. The site runs on Vercel. Payments are handled by Stripe. If AI drafting is switched on for a brief, its text and your brand book are sent to Anthropic to draft it, and are not used to train their models.",
        ],
      },
      {
        h: "How long",
        p: [
          "We keep account and project data while your account is open and for six years after for accounting records, unless you ask us to delete files sooner. Enquiries that don't become clients are deleted after 12 months.",
        ],
      },
      {
        h: "Your rights",
        p: [
          "You can ask to see, correct, export or delete your data, or object to how we use it. Contact us through Book a call. You can also complain to the Information Commissioner's Office (ico.org.uk).",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const d = DOCS[(await params).doc];
  return d ? { title: d.title } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc];
  if (!d) notFound();
  return (
    <section className="page-head">
      <div className="wrap prose">
        <h1 className="h1">{d.title}</h1>
        <p className="muted">Last updated {d.updated}</p>
        {d.body.map((s) => (
          <div key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
