import type { Metadata } from "next";
import { SignInScreen } from "@/components/SignInScreen";
import { safeNext } from "@/lib/origin";

export const metadata: Metadata = { title: "Designer sign-in", robots: { index: false } };

// The designers' own sign-in: nka.studio/designer. Lands on /studio.
export default async function DesignerSignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <SignInScreen kind="designer" next={safeNext(next, "/studio")} error={error} />;
}
