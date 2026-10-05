/**
 * Fit and check the human-facing danger model (src/analysis/danger.ts) on simulated Master games.
 *
 * Bots play full matches unchanged. Before every discard, the discarder's public view is recorded
 * along with the truth that view can't see: which opponents could win on a discard and on which
 * tiles. The model is fitted on the first set of matches and checked on a separate set.
 *
 *   bun scripts/danger-calibrate.ts [trainMatches=150] [testMatches=60] [--write]
 *
 * --write regenerates src/analysis/dangerModel.ts. Re-run after changing the features, the bots
 * or the rules, since the fitted weights depend on all three.
 */
import { writeFileSync } from 'node:fs';
import {
  TableState,
  HANDS_PER_MATCH,
  dealHand,
  getClaimOptions,
  playersWithClaimOptions,
  resolveClaims,
  declareSelfDraw,
  declareKong,
  discard,
  isWinningShape,
  ClaimDecision,
} from '../src/engine/table';
import { decideTurn, decideClaim } from '../src/ai/brain';
import { samplePersona } from '../src/ai/personas';
import { evaluateWin } from '../src/utils/rulesEngine';
import { createHypotheticalTile, evaluateTileSafety } from '../src/utils/strategyEngine';
import { ALL_TILE_TYPES, shanten, tileIndex } from '../src/engine/shanten';
import {
  publicView,
  readyFeatures,
  waitFeatures,
  fanFeatures,
  readDanger,
  READY_FEATURES,
  WAIT_FEATURES,
  FAN_FEATURES,
  LinearModel,
  pReadyOf,
} from '../src/analysis/danger';

const mul = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Tiles each player could win on from a discard right now (hidden information)
function ronWaits(s: TableState, o: number): Map<number, number> {
  const pl = s.players[o];
  const out = new Map<number, number>();
  if (pl.isDead || shanten(pl.hand, pl.melds.length) > 0) return out;
  ALL_TILE_TYPES.forEach((type, i) => {
    const hypo = createHypotheticalTile(type);
    if (!isWinningShape([...pl.hand, hypo], pl.melds)) return;
    const ev = evaluateWin(pl.hand, pl.melds, hypo, { isSelfDraw: false, prevailingWind: s.prevailingWind, seatWind: pl.seatWind });
    if (ev.isWin) out.set(i, ev.totalFan);
  });
  return out;
}

interface Sample {
  ready: { x: number[]; y: number }[];
  wait: { x: number[]; y: number }[];
  fan: { x: number[]; y: number }[];
  // Per tile in the discarder's hand: model inputs and the truth, for checking
  tiles: { s: TableState; p: number; type: string; truth: number; oldScore: number }[];
}

// Play matches; call `observe` before every discard decision
export function collect(matches: number, seed: number, keepTiles: boolean): Sample {
  const out: Sample = { ready: [], wait: [], fan: [], tiles: [] };
  for (let m = 0; m < matches; m++) {
    const prng = mul(seed + m * 7919);
    const personas = [0, 1, 2, 3].map(() => samplePersona('master', prng));
    const botRng = mul(seed * 3 + m);
    let scores = [0, 0, 0, 0];
    for (let h = 0; h < HANDS_PER_MATCH; h++) {
      let s: TableState = dealHand(h, scores, mul(seed * 7 + m * 16 + h));
      while (s.phase !== 'ended') {
        if (s.phase === 'turn') {
          const p = s.active;
          const d = decideTurn(s, p, personas[p], botRng);
          if (d.type === 'discard') observe(s, p, out, keepTiles);
          s = d.type === 'tsumo' ? declareSelfDraw(s, p) : d.type === 'kong' ? declareKong(s, p, d.candidate) : discard(s, p, d.tileId);
        } else {
          const dec: (ClaimDecision | undefined)[] = [];
          for (const q of playersWithClaimOptions(s)) dec[q] = decideClaim(s, q, getClaimOptions(s, q)!, personas[q], botRng);
          s = resolveClaims(s, dec);
        }
      }
      scores = s.players.map((pl) => pl.score);
    }
  }
  return out;
}

