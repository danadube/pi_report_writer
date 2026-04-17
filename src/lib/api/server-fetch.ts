import { headers } from "next/headers";

/**
 * Base URL for server-side fetch to this app's API routes.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://app.example.com).
 */
export function getServerOrigin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
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
  const url = `${getServerOrigin()}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      cookie,
    },
  });
}
