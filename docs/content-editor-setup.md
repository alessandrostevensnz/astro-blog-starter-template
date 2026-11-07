# Set up the ANDRO visual editor

The visual editor is Decap CMS at `/admin/`. It uses GitHub sign-in and commits content and uploaded images to this repository. The website's normal deployment process publishes those changes.

## One-time GitHub sign-in setup

1. In GitHub, create an OAuth App under **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Set **Homepage URL** to `https://astro-blog-starter-template.alessandrostevensnz.workers.dev/`.
3. Set **Authorization callback URL** to `https://astro-blog-starter-template.alessandrostevensnz.workers.dev/admin/`.
4. Copy the OAuth App's **Client ID** (not its client secret).
5. In `public/admin/config.yml`, replace `YOUR_GITHUB_OAUTH_APP_CLIENT_ID` with that Client ID and commit the change.
6. Visit `https://astro-blog-starter-template.alessandrostevensnz.workers.dev/admin/`, sign in with a GitHub account that has write access to this repository, and edit the content.

The OAuth Client ID is public and belongs in the CMS config; never add the OAuth App client secret or a personal access token to the website. `andro.co.nz` is not connected yet, so the editor initially uses the current `workers.dev` address. If you connect the custom domain later, update the OAuth App URLs to use it.

## What you can edit

The **Website content** collection lets you update homepage copy, page summaries, photos and their accessible descriptions (alt text), and add/reorder/edit project gallery cards. Uploaded images are saved in `public/images` and referenced from the site's content JSON.
