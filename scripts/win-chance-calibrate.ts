/**
 * Measure how often a bot goes on to win the hand from a given distance to ready (shanten) and
 * number of turns left, on simulated Master games. The bots plan with this table (pWin in
 * src/ai/brain.ts), so a hand that isn't ready yet is valued by how often such hands really win,
 * not by how often they would win if nobody else did.
 *
 *   bun scripts/win-chance-calibrate.ts [matches=300] [--write]
 *
 * --write regenerates src/ai/winChance.ts. The table in use was measured on the bots before they
 * planned with it. Re-measuring it on bots that already use it raised the late-hand chances of
 * hands two or more tiles from ready, so the bots stopped giving those hands up, and they got weaker
 * (+14.9 instead of +22.7 points per match against the earlier bots; docs/decisions.md §3). So run
 * it without --write to look, and only replace the table after a rules change, checking the new
 * bots head-to-head first. Re-fit the danger model (scripts/danger-calibrate.ts) after any change.
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
  ClaimDecision,
} from '../src/engine/table';
import { decideTurn, decideClaim, ukeFactor } from '../src/ai/brain';
import { samplePersona } from '../src/ai/personas';
import { shantenFromCounts, tileIndex, toCounts, usefulTiles } from '../src/engine/shanten';
import { Tile } from '../src/types/mahjong';

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

const ROWS = 5; // shanten 0 (ready) to 4; further hands use row 4, halved per extra step
const TURNS = 21; // whole turns left: 0-20 (83 tiles in the wall after the deal)
const MIN_SAMPLES = 60;

const [nArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const matches = Number(nArg ?? 300);
const write = process.argv.includes('--write');

// cells[shanten][turns]: decisions seen, how many went on to win, sum of the bot's useful-tile factor
const cells = Array.from({ length: ROWS }, () => Array.from({ length: TURNS }, () => ({ n: 0, won: 0, uke: 0 })));
const t0 = Date.now();

for (let m = 0; m < matches; m++) {
  const prng = mul(3_000_017 + m * 7919);
  const personas = [0, 1, 2, 3].map(() => samplePersona('master', prng));
  const botRng = mul(4_000_037 + m);
  let scores = [0, 0, 0, 0];
  for (let h = 0; h < HANDS_PER_MATCH; h++) {
    let s: TableState = dealHand(h, scores, mul(5_000_011 + m * 16 + h));
    const seen: { p: number; sh: number; turn: number; uke: number }[] = [];
    while (s.phase !== 'ended') {
      if (s.phase === 'turn') {
        const p = s.active;
        const d = decideTurn(s, p, personas[p], botRng);
        if (d.type === 'discard') {
          const pl = s.players[p];
          const counts = toCounts(pl.hand.filter((t) => t.id !== d.tileId));
          const sh = shantenFromCounts(counts, pl.melds.length);
          // Tiles the bot can't see, as the bot counts them
          const visible = new Array(34).fill(0);
          const add = (t: Tile) => visible[tileIndex(t.type)]++;
          pl.hand.forEach(add);
          s.players.forEach((q) => {
            q.melds.forEach((mm) => mm.tiles.forEach(add));
            q.discards.forEach(add);
          });
          const unseen = visible.map((v) => Math.max(0, 4 - v));
          const useful = sh > 0 ? usefulTiles(counts, pl.melds.length, unseen).reduce((a, u) => a + u.remaining, 0) : 0;
          seen.push({ p, sh: Math.min(ROWS - 1, sh), turn: Math.min(TURNS - 1, Math.floor(s.wall.length / 4)), uke: sh > 0 ? ukeFactor(useful) : 1 });
        }
        s = d.type === 'tsumo' ? declareSelfDraw(s, p) : d.type === 'kong' ? declareKong(s, p, d.candidate) : discard(s, p, d.tileId);
      } else {
        const dec: (ClaimDecision | undefined)[] = [];
        for (const q of playersWithClaimOptions(s)) dec[q] = decideClaim(s, q, getClaimOptions(s, q)!, personas[q], botRng);
        s = resolveClaims(s, dec);
      }
    }
    const winner = s.result!.winner;
    for (const r of seen) {
      const c = cells[r.sh][r.turn];
      c.n++;
      c.uke += r.uke;
      if (r.p === winner) c.won++;
    }
    scores = s.players.map((pl) => pl.score);
  }
}

// Win chance per unit of useful-tile factor, so pWin = table × the hand's own factor.
// Sparse early cells (few hands get that far from ready that late) count as 0; later sparse cells
// repeat the last value. More turns left never lowers the chance.
const table = cells.map((row) => {
  let best = 0;
  let any = false;
  return row.map((c) => {
    if (c.n >= MIN_SAMPLES) {
      any = true;
      best = Math.max(best, c.won / c.uke);
    }
    return any ? +best.toFixed(4) : 0;
  });
});

console.log(`${matches} Master matches (${((Date.now() - t0) / 1000).toFixed(0)}s). Chance to go on and win the hand, by turns left:`);
console.log('turns left  ' + Array.from({ length: TURNS }, (_, t) => String(t).padStart(5)).join(''));
cells.forEach((row, sh) => {
  const label = sh === 0 ? 'ready     ' : `${sh}${sh === ROWS - 1 ? '+' : ' '} away   `;
  console.log(`${label}  ` + row.map((c) => (c.n >= MIN_SAMPLES ? `${Math.round((100 * c.won) / c.n)}%` : '-').padStart(5)).join(''));
});

if (write) {
  const file = `// Generated by scripts/win-chance-calibrate.ts (${matches} matches at Master). Do not edit by hand.
// WIN_CHANCE[shanten][whole turns left]: how often a bot that far from ready went on to win the hand,
// per unit of its useful-tile factor (ukeFactor in ./brain.ts). Row 0 is a ready hand.
export const WIN_CHANCE = [
${table.map((row) => `  [${row.join(', ')}],`).join('\n')}
];
`;
  writeFileSync(new URL('../src/ai/winChance.ts', import.meta.url), file);
  console.log('\nwrote src/ai/winChance.ts');
}
