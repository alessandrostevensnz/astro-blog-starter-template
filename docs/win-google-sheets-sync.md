# Google Sheets → ANDRO lead-sync bridge (SAFE MODE / OFF)

For the final Meta Lead Ads form **ANDRO WIN final**, delivered to Google spreadsheet **ANDRO NEW FINAL**, tab **Sheet1**. The sheet contains Meta-generated sample leads and an owner-controlled manual test. None is an eligible competition entry.

**Not live:** This bridge is provided for inspection and setup. Do NOT count a Facebook form as an official entry, publish the Instant Form ad, activate scheduled sync, or enable Cloudflare import until a NZ promotion-law/consent review has approved adding a second method to the already-running giveaway. The published website rules provide for Facebook entries once ANDRO makes the final form available; live imports remain disabled until verification and approval. This does not alter existing website entries or the Christmas draw.

## What to do in Apps Script right now

1. In **ANDRO NEW FINAL → Extensions → Apps Script** rename `Untitled project` to **ANDRO Facebook Lead Sync**.
2. Open `Code.gs`, delete the starter `myFunction()` code, and paste all of `scripts/ANDRO_Facebook_Lead_Sync.gs` from this repository.
3. Press **Save** (Cmd+S). In the function selector near **Run**, choose **androPreview**, then click **Run** once. Google may ask you to authorise this *your own* script to access your private sheet. Inspect the permissions before allowing access.
4. Open **Execution log**. It prints the number of Meta leads, the number of sample rows, and whether the expected consent column exists. **It never transfers personal information, creates entries or sends a network request.**
5. Expect `records=1`, `Meta test rows=1` and likely `Verified consent column configured and present: NO` with the current form. A Meta-generated sample row must not be imported. **Do not manually add a "yes" column to pretend entrants checked a box.**

Do **not** click the Apps Script **Deploy** button. This is not a public web app; later it uses a private **5-minute time-driven trigger**. Meta/Google Sheets adds rows externally, so `onEdit` and Sheets "on form submit" are not reliable for this connection.

## Before production activation (NOT now)

1. Obtain a legal review of adding a Facebook Instant Form to the current promotion, and verify/approve the form's required eligibility/terms acknowledgement and separate optional marketing permission. The current published entry method is the ANDRO website; NZ DIA's sales-promotion guidance states conditions cannot be changed once the promotion has started.
2. Ensure the *actual Meta-generated* Google Sheet contains a reliable column for the required checkbox, not a hand-entered value or checkbox fabricated by an administrator. Without a verifiable consent column the bridge will refuse to run. If Meta's basic Instant Form does not export that checkbox into Sheets, use a properly configured Instant Form with a verifiable custom disclaimer and retest, or continue to use website-only entries for this giveaway.
3. In Cloudflare D1 **andro-win** apply the idempotent `migrations/0003_win_meta_leads.sql` after separately reviewing it. Never drop/recreate `win_entries` or the original database.
4. In the Cloudflare Worker **astro-blog-starter-template**:
   - Production **secret** `WIN_META_SHEETS_SYNC_SECRET`: a unique 32+-character secret, created securely by the owner. NEVER paste into ChatGPT, emails or GitHub.
   - Non-secret `WIN_META_FORM_ID`: the final form ID is stored in `wrangler.json`, so it survives GitHub deployments. Verify it against the sheet's `form_id` field. Wrangler is the source of truth for the import switches; do not rely on dashboard-only changes surviving deployments.
   - **Only after** legal/consent checks, D1 migration and successful isolated test: `WIN_META_IMPORT_ENABLED="true"` and `WIN_META_SHEETS_SYNC_ENABLED="true"` in `wrangler.json`. Both are currently deliberately false. Do not alter the website's `WIN_ENTRIES_ENABLED` or the giveaway dates.
5. In **Apps Script → Project Settings → Script properties** (NOT in source code):
   - `ANDRO_SYNC_SECRET`: same secret as the Cloudflare `WIN_META_SHEETS_SYNC_SECRET`.
   - `ANDRO_TERMS_COLUMN`: the precise **Meta-provided column heading** containing each entrant's affirmative agreement to age, eligibility, permission, and full terms. Do not create a fabricated consent column.
   - `ANDRO_MARKETING_COLUMN` (optional): the *separate* Meta-generated opt-in column, if present; otherwise consent is OFF.
   - `ANDRO_SYNC_ENABLED`: set to **false** during setup; enable only after all checks and approval.
   - `ANDRO_TEST_LEAD_ID`: exact owner-controlled manual test lead ID; that row will always be skipped.
   - With all three switches still false, run `androCheckConnection`. It sends a signed, no-contact-details probe with terms deliberately false, expecting HTTP 422 and `terms_acknowledgement_not_captured`. It cannot create a competition entry. Check the private admin dashboard for missing configuration if necessary.
6. With an approved genuine test lead and both systems enabled, manually run `androSyncLeads` and confirm one new entry in `/win/admin`, correct source, no duplicate email and no inadvertent marketing permission. **The Meta-generated `test@meta.com` row is always skipped.** The script records only lead IDs, results and timestamps in an additional `ANDRO Sync Log` tab; it never copies full contact details to the log. A failed request is not marked as processed so it can be retried.
7. Only after end-to-end verification, select `androInstallFiveMinuteTrigger` and Run. This creates one five-minute scheduled sync. App Script **Deploy** is not used. Monitor Apps Script **Executions** and the status labels in `/win/admin`; reconcile Facebook lead counts before any draw.

## Security design

- The client sends a JSON body signed using **HMAC SHA-256** over the exact UTF-8 content, in `X-ANDRO-Sheets-Signature`. The Cloudflare Worker verifies it, rejects expired/replayed timestamps beyond five minutes and requires the correct Meta form ID, entries being open at the **original Meta form submission time**, age/property/terms consent confirmation, and normal contact validation. It refuses the `test@meta.com` sample row.
- The public endpoint is `POST https://andro.co.nz/api/win/meta/sheets` but refuses imports unless both independent runtime flags are explicitly set to true, the secret exists, and migration 0003 has been installed. No secret or personal lead data is logged.
- Accepted entries share the existing `win_entries` database and are deduplicated by email and lead ID in `win_meta_leads`. Imported leads carry the same separate marketing consent rule as the website.
- **Important limitation:** An owner-edited Google spreadsheet cannot independently prove the person really saw or ticked the Meta terms. Approval and test must establish that the terms-acknowledgement column came from Meta's original form and is trustworthy. The proposed system is a prepared integration, not a compliance certificate.

## Supporting sources

- https://developers.google.com/apps-script/guides/triggers/installable
- https://developers.google.com/apps-script/guides/triggers/index
- https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app
- https://developers.google.com/apps-script/reference/utilities/utilities
- https://www.dia.govt.nz/Gambling-Fact-Sheet-9---Sales-Promotions