function observe(s: TableState, p: number, out: Sample, keepTiles: boolean) {
  const view = publicView(s, p);
  const types = [...new Set(s.players[p].hand.map((t) => tileIndex(t.type)))];
  const truth = new Array(34).fill(0);
  for (let o = 0; o < 4; o++) {
    if (o === p) continue;
    const waits = ronWaits(s, o);
    const ready = waits.size > 0 ? 1 : 0;
    out.ready.push({ x: readyFeatures(view, o), y: ready });
    if (!ready) continue;
    let fanSum = 0;
    waits.forEach((f) => (fanSum += f));
    out.fan.push({ x: fanFeatures(view, o), y: fanSum / waits.size });
    for (const i of types) {
      const y = waits.has(i) ? 1 : 0;
      out.wait.push({ x: waitFeatures(view, o, i), y });
      if (y) truth[i] = 1;
    }
  }
  if (!keepTiles) return;
  // The old tile-only labeler, with the same visible inputs the app passed it
  const opponentDiscards = s.players.map((pl) => pl.discards);
  const threats = s.players.map((pl, i) => i !== p && pl.melds.length >= 2);
  const visibleTiles = [...s.players.flatMap((pl) => [...pl.discards, ...pl.melds.flatMap((mm) => mm.tiles)]), ...s.players[p].hand];
  for (const i of types) {
    const tile = s.players[p].hand.find((t) => tileIndex(t.type) === i)!;
    const oldScore = evaluateTileSafety(tile, opponentDiscards, threats, visibleTiles).score;
    out.tiles.push({ s, p, type: ALL_TILE_TYPES[i], truth: truth[i], oldScore });
  }
}

// ---------------------------------------------------------------------------
// Fitting
// ---------------------------------------------------------------------------

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// L2-regularized logistic regression by Newton's method (bias unregularized)
function fitLogistic(rows: { x: number[]; y: number }[], lambda = 1): LinearModel {
  const d = rows[0].x.length + 1;
  let beta = new Array(d).fill(0);
  for (let iter = 0; iter < 25; iter++) {
    const H = Array.from({ length: d }, () => new Array(d).fill(0));
    const g = new Array(d).fill(0);
    for (const { x, y } of rows) {
      const z = [1, ...x];
      let eta = 0;
      for (let i = 0; i < d; i++) eta += z[i] * beta[i];
      const p = 1 / (1 + Math.exp(-eta));
      const w = p * (1 - p);
      for (let i = 0; i < d; i++) {
        if (z[i] === 0) continue;
        g[i] += (y - p) * z[i];
        for (let j = 0; j < d; j++) if (z[j] !== 0) H[i][j] += w * z[i] * z[j];
      }
    }
    for (let i = 1; i < d; i++) {
      g[i] -= lambda * beta[i];
      H[i][i] += lambda;
    }
    H[0][0] += 1e-9;
    const step = solve(H, g);
    beta = beta.map((b, i) => b + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-6) break;
  }
  return { bias: beta[0], w: beta.slice(1) };
}

// Ridge linear regression
function fitLinear(rows: { x: number[]; y: number }[], lambda = 1): LinearModel {
  const d = rows[0].x.length + 1;
  const A = Array.from({ length: d }, () => new Array(d).fill(0));
  const b = new Array(d).fill(0);
  for (const { x, y } of rows) {
    const z = [1, ...x];
    for (let i = 0; i < d; i++) {
      b[i] += z[i] * y;
      for (let j = 0; j < d; j++) A[i][j] += z[i] * z[j];
    }
  }
  for (let i = 1; i < d; i++) A[i][i] += lambda;
  const beta = solve(A, b);
  return { bias: beta[0], w: beta.slice(1) };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export function auc(scores: number[], labels: number[]): number {
  const idx = scores.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);
  let rankSum = 0;
  let pos = 0;
  // Average ranks for ties
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (labels[idx[k]]) {
      rankSum += r;
      pos++;
    }
    i = j + 1;
  }
  const neg = labels.length - pos;
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

function calibrationTable(pred: number[], truth: number[], edges: number[]) {
  const lines: string[] = [];
  for (let b = 0; b < edges.length - 1; b++) {
    let n = 0;
    let p = 0;
    let y = 0;
    pred.forEach((q, i) => {
      if (q >= edges[b] && q < edges[b + 1]) {
        n++;
        p += q;
        y += truth[i];
      }
    });
    if (n) lines.push(`  ${(100 * edges[b]).toFixed(0).padStart(3)}–${(100 * edges[b + 1]).toFixed(0).padStart(3)}%: ${String(n).padStart(7)} tiles, predicted ${(100 * p / n).toFixed(1).padStart(5)}%, actual ${(100 * y / n).toFixed(1).padStart(5)}%`);
  }
  return lines.join('\n');
}

