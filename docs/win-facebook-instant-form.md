# ANDRO /win — Facebook & Instagram Instant Form integration (prepared, OFF)

**Status: NOT ACTIVE.** The website's existing signup form stays open and unchanged. Meta/Instagram leads are **not official entries and are not imported** until the conditions, Page permissions, consent wording, integration tests and opt-in switch are explicitly approved.

## 1. Current promotion-rule blocker

ANDRO's published entry method currently states that entrants must use the free form on `andro.co.nz/win`. The giveaway is already in progress. NZ Department of Internal Affairs guidance says **sales-promotion conditions cannot be changed once started**, and the Commerce Commission requires clear, non-misleading rules. An adviser should first determine how this no-purchase prize draw is classified, and whether it is lawful/fair to add a new entry route during the current competition. If that cannot be cleared, **keep this integration off for the present draw** and advertise the website link; use Facebook's Instant Form as an entry route only for a subsequent competition with terms settled before launch.

Do not run paid ads that promise completion of the Facebook form is an official current entry before this has been resolved.

Official guidance:
- https://www.dia.govt.nz/Gambling-Fact-Sheet-9---Sales-Promotions
- https://www.comcom.govt.nz/business/dealing-with-typical-situations/running-competitions-and-promotions/
- https://www.privacy.org.nz/privacy-principles/3/

## 2. Build a new, fully specified Meta Instant Form

The current screenshots show an Instant Form with only contact details; **do not use it as a giveaway entry**. Duplicate it or make a new form before publishing. In Meta Ads Manager choose **Get more leads → Instant Form**, and use these fields. The labels matter because the connector normalises them into predictable Graph API keys:

| Meta question | Type | Allowed responses / notes |
|---|---|---|
| Full name | Standard contact | Required |
| Email | Standard contact | Required |
| Phone number | Standard contact | Required (same rule as website) |
| Auckland suburb | Short text | Required |
| Relationship to property | Multiple choice | `Owner` / `Property manager` / `Tenant with owner permission` |
| Type of work | Multiple choice | `Property maintenance` / `Handyman work` / `Minor building repairs` / `Other eligible work` |
| Are you 18 or older | Multiple choice | `Yes` / `No` — must answer Yes |
| Do you have permission to arrange work at this property | Multiple choice | `Yes` / `No` — must answer Yes |
| Optional work description | Short text | Optional; remove if Meta cannot make it optional |

Include a **required custom-disclaimer consent checkbox** with text along these lines (to be approved before use):

> I have read and agree to ANDRO's giveaway terms and privacy notice, including the one-entry-per-person rule, the labour-only prize and the Auckland eligibility conditions.

Include a **separate optional, initially unchecked custom-disclaimer checkbox**:

> I would also like to receive optional marketing emails from ANDRO Construction + Projects. I can unsubscribe at any time.

Do not require a Facebook follow, like, tag, share, or purchase. Make clear: **18+**, mainland Auckland Council area, one prize of **up to eight hours of one worker's labour**, materials/consent/specialist services excluded, and Christmas Eve entry deadline. Show prize details and the official entry rules at `https://andro.co.nz/win/#win-terms`.

Set the Meta **privacy policy URL** to `https://andro.co.nz/win/privacy` (it draws from the same editable privacy notice as the website) and the completion message to **"Thanks for entering!"** only after the form-to-database integration has been fully verified. Until then, do not tell people their Meta form submission is an official current giveaway entry.

**Important:** Custom-disclaimer answers are not in Graph API `field_data`; they are retrieved separately as `custom_disclaimer_responses`, with a `checkbox_key` and `is_checked`. The required and optional keys must be discovered and tested using Meta's Lead Ads Testing Tool (do not guess their values).

## 3. Connect the Meta Page (requires action in Meta)

