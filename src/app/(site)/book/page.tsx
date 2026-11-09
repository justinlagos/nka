import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { sendBooking } from "./actions";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Book a call", description: "Tell us what you need and we'll suggest a plan or a quote." };

const INTERESTS = [
  { value: "plan", label: "A monthly plan" },
  { value: "flex", label: "Flex budget" },
  { value: "bespoke", label: "Bespoke or a dedicated team" },
  { value: "project", label: "A one-off project" },
  { value: "procurement", label: "A tender or RFQ" },
  { value: "unsure", label: "Not sure yet" },
];

export default async function Book({ searchParams }: { searchParams: Promise<{ interest?: string }> }) {
  const { interest } = await searchParams;
  const preset = INTERESTS.some((i) => i.value === interest) ? interest : "";
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <h1 className="h1">Book a call</h1>
          <p className="lede">
            Tell us what&apos;s coming up. We&apos;ll reply within one working day with times for a 20-minute call, and a plan
            or a quote that fits.
          </p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 24 }}>
        <div className="wrap split">
          <ActionForm action={sendBooking} submit="Send" pending="Sending" resetOnSuccess>
            <div className="row-2">
              <label className="field">
                <span>Your name</span>
                <input type="text" name="name" required autoComplete="name" maxLength={120} />
              </label>
              <label className="field">
                <span>Work email</span>
                <input type="email" name="email" required autoComplete="email" maxLength={200} />
              </label>
            </div>
            <div className="row-2">
              <label className="field">
                <span>Company</span>
                <input type="text" name="company" autoComplete="organization" maxLength={160} />
              </label>
              <label className="field">
                <span>Team size</span>
                <select name="company_size" defaultValue="">
                  <option value="">Choose</option>
                  <option>1 to 10</option>
                  <option>11 to 50</option>
                  <option>51 to 250</option>
                  <option>251 to 1,000</option>
                  <option>Over 1,000</option>
                </select>
              </label>
            </div>
            <div className="row-2">
              <label className="field">
                <span>Country</span>
                <select name="country" defaultValue="">
                  <option value="">Choose</option>
                  <option>United Kingdom</option>
                  <option>Nigeria</option>
                  <option>Elsewhere in Africa</option>
                  <option>Europe</option>
                  <option>North America</option>
                  <option>Elsewhere</option>
                </select>
              </label>
              <label className="field">
                <span>Interested in</span>
                <select name="interest" defaultValue={preset}>
                  <option value="">Choose</option>
                  {INTERESTS.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Monthly design budget</span>
              <select name="budget" defaultValue="">
                <option value="">Prefer not to say</option>
                <option>Under £1,500</option>
                <option>£1,500 to £3,000</option>
                <option>£3,000 to £6,000</option>
                <option>£6,000 to £15,000</option>
                <option>Over £15,000</option>
              </select>
            </label>
            <label className="field">
              <span>What&apos;s on your list?</span>
              <textarea name="message" rows={5} maxLength={4000} placeholder="A report in March, an event in May, social every week…" />
            </label>
            <label className="skip" aria-hidden="true">
              Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </ActionForm>
          <div className="block">
            <h2 className="h3">What happens next</h2>
            <ul className="ticks">
              <li>We read your note and reply within one working day.</li>
              <li>On the call we go through your next few months of work.</li>
              <li>You get a plan suggestion, or a fixed quote for one-off work.</li>
            </ul>
            {env.bookingUrl && (
              <p style={{ marginTop: 24 }}>
                Prefer to pick a time now?{" "}
                <a href={env.bookingUrl} target="_blank" rel="noreferrer">
                  Open the calendar
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
