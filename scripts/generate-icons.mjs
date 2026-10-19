// Generates every app icon / splash asset from the Gallero mark.
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const INK_TOP = '#7C5CFF'; // violet
const INK_BOTTOM = '#FF7A45'; // sunset orange
const CREAM = '#FFFFFF';
const SUN = '#FFD66B';

// The mark: an open "G" ring with a crossbar, and a sun sitting in its opening.
// Drawn on a 1024 canvas, centred on (512, 512), radius 250.
const glyph = (color, sun, scale = 1) => {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  return `
  <g transform="${t}">
    <path d="M672.7 320.5 A250 250 0 1 0 762 512 L 572 512"
      fill="none" stroke="${color}" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="752" cy="396" r="42" fill="${sun}"/>
  </g>`;
};

const bg = (rounded) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${INK_TOP}"/>
      <stop offset="0.55" stop-color="#E4508F"/>
      <stop offset="1" stop-color="${INK_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" ${rounded ? 'rx="232"' : ''} fill="url(#bg)"/>`;

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

const files = {
  'assets/brand/logo.svg': svg(bg(true) + glyph(CREAM, SUN)),
  'assets/brand/logo-mark.svg': svg(glyph(CREAM, SUN)),
};

mkdirSync('assets/brand', { recursive: true });
for (const [path, content] of Object.entries(files)) writeFileSync(path, content);

const png = (content, out, size = 1024) =>
  sharp(Buffer.from(content)).resize(size, size).png().toFile(out);

await Promise.all([
  // iOS / generic icon: full-bleed square (iOS applies its own mask).
  png(svg(bg(false) + glyph(CREAM, SUN, 0.82)), 'assets/icon.png'),
  // Android adaptive icon: glyph kept inside the 66% safe zone.
  png(svg(glyph(CREAM, SUN, 0.62)), 'assets/android-icon-foreground.png'),
  png(svg(bg(false)), 'assets/android-icon-background.png'),
  png(svg(glyph('#FFFFFF', '#FFFFFF', 0.62)), 'assets/android-icon-monochrome.png'),
  png(svg(bg(true) + glyph(CREAM, SUN, 0.82)), 'assets/splash-icon.png'),
  png(svg(bg(true) + glyph(CREAM, SUN, 0.82)), 'assets/favicon.png', 64),
  png(files['assets/brand/logo.svg'], 'assets/brand/logo.png'),
]);

console.log('Icons generated.');
