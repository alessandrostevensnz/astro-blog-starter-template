import type { APIRoute } from "astro";
import { CALLBACK_URL, SITE_ORIGIN, oauthState, oauthEnv, stateCookie, validRelay, cookieValue, newState } from "../../../lib/decap-oauth";

export const prerender = false;

export const GET: APIRoute = ({ request, locals }) => {
  if (new URL(request.url).origin !== SITE_ORIGIN)
    return new Response("Invalid origin", { status: 400 });
  const env = oauthEnv(locals);
  if (!env) return new Response("OAuth is not configured", { status: 503 });

  const requestedRelay = new URL(request.url).searchParams.get("andro_relay");
  // Use the explicit one-time ID from the current editor first. A fallback ID
  // seeded in an editor cookie also works if an older Decap launcher opened
  // /api/auth without the query parameter. Finally generate a server ID so
  // every fresh OAuth callback has a recovery slot.
  const editorRelay = cookieValue(request, "__Host-andro_oauth_editor_relay");
  const relay = validRelay(requestedRelay) ? requestedRelay :
    validRelay(editorRelay) ? editorRelay : newState().slice(0, 32);
  const state = oauthState(relay);
  const github = new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  github.searchParams.set("redirect_uri", CALLBACK_URL);
  github.searchParams.set("scope", "repo");
  github.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: github.toString(),
      "Set-Cookie": stateCookie(state, relay),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    }
  });
};
