import { headers } from "next/headers";

/**
 * Prefer the incoming request URL (forwarded host/proto) so server-side fetches
 * hit the same deployment (Preview, production, or local). A project-wide
 * NEXT_PUBLIC_SITE_URL pointing at production breaks Preview if it wins over
 * the actual preview hostname.
 */
function originFromRequestHeaders(headerList: Headers): string | null {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    return null;
  }
  let proto = headerList.get("x-forwarded-proto");
  if (!proto) {
    proto =
      host.startsWith("localhost:") || host.startsWith("127.0.0.1:")
        ? "http"
        : "https";
  }
  return `${proto}://${host}`;
}

function resolveServerOrigin(headerList: Headers): string {
  const fromRequest = originFromRequestHeaders(headerList);
  if (fromRequest) {
    return fromRequest;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Base URL for server-side fetch to this app's API routes.
 * Uses the current request host when available (Vercel Preview-safe).
 */
export async function getServerOrigin(): Promise<string> {
  const h = await headers();
  return resolveServerOrigin(h);
}

/**
 * Forward cookies so API routes see the same session as the incoming request.
 */
export async function serverFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const url = `${resolveServerOrigin(h)}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      cookie,
    },
  });
}
