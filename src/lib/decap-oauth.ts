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

export function popupResponse(token?: string): Response {
  // Decap's GitHub OAuth popup protocol starts with an "authorizing" handshake.
  // Do not deliver the token until the opener confirms the expected origin.
  const message = token
    ? "authorization:github:success:" + JSON.stringify({ token, provider: "github" })
    : "authorization:github:error:Authentication failed";
  const safeMessage = JSON.stringify(message).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>ANDRO GitHub login</title></head><body><p>Completing GitHub login…</p>
<script>
(function () {
  const origin = ${JSON.stringify(SITE_ORIGIN)};
  const result = ${safeMessage};
  const success = ${Boolean(token)};
  if (!window.opener) {
    document.body.textContent = "Login window was not opened by the editor.";
    return;
  }
  function receive(event) {
    if (event.origin !== origin || event.source !== window.opener ||
        event.data !== "authorizing:github") return;
    window.removeEventListener("message", receive);
    window.opener.postMessage(result, origin);
    if (success) window.close();
  }
  window.addEventListener("message", receive);
  window.opener.postMessage("authorizing:github", origin);
  if (!success) {
    document.body.textContent = "GitHub login failed. Please check the Cloudflare OAuth credentials and the GitHub OAuth callback URL. No credentials are shown here.";
  } else {
    setTimeout(function () {
      document.body.textContent = "GitHub returned a token, but the ANDRO admin page did not complete the login handshake. Please report this message.";
    }, 8000);
  }
})();
</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
    }
  });
}
