import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function shouldSkipProxy(pathname: string): boolean {
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico"
  ) {
    return true;
  }
  if (/\.(?:svg|png|jpg|jpeg|gif|webp)$/i.test(pathname)) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  if (shouldSkipProxy(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return NextResponse.next();
  }

  try {
    return await updateSession(request);
  } catch (e) {
    console.error("[proxy] updateSession failed:", e);
    return NextResponse.next();
  }
}

/**
 * `/:path*` matches every path including `/` (zero segments after the slash).
 * Regex-only matchers often omit the bare root in edge matching; this avoids that class of 404s.
 */
export const config = {
  matcher: ["/:path*"],
};
