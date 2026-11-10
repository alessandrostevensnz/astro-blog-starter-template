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
const projectsFile = path.join(projectRoot, 'content', 'pages', 'projects.json');
const constructionFile = path.join(projectRoot, 'content', 'pages', 'construction.json');

const widths = [480, 960];
const quality = 78;

export async function optimizeProjectGallery() {
  // A missing/generated manifest must never break the build or hide a source image.
  await writeFile(manifestFile, '{}\n');
  const data = JSON.parse(await readFile(projectsFile, 'utf8'));
  const construction = JSON.parse(await readFile(constructionFile, 'utf8'));
  const serviceKeys = ['serviceCarpentry', 'serviceDecks', 'serviceRenovations'];
  const residentialServicePhotos = serviceKeys.map((key) => construction.photos?.[key]?.src);
  const photoUrls = [...new Set([
    ...(data.projects ?? []).map((project) => project.image),
    ...residentialServicePhotos,
  ].filter(Boolean))];
  const manifest = {};

  // Keep only thumbnails referenced by Projects or the three residential-service photos.
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

      for (const width of widths) {
        const optimizedName = `${stem}-${digest}-${width}.webp`;
        const destination = path.join(outputDir, optimizedName);
        const info = await sharp(original)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality, effort: 4 })
          .toFile(destination);
        variants[width === 480 ? 'small' : 'large'] = `/images/project-thumbnails/${optimizedName}`;
        outputBytes += info.size;
      }

      manifest[sourceUrl] = variants;
      converted += 1;
      sourceBytes += original.length;
    } catch (error) {
      // A bad/unsupported photo must not take down the entire ANDRO website.
      // The Projects page will simply display its original image instead.
      console.warn(`[projects-gallery] Unable to optimise ${sourceUrl}:`, error?.message ?? error);
    }
  }

  await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `[projects-gallery] Optimised ${converted}/${photoUrls.length} images; ` +
    `${(sourceBytes / 1048576).toFixed(1)} MiB original -> ` +
    `${(outputBytes / 1048576).toFixed(1)} MiB across both WebP sizes.`,
  );
}
