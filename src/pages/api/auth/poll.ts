import type { APIRoute } from "astro";
import {
  SITE_ORIGIN, oauthEnv, validRelay, resultCookieName, clearResultCookie,
  cookieValue, decryptResult
} from "../../../lib/decap-oauth";

export const prerender = false;

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex"
};

/** Polling works even when a GitHub COOP navigation has severed window.opener.
 * The token is released only to a request with this login's same-origin cookie
 * and unguessable relay, and the encrypted cookie is expired immediately.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  if (url.origin !== SITE_ORIGIN ||
      request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return new Response(null, { status: 403, headers });
  }
  const relay = url.searchParams.get("relay");
  if (!validRelay(relay)) return new Response(null, { status: 400, headers });
  const env = oauthEnv(locals);
  if (!env) return new Response(null, { status: 503, headers });

  const cookie = cookieValue(request, resultCookieName(relay));
  if (!cookie) return new Response(null, { status: 204, headers });

  const token = await decryptResult(cookie, relay, env.GITHUB_CLIENT_SECRET);
  if (!token) {
    return new Response(null, {
      status: 204,
      headers: { ...headers, "Set-Cookie": clearResultCookie(relay) }
    });
  }

  return new Response(JSON.stringify({ token, provider: "github" }), {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": clearResultCookie(relay)
    }
  });
};
