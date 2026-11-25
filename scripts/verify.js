// Sanity check: makes sure the dino clears every cactus group in dist/trex-run.svg.
// Usage: node scripts/verify.js
const fs = require("fs");
const path = require("path");

const svg = fs.readFileSync(
  path.join(__dirname, "..", "dist", "trex-run.svg"),
  "utf8"
);

const DINO_X = 70, S = 4, CACTUS_SCALE = 5, SLOT = 40;
const MASTER = 12, TRAVEL = 3.2, START_X = 900, END_X = -160;
const SPEED = (START_X - END_X) / TRAVEL;
const CACTUS_W = 7 * CACTUS_SCALE;
const CACTUS_H = 9 * CACTUS_SCALE;
const LEG_L = DINO_X + 4 * S;
const LEG_R = DINO_X + 14 * S;

// --- dino jump keyframes ---
const m = svg.match(/values="(70 [^"]+)" keyTimes="([^"]+)" dur="12s"/);
if (!m) throw new Error("dino jump animation not found");
const vals = m[1].split(";").map((v) => Number(v.trim().split(/\s+/)[1]));
const times = m[2].split(";").map((v) => Number(v) * MASTER);

function heightAt(t) {
  t = ((t % MASTER) + MASTER) % MASTER;
  if (t <= times[0]) return vals[0];
  for (let i = 0; i < times.length - 1; i++) {
    if (t >= times[i] && t <= times[i + 1]) {
      const f = (t - times[i]) / (times[i + 1] - times[i]);
      return vals[i] + (vals[i + 1] - vals[i]) * f;
    }
  }
  return vals[vals.length - 1];
}

// --- cactus groups ---
function groupX(t, t0) {
  const phase = (((t - t0) % MASTER) + MASTER) % MASTER;
  if (phase >= TRAVEL) return END_X;
  return START_X + (END_X - START_X) * (phase / TRAVEL);
}

const blocks = svg.split('<g transform="translate(900 0)">').slice(1);
const groups = blocks.map((b) => {
  const body = b.split("</g>")[0];
  const begin = Number(b.match(/begin="(-?[\d.]+)s"/)[1]);
  const xs = [...body.matchAll(/x="([\d.]+)"/g)].map((x) => Number(x[1]));
  const lastPixel = (CACTUS_W / CACTUS_SCALE - 1) * CACTUS_SCALE;
  const n = Math.round((Math.max(...xs) - lastPixel) / SLOT) + 1;
  return { begin, n };
});

let worst = Infinity;
let collisions = 0;

for (const g of groups) {
  const width = (g.n - 1) * SLOT + CACTUS_W;
  let checked = 0;
  for (let t = 0; t < MASTER; t += 0.002) {
    const x = groupX(t, g.begin);
    if (!(x < LEG_R && x + width > LEG_L)) continue;
    checked++;
    const clearance = -heightAt(t) - CACTUS_H;
    if (clearance < worst) worst = clearance;
    if (clearance < 0) collisions++;
  }
  console.log(
    `group begin=${g.begin}s cacti=${g.n} width=${width}px overlapSamples=${checked}`
  );
}

console.log("---");
console.log("min clearance:", worst.toFixed(2), "px");
if (collisions) {
  console.log(`FAIL: ${collisions} samples where the dino hits a cactus`);
  process.exit(1);
}
console.log("OK: every group is cleared");
