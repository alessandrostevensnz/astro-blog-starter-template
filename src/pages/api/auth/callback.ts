import type { APIRoute } from "astro";
import {
  CALLBACK_URL, SITE_ORIGIN, stateCookieName, expiredStateCookie, stateRelay,
  cookieValue, oauthEnv, popupResponse, validState
} from "../../../lib/decap-oauth";

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const relay = stateRelay(state);
  const finish = (token?: string, reason?: string) => {
    const response = popupResponse(token, reason, relay);
    response.headers.set("Set-Cookie", expiredStateCookie(relay));
    return response;
  };

  if (url.origin !== SITE_ORIGIN) return finish(undefined, "origin_mismatch");
  const expected = cookieValue(request, stateCookieName(relay));
  const code = url.searchParams.get("code");
  if (url.searchParams.has("error")) return finish(undefined, "github_authorization_denied");
  if (!validState(state, expected)) return finish(undefined, "csrf_state_mismatch");
  if (!code) return finish(undefined, "missing_authorization_code");

  const env = oauthEnv(locals);
  if (!env) return finish(undefined, "missing_worker_credentials");

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
    if (!exchange.ok) return finish(undefined, "github_token_http_error");
    const result = await exchange.json() as {
      access_token?: string; token_type?: string; error?: string;
    };
    if (result.error === "incorrect_client_credentials") return finish(undefined, "github_client_credentials_rejected");
    if (result.error === "bad_verification_code") return finish(undefined, "github_code_rejected");
    if (result.error) return finish(undefined, "github_token_error");
    if (!result.access_token) return finish(undefined, "github_token_missing");
    if (result.token_type?.toLowerCase() !== "bearer") return finish(undefined, "github_token_type_invalid");
    return finish(result.access_token);
  } catch {
    return finish(undefined, "github_token_request_failed");
  }
};
