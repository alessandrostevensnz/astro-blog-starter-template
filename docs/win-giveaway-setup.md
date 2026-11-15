# ANDRO /win giveaway — launch checklist

This feature lives in the existing Astro/Cloudflare **Workers** site (not a separate Pages project).
Public: `/win`. Private dashboard: `/win/admin`. Admin sign-in uses the **existing /report password**, which must remain configured with `REPORT_PASSWORD` and `REPORT_SESSION_SECRET`, and existing `REPORT_LOGIN_IP_LIMITER` and `REPORT_LOGIN_GLOBAL_LIMITER`.

## Required setup (not automated by this PR)

1. Confirm the promotion rules and the prize with the business owner, including the Auckland eligibility area, maximum **8 hours of one worker's labour**, exclusions and how a winner will be chosen. Review NZ Fair Trading Act / DIA sales-promotion guidance before launch. Do not advertise or open the draw until this is final.
2. In Cloudflare D1 create a database called `andro-win` (free tier). Using Wrangler: `npx wrangler d1 create andro-win`. Copy the UUID returned. In the root `wrangler.json`, add alongside the existing keys:
   ```json
   "d1_databases": [{
     "binding": "WIN_DB",
     "database_name": "andro-win",
     "database_id": "PASTE_THE_REAL_D1_DATABASE_UUID_HERE"
   }]
   ```
   Do **not** add a fake UUID; it would break deployments. Commit the real binding only after the database exists. Apply the schema with `npx wrangler d1 migrations apply andro-win --remote` from the repo root, after the real binding has been added.
3. In Cloudflare Turnstile create a **free** widget for `andro.co.nz` (also add allowed preview hostnames only if necessary). Set site key as Worker plain text environment variable `WIN_TURNSTILE_SITE_KEY` and the verification secret as a **secret** `WIN_TURNSTILE_SECRET_KEY`. The server verifies each response through Siteverify and checks the hostname and action.
4. Set Worker variables with timezone offsets in valid ISO format (illustrative values only; **agree actual dates before entering**):
   - `WIN_OPEN_AT` = `2026-11-20T09:00:00+13:00`
   - `WIN_CLOSE_AT` = `2026-12-15T23:59:00+13:00`
   - `WIN_DRAW_AT` = `2026-12-16T12:00:00+13:00`
   This is a **manual draw** button available to the authenticated admin **on or after** the draw time. The code does not schedule or notify a winner automatically.
5. Deploy; visit `/win`. It will show **Entries not yet open** when any dates, database or Turnstile keys are missing. Only advertise the promotion after you have tested a real entry and checked `/win/admin`.
6. Review privacy disclosures and secure the Cloudflare account. Download a CSV backup from the private admin as needed. At the conclusion, remove entries when no longer needed (and preserve any marketing-consent records only under a lawful retention policy).

## Entry experience

- Mobile-friendly landing page, prize details, eligibility, terms and privacy statement.
- Required name, email, phone, suburb, property role, task category and description.
- Separate **unchecked** marketing opt-in; entering does not automatically subscribe a person.
- Hidden honeypot, Cloudflare Turnstile (server verified), existing per-IP and global rate-limiting bindings, strict server-side validation, unique email address, no open submissions before/after the configured window.
- After submission it returns the same confirmation for duplicate email addresses to avoid disclosing who has entered.

## Admin experience

- Reuses password and strong signed cookie from /report but with its own `/win/admin` session cookie.
- Current totals, recent entries, separate marketing-consent status, CSV export.
- Cryptographically random draw after the configured draw time, with a database uniqueness constraint limiting to a single winner.
- To select a replacement winner following a disqualification, resolve the original winner status through a reviewed, auditable procedure; this feature deliberately does not offer an unrecorded redraw.

## Important technical notes

- The public page cannot accept entries until the D1 database, migration, dates and Turnstile secrets are in place.
- `wrangler.json` is the deployment source of truth; database binding must be added there, not only in a dashboard binding.
- Cloudflare's free quotas apply; high traffic can hit them. This feature does not deliver email confirmations or automatically contact the winner.
- The admin uses the already configured /report password (do not expose it in client code); /win/admin endpoints check a signed, expiring cookie, with no-store responses.
- Never commit Turnstile secret key, report password or session secret.
- Giveaway terms were authored as a starting point only, not legal advice; business owner must verify before opening the entries.
