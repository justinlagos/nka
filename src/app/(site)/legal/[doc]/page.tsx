import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITE } from "@/content/site";
import { FLEX } from "@/lib/plans";

// Plain-English starting points. Have them reviewed before taking payment.
const DOCS: Record<string, { title: string; updated: string; body: { h: string; p: string[] }[] }> = {
  terms: {
    title: "Terms of service",
    updated: "10 November 2026",
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
          "Your monthly price is agreed with you before you pay and confirmed in writing. We won't change it without your agreement.",
          "You can change, pause or cancel your plan from Billing at any time. There is no minimum term, notice period or exit fee. Cancellation takes effect at the end of the month you have paid for, and work already started that month is finished. A pause stops charges for up to a month at a time; nothing new starts while paused.",
          `Flex is a monthly budget with no minimum term. Each project is estimated, and the estimate is taken from your budget when an owner or admin approves it. Unused budget carries over for ${FLEX.rolloverMonths} months. If you leave, we pay back unused budget that hasn't been committed to approved work, within 14 days of your request.`,
        ],
      },
      {
        h: "Briefs and revisions",
        p: [
          "We work to the brief you approve. We revise work until it meets that brief. If you change the brief, we'll tell you what that means for timing or cost before we continue.",
          "An approved estimate is a fixed price. If the work takes us longer than estimated, we don't charge more. The price only changes if you ask for something new and approve a new estimate.",
          "Other sizes and formats of work you have approved are included at no charge and don't count against your plan.",
          "One named designer leads your account. If we need to change who that is, we'll tell you first and give you a written handover note.",
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
      {
        h: "Work and people shown on our website",
        p: [
          "The projects on our website are studio concepts: work we made for invented brands to show the range of what we do. None of them is client work, and the brands, people and figures in them are made up.",
          "People in the photographs and portraits on our website are illustrations. They are not our team, our clients or people who have used Nka.",
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
          "Enquiries: what you send through Book a demo, including your phone number if you give it.",
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
          "You can ask to see, correct, export or delete your data, or object to how we use it. Contact us by email or through Book a demo. You can also complain to the Information Commissioner's Office (ico.org.uk).",
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
