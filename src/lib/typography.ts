/** Validated CSS emitted at build time from editor-managed content. */
type Override = { size?: number | string; color?: string };
type Typography = { global?: { headingSize?: number | string; bodySize?: number | string; headingColor?: string; bodyColor?: string }; overrides?: Record<string, Override> };
const hex = (value: unknown): string | null => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
const percent = (value: unknown, min: number, max: number): number | null => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n / 100 : null;
};
const heading = '.hero h1,.display-heading,.section-heading h2,.two-col h2,.content-block h2,.page-hero h1,.cta-row h2,.card-meta h3,.maintenance-detail-grid h3,.maintenance-services-heading h2,.maintenance-service h3,.construction-hero h1,.maintenance-hero h1,.image-band-copy h2';
const body = '.hero-subtitle,.body-copy,.intro-copy p,.card-meta p,.maintenance-detail-grid p,.maintenance-service p,.page-hero .lead,.construction-hero .lead';
export function typographyCss(input: Typography | undefined, content?: Record<string, any>): string {
  const global = input?.global || {};
  const rules: string[] = [];
  const hs = percent(global.headingSize, 70, 150);
  const bs = percent(global.bodySize, 80, 150);
  const hc = hex(global.headingColor);
  const bc = hex(global.bodyColor);
  if (hs && hs !== 1) rules.push(`${heading}{zoom:${hs};}`);
  if (bs && bs !== 1) rules.push(`${body}{zoom:${bs};}`);
  // Default palette is already in theme.css. Apply explicit colours only if changed.
  if (hc && hc.toLowerCase() !== '#1b1b19') rules.push(`${heading}{color:${hc};}`);
  if (bc && bc.toLowerCase() !== '#77746e') rules.push(`${body}{color:${bc};}`);
  for (const [key, override] of Object.entries(input?.overrides || {})) {
    if (!/^[a-zA-Z]+__[a-zA-Z]+$/.test(key) || !override) continue;
    const selector = `[data-style-key="${key.replace('__', '.')}"]`;
    const size = percent(override.size, 60, 180);
    const color = hex(override.color);
    const declarations = [size ? `zoom:${size}` : '', color ? `color:${color}` : ''].filter(Boolean);
    if (declarations.length) rules.push(`${selector}{${declarations.join(';')};}`);
  }
  // Inline editor formatting is stored beside each text field in site.json.
  // Existing advanced overrides remain supported; inline values take precedence.
  for (const [section, fields] of Object.entries(content || {})) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue;
    for (const [field, style] of Object.entries(fields as Record<string, any>)) {
      if (!field.endsWith('Style') || !style || typeof style !== 'object') continue;
      const name = field.slice(0, -5);
      if (!/^[a-zA-Z]+$/.test(section) || !/^[a-zA-Z]+$/.test(name)) continue;
      const selector = `[data-style-key="${section}.${name}"]`;
      const size = percent(style.size, 60, 180);
      const color = hex(style.color);
      const declarations = [size ? `zoom:${size}` : '', color ? `color:${color}` : ''].filter(Boolean);
      if (declarations.length) rules.push(`${selector}{${declarations.join(';')};}`);
    }
  }
  return rules.join('\n');
}
