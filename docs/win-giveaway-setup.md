# ANDRO /win giveaway — launch checklist

This feature lives in the existing Astro/Cloudflare **Workers** site (not a separate Pages project). The D1 binding and public Turnstile site key are configured in the main site; legal improvements are under review. The site owner confirmed that the `win_entries` table is listed in Cloudflare D1 and that the Turnstile production secret was deployed. These have not yet been independently verified by live submission testing. The approved Christmas Eve closing deadline and Christmas Day draw are configured in `wrangler.json`.
Public: `/win`. Private dashboard: `/win/admin`. Admin sign-in uses the **existing /report password**, which must remain configured with `REPORT_PASSWORD` and `REPORT_SESSION_SECRET`, and existing `REPORT_LOGIN_IP_LIMITER` and `REPORT_LOGIN_GLOBAL_LIMITER`.

## Remaining launch setup

1. **Review and approve the full proposed terms in `src/pages/win.astro` before enabling entries.** They now cover Auckland eligibility, maximum **eight hours of one worker's labour**, materials exclusions, random draw, contact within three business days, seven-day response window, replacement-draw procedure, proposed 31 March 2027 redemption target, and privacy. Confirm each business promise is practical before removing the draft notice. Ensure all entry conditions and the prize are clear in advertising, including the start of the entry period. Relevant NZ guidance: [Commerce Commission — Running competitions](https://www.comcom.govt.nz/business/dealing-with-typical-situations/running-competitions-and-promotions/), [DIA — Sales promotions](https://www.dia.govt.nz/Gambling-Fact-Sheet-9---Sales-Promotions), and [Privacy Commissioner — Collecting](https://www.privacy.org.nz/responsibilities/collecting/). This is not legal advice.
2. **D1 database binding has been configured in this PR.** The submitted database UUID `2b29bba4-6369-44a9-a204-69ae88b2ac0a` is bound as `WIN_DB` with the configured database name `andro-win`. Confirm that this UUID belongs to the correct Cloudflare account and database. **The site owner has confirmed that `win_entries` appears in the Cloudflare D1 Console.** The SQL migration was applied manually; do not re-run it just to proceed. If a fresh environment requires installation, choose one approach:
   - **Cloudflare dashboard (no terminal):** Open **Storage & databases → D1 → andro-win → Console**. Copy the SQL from [migrations/0001_win_entries.sql](../migrations/0001_win_entries.sql), paste it in the Console and execute it. Check that the `win_entries` table appears. The SQL uses `CREATE IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` so rerunning it does not drop entries.
   - **Wrangler CLI (tracks applied migrations):** From the repository root, with Cloudflare authenticated, run `npx wrangler d1 migrations apply andro-win --remote`. Use this approach if you want Wrangler migration tracking. Do not run both approaches unnecessarily.

3. **Turnstile widget has been created, and the site owner confirmed its production secret was deployed.** Its public site key `0x4AAAAAAGBnK_eVlihsb2dT` is now committed under `vars.WIN_TURNSTILE_SITE_KEY` in `wrangler.json`. Verify the widget permits hostname `andro.co.nz`. Confirm Cloudflare **Workers & Pages → astro-blog-starter-template → Settings → Variables and Secrets → Production** has `WIN_TURNSTILE_SECRET_KEY` saved as a **Secret** (not a plain text variable). If the previous Add variable dialog was still open, select **Add 1 variable and deploy** to finish saving it. Do **not** put the secret in GitHub or share it in chat. The server verifies each response through Siteverify and checks hostname and action.
4. **Competition dates have been approved and set in `wrangler.json` (Auckland time, UTC+13):**
   - `WIN_OPEN_AT` = `pending` — **this must be replaced with a precise, future, timezone-qualified entry opening date before launch**. Example format: `2026-11-30T09:00:00+13:00`. No entry can be accepted while it says `pending` or `launch`.
   - `WIN_CLOSE_AT` = `2026-12-24T23:59:59+13:00` — Thursday, Christmas Eve, 24 December 2026 at 11:59:59 p.m.
   - `WIN_DRAW_AT` = `2026-12-25T12:00:00+13:00` — Friday, Christmas Day, 25 December 2026 at 12:00 noon.
   Publish the actual start time (not just 'on launch') before any advertising. A fixed start time is now an independent safety requirement in the code, alongside the enabled flag. This is a **manual draw**, available at `/win/admin` to the authenticated admin **on or after noon on Christmas Day**. Changing the date does **not** automatically select or notify the winner; ANDRO must press **Draw winner** and then contact them using the existing rules.

