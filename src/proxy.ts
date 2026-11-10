import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Keeps the Supabase session fresh on every page request and sends signed-out
// visitors from the workspace to sign in.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Pages read the path from x-nka-path (set here, never from the browser) to send people to the
  // same thing in their own area, e.g. a designer opening a client project link.
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nka-path", request.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = forward();
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const protectedArea = ["/app", "/admin", "/studio", "/go"].some((p) => path === p || path.startsWith(`${p}/`));

  if (protectedArea && !signedIn) {
    const to = request.nextUrl.clone();
    to.pathname = "/signin";
    to.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/stripe/webhook|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|txt|xml|woff2?)$).*)"],
};
