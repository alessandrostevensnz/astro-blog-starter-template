# ANDRO Site Reports — password login setup (draft PR #16)

This integration is **not ready to merge or deploy** until the steps below are complete.

## What changed
- `/report` renders a page with the reporting app embedded.
- `/report/login` is a password sign-in form.
- `/report/app.html` is served dynamically, not from `public/`. The original public file was removed to prevent bypass.
- `src/middleware.ts` requires a signed session cookie for both the app and the report page.
- The login is disabled (HTTP 503) until secrets are configured.
- The public website and `/admin` are not subject to this middleware.

## Required Cloudflare Worker secrets
In Cloudflare **Workers & Pages > astro-blog-starter-template > Settings > Variables and Secrets**, add **encrypted secrets** (not plaintext variables):

- `REPORT_PASSWORD`: a unique password of at least 10 characters (12–15 or more recommended; never reuse a password from another account).
- `REPORT_SESSION_SECRET`: a different cryptographically random string of at least 32 characters.

Do **not** commit these values to GitHub, share them in screenshots or put them in client-side code. Configure the secrets for the correct environment and test them in a controlled preview before production deployment. Changes to the Worker settings may affect its deployment; review them before saving.

## Before approving deployment
1. Confirm Astro build and TypeScript checks pass, and inspect Cloudflare Worker routing (especially asset routing).
2. Test logged-out requests to `/report`, `/report/`, `/report/app.html`, and any preview hostname; no report HTML may be exposed without a valid session.
3. Test correct/incorrect passwords, expired/tampered cookies, and direct URL navigation.
4. Add a Cloudflare WAF/rate-limiting rule or equivalent protection for repeated POSTs to `/report/login`; this initial password form has no persistent server-side lockout.
5. Test on iPhone and Mac: photos, local IndexedDB storage, backups, PDF printing and mail drafts.
6. Do not merge without the owner's explicit approval.

## Limitations
- This is a shared-password login, not individual employee accounts, MFA, or an audit log.
- Sessions last up to eight hours. To revoke all sessions, rotate `REPORT_SESSION_SECRET`.
- Browser IndexedDB reports remain local to each browser and origin, and do not sync.
- Free-tier Worker usage limits still apply; zero charges cannot be guaranteed if paid services are later enabled.