5. **Launch safety switch:** `wrangler.json` now contains `WIN_ENTRIES_ENABLED = "false"`. The public page will display **Entries are not open yet** even after a deployment, so that the landing page and private dashboard can be inspected without accepting entries. No changes to this setting should be made without the business owner's explicit go-live approval.
6. **Additional D1 migration required:** Apply [migrations/0002_win_draw_audit.sql](../migrations/0002_win_draw_audit.sql) to the **existing** remote `andro-win` database via Cloudflare D1 → Console, or apply it using authenticated Wrangler. Do **not** recreate or delete the existing `win_entries` table. This creates `win_entry_exclusions` and `win_draw_events`. Confirm both tables appear in the D1 Console and audit functionality works before launch.
7. **Privacy/contact review required:** The Privacy Act principle 3 requires the collector's name and address. The current terms intentionally flag that ANDRO must provide a suitable **real business correspondence/postal address** before launch; do not publish a private residential address unintentionally. Verify a functioning contact inbox and privacy-officer contact route, and review Cloudflare's data-processing arrangements under privacy principle 12. Finalise the stated data-retention procedure for after the prize is delivered.
8. **Approval required:** Confirm the promised scope, eligibility area, worker availability, response times and March 2027 prize redemption plan. Obtain legal confirmation on the free-entry promotion's classification under the Gambling Act before starting paid advertising. Review final Facebook/Instagram release and advertising wording.
9. After the owner approves the proposed rules, test the live/deployed worker: verify public form remains closed with the switch OFF; confirm `/win/admin` requires the site-reports password and that its CSV export works; test Turnstile and database writing in a controlled, approved production or isolated test environment; check closed/open time boundaries, mobile view and duplicate-entry handling. To launch, publish the approved public opening time clearly and change `WIN_ENTRIES_ENABLED` to `"true"` only in the final authorised deployment. Do not publicly advertise until this end-to-end test succeeds.
10. Review privacy disclosures and secure the Cloudflare account. Download a CSV backup from the private admin as needed. At the conclusion, remove entries when no longer needed (and preserve any marketing-consent records only under a lawful retention policy).

## Editing the prize and terms later

The draft now adds **Pages - photos and text → Win a Day - prize and conditions** to the existing `https://andro.co.nz/admin` editor. It edits `content/pages/win.json` (the hero/prize summary, promotional copy, eligibility, exclusions, full prize conditions, winner contact rules, redemption and privacy).
Publish changes in Decap as usual; on successful GitHub and Cloudflare deployment, the live `/win` page reflects the edits. Technical keys, draw dates, database access and the entry switch stay in `wrangler.json` for safety.

