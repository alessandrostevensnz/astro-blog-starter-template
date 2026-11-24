# ANDRO /win — Facebook & Instagram Instant Form integration (prepared, OFF)

**Status: NOT ACTIVE.** The website's existing signup form stays open and unchanged. Meta/Instagram leads are **not official entries and are not imported** until the conditions, Page permissions, consent wording, integration tests and opt-in switch are explicitly approved.

## 1. Current promotion-rule blocker

ANDRO's published entry method currently states that entrants must use the free form on `andro.co.nz/win`. The giveaway is already in progress. NZ Department of Internal Affairs guidance says **sales-promotion conditions cannot be changed once started**, and the Commerce Commission requires clear, non-misleading rules. An adviser should first determine how this no-purchase prize draw is classified, and whether it is lawful/fair to add a new entry route during the current competition. If that cannot be cleared, **keep this integration off for the present draw** and advertise the website link; use Facebook's Instant Form as an entry route only for a subsequent competition with terms settled before launch.

Do not run paid ads that promise completion of the Facebook form is an official current entry before this has been resolved.

Official guidance:
- https://www.dia.govt.nz/Gambling-Fact-Sheet-9---Sales-Promotions
- https://www.comcom.govt.nz/business/dealing-with-typical-situations/running-competitions-and-promotions/
- https://www.privacy.org.nz/privacy-principles/3/

## 2. Build a three-field Meta Instant Form

A separate yes/no age question is **not required** for this proposed intake. Show all eligibility conditions prominently and use **one required acknowledgement** of the full terms (including age and property authority), followed by verification of the provisional winner's age, Auckland property and permission to arrange work **before** awarding the prize. Set the ad audience to 18+, but do not treat Facebook age targeting as proof of eligibility.

Create a NEW Instant Form (do not reuse an earlier form with different questions). Choose **Get more leads → Instant Form** and ask for only:

| Meta question | Type | Required |
|---|---|---|
| Full name | Standard contact | Yes |
| Email address | Standard contact | Yes |
| Phone number | Standard contact | Yes |

Include a **required, initially unticked custom disclaimer agreement checkbox** with this concise wording:

> I confirm I am 18 or older, have an eligible property in mainland Auckland and permission to arrange work there, and agree to ANDRO's giveaway terms and privacy notice. One entry per person.

This replaces multiple separate eligibility questions. It is **not proof** of age or property authority. The eventual provisional winner must pass the published verification process. The importer deliberately stores `suburb`, `property_role`, `service_type`, and `work_details` as **empty strings**, not fabricated values; the admin dashboard flags the missing details for later verification.

Include a **separate optional**, initially unchecked marketing consent checkbox if you want to use leads for news or offers:

> Optional: I would like to receive occasional ANDRO news and offers by email. I can unsubscribe at any time.

If you omit the optional marketing checkbox, the integration will mark every Meta entrant as **not opted in**. No purchase, Facebook like, follow, tag or share is required.

In the form's headline/description, make clear: **one prize of up to 8 hours of one worker's labour, materials excluded; 18+; eligible mainland Auckland property; one entry per person; entries close midnight at the end of 24 December 2026; manual draw on Christmas Day.** Link the full rules: `https://andro.co.nz/win/#win-terms`.

Set Meta's **privacy policy URL** to `https://andro.co.nz/win/privacy`. The form completion text may say **"Thanks for entering"** only once the live integration is activated, its database acceptance is verified and legal approval for Facebook entries has been obtained.

**Important:** Graph API `field_data` contains the three contact fields; a custom disclaimer agreement arrives separately in `custom_disclaimer_responses` with `checkbox_key` and `is_checked`. Discover the real keys using Meta's Lead Ads Testing Tool; do not guess them. The backend fails closed if the required checkbox is absent, even when all three contact fields are present.

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

1. Use a test lead from the correct Page and form, created **inside** the published entry period, with name, email, phone and the single required eligibility/terms checkbox. No separate age/suburb/job questions should appear.
2. Confirm Meta sent a signed `leadgen` webhook. The Worker validates **HMAC SHA-256**, checks the exact Page and Form, fetches complete lead data (including custom-disclaimer answers) through Graph API and applies the same contact-field validation as the ANDRO website form, leaving additional property information uncollected until winner verification.
3. Check `/win/admin`: one new record appears with source **Facebook Instant Form**, and **Total entries** increases by one.
4. Re-send the identical test lead: total must stay unchanged. Use an email already in the website signup: no duplicate entry may be added.
5. Check with and without the optional marketing checkbox. Marketing opt-in must remain **off** unless the specific optional checkbox was actually ticked.
6. Confirm forms lacking name, email, phone or the required eligibility/terms agreement are **rejected** and **not** counted as entries. A self-declared eligible applicant may be selected provisionally, but the winner must verify age, mainland Auckland property and owner permission before the prize is confirmed.
7. Before the Christmas Day draw, verify Meta's submission count and the imported/duplicate/rejected counts, and investigate any missing eligible leads. Meta webhooks can arrive late; the draw must not go ahead while valid entries are unprocessed.

**Note:** Automatic transfer is conditional on Meta's permissions and Page integration. No connection to the owner's Facebook account has been made by committing code. Since the prize is a live competition, final legal and consent sign-off remains essential.

## 6. Privacy and retention

The publicly accessible privacy notice is `/win/privacy`, using the same `content/pages/win.json` privacy text already published on `/win`. Meta stores the original form response; the ANDRO D1 database stores the approved, normalised entry and a **minimal Meta receipt log** (lead ID, form ID, status and receipt time — not a second full contact-data copy). Retain/delete personal data in accordance with the approved giveaway privacy notice. Do not use lead details for marketing if no separate, valid optional consent exists.
