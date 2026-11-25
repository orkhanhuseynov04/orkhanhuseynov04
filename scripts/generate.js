// Generates a Chrome-dino style animated SVG (SMIL only, so GitHub can render it).
const fs = require("fs");
const path = require("path");

// T_OFFSET (seconds, negative) freezes a frame for local previewing.
const OFFSET = Number(process.env.T_OFFSET || 0);

const S = 4;                  // pixel size
const W = 820;
const H = 168;
const GROUND_Y = 156;
const DINO_X = 70;
const LEG_H = 4 * S;

const C = {
  bg: "#000000",
  dino: "#3ee06a",
  cactus: "#1fa84a",
  ground: "#2c4a34",
  cloud: "#173a22",
};

// ---------- pixel helpers ----------
function runs(rows) {
  const out = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let c = 0;
    while (c < row.length) {
      if (row[c] === "#") {
        const start = c;
        while (c < row.length && row[c] === "#") c++;
        out.push({ c: start, r, w: c - start });
      } else {
        c++;
      }
    }
  }
  return out;
}

function pixelRect(run, ox, oy, fill, scale) {
  return `<rect x="${ox + run.c * scale}" y="${oy + run.r * scale}" width="${
    run.w * scale
  }" height="${scale}" fill="${fill}"/>`;
}

// begin helper: numeric seconds -> clock value
const at = (sec) => `${(sec + OFFSET).toFixed(3).replace(/\.?0+$/, "")}s`;

// ---------- sprites ----------
// 22 x 21 dino body; legs are separate so they can animate
const DINO_BODY = [
  "...........##########.",
  "..........###########.",
  "..........###.#######.",
  "..........###########.",
  "..........###########.",
  "..........#########...",
  "..........##########..",
  "...........#######....",
  "...........######.....",
  "...........######.....",
  "#..........######.....",
  "##.........######.....",
  "###.......#######.....",
  "####.....########.....",
  "#####..##########.....",
  "#################.....",
  "..##############......",
  "...############.......",
  "....##########........",
  "....##########........",
  "....##########........",
];

const CACTUS = [
  "..###..",
  "..###..",
  "#.###..",
  "#.###.#",
  "#####.#",
  "..#####",
  "..###..",
  "..###..",
  "..###..",
];

const CLOUD = ["..####...", ".######..", "#########"];

// ---------- dino ----------
const bodyH = DINO_BODY.length * S;
const dinoTop = GROUND_Y - bodyH - LEG_H;

const bodyRects = runs(DINO_BODY)
  .map((r) => pixelRect(r, DINO_X, dinoTop, C.dino, S))
  .join("\n    ");

const arm = `<rect x="${DINO_X + 16 * S}" y="${dinoTop + 12 * S}" width="${3 * S}" height="${
  2 * S
}" fill="${C.dino}"/>`;

// legs: two blocks bouncing in opposite phase = run cycle
const legY = dinoTop + bodyH;
const leg1X = DINO_X + 4 * S;
const leg2X = DINO_X + 10 * S;
const legW = 4 * S;

const legs = `
    <rect x="${leg1X}" y="${legY}" width="${legW}" height="${LEG_H}" fill="${C.dino}">
      <animate attributeName="y" values="${legY};${legY - S};${legY}"
               dur="0.24s" repeatCount="indefinite" begin="${at(0)}"/>
    </rect>
    <rect x="${leg2X}" y="${legY}" width="${legW}" height="${LEG_H}" fill="${C.dino}">
      <animate attributeName="y" values="${legY - S};${legY};${legY - S}"
               dur="0.24s" repeatCount="indefinite" begin="${at(0)}"/>
    </rect>`;

// ---------- obstacles ----------
function cactusSprite(beginSec) {
  const scale = 3;
  const w = CACTUS[0].length * scale;
  const h = CACTUS.length * scale;
  const oy = GROUND_Y - h;
  const rects = runs(CACTUS)
    .map((r) => pixelRect(r, 0, oy, C.cactus, scale))
    .join("\n      ");
  return `
  <g transform="translate(${W + 80} 0)">
    <animateTransform attributeName="transform" type="translate"
      values="${W + 80} 0; -${w + 40} 0" dur="4s" begin="${at(beginSec)}" repeatCount="indefinite"/>
    ${rects}
  </g>`;
}

function cloudSprite(y, beginSec) {
  const scale = 3;
  const rects = runs(CLOUD)
    .map((r) => pixelRect(r, 0, 0, C.cloud, scale))
    .join("\n    ");
  return `
  <g transform="translate(${W + 40} ${y})">
    <animateTransform attributeName="transform" type="translate"
      values="${W + 40} ${y}; -120 ${y}" dur="26s" begin="${at(beginSec)}" repeatCount="indefinite"/>
    ${rects}
  </g>`;
}

// two jumps per 4s loop, each straddling the moment a cactus passes the dino
const JUMP_TIMES =
  "0; 0.12; 0.20; 0.28; 0.38; 0.50; 0.62; 0.70; 0.78; 0.88; 1";
const JUMP_HEIGHTS = [0, 0, -42, -48, -42, 0, 0, -42, -48, -42, 0];
const JUMP_VALUES = JUMP_HEIGHTS.map((dy) => `${DINO_X} ${dy}`).join("; ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="T-Rex running animation">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>

  <!-- clouds -->
  ${cloudSprite(26, -8)}
  ${cloudSprite(12, -19)}

  <!-- scrolling ground -->
  <line x1="0" y1="${GROUND_Y}" x2="${W}" y2="${GROUND_Y}"
        stroke="${C.ground}" stroke-width="4" stroke-dasharray="30 18">
    <animate attributeName="stroke-dashoffset" values="0;-48" dur="0.2s"
             repeatCount="indefinite" begin="${at(0)}"/>
  </line>

  <!-- cacti -->
  ${cactusSprite(0)}
  ${cactusSprite(-2)}

  <!-- dino -->
  <g transform="translate(${DINO_X} 0)">
    <animateTransform attributeName="transform" type="translate"
      values="${JUMP_VALUES}" keyTimes="${JUMP_TIMES}" dur="4s"
      repeatCount="indefinite" begin="${at(0)}"/>
    ${bodyRects}
    ${arm}
    ${legs}
  </g>
</svg>
`;

const outDir = path.join(__dirname, "..", "dist");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "trex-run.svg"), svg);
fs.writeFileSync(path.join(__dirname, "trex.svg"), svg);
console.log("wrote dist/trex-run.svg", svg.length, "bytes");
