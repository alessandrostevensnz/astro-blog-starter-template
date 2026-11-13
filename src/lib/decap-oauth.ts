export const SITE_ORIGIN = "https://andro.co.nz";
export const CALLBACK_URL = SITE_ORIGIN + "/api/auth/callback";
export const STATE_COOKIE = "__Host-andro_oauth_state";
const RELAY_PATTERN = /^[a-f0-9]{32}$/;
const OAUTH_STATE_PATTERN = /^[a-f0-9]{64}(?:\.[a-f0-9]{32})?$/;

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

export function validRelay(value: string | null | undefined): value is string {
  return !!value && RELAY_PATTERN.test(value);
}

// Keep a server-generated CSRF secret even with a caller-supplied relay ID.
export function oauthState(relay: string | null = null): string {
  return newState() + (validRelay(relay) ? "." + relay : "");
}

export function stateRelay(state: string | null): string | null {
  if (!state || !OAUTH_STATE_PATTERN.test(state)) return null;
  return state.length === 97 ? state.slice(65) : null;
}

// Each login popup has an independent CSRF cookie; concurrent logins
// no longer overwrite each other.
export function stateCookieName(relay: string | null = null): string {
  return STATE_COOKIE + (validRelay(relay) ? "_" + relay : "");
}

export function stateCookie(state: string, relay: string | null = null): string {
  return `${stateCookieName(relay)}=${state}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Lax`;
}

