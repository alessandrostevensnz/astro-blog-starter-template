import type { APIRoute } from "astro";
import {
  CALLBACK_URL, SITE_ORIGIN, STATE_COOKIE, clearStateCookie,
  cookieValue, oauthEnv, popupResponse, validState
} from "../../../lib/decap-oauth";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const finish = (token?: string) => {
    const response = popupResponse(token);
    response.headers.set("Set-Cookie", clearStateCookie);
    return response;
  };

  if (url.origin !== SITE_ORIGIN) return finish();
  const state = url.searchParams.get("state");
  const expected = cookieValue(request, STATE_COOKIE);
  const code = url.searchParams.get("code");
  if (!validState(state, expected) || !code || url.searchParams.has("error"))
    return finish();

  const env = oauthEnv(locals);
  if (!env) return finish();

  try {
    const exchange = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        state,
        redirect_uri: CALLBACK_URL
      })
    });
    if (!exchange.ok) return finish();
    const result = await exchange.json() as {
      access_token?: string; token_type?: string; error?: string;
    };
    if (result.error || !result.access_token ||
        result.token_type?.toLowerCase() !== "bearer") return finish();
    return finish(result.access_token);
  } catch {
    return finish();
  }
};
