import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/env";

// A Supabase client acting as the signed-in visitor. Row-level security applies to everything it does.
export async function supabaseServer() {
  const { url, key } = requireSupabaseEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        // Server Components can't write cookies; the proxy refreshes the session instead.
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* read-only context */
        }
      },
    },
  });
}