export function evaluateTiles(tiles: Sample['tiles']) {
  const pred: number[] = [];
  const truth: number[] = [];
  const old: number[] = [];
  const levels = { safe: [0, 0], medium: [0, 0], danger: [0, 0] };
  for (const t of tiles) {
    const r = readDanger(publicView(t.s, t.p), [t.type as any]).tiles[t.type];
    pred.push(r.pct);
    truth.push(t.truth);
    old.push(100 - t.oldScore);
    levels[r.level][0]++;
    levels[r.level][1] += t.truth;
  }
  return { pred, truth, old, levels };
}

if (import.meta.main) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const write = process.argv.includes('--write');
  const nTrain = Number(args[0] ?? 150);
  const nTest = Number(args[1] ?? 60);
  const t0 = Date.now();
  if (nTrain > 0) fitAndReport(nTrain, write, t0);
  if (nTest > 0) testReport(nTest);
}

function fitAndReport(nTrain: number, write: boolean, t0: number) {
  const train = collect(nTrain, 1_000_000, false);
  console.log(`train: ${nTrain} matches, ${train.ready.length} opponent reads, ${train.wait.length} tile-vs-ready-opponent rows (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

  const ready = fitLogistic(train.ready);
  const wait = fitLogistic(train.wait);
  const fan = fitLinear(train.fan);
  const fmt = (names: readonly string[], m: LinearModel) =>
    `bias ${m.bias.toFixed(2)}\n` + names.map((n, i) => `  ${n.padEnd(15)} ${m.w[i] >= 0 ? '+' : ''}${m.w[i].toFixed(2)}`).join('\n');
  console.log('\nready (log-odds):\n' + fmt(READY_FEATURES, ready));
  console.log('\nwait given ready (log-odds):\n' + fmt(WAIT_FEATURES, wait));
  console.log('\nfan if you deal in:\n' + fmt(FAN_FEATURES, fan));

  const r4 = (m: LinearModel) => ({ bias: +m.bias.toFixed(4), w: m.w.map((x) => +x.toFixed(4)) });
  const levels = { medium: 0.03, danger: 0.08 };
  const model = { ready: r4(ready), wait: r4(wait), fan: r4(fan), levels };
  if (write) {
    const file = `// Generated by scripts/danger-calibrate.ts (${nTrain} training matches at Master). Do not edit by hand.
// Feature order: READY_FEATURES, WAIT_FEATURES and FAN_FEATURES in ./danger.ts
export const MODEL = ${JSON.stringify(model, null, 2)};
`;
    writeFileSync(new URL('../src/analysis/dangerModel.ts', import.meta.url), file);
    console.log('\nwrote src/analysis/dangerModel.ts');
  }

}

// Check on unseen matches, using the model file on disk (fit with --write first)
function testReport(nTest: number) {
  {
    const test = collect(nTest, 9_000_000, true);
    const { pred, truth, old, levels: lv } = evaluateTiles(test.tiles);
    const base = truth.reduce((a, b) => a + b, 0) / truth.length;
    console.log(`\ntest: ${nTest} matches, ${pred.length} tiles in hand at discard time, ${(100 * base).toFixed(1)}% would have dealt in`);
    console.log(`ranking quality (AUC, 0.5 = coin flip, 1 = perfect): new model ${auc(pred, truth).toFixed(3)}, old labeler ${auc(old, truth).toFixed(3)}`);
    console.log('calibration (did tiles the model rated X% actually deal in X% of the time?):');
    console.log(calibrationTable(pred, truth, [0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.3, 1.01]));
    const rp = test.ready.map((r) => pReadyOf(r.x));
    const ry = test.ready.map((r) => r.y);
    console.log(`\nopponent "ready to win on a discard" read: AUC ${auc(rp, ry).toFixed(3)}`);
    console.log(calibrationTable(rp, ry, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01]).replace(/tiles/g, 'reads'));
    console.log('levels:');
    for (const [k, [n, y]] of Object.entries(lv)) console.log(`  ${k.padEnd(7)} ${(100 * n / pred.length).toFixed(1).padStart(5)}% of tiles, ${(100 * y / Math.max(1, n)).toFixed(1)}% dealt in`);
  }
}
