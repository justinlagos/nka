import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getSession } from "@/lib/session";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  try {
    signedIn = Boolean((await getSession()).userId);
  } catch {
    signedIn = false;
  }
  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
