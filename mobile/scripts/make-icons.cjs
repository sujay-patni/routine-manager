// Draws the Rise icon options as SVG and renders PNGs with sharp.
// usage (from mobile/): node scripts/make-icons.cjs preview assets/icon-options.png
//                      node scripts/make-icons.cjs assets C assets
const sharp = require("sharp"); // resolved from the repo root node_modules
const fs = require("fs");
const path = require("path");

const VARIANTS = {
  A: { label: "Daybreak blue", bg: ["#3b93ff", "#0058d6"], sun: "#ffffff", rays: "#ffffff", line: "#ffffff" },
  B: { label: "Warm sunrise", bg: ["#ffb347", "#ff5f3d"], sun: "#ffffff", rays: "#ffffff", line: "#ffffff" },
  C: { label: "Night to day", bg: ["#2a5fe0", "#0b1a40"], sun: "#ffb547", rays: "#ffd28a", line: "#ffffff" },
};

// The mark lives in a 1024 canvas and stays inside Android's adaptive-icon
// safe zone (a ~672px circle in the middle), so no launcher mask clips it.
function mark(v, mono = false) {
  const sun = mono ? "#fff" : v.sun;
  const rays = mono ? "#fff" : v.rays;
  const line = mono ? "#fff" : v.line;
  const cx = 512, hy = 600, r = 160;
  const rayAngles = [198, 234, 270, 306, 342];
  const rayLines = rayAngles
    .map((a) => {
      const t = (a * Math.PI) / 180;
      const x1 = cx + Math.cos(t) * 215, y1 = hy + Math.sin(t) * 215;
      const x2 = cx + Math.cos(t) * 272, y2 = hy + Math.sin(t) * 272;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`;
    })
    .join("");
  return `
    <g stroke="${rays}" stroke-width="36" stroke-linecap="round">${rayLines}</g>
    <path d="M ${cx - r} ${hy} A ${r} ${r} 0 0 1 ${cx + r} ${hy} Z" fill="${sun}" />
    <line x1="${cx - 250}" y1="${hy + 52}" x2="${cx + 250}" y2="${hy + 52}" stroke="${line}" stroke-width="36" stroke-linecap="round" />`;
}

function background(v, id) {
  return `
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${v.bg[0]}" /><stop offset="1" stop-color="${v.bg[1]}" />
    </linearGradient></defs>
    <rect width="1024" height="1024" fill="url(#${id})" />`;
}

const svg = (body, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>`;

async function preview(out) {
  const cell = 300, gap = 60, cols = 3;
  const W = cols * cell + (cols + 1) * gap;
  const rowH = cell + 90;
  const H = gap + rowH * 2 + 40;
  let body = "";
  const keys = Object.keys(VARIANTS);
  ["#f1f3f6", "#121417"].forEach((pageBg, row) => {
    const y0 = gap / 2 + row * rowH;
    body += `<rect x="0" y="${y0 - gap / 2}" width="${W}" height="${row ? H - (y0 - gap / 2) : rowH}" fill="${pageBg}" />`;
    keys.forEach((k, i) => {
      const v = VARIANTS[k];
      const x = gap + i * (cell + gap);
      const id = `g${row}${k}`;
      body += `
        <defs><clipPath id="c${id}"><circle cx="${x + cell / 2}" cy="${y0 + cell / 2}" r="${cell / 2}" /></clipPath></defs>
        <g clip-path="url(#c${id})"><g transform="translate(${x},${y0}) scale(${cell / 1024})">${background(v, id)}${mark(v)}</g></g>
        <text x="${x + cell / 2}" y="${y0 + cell + 40}" text-anchor="middle" font-family="Helvetica, Arial" font-size="26"
          fill="${row ? "#e8e8e8" : "#222"}">${k}. ${v.label}</text>`;
    });
  });
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`;
  await sharp(Buffer.from(full)).png().toFile(out);
}

async function assets(key, dir) {
  const v = VARIANTS[key];
  const png = (body, file, size = 1024) => sharp(Buffer.from(svg(body, size))).png().toFile(path.join(dir, file));
  await png(background(v, "bg") + mark(v), "icon.png");
  await png(background(v, "bg"), "android-icon-background.png");
  await png(mark(v), "android-icon-foreground.png");
  await png(mark(v, true), "android-icon-monochrome.png");
  await png(mark(v), "splash-icon.png");
  await png(background(v, "bg") + mark(v), "favicon.png", 48);
}

const [cmd, a, b] = process.argv.slice(2);
(cmd === "preview" ? preview(a) : assets(a, b)).catch((e) => {
  console.error(e);
  process.exit(1);
});
