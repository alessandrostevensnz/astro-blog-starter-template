// CI verification: all CMS photos must be optimised, appropriately sized and valid.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const pageNames = ['home', 'about', 'construction', 'maintenance', 'projects', 'win'];
const images = new Set();
const assetRegex = /\.(?:jpe?g|png|webp|avif|heic|heif)$/i;
function collect(v) {
  if (typeof v === 'string' && v.startsWith('/images/') && assetRegex.test(decodeURIComponent(v))) {
    images.add(v);
  } else if (Array.isArray(v)) {
    v.forEach(collect);
  } else if (v && typeof v === 'object') {
    Object.values(v).forEach(collect);
  }
}
for (const name of pageNames) {
  collect(JSON.parse(await readFile(path.join(root, 'content/pages', name + '.json'), 'utf8')));
}
collect(JSON.parse(await readFile(path.join(root, 'content/site-footer.json'), 'utf8')));

const manifest = JSON.parse(await readFile(path.join(root, 'src/data/project-gallery-optimized.generated.json'), 'utf8'));
const footer = JSON.parse(await readFile(path.join(root, 'content/site-footer.json'), 'utf8')).logo.src;
const errors = [];
let originalBytes = 0;
let compactBytes = 0;
let checked = 0;
let minimumPsnr = Infinity;
let totalPsnr = 0;
let measuredPhotos = 0;

// PSNR compares the pixels at the *same displayed width*. Source masters are
// not changed; this checks whether their 90-quality WebP copies stay faithful.
async function compareQuality(original, optimized, displayWidth) {
  const reference = await sharp(original).rotate().resize({
    width: displayWidth, withoutEnlargement: true,
  }).flatten({ background: '#fff' }).toColourspace('srgb').removeAlpha().raw().toBuffer();
  const candidate = await sharp(optimized).flatten({
    background: '#fff',
  }).toColourspace('srgb').removeAlpha().raw().toBuffer();
  if (reference.length !== candidate.length) return null;
  let squaredError = 0;
  for (let i = 0; i < reference.length; i++) {
    const difference = reference[i] - candidate[i];
    squaredError += difference * difference;
  }
  const mse = squaredError / reference.length;
  return mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse);
}

for (const source of images) {
  const variant = manifest[source];
  if (!variant?.small || (source !== footer && !variant?.large)) {
    errors.push('Missing responsive photo: ' + source);
    continue;
  }
  const original = path.join(root, 'public', decodeURIComponent(source).slice(1));
  const originalStat = await stat(original);
  originalBytes += originalStat.size;
  const metadata = await sharp(original).metadata();
  const trueWidth = [5, 6, 7, 8].includes(metadata.orientation) ? metadata.height : metadata.width;
  for (const name of ['small', 'large', 'process', 'hero']) {
    const url = variant[name];
    if (!url) continue;
    if (!url.startsWith('/images/project-thumbnails/')) {
      errors.push('Bad generated URL: ' + source + ' / ' + name);
      continue;
    }
    const target = path.join(root, 'public', decodeURIComponent(url).slice(1));
    const actual = await sharp(target).metadata();
    if (actual.format !== 'webp') errors.push('Variant is not WebP: ' + url);
    if (actual.width > trueWidth) errors.push('Upscaled photo: ' + url);
    if (variant.widths?.[name] !== actual.width) errors.push('Incorrect srcset width: ' + url);
    if (name === 'large' || (source === footer && name === 'small')) {
      compactBytes += (await stat(target)).size;
    }
  }
  const sampleVariant = variant.large ?? variant.small;
  const sampleWidth = variant.widths?.large ?? variant.widths?.small ?? 480;
  const psnr = await compareQuality(original, path.join(root, 'public', decodeURIComponent(sampleVariant).slice(1)), sampleWidth);
  if (psnr === null) errors.push('Mismatched pixel dimensions: ' + source);
  else if (Number.isFinite(psnr)) {
    minimumPsnr = Math.min(minimumPsnr, psnr);
    totalPsnr += psnr;
    measuredPhotos += 1;
    // >=32dB is a conservative guard against visibly degraded image quality.
    if (psnr < 32) errors.push('Photo quality below 32dB PSNR: ' + source + ' (' + psnr.toFixed(1) + 'dB)');
  }
  checked += 1;
}

const pages = [
  'index.astro', 'about.astro', 'construction.astro', 'projects.astro',
  'property-maintenance.astro', 'win.astro',
];
for (const file of pages) {
  const text = await readFile(path.join(root, 'src/pages', file), 'utf8');
  for (const tag of text.match(/<img\b[\s\S]*?\/>/g) ?? []) {
    if (!tag.includes('responsivePhoto(')) errors.push('Unoptimised <img> in ' + file);
  }
}
const layout = await readFile(path.join(root, 'src/components/SiteLayout.astro'), 'utf8');
if (!layout.includes('responsivePhoto(siteFooter.logo.src')) errors.push('Footer logo is not optimised');

const ratio = originalBytes ? Math.round(100 * (1 - compactBytes / originalBytes)) : 0;
console.log('CMS photos verified:', checked, '/', images.size);
console.log('Photo fidelity (PSNR): minimum ' + minimumPsnr.toFixed(1) + 'dB, mean ' + (totalPsnr / measuredPhotos).toFixed(1) + 'dB across ' + measuredPhotos + ' photos');
console.log('Original photos:', (originalBytes / 1048576).toFixed(1) + ' MiB');
console.log('One responsive display set:', (compactBytes / 1048576).toFixed(1) + ' MiB');
console.log('Total transferred bytes avoided versus originals (at selected display widths):', ratio + '%');
if (errors.length) {
  errors.forEach((message) => console.error('FAIL:', message));
  process.exitCode = 1;
}
