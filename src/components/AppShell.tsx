import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { AppNav } from "@/components/AppNav";
import { switchOrg } from "@/app/app/actions";
import type { Membership, Profile } from "@/lib/session";

const CLIENT_NAV = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/projects", label: "Projects" },
  { href: "/app/projects/new", label: "New brief", exact: true },
  { href: "/app/library", label: "Library" },
  { href: "/app/brand", label: "Brand book" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/team", label: "Team" },
];

const STAFF_NAV = [
  { href: "/admin", label: "Studio queue", exact: true },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/leads", label: "Call requests" },
];

export function AppShell({
  profile,
  memberships,
  current,
  children,
}: {
  profile: Profile;
  memberships: Membership[];
  current: Membership | null;
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <aside className="app-side">
        <Link href={current ? "/app" : profile.is_staff ? "/admin" : "/app"} aria-label="Nka workspace home" style={{ color: "inherit", padding: "0 12px" }}>
          <Wordmark ink="white" />
        </Link>
        {memberships.length > 1 ? (
          <form action={switchOrg} className="org-switch">
            <label className="skip" htmlFor="org-switch">
              Organisation
            </label>
            <select id="org-switch" name="org" defaultValue={current?.org.id}>
              {memberships.map((m) => (
                <option key={m.org.id} value={m.org.id}>
                  {m.org.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-small org-switch-btn">
              Switch organisation
            </button>
          </form>
        ) : current ? (
          <div className="org-name">{current.org.name}</div>
        ) : null}
        {current && <AppNav items={CLIENT_NAV} label="Workspace" />}
        {profile.is_staff && (
          <>
            <div className="app-nav-label">Studio</div>
            <AppNav
              items={current ? STAFF_NAV : [...STAFF_NAV, { href: "/app/onboarding", label: "Try the client side", exact: true }]}
              label="Studio"
            />
          </>
        )}
        <div className="app-side-foot">
          <span title={profile.email}>{profile.full_name || profile.email}</span>
          <Link href="/">Nka site</Link>
          <form action="/auth/signout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main id="main" className="app-main">
        {children}
      </main>
    </div>
  );
}
