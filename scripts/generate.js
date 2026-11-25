// Generates a Chrome-dino style animated SVG (SMIL only, so GitHub can render it).
const fs = require("fs");
const path = require("path");

// T_OFFSET (seconds, negative) freezes a frame for local previewing.
const OFFSET = Number(process.env.T_OFFSET || 0);

const S = 4;                  // Dino pixel size
const W = 820;
const H = 200;
const GROUND_Y = 180;
const DINO_X = 70;
const LEG_H = 4 * S;

const CACTUS_SCALE = 5;       // cactus pixel size
const SLOT = 40;              // horizontal step between cacti inside one group

const MASTER = 12;            // full loop length in seconds
const TRAVEL = 3.2;           // seconds a group takes to cross the screen
const START_X = 900;          // spawn x
const END_X = -160;           // parked x (fully off screen)
const SPEED = (START_X - END_X) / TRAVEL;

const JUMP_PEAK = 64;

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

const legY = dinoTop + bodyH;
const leg1X = DINO_X + 4 * S;
const leg2X = DINO_X + 10 * S;
const legW = 4 * S;
const LEG_L = leg1X;
const LEG_R = leg2X + legW;

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
const CACTUS_W = CACTUS[0].length * CACTUS_SCALE;
const CACTUS_H = CACTUS.length * CACTUS_SCALE;

// One entry per group appearing in a 12s cycle.
// n = how many cacti stand next to each other.
const SCHEDULE = [
  { t: 0, n: 1 },
  { t: 2, n: 2 },
  { t: 4, n: 3 },
  { t: 6, n: 1 },
  { t: 8, n: 2 },
  { t: 10, n: 3 },
];

function cactusGroup(beginSec, n) {
  const oy = GROUND_Y - CACTUS_H;
  const rects = [];
  for (let i = 0; i < n; i++) {
    for (const run of runs(CACTUS)) {
      rects.push(pixelRect(run, i * SLOT, oy, C.cactus, CACTUS_SCALE));
    }
  }
  return `
  <g transform="translate(${START_X} 0)">
    <animateTransform attributeName="transform" type="translate"
      values="${START_X} 0; ${END_X} 0; ${END_X} 0" keyTimes="0; ${(TRAVEL / MASTER).toFixed(
        5
      )}; 1" dur="${MASTER}s" begin="${at(beginSec)}" repeatCount="indefinite"/>
    ${rects.join("\n    ")}
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

// ---------- jump timeline ----------
// When does a group of n cacti overlap the dino's legs?
function contactStart() {
  return (START_X - LEG_R) / SPEED;
}
function contactEnd(n) {
  return (START_X - (LEG_L - (n - 1) * SLOT - CACTUS_W)) / SPEED;
}

const AIRTIME = { 1: 0.55, 2: 0.70, 3: 0.90 };

const keyTimes = [0];
const values = [`${DINO_X} 0`];

for (const ob of SCHEDULE) {
  const c = ((contactStart() + contactEnd(ob.n)) / 2 + ob.t) % MASTER;
  const T = AIRTIME[ob.n];
  const pts = [
    [c - T * 0.5, 0],
    [c - T * 0.36, -Math.round(JUMP_PEAK * 0.72)],
    [c - T * 0.22, -Math.round(JUMP_PEAK * 0.97)],
    [c, -JUMP_PEAK],
    [c + T * 0.22, -Math.round(JUMP_PEAK * 0.97)],
    [c + T * 0.36, -Math.round(JUMP_PEAK * 0.72)],
    [c + T * 0.5, 0],
  ];
  for (const [t, dy] of pts) keyTimes.push(t / MASTER);
  for (const [, dy] of pts) values.push(`${DINO_X} ${dy}`);
}

keyTimes.push(1);
values.push(`${DINO_X} 0`);

const order = keyTimes.map((t, i) => i).sort((a, b) => keyTimes[a] - keyTimes[b]);
const SORTED_TIMES = order.map((i) => +keyTimes[i].toFixed(3)).join("; ");
const SORTED_VALUES = order.map((i) => values[i]).join("; ");

// ---------- assemble ----------
const dashPeriod = 54;
const dashDur = (dashPeriod / SPEED).toFixed(4);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="T-Rex running animation">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>

  <!-- clouds -->
  ${cloudSprite(40, -8)}
  ${cloudSprite(18, -19)}

  <!-- scrolling ground (dashes travel left at the same speed as the cacti) -->
  <line x1="0" y1="${GROUND_Y}" x2="${W}" y2="${GROUND_Y}"
        stroke="${C.ground}" stroke-width="4" stroke-dasharray="34 20">
    <animate attributeName="stroke-dashoffset" values="0;${dashPeriod}" dur="${dashDur}s"
             repeatCount="indefinite" begin="${at(0)}"/>
  </line>

  <!-- cactus groups: 1, 2 and 3 wide -->
${SCHEDULE.map((ob) => cactusGroup(ob.t - MASTER, ob.n)).join("\n")}

  <!-- dino -->
  <g transform="translate(${DINO_X} 0)">
    <animateTransform attributeName="transform" type="translate"
      values="${SORTED_VALUES}" keyTimes="${SORTED_TIMES}" dur="${MASTER}s"
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
console.log("wrote dist/trex-run.svg", svg.length, "bytes");
console.log("keyTimes:", SORTED_TIMES);
