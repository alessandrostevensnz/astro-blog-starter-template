import generated from '../data/project-gallery-optimized.generated.json';

type VariantName = 'small' | 'large' | 'process' | 'hero';
type ImageVersions = Partial<Record<VariantName, string>> & {
  widths?: Partial<Record<VariantName, number>>;
};
type ImageAttrs = { src: string; srcset?: string; sizes?: string };

const photos = generated as Record<string, ImageVersions>;
const variantOrder: VariantName[] = ['small', 'large', 'process', 'hero'];
const assumedWidths: Record<VariantName, number> = {
  small: 480, large: 960, process: 1440, hero: 1800,
};

/**
 * Serve the right size for each visitor, retaining the CMS original URL as a
 * fallback if an image is remote, newly added, or cannot be processed by Sharp.
 * Originals remain untouched for future editing and full-size use.
 */
export function responsivePhoto(
  source: string | undefined | null,
  sizes: string,
  preferred: VariantName = 'large',
): ImageAttrs {
  const original = source || '';
  const available = photos[original];
  if (!available) return { src: original };

  const byPixelWidth = new Map<number, string>();
  for (const variant of variantOrder) {
    const url = available[variant];
    const width = available.widths?.[variant] ?? assumedWidths[variant];
    if (url && width > 0) byPixelWidth.set(width, url);
  }

  const candidates = [...byPixelWidth.entries()].sort(([a], [b]) => a - b);
  return {
    src: available[preferred] ?? available.large ?? available.process ??
      available.hero ?? available.small ?? original,
    ...(candidates.length > 1 ? {
      srcset: candidates.map(([width, url]) => url + ' ' + width + 'w').join(', '),
      sizes,
    } : {}),
  };
}