A real-time Meta lead integration needs a Meta developer app, Page access and a token that can fetch leads. Current Meta documentation mentions `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, and `ads_management`/`pages_manage_ads` as relevant permissions. App Review and business verification may be required; an unpublished/development-mode app cannot retrieve all public leads. The account owner needs to complete the approval/authorization in Meta — ChatGPT cannot infer or issue these tokens.

- Create/configure the app at https://developers.facebook.com/apps/
- Graph API leadgen webhook docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/
- Lead retrieval: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/
- Webhook callback: **`https://andro.co.nz/api/win/meta/webhook`**
- Subscribe the **Page** object's **`leadgen`** field and install the app on ANDRO's business Page.
- Use the Meta Lead Ads Testing Tool: https://developers.facebook.com/tools/lead-ads-testing/
- The Facebook Page ID, Instant Form ID and `checkbox_key` values can be shared as **non-secret identifiers**. Do not paste the Page access token, app secret or verification token into chat or GitHub.

Meta Lead Ads permissions must allow ANDRO's chosen app to retrieve that Page's lead information; check Leads Access Manager.

## 4. Cloudflare settings — do not activate early

The existing `wrangler.json` has **`WIN_META_IMPORT_ENABLED = "false"`**. Keep it false until everything above is tested, then enable as a separate approved change. Do not modify `WIN_ENTRIES_ENABLED`, dates, website form, Turnstile or existing D1 bindings.

Cloudflare Workers → `astro-blog-starter-template` → Settings → Variables and Secrets:
- Non-secret vars (set only once verified): `WIN_META_PAGE_ID`, `WIN_META_FORM_ID`, `WIN_META_TERMS_KEY`, `WIN_META_MARKETING_KEY` (optional; no key means NO marketing consent).
- **Production Secrets** (never commit or send in chat): `WIN_META_APP_SECRET` (the Meta app secret), `WIN_META_VERIFY_TOKEN` (a newly generated strong token, same value as Meta's Webhooks Verify Token), and `WIN_META_PAGE_TOKEN` (a properly authorised Page access token with lead retrieval).
- After Meta can retrieve a real test lead and consent mapping is confirmed, install `migrations/0003_win_meta_leads.sql` in the **existing** Cloudflare D1 database `andro-win`. Only new lead-status/idempotence records are created; existing `win_entries` rows are untouched.
- Turn on `WIN_META_IMPORT_ENABLED="true"` **only after legal review and the migration**. This connector will otherwise fail closed with 503 instead of registering someone as a contest entrant.

No Facebook API token is necessary to continue accepting normal website submissions.

## 5. Verify end-to-end before advertising

1. Use a test lead from the correct Page and form, created **inside** the published entry period and with every required checkbox affirmative.
2. Confirm Meta sent a signed `leadgen` webhook. The Worker validates **HMAC SHA-256**, checks the exact Page and Form, fetches complete lead data (including custom-disclaimer answers) through Graph API and reuses the existing ANDRO entry validation.
3. Check `/win/admin`: one new record appears with source **Facebook Instant Form**, and **Total entries** increases by one.
4. Re-send the identical test lead: total must stay unchanged. Use an email already in the website signup: no duplicate entry may be added.
5. Check with and without the optional marketing checkbox. Marketing opt-in must remain **off** unless the specific optional checkbox was actually ticked.
6. Confirm incomplete/ineligible Meta forms are flagged as **rejected** in the Meta import status but **not counted as eligible entries**; fix the form and re-test before spending money.
7. Before the Christmas Day draw, verify Meta's submission count and the imported/duplicate/rejected counts, and investigate any missing eligible leads. Meta webhooks can arrive late; the draw must not go ahead while valid entries are unprocessed.

**Note:** Automatic transfer is conditional on Meta's permissions and Page integration. No connection to the owner's Facebook account has been made by committing code. Since the prize is a live competition, final legal and consent sign-off remains essential.

## 6. Privacy and retention

The publicly accessible privacy notice is `/win/privacy`, using the same `content/pages/win.json` privacy text already published on `/win`. Meta stores the original form response; the ANDRO D1 database stores the approved, normalised entry and a **minimal Meta receipt log** (lead ID, form ID, status and receipt time — not a second full contact-data copy). Retain/delete personal data in accordance with the approved giveaway privacy notice. Do not use lead details for marketing if no separate, valid optional consent exists.
