# ANDRO editor OAuth popup reliability

## Diagnosis and scope
The reported message comes from the callback after a successful GitHub token exchange, when it has not completed the popup-to-editor handshake. It is not the report password error. The previous callback sent `authorizing:github` once, gave up after eight seconds, closed itself immediately after queuing the token message, and sent non-JSON errors even though Decap parses both result types as JSON.

A controlled offline Chromium test deliberately dropped the first readiness message: the previous code reproduced the exact eight-second timeout, while the patched code recovered and Decap received the dummy token and closed its popup. This establishes a reproducible failure mode, not proof of what dropped or delayed the message in the owner's particular browser. Simple named-window reuse alone did not reproduce the failure in that experiment. Unique window names are defensive isolation, not a claimed proven root cause.

## Changes
- Retry only the harmless readiness message every 500 ms, with a 30-second deadline.
- Deliver the result once, only after the exact origin, opener window, and GitHub handshake match. No wildcard token delivery.
- Let Decap close the popup after it parses the result; the callback no longer races the receiver by closing itself.
- Stop retries on acknowledgment, timeout, closed opener, or pagehide. Drop the in-memory result after delivery or abandonment.
- Return JSON error payloads compatible with Decap 3.8.3.
- Use a nonce-based script CSP and safely serialize all inline data.
- Remove one-use OAuth query parameters from the visible callback URL.
- Install a narrowly scoped window.open wrapper before Decap, giving each ANDRO GitHub login attempt a new window name. Other windows, hosts, providers, and /report are passed through unchanged.

No change to GitHub OAuth secrets, scopes, state-cookie checks, server-side token exchange, CMS content configuration, Cloudflare deployment settings, /report, or saved report data. No localStorage or BroadcastChannel token bridge, no security bypass, and no CMS dependency upgrade.

## Automated tests
Run with Node 22.6+:

```sh
node --experimental-strip-types --test tests/decap-oauth.test.mjs
node --check public/admin/oauth-popup.js
```

12 tests cover state validation, lost/delayed readiness, exact origin/source checks, once-only delivery, expiry, page abandonment, missing opener, JSON errors, inline-script escaping, CSP and scoped popup isolation. All passed during preparation. The updated auth module also passed an isolated strict TypeScript check with a minimal App.Locals fixture.

Offline Chromium protocol experiments also passed normal success, first-readiness loss recovery and JSON error delivery. They used dummy messages and a Decap 3.8.3 message-handler fixture; they did not authenticate a real GitHub user or run the full CDN CMS bundle. Because the offline documents were about:blank with opaque origins, only those in-memory browser fixtures used '*' for transport; the production code and Node origin-validation tests retain the exact https://andro.co.nz origin. Live browser end-to-end success is not yet claimed.

## Release and owner validation
Keep this fix on its pull request until the owner approves production deployment. The OAuth application is bound to https://andro.co.nz, so a successful preview build alone does not validate login at a workers.dev hostname.

After approval and successful deployment, close old login popups, reload /admin without clearing site data, and sign in once. Repeat after signing out and with a fresh private window; confirm the popup closes and the page editor appears. Do not reuse a callback URL or share code/state/token values. If a timeout remains, capture only the safe status message and redacted console error, not credentials.
