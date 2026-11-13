import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { AppNav } from "@/components/AppNav";
import { AccountGuard } from "@/components/AccountGuard";
import { switchOrg } from "@/app/app/actions";
import type { Area, Membership, Profile } from "@/lib/session";

// One shell per area, each with its own nav and colour, so nobody is ever unsure which side
// of Nka they're on:
//   client    /app     the client's workspace
//   designer  /studio  the designer's own work, for the clients Nka assigned them
//   admin     /admin   Nka itself: every client, every designer, partners, prices
const NAV: Record<Area, { href: string; label: string; exact?: boolean }[]> = {
  client: [
    { href: "/app", label: "Home", exact: true },
    { href: "/app/projects", label: "Projects" },
    { href: "/app/projects/new", label: "New brief", exact: true },
    { href: "/app/library", label: "Library" },
    { href: "/app/brand", label: "Brand book" },
    { href: "/app/billing", label: "Billing" },
    { href: "/app/team", label: "Team" },
  ],
  designer: [
    { href: "/studio", label: "Your work", exact: true },
    { href: "/studio/clients", label: "Your clients" },
  ],
  admin: [
    { href: "/admin", label: "Studio queue", exact: true },
    { href: "/admin/clients", label: "Clients" },
    { href: "/admin/designers", label: "Designers" },
    { href: "/admin/leads", label: "Call requests" },
    { href: "/admin/support", label: "Support" },
  ],
};

const BADGE: Record<Area, string> = { client: "Client workspace", designer: "Designer studio", admin: "Nka admin" };
const HOME: Record<Area, string> = { client: "/app", designer: "/studio", admin: "/admin" };

export function AppShell({
  profile,
  area,
  memberships = [],
  current = null,
  children,
}: {
  profile: Profile;
  area: Area;
  memberships?: Membership[];
  current?: Membership | null;
  children: React.ReactNode;
}) {
  const name = profile.full_name || profile.email.split("@")[0];
  return (
    <div className={`app area-${area}`}>
      <AccountGuard userId={profile.id} signin={area === "designer" ? "/designer" : "/signin"} />
      <aside className="app-side">
        <Link href={HOME[area]} aria-label={`${BADGE[area]} home`} style={{ color: "inherit", padding: "0 12px" }}>
          <Wordmark ink="white" />
        </Link>
        <span className="area-badge">{BADGE[area]}</span>
        {area === "client" &&
          (memberships.length > 1 ? (
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
          ) : null)}
        <AppNav items={NAV[area]} label={BADGE[area]} />
        {area === "admin" && memberships.length > 0 && (
          <p className="app-side-switch">
            <Link href="/app">Open your test client workspace</Link>
          </p>
        )}
        {area === "client" && profile.is_staff && (
          <p className="app-side-switch">
            <Link href="/admin">Back to Nka admin</Link>
          </p>
        )}
        <div className="app-side-foot">
          <span className="app-who">
            <b>{name}</b>
            <span title={profile.email}>{profile.email}</span>
            {area === "designer" && <span>Clients see you as &ldquo;{profile.alias || "Your designer"}&rdquo;</span>}
          </span>
          <Link href="/">Nka site</Link>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="next" value={area === "designer" ? "/designer" : "/"} />
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