export function expiredStateCookie(relay: string | null = null): string {
  return `${stateCookieName(relay)}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

export const clearStateCookie = expiredStateCookie();
export function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const part = cookie.split(";").map(s => s.trim())
    .find(s => s.startsWith(name + "="));
  return part ? part.slice(name.length + 1) : null;
}

export function validState(actual: string | null, expected: string | null): boolean {
  if (!actual || !expected || !OAUTH_STATE_PATTERN.test(actual) ||
      !OAUTH_STATE_PATTERN.test(expected) || actual.length !== expected.length) return false;
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

export function popupResponse(token?: string, failureReason = "unknown_failure", relay: string | null = null): Response {
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
  const relay = ${inlineJson(validRelay(relay) ? relay : "")};
  let result = ${inlineJson(message)};
  const success = ${Boolean(token)};
  const reason = ${inlineJson(reason)};
  const reasonHelp = ({
    csrf_state_mismatch: "The login state cookie was missing or did not match. This can happen after an expired tab or with blocked cookies.",
    github_client_credentials_rejected: "ANDRO's GitHub OAuth application credentials were rejected. This requires a server configuration change.",
    github_code_rejected: "GitHub rejected the one-time sign-in code. Start a completely new login attempt.",
    github_authorization_denied: "GitHub sign-in was denied or cancelled.",
    missing_worker_credentials: "The server is missing its GitHub OAuth configuration.",
    github_token_http_error: "The GitHub authentication service returned an error.",
    github_token_request_failed: "ANDRO could not reach GitHub to complete the sign-in.",
    origin_mismatch: "The login callback returned on the wrong domain.",
    missing_authorization_code: "GitHub did not return a usable login code."
  })[reason] || "Close the login popup and open the ANDRO editor to retry.";
  const opener = window.opener;
  const status = document.getElementById("login-status");
  const help = document.getElementById("login-help");
  let waiting = true;
  let retryTimer;
  let deadlineTimer;
  let channel = null;
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
    if (channel) { channel.close(); channel = null; }
  }
  function abandon() { cleanup(); result = ""; }
  function stop(text) {
    abandon();
    // Never replace a real OAuth failure with a misleading popup timeout.
    show(success ? text : ("GitHub sign-in failed (" + reason + "). " + reasonHelp + " " + text), true);
  }
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
  function announceBridge() {
    if (!waiting || !channel) return;
    try { channel.postMessage({ kind: "ready" }); }
    catch (_) { stop("Unable to contact the editor. Please start a new login."); }
  }
  function beginBridge() {
    if (!relay || typeof window.BroadcastChannel !== "function") return false;
    try { channel = new window.BroadcastChannel("andro-github-oauth-" + relay); }
    catch (_) { return false; }
    channel.onmessage = function (event) {
      if (!waiting || !event.data || event.data.kind !== "ack") return;
      const response = result;
      try {
        channel.postMessage({ kind: "result", message: response });
        cleanup();
        result = "";
        show(success ? "Login response sent to the editor." :
          "GitHub login failed (" + reason + "). Please start a new login.", !success);
        if (success) setTimeout(function () { window.close(); }, 1500);
      } catch (_) { stop("Unable to finish GitHub login. Please start a new login."); }
    };
    retryTimer = setInterval(announceBridge, 500);
    deadlineTimer = setTimeout(function () {
      stop("The editor did not acknowledge this login within 45 seconds. " +
        "The secure recovery channel could not finish. Please start a new login from ANDRO.");
    }, 45000);
    announceBridge();
    return true;
  }
  // Remove one-use OAuth parameters from the visible address without storing
  // tokens, using localStorage, or changing the verified origin.
  try { history.replaceState(null, "", location.pathname); } catch (_) {}
  // The editor can also retrieve a verified login receipt from the
  // server. Give useful feedback even when the popup's opener is gone.
  if (success && relay) {
    show("GitHub authorised. Return to your ANDRO editor tab — sign-in should finish there automatically.", false);
    setTimeout(function () { try { window.close(); } catch (_) {} }, 8000);
  }
  // Display the verified server-side reason immediately on failure.
  // The message handshake still runs to notify the original editor.
  if (!success) show("GitHub sign-in failed (" + reason + "). " + reasonHelp, true);
  // A same-origin relay survives GitHub navigation that severs window.opener.
  // The server-side receipt polling path remains available independently.
  if (beginBridge()) return;
  if (openerMissing()) {
    if (success && relay) return;
    stop("This login window is not connected to the editor. Please start a new login.");
    return;
  }
  window.addEventListener("message", receive);
  window.addEventListener("pagehide", abandon);
  // Retry ONLY the harmless readiness message. Never replay the token or the
  // GitHub authorization-code exchange. A lost first handshake can recover.
  retryTimer = setInterval(announce, 500);
  deadlineTimer = setTimeout(function () {
    stop("The editor did not acknowledge this login within 30 seconds. " +
      (relay ? "The recovery connection was unavailable." :
       "This attempt has no recovery ID; an old editor tab or a missing OAuth state may be involved.") +
      " Please start a new login from ANDRO.");
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


// A short-lived, encrypted, per-attempt receipt lets the editor complete an
// OAuth login without a live popup/opener or BroadcastChannel connection.
// Never store the raw GitHub token in a cookie, URL, or persistent browser storage.
export const LOGIN_RESULT_TTL_MS = 120_000;

export function resultCookieName(relay: string): string {
  if (!validRelay(relay)) throw new Error("invalid_oauth_relay");
  return "__Host-andro_oauth_result_" + relay;
}

export function clearResultCookie(relay: string): string {
  return resultCookieName(relay) + "=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).split("+").join("-").split("/").join("_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{1,3000}$/.test(value)) throw new Error("bad_cookie");
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function resultKey(secret: string): Promise<CryptoKey> {
  const label = new TextEncoder().encode("andro-oauth-receipt-v1:" + secret);
  const hash = await crypto.subtle.digest("SHA-256", label);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptedResultCookie(token: string, relay: string, secret: string): Promise<string> {
  if (!validRelay(relay) || !token || token.length > 1024 || !secret) {
    throw new Error("invalid_oauth_receipt");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify({
    token, relay, expires: Date.now() + LOGIN_RESULT_TTL_MS
  }));
  const aad = new TextEncoder().encode("andro-oauth:" + relay);
  const cipher = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    await resultKey(secret), data
  ));
  const result = new Uint8Array(iv.length + cipher.length);
  result.set(iv);
  result.set(cipher, iv.length);
  return resultCookieName(relay) + "=" + base64Url(result) +
    "; Path=/; Max-Age=120; Secure; HttpOnly; SameSite=Lax";
}

export async function decryptResult(value: string, relay: string, secret: string): Promise<string | null> {
  if (!validRelay(relay) || !secret) return null;
  try {
    const blob = fromBase64Url(value);
    if (blob.length < 29) return null;
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM", iv: blob.slice(0, 12),
        additionalData: new TextEncoder().encode("andro-oauth:" + relay)
      },
      await resultKey(secret), blob.slice(12)
    );
    const data = JSON.parse(new TextDecoder().decode(plain)) as {
      token?: unknown; relay?: unknown; expires?: unknown
    };
    if (data.relay !== relay || typeof data.token !== "string" ||
        !data.token || data.token.length > 1024 || typeof data.expires !== "number" ||
        data.expires <= Date.now() || data.expires > Date.now() + LOGIN_RESULT_TTL_MS) return null;
    return data.token;
  } catch {
    return null;
  }
}
