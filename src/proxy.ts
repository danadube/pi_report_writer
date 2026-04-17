import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Bare `/` must be listed explicitly: the regex below can fail to match the
    // empty path segment in edge matching, which surfaced as Middleware 404 on GET / in Preview.
    "/",
    // Exclude /test (temporary public debug route) from session middleware
    "/((?!_next/static|_next/image|favicon.ico|test(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
