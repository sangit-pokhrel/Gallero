// Generates the README artwork from code: a banner and abstract UI mock-ups.
// No real photos are used — every "photo" is a generated gradient tile.
// Run: node scripts/generate-readme-art.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = 'docs/images';
mkdirSync(OUT, { recursive: true });

const VIOLET = '#7C5CFF';
const PINK = '#E4508F';
const ORANGE = '#FF7A45';
const SUN = '#FFD66B';
const INK = '#0F0F12';
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// The Gallero mark at any position/size (drawn on a 1024 grid).
const mark = (x, y, size, { tile = true } = {}) => `
  <g transform="translate(${x} ${y}) scale(${size / 1024})">
    ${tile ? `<rect width="1024" height="1024" rx="232" fill="url(#brand)"/>` : ''}
    <g transform="translate(512 512) scale(0.82) translate(-512 -512)">
      <path d="M672.7 320.5 A250 250 0 1 0 762 512 L 572 512" fill="none" stroke="#fff" stroke-width="92" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="752" cy="396" r="42" fill="${SUN}"/>
    </g>
  </g>`;

const defs = `
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${VIOLET}"/><stop offset="0.55" stop-color="${PINK}"/><stop offset="1" stop-color="${ORANGE}"/>
    </linearGradient>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17151F"/><stop offset="1" stop-color="#0B0A10"/>
    </linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
    </linearGradient>
    ${Array.from({ length: 12 }, (_, i) => {
      // Soft abstract "photos": warm/cool gradient pairs.
      const pairs = [
        ['#FFB38A', '#7C5CFF'], ['#8EC5FC', '#E0C3FC'], ['#F6D365', '#FDA085'], ['#84FAB0', '#8FD3F4'],
        ['#A18CD1', '#FBC2EB'], ['#FAD0C4', '#FFD1FF'], ['#30CFD0', '#330867'], ['#FF9A9E', '#FECFEF'],
        ['#667EEA', '#764BA2'], ['#43E97B', '#38F9D7'], ['#FEE140', '#FA709A'], ['#4FACFE', '#00F2FE'],
      ][i];
      return `<linearGradient id="p${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pairs[0]}"/><stop offset="1" stop-color="${pairs[1]}"/></linearGradient>`;
    }).join('')}
  </defs>`;

