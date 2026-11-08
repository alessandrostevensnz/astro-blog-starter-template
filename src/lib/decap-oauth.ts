export const SITE_ORIGIN = "https://andro.co.nz";
export const CALLBACK_URL = SITE_ORIGIN + "/api/auth/callback";
export const STATE_COOKIE = "__Host-andro_oauth_state";

export interface GitHubOAuthEnv {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

export function oauthEnv(locals: App.Locals): GitHubOAuthEnv | null {
  const env = locals.runtime?.env as unknown as Partial<GitHubOAuthEnv> | undefined;
  if (!env?.GITHUB_CLIENT_ID || !env?.GITHUB_CLIENT_SECRET) return null;
  return env as GitHubOAuthEnv;
}

export function newState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function stateCookie(state: string): string {
  return `${STATE_COOKIE}=${state}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`;
}

export const clearStateCookie =
  `${STATE_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;

export function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const part = cookie.split(";").map(s => s.trim())
    .find(s => s.startsWith(name + "="));
  return part ? part.slice(name.length + 1) : null;
}

export function validState(actual: string | null, expected: string | null): boolean {
  if (!actual || !expected || !/^[a-f0-9]{64}$/.test(actual) ||
      !/^[a-f0-9]{64}$/.test(expected)) return false;
  const a = new TextEncoder().encode(actual);
  const b = new TextEncoder().encode(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function popupResponse(token?: string, failureReason = "unknown_failure"): Response {
  const reason = /^[a-z0-9_]{1,64}$/.test(failureReason) ? failureReason : "unknown_failure";
  // Both results must end in JSON: Decap parses the success AND error suffix.
  const message = token
    ? "authorization:github:success:" + JSON.stringify({ token, provider: "github" })
    : "authorization:github:error:" + JSON.stringify({ message: "GitHub login failed (" + reason + "). Please start a new login." });
  const nonce = newState();
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ANDRO GitHub login</title></head><body>
<p id="login-status" role="status">Completing GitHub login...</p>
<p id="login-help" hidden>Close this popup and start a new login from the ANDRO editor. Do not refresh this callback or clear your saved reports.</p>
<script nonce="${nonce}">
(function () {
  "use strict";
  const origin = ${inlineJson(SITE_ORIGIN)};
  let result = ${inlineJson(message)};
  const success = ${Boolean(token)};
  const reason = ${inlineJson(reason)};
  const opener = window.opener;
  const status = document.getElementById("login-status");
  const help = document.getElementById("login-help");
  let waiting = true;
  let retryTimer;
  let deadlineTimer;
  function show(text, retry) {
    status.textContent = text;
    help.hidden = !retry;
  }
  function cleanup() {
    waiting = false;
    clearInterval(retryTimer);
    clearTimeout(deadlineTimer);
    window.removeEventListener("message", receive);
    window.removeEventListener("pagehide", abandon);
  }
  function abandon() { cleanup(); result = ""; }
  function stop(text) { abandon(); show(text, true); }
  function openerMissing() {
    try { return !opener || opener.closed; } catch (_) { return true; }
  }
  function receive(event) {
    // Never relax origin/source checks or deliver the token unsolicited.
    if (!waiting || event.origin !== origin || event.source !== opener ||
        event.data !== "authorizing:github") return;
    cleanup();
    try {
      opener.postMessage(result, origin);
      show(success
        ? "Login response sent to the editor. It will close this window when received."
        : "GitHub login failed (" + reason + "). Please start a new login.", !success);
    } catch (_) {
      show("The editor window is no longer available. Please start a new login.", true);
    } finally { result = ""; }
    // IMPORTANT: postMessage is asynchronous. Decap closes its auth window
    // after parsing the result; closing it here can race that handoff.
  }
  function announce() {
    if (!waiting) return;
    if (openerMissing()) { stop("The editor window was closed. Please start a new login."); return; }
    try { opener.postMessage("authorizing:github", origin); }
    catch (_) { stop("Unable to contact the editor. Please start a new login."); }
  }
  // Remove one-use OAuth parameters from the visible address without storing
  // tokens, using localStorage, or changing the verified origin.
  try { history.replaceState(null, "", location.pathname); } catch (_) {}
  if (openerMissing()) {
    stop("This login window is not connected to the editor. Please start a new login.");
    return;
  }
  window.addEventListener("message", receive);
  window.addEventListener("pagehide", abandon);
  // Retry ONLY the harmless readiness message. Never replay the token or the
  // GitHub authorization-code exchange. A lost first handshake can recover.
  retryTimer = setInterval(announce, 500);
  deadlineTimer = setTimeout(function () {
    stop("The editor did not acknowledge this login within 30 seconds. Please start a new login.");
  }, 30000);
  announce();
})();
</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`
    }
  });
}
