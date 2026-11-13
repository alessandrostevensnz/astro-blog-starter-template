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
  "X-Robots-Tag": "noindex",
  "X-ANDRO-Poll-Version": "6",
  "Cross-Origin-Resource-Policy": "same-origin"
};

/** Polling works even when a GitHub COOP navigation has severed window.opener.
 * The token is released only to a request with this login's same-origin cookie
 * and unguessable relay, and the encrypted cookie is expired immediately.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  // Keep strict cross-origin protection, but distinguish an ANDRO
  // rejection from an upstream Cloudflare block without logging cookies.
  const deny = (reason: "origin" | "fetch-site" | "editor-header") =>
    new Response(null, {
      status: 403,
      headers: { ...headers, "X-ANDRO-Poll-Block": reason }
    });
  if (url.origin !== SITE_ORIGIN) return deny("origin");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site")
    return deny("fetch-site");
  let relay = url.searchParams.get("relay");
  if (relay === "auto") {
    // Only the in-page editor's fetch can send this custom header. Refuse
    // normal cross-site links/navigations that could otherwise display a
    // browser's one-time OAuth receipt as JSON.
    const editorHeader = request.headers.get("X-ANDRO-Editor");
    if (editorHeader !== "login-v5" && editorHeader !== "login-v6")
      return deny("editor-header");
    // Recover a login started by an older Decap launcher without an explicit
    // relay query parameter. Never guess which token to use when two GitHub
    // logins are pending in the same browser.
    const prefix = "__Host-andro_oauth_result_";
    const candidates = [...new Set((request.headers.get("Cookie") ?? "")
      .split(";").map(part => part.trim().split("=")[0])
      .filter(name => name.startsWith(prefix))
      .map(name => name.slice(prefix.length))
      .filter(value => validRelay(value)))];
    if (candidates.length > 1)
      return new Response(JSON.stringify({ error: "multiple_login_receipts" }), {
        status: 409,
        headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
      });
    if (candidates.length === 0) return new Response(null, { status: 204, headers });
    relay = candidates[0];
  }
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
