# ANDRO page-by-page photo editing

## Using the editor

Open `/admin/`, select **Pages - photos and text**, then the page you want to edit.

- **Home:** four fixed photos, existing text/formatting controls, and two footer images.
- **Construction:** five individually labelled photos (banner, residential, commercial, process left, process right), the construction showcase, existing copy/formatting, and footer images.
- **Asset maintenance:** the actual banner previously hard-coded as `preston.png`, all four service-photo positions and their descriptions (including currently empty slots), the closing photo, existing copy/formatting, and footer images.
- **Projects:** all existing project cards and photos, plus footer images.
- **About:** both the banner background and the approach photo, existing copy/formatting, and footer images.
- **Contact:** the two footer images. No main-page photograph exists in the current design. The contact form is unchanged.

Choosing a different file in one image control changes only that position. Two controls may initially use the same file, but they are independent. Upload replacements using new filenames; overwriting/deleting an existing media file can affect every place that uses that physical file.

The native image controls show selected thumbnails. The right-hand preview follows the page you are editing, rather than always showing Home. Supported text changes preview immediately. For new photo choices and added/removed gallery cards, publish, wait for the website build, and select **Refresh page preview**.

## Data and migration

Six files in `content/pages/` replace the single large page editor. Existing data was copied from commit `2dd99859d62549d433c695e94b157023766ed5ca` without changing the visible photographs or existing copy. The About banner changes from a CSS background to an equivalent positioned image so it has an editable source and alt text.

`content/site.json`, `content/maintenance-services.json`, and `content/construction-gallery.json` are retained as migration backups. They are no longer exposed as competing CMS editors. `src/data/site.ts` preserves existing consuming API shapes while loading each page file. Global typography is in `content/site-settings.json`.

Configuration is generated at build time by `src/pages/admin/config.yml.ts` from `src/lib/cms-config.ts`. JSON is valid YAML, so Decap uses the same `/admin/config.yml` URL. The old `public/admin/config.yml` must be removed to avoid a route collision. All file-collection entries have distinct files, avoiding cross-page save overwrites.

OAuth configuration, the Decap package version, Cloudflare settings, login middleware, and `/report` are unchanged. No photos are uploaded by this patch. Old editor links redirect to the equivalent new page editor.

## Verification

Run:

```sh
node --experimental-strip-types scripts/verify-page-editor.mjs
npm run build
```

Before merge, reconcile any changes to the three legacy content files made after the migration snapshot, so fresh live edits are not lost. Do not publish from an old editor tab during the transition. Reload `/admin/` after deploying.

Then verify in the real authenticated editor: all five Construction thumbnails are visible; change just the process-right photo, publish and confirm the other four and Home remain unchanged. Test an Asset maintenance service photo, an About photo and a Projects card, and ensure captions/alt text persist after reopening.

The preview config still targets `main`, as before. New CMS file entries will not be available through the production backend until this migration is merged. Public-page previews and static schema tests can run before merge; do not treat those as an authenticated CMS save test.
