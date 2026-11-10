import type { Metadata } from "next";
import { SignInScreen } from "@/components/SignInScreen";
import { safeNext } from "@/lib/origin";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <SignInScreen kind="client" next={safeNext(next)} error={error} />;
}
