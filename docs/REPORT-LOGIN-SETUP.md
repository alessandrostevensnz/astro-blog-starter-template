# ANDRO Site Reports — password login setup (draft PR #16)

This integration is **not ready to merge or deploy** until the steps below are complete.

## What changed
- `/report` renders a page with the reporting app embedded.
- `/report/login` is a password sign-in form.
- `/report/app.html` is served dynamically, not from `public/`. The original public file was removed to prevent bypass.
- `src/middleware.ts` requires a signed session cookie for both the app and the report page.
- The login is disabled (HTTP 503) until secrets are configured.
- The public website and `/admin` are not subject to this middleware.
- POST requests to `/report/login` are checked by Cloudflare Workers Rate Limiting API before password verification: approximately 8 attempts per minute per visitor IP and 60 attempts per minute overall, independently at each Cloudflare location. Missing or failed rate limiter bindings deny login rather than disabling protection.

## Required Cloudflare Worker secrets
In Cloudflare **Workers & Pages > astro-blog-starter-template > Settings > Variables and Secrets**, add **encrypted secrets** (not plaintext variables):

- `REPORT_PASSWORD`: a unique password of at least 10 characters (12–15 or more recommended; never reuse a password from another account).
- `REPORT_SESSION_SECRET`: a different cryptographically random string of at least 32 characters.

Do **not** commit these values to GitHub, share them in screenshots or put them in client-side code. Configure the secrets for the correct environment and test them in a controlled preview before production deployment. Changes to the Worker settings may affect its deployment; review them before saving.

## Before approving deployment
1. Confirm Astro build and TypeScript checks pass, and inspect Cloudflare Worker routing (especially asset routing).
2. Test logged-out requests to `/report`, `/report/`, `/report/app.html`, and any preview hostname; no report HTML may be exposed without a valid session.
3. Test correct/incorrect passwords, expired/tampered cookies, and direct URL navigation.
4. Verify the two version-controlled `ratelimits` bindings in `wrangler.json` are present in the deployed preview and production Worker. Test repeated incorrect POSTs to `/report/login` with **dummy credentials**, expecting a `429 Too Many Requests` and `Retry-After: 60` after approximately 8 attempts per minute from the same visitor. Test a correct password again after the window expires. The counters are approximate and per Cloudflare location: this is not a strict global lockout. Do not use real client data during preview tests.
5. Test on iPhone and Mac: photos, local IndexedDB storage, backups, PDF printing and mail drafts.
6. Do not merge without the owner's explicit approval.

## Limitations
- This is a shared-password login, not individual employee accounts, MFA, or an audit log.
- Rate limiting is approximate (local to Cloudflare locations), can temporarily affect users on shared IP networks, and is not a strict guarantee against a coordinated distributed attack.
- The login password and session key must be generated/stored privately before production. Replace any values published in chat; keep both as encrypted Worker secrets.
- Sessions last up to eight hours. To revoke all sessions, rotate `REPORT_SESSION_SECRET`.
- Browser IndexedDB reports remain local to each browser and origin, and do not sync.
- Free-tier Worker usage limits still apply; zero charges cannot be guaranteed if paid services are later enabled.