const photo = (x, y, w, h, i, r = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#p${i % 12})"/>`;
const text = (x, y, s, size, { weight = 600, fill = '#fff', anchor = 'start', opacity = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${s}</text>`;
const glass = (x, y, w, h, r) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-opacity="0.22"/>`;

// ---- banner -------------------------------------------------------------------------
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640">
  ${defs}
  <rect width="1280" height="640" fill="url(#night)"/>
  <circle cx="1080" cy="80" r="320" fill="${VIOLET}" opacity="0.28"/>
  <circle cx="1180" cy="600" r="260" fill="${ORANGE}" opacity="0.22"/>
  <circle cx="160" cy="620" r="220" fill="${PINK}" opacity="0.16"/>
  ${mark(110, 200, 220)}
  ${text(380, 300, 'Gallero', 112, { weight: 800 })}
  ${text(384, 360, 'A minimal, private, fully customizable photo gallery.', 30, { weight: 500, opacity: 0.85 })}
  ${text(384, 410, 'No ads · No accounts · Nothing leaves your phone', 24, { weight: 500, fill: SUN, opacity: 0.95 })}
  ${[0, 1, 2, 3, 4].map((i) => photo(820 + i * 78, 470, 66, 66, i + 3, 12)).join('')}
</svg>`;

// ---- phone mock-ups --------------------------------------------------------------------
const PW = 360;
const PH = 760;
const phone = (ox, inner) => `
  <g transform="translate(${ox} 60)">
    <rect x="-10" y="-10" width="${PW + 20}" height="${PH + 20}" rx="58" fill="#05050A"/>
    <rect width="${PW}" height="${PH}" rx="48" fill="#0F0F12"/>
    <clipPath id="clip${ox}"><rect width="${PW}" height="${PH}" rx="48"/></clipPath>
    <g clip-path="url(#clip${ox})">${inner}</g>
  </g>`;

const tabBar = (active) => `
  ${glass(18, PH - 96, 236, 70, 35)}
  <rect x="${active === 0 ? 24 : 136}" y="${PH - 90}" width="112" height="58" rx="29" fill="${VIOLET}" fill-opacity="0.3"/>
  ${text(80, PH - 52, 'Library', 14, { anchor: 'middle', fill: active === 0 ? '#B8A6FF' : '#fff' })}
  ${text(192, PH - 52, 'Collections', 14, { anchor: 'middle', fill: active === 1 ? '#B8A6FF' : '#fff' })}
  ${glass(272, PH - 96, 70, 70, 35)}
  <circle cx="303" cy="${PH - 64}" r="11" fill="none" stroke="${VIOLET}" stroke-width="3.5"/>
  <line x1="311" y1="${PH - 56}" x2="319" y2="${PH - 48}" stroke="${VIOLET}" stroke-width="3.5" stroke-linecap="round"/>`;

// 1) Library grid
const tile = (PW - 24 - 4) / 3;
let grid = '';
for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) grid += photo(12 + c * (tile + 2), 170 + r * (tile + 2), tile, tile, r * 3 + c, 6);
const library = `
  ${text(22, 92, 'Library', 34, { weight: 800 })}
  ${text(22, 120, '12,480 Photos, 312 Videos', 14, { weight: 500, opacity: 0.6 })}
  ${text(22, 156, 'October 2026', 17, { weight: 600 })}
  ${grid}
  ${glass(80, PH - 160, 200, 44, 22)}
  <rect x="216" y="${PH - 156}" width="60" height="36" rx="18" fill="${VIOLET}"/>
  ${text(115, PH - 132, 'Years', 13, { anchor: 'middle' })}${text(178, PH - 132, 'Months', 13, { anchor: 'middle' })}${text(246, PH - 132, 'All', 13, { anchor: 'middle' })}
  ${tabBar(0)}`;

// 2) Collections
const card = (x, y, w, h, i, title, sub) => `
  ${photo(x, y, w, h, i, 20)}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="url(#shade)"/>
  ${text(x + 14, y + h - (sub ? 34 : 16), title, sub ? 20 : 14, { weight: 800 })}
  ${sub ? text(x + 14, y + h - 14, sub, 11, { weight: 600, opacity: 0.85 }) : ''}`;
const person = (cx, cy, i, name) =>
  `<circle cx="${cx}" cy="${cy}" r="30" fill="url(#p${i})"/>${text(cx, cy + 50, name, 12, { anchor: 'middle', weight: 500 })}`;
const collections = `
  ${text(22, 92, 'Collections', 32, { weight: 800 })}
  ${text(22, 140, 'Memories ›', 20, { weight: 800 })}
  ${card(22, 154, 250, 220, 0, 'October Moments', 'OCTOBER 2026')}
  ${card(284, 154, 250, 220, 4, 'On This Day', '19 OCT')}
  ${text(22, 412, 'People ›', 20, { weight: 800 })}
  ${person(54, 452, 8, 'Maya')}${person(134, 452, 1, 'Arjun')}${person(214, 452, 10, 'Sam')}${person(294, 452, 6, '')}
  ${text(22, 540, 'Utilities', 20, { weight: 800 })}
  <rect x="22" y="556" width="152" height="44" rx="14" fill="#1C1C21"/>${text(40, 584, '♡  Favorites', 14, { weight: 500 })}
  <rect x="186" y="556" width="152" height="44" rx="14" fill="#1C1C21"/>${text(204, 584, 'Hidden  🔒', 14, { weight: 500 })}
  ${tabBar(1)}`;

// 3) Viewer
const viewer = `
  <rect width="${PW}" height="${PH}" fill="#000"/>
  ${photo(0, 210, PW, 300, 9, 0)}
  <rect width="${PW}" height="140" fill="url(#shade)" transform="rotate(180 ${PW / 2} 70)"/>
  <circle cx="44" cy="76" r="22" fill="${VIOLET}" stroke="#fff" stroke-opacity="0.6" stroke-width="1.5"/>
  <path d="M36 72 L44 80 L52 72" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="78" y="54" width="204" height="44" rx="22" fill="${VIOLET}" stroke="#fff" stroke-opacity="0.6" stroke-width="1.5"/>
  ${text(180, 74, 'Sunday, 19 October', 13, { anchor: 'middle' })}${text(180, 90, '7:42 PM · 24 of 12,792', 10, { anchor: 'middle', opacity: 0.8 })}
  <circle cx="316" cy="76" r="22" fill="${VIOLET}" stroke="#fff" stroke-opacity="0.6" stroke-width="1.5"/>
  <path d="M310 66 L324 76 L310 86 Z" fill="#fff"/>
  <rect x="44" y="${PH - 110}" width="272" height="56" rx="28" fill="${VIOLET}" stroke="#fff" stroke-opacity="0.6" stroke-width="1.5"/>
  ${['↑', '♥', 'i', '•••', '🗑'].map((g, i) => text(76 + i * 52, PH - 75, g, 18, { anchor: 'middle', fill: i === 1 ? SUN : '#fff' })).join('')}
  ${text(PW / 2, 560, 'pinch · double-tap · swipe', 13, { anchor: 'middle', opacity: 0.55, weight: 500 })}`;

const screens = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="880" viewBox="0 0 1280 880">
  ${defs}
  <rect width="1280" height="880" fill="url(#night)"/>
  <circle cx="640" cy="440" r="420" fill="${VIOLET}" opacity="0.12"/>
  ${phone(40, library)}
  ${phone(460, collections)}
  ${phone(880, viewer)}
</svg>`;

await Promise.all([
  sharp(Buffer.from(banner)).png().toFile(`${OUT}/banner.png`),
  sharp(Buffer.from(screens)).png().toFile(`${OUT}/screens.png`),
  sharp('assets/brand/logo.png').resize(256, 256).png().toFile(`${OUT}/icon.png`),
]);
console.log('README art generated in', OUT);
