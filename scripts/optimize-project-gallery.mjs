/**
 * Generate lightweight, responsive WebP thumbnails for ANDRO photo galleries.
 *
 * The source photos in public/images/ are never modified. The generated files and
 * manifest are build outputs only, so Decap CMS continues editing original URLs.
 * Run by the Astro config hook before every build and dev server start.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const originalsDir = path.join(projectRoot, 'public', 'images');
const outputDir = path.join(originalsDir, 'project-thumbnails');
const manifestFile = path.join(projectRoot, 'src', 'data', 'project-gallery-optimized.generated.json');
const pageNames = ['home', 'about', 'construction', 'maintenance', 'projects', 'win'];
const pagesDir = path.join(projectRoot, 'content', 'pages');
const footerFile = path.join(projectRoot, 'content', 'site-footer.json');
const imagePattern = /\.(?:png|jpe?g|webp|avif|heic|heif)$/i;

// Traverse the CMS data so any added or replaced site photo is processed on each build.
function collectPhotoUrls(value, urls) {
  if (typeof value === 'string') {
    if (value.startsWith('/images/') && imagePattern.test(decodeURIComponent(value))) urls.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectPhotoUrls(entry, urls));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectPhotoUrls(entry, urls));
  }
}

const widths = [480, 960];
const quality = 90; // Visually high-fidelity WebP (originals remain untouched).
const constructionHeroKeys = ['hero', 'residential', 'commercial'];
const constructionProcessKeys = ['processLeft', 'processRight'];

export async function optimizeProjectGallery() {
  // A missing/generated manifest must never break the build or hide a source image.
  await writeFile(manifestFile, '{}\n');
  const pages = Object.fromEntries(await Promise.all(pageNames.map(async (name) => [
    name,
    JSON.parse(await readFile(path.join(pagesDir, name + '.json'), 'utf8')),
  ])));
  const footer = JSON.parse(await readFile(footerFile, 'utf8'));
  const data = pages.projects;
  const construction = pages.construction;
  const constructionHeroPhotos = constructionHeroKeys.map((key) => construction.photos?.[key]?.src);
  const constructionProcessPhotos = constructionProcessKeys.map((key) => construction.photos?.[key]?.src);
  const heroSources = new Set([
    ...constructionHeroPhotos,
    pages.home.photos?.hero?.src, pages.home.photos?.feature?.src,
    pages.about.photos?.hero?.src,
    pages.maintenance.photos?.hero?.src, pages.maintenance.photos?.closing?.src,
    pages.maintenance.heroVideoPoster,
    data.photos?.hero?.src, data.heroVideoPoster,
    pages.win.photos?.hero?.src, pages.win.photos?.closing?.src,
  ].filter(Boolean));
  const processSources = new Set(constructionProcessPhotos.filter(Boolean));
  const featureSources = new Set([
    pages.about.photos?.whoWeAre?.src,
    data.featurePhoto?.src,
    ...(pages.maintenance.services ?? []).map((service) => service.image),
  ].filter(Boolean));
  const footerLogo = footer.logo?.src;
  const photoUrlSet = new Set();
  Object.values(pages).forEach((page) => collectPhotoUrls(page, photoUrlSet));
  collectPhotoUrls(footer, photoUrlSet);
  const photoUrls = [...photoUrlSet];
  const manifest = {};

  // Build only the variants used by current CMS pages and the shared footer.
  await rm(outputDir, { force: true, recursive: true });
  await mkdir(outputDir, { recursive: true });

  let sourceBytes = 0;
  let outputBytes = 0;
  let converted = 0;

  for (const sourceUrl of photoUrls) {
    // Remote URLs, if used, stay unchanged and are not downloaded at build time.
    if (typeof sourceUrl !== 'string' || !sourceUrl.startsWith('/images/')) continue;

    try {
      const fileName = decodeURIComponent(sourceUrl.slice('/images/'.length));
      const sourcePath = path.resolve(originalsDir, fileName);
      if (!sourcePath.startsWith(originalsDir + path.sep)) {
        console.warn('[projects-gallery] Ignoring an unsafe image path.');
        continue;
      }

      const original = await readFile(sourcePath);
      const digest = createHash('sha256').update(original).digest('hex').slice(0, 12);
      const stem = path.basename(fileName, path.extname(fileName))
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 40) || 'project';
      const variants = {};

      // Do not upscale. Small cards get 480/960; wide features get 1440/1800.
      const requestedWidths = [...new Set([
        ...(sourceUrl === footerLogo ? [480] : widths),
        ...(processSources.has(sourceUrl) || featureSources.has(sourceUrl) ? [1440] : []),
        ...(heroSources.has(sourceUrl) ? [1800] : []),
      ])].sort((a, b) => a - b);
      const metadata = await sharp(original).metadata();
      const orientedWidth = [5, 6, 7, 8].includes(metadata.orientation) ? metadata.height : metadata.width;
      const seenWidths = new Map();
      variants.widths = {};
      for (const width of requestedWidths) {
        const kind = width === 480 ? 'small' : width === 960 ? 'large' : width === 1440 ? 'process' : 'hero';
        const outputWidth = Math.min(width, orientedWidth || width);
        if (seenWidths.has(outputWidth)) {
          variants[kind] = seenWidths.get(outputWidth);
          variants.widths[kind] = outputWidth;
          continue;
        }
        const optimizedName = `${stem}-${digest}-${outputWidth}.webp`;
        const destination = path.join(outputDir, optimizedName);
        const info = await sharp(original)
          .rotate()
          .resize({ width: outputWidth, withoutEnlargement: true })
          .webp({
            quality,
            lossless: sourceUrl === footerLogo, // Keep logo lettering/edges exactly intact.
            alphaQuality: 100, // Preserve transparency in other images.
            smartSubsample: true,
            effort: 5,
          })
          .toFile(destination);
        const optimizedUrl = `/images/project-thumbnails/${optimizedName}`;
        variants[kind] = optimizedUrl;
        variants.widths[kind] = info.width;
        seenWidths.set(info.width, optimizedUrl);
        outputBytes += info.size;
      }

      manifest[sourceUrl] = variants;
      converted += 1;
      sourceBytes += original.length;
    } catch (error) {
      // A failed conversion is reported; public pages retain original image fallback.
      console.warn(`[projects-gallery] Unable to optimise ${sourceUrl}:`, error?.message ?? error);
    }
  }

  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `[site-photos] Optimised ${converted}/${photoUrls.length} images; ` +
    `${(sourceBytes / 1048576).toFixed(1)} MiB original -> ` +
    `${(outputBytes / 1048576).toFixed(1)} MiB across responsive WebP sizes.`,
  );
}
