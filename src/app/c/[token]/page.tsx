import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardView } from "@/components/CardView";
import { fieldsFor, merge, type CardSpec } from "@/lib/api/endpoints/ecards";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// A card is personal: keep it out of search engines and link previews generic.
export const metadata: Metadata = { title: "A card for you", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Card({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { token } = await params;
  const { preview } = await searchParams;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const db = supabaseAdmin();
  const { data: person } = await db.from("ecard_recipients").select("name, fields, ecard_id").eq("token", token).maybeSingle();
  if (!person) notFound();
  const { data: card } = await db.from("ecards").select("spec, expires_at").eq("id", person.ecard_id).maybeSingle();
  if (!card) notFound();
  if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) {
    return (
      <main id="main" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <p>This card has expired.</p>
      </main>
    );
  }
  const spec = card.spec as CardSpec;
  const fields = fieldsFor({ name: person.name, fields: person.fields as Record<string, string> });
  return (
    <CardView
      token={token}
      count={preview !== "1"}
      spec={{ ...spec, headline: merge(spec.headline, fields), message: merge(spec.message, fields) }}
      name={person.name}
    />
  );
}