**Important NZ rule:** Treat the published terms as fixed once this promotion starts. Department of Internal Affairs guidance on sales promotions says conditions cannot be changed once the competition has started. Edit the draft before launch, and use the editable fields to prepare terms for a *future* giveaway rather than changing the current prize or rules after people have entered. See [DIA sales promotions guidance](https://www.dia.govt.nz/Gambling-Fact-Sheet-9---Sales-Promotions).

## Entry experience

- Mobile-friendly landing page, prize details, eligibility, terms and privacy statement.
- Required name, email, phone, suburb, property role, task category and description.
- Separate **unchecked** marketing opt-in; entering does not automatically subscribe a person.
- Hidden honeypot, Cloudflare Turnstile (server verified), strict server-side validation, unique email address, no open submissions before/after the configured window. Admin password attempts reuse the existing report login rate-limit bindings; public entry submissions use Turnstile.
- After submission it returns the same confirmation for duplicate email addresses to avoid disclosing who has entered.

## Admin experience

- Reuses password and strong signed cookie from /report but with its own `/win/admin` session cookie.
- Current totals, recent entries, separate marketing-consent status, CSV export.
- Cryptographically random draw after the configured draw time, with a database uniqueness constraint limiting to a single winner.
- After migration 0002 is installed, the admin can record exclusion reasons for duplicate/ineligible entries after closing. If a provisionally selected entrant is ineligible, declines or fails to respond within the advertised seven days, record the reason. This releases the selection, excludes the original entry from future draws, and preserves its selection/exclusion events in an audit log. The Draw winner button then becomes available again. **Do not disqualify a valid entrant without an evidenced reason.**

## Important technical notes

- The public page cannot accept entries until its code is deployed, the D1 database/migration and Turnstile secret have been verified, a definite start time configured, migration 0002 installed, and `WIN_ENTRIES_ENABLED` explicitly switched to `true`. Deploying this branch with `WIN_ENTRIES_ENABLED=false` will not open the form. The owner must approve the complete promotion terms, privacy notice and launch checks before the switch is enabled.
- `wrangler.json` is the deployment source of truth; database binding must be added there, not only in a dashboard binding.
- Cloudflare's free quotas apply; high traffic can hit them. This feature does not deliver email confirmations or automatically contact the winner.
- The admin uses the already configured /report password (do not expose it in client code); /win/admin endpoints check a signed, expiring cookie, with no-store responses.
- Never commit Turnstile secret key, report password or session secret.
- Giveaway terms were authored as a starting point only, not legal advice; business owner must verify before opening the entries.

## Legal sources to review at launch (updated November 2026)

- **NZ Commerce Commission, Fair Trading Act**: https://www.comcom.govt.nz/business/dealing-with-typical-situations/running-competitions-and-promotions/ — clear prize, time limit and fair advertising.
- **Department of Internal Affairs**: https://www.dia.govt.nz/Gambling-Fact-Sheet-9---Sales-Promotions — sales-promotion rules and when specialist legal advice is needed. Because this giveaway requires **no purchase or payment**, confirm the legal classification with a solicitor before opening entries. Never introduce mandatory material purchases, fees, paid referrals or an obligation to buy a service as an entry condition.
- **Privacy Commissioner**: https://www.privacy.org.nz/privacy-principles/3/ (notice with name/address), https://www.privacy.org.nz/privacy-principles/9/ (retention), https://www.privacy.org.nz/privacy-principles/12/ (cross-border disclosure). A professional adviser must verify applicable Cloudflare hosting agreements and any international transfer requirements.
- **DIA unsolicited electronic messages**: https://www.dia.govt.nz/Spam---Commercial-electronic-messaging-in-New-Zealand — only use the **unchecked, separately opted-in** marketing list for promotional messages; identify ANDRO and provide a working unsubscribe mechanism.
- **Auckland Council**: https://www.aucklandcouncil.govt.nz/en/building-and-consents/consent-exemptions/building-work-you-can-do-yourself.html — even exempt works must meet Building Code obligations; some projects need resource consent and restricted building work requires an LBP.
- **WorkSafe**: https://www.worksafe.govt.nz/managing-health-and-safety/getting-started/understanding-the-law/primary-duty-of-care/ — contractor/PCBU must manage safety risks for workers and others.
- **Meta**: check the latest Page/Instagram promotion policies before advertisements. Terms must say the promotion is independent, release Meta/Facebook/Instagram as permitted by law, and should not require likes, follows, tags or shares.

Do not advertise until the **final opening timestamp**, **business contact address**, **prize terms**, **hosted privacy assurances**, **D1 audit migration**, and **end-to-end tests** are confirmed. The entry switch intentionally remains OFF.
