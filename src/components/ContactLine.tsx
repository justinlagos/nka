import { CONTACT } from "@/content/site";

// Email and phone, if they're set. Renders nothing when neither is.
export function ContactLine({ lead = "Or reach us directly:", className = "small muted" }: { lead?: string; className?: string }) {
  if (!CONTACT.email && !CONTACT.phone) return null;
  return (
    <p className={className}>
      {lead}{" "}
      {CONTACT.email && <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}
      {CONTACT.email && CONTACT.phone ? " or " : ""}
      {CONTACT.phone && <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>}
    </p>
  );
}
