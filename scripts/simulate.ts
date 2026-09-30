/**
 * Headless match simulator: 4 bots play full 16-hand matches through the table engine.
 * Checks rule invariants after every action and reports field statistics per play style.
 *
 *   bun scripts/simulate.ts [matches=50] [difficulty=tournament] [seed=1]
 */
import { DifficultyLevel } from '../src/types/mahjong';
import {
  TableState,
  HANDS_PER_MATCH,
  dealHand,
  getTurnOptions,
  getClaimOptions,
  playersWithClaimOptions,
  resolveClaims,
  declareSelfDraw,
  declareKong,
  discard,
  checkInvariants,
  ClaimDecision,
} from '../src/engine/table';
import { evaluateWin } from '../src/utils/rulesEngine';
import { createHypotheticalTile } from '../src/utils/strategyEngine';
import { ALL_TILE_TYPES, shanten } from '../src/engine/shanten';
import { decideTurn, decideClaim } from '../src/ai/brain';
import { Persona, samplePersona } from '../src/ai/personas';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface StyleStats {
  seats: number;
  hands: number;
  wins: number;
  selfDraws: number;
  dealIns: number;
  fan: number;
  score: number;
  calls: number;
}

export function runMatches(matches: number, difficulty: DifficultyLevel, seed: number) {
  const rng = mulberry32(seed);
  const styles: Record<string, StyleStats> = {};
  const fanHist: number[] = new Array(11).fill(0);
  let hands = 0;
  let wins = 0;
  let selfDraws = 0;
  let draws = 0;
  let robbed = 0;
  let violations = 0;
  const matchScores: number[] = [];
  const diag = { tenpaiAtDraw: 0, tsumoOnlyAtDraw: 0, meldsAtEnd: 0 };
  const t0 = Date.now();

  for (let m = 0; m < matches; m++) {
    const personas: Persona[] = [0, 1, 2, 3].map((seat) => {
      // SIM_HERO=<difficulty> seats a player from another field at seat 0
      const p = samplePersona(seat === 0 && process.env.SIM_HERO ? (process.env.SIM_HERO as DifficultyLevel) : difficulty, rng);
      // Diagnostics: SIM_OVERRIDE='{"caution":0}' forces persona fields
      if (process.env.SIM_OVERRIDE) Object.assign(p, JSON.parse(process.env.SIM_OVERRIDE));
      return p;
    });
    personas.forEach((p) => {
      styles[p.style] ??= { seats: 0, hands: 0, wins: 0, selfDraws: 0, dealIns: 0, fan: 0, score: 0, calls: 0 };
      styles[p.style].seats++;
    });
    let scores = [0, 0, 0, 0];

    for (let h = 0; h < HANDS_PER_MATCH; h++) {
      let s: TableState = dealHand(h, scores, rng);
      let steps = 0;
      while (s.phase !== 'ended') {
        if (++steps > 2000) throw new Error('hand did not finish');
        if (s.phase === 'turn') {
          const p = s.active;
          const d = decideTurn(s, p, personas[p], rng);
          if (d.type === 'tsumo') s = declareSelfDraw(s, p);
          else if (d.type === 'kong') s = declareKong(s, p, d.candidate);
          else s = discard(s, p, d.tileId);
        } else {
          const decisions: (ClaimDecision | undefined)[] = [];
          for (const q of playersWithClaimOptions(s)) {
            decisions[q] = decideClaim(s, q, getClaimOptions(s, q)!, personas[q], rng);
          }
          s = resolveClaims(s, decisions);
        }
        const errs = checkInvariants(s);
        if (errs.length) {
          violations++;
          console.error('INVARIANT', errs);
        }
      }

      diag.meldsAtEnd += s.players.reduce((a, p) => a + p.melds.length, 0);
      // Calls that actually happened
      for (const e of s.log) {
        if (e.meld?.calledTile) styles[personas[e.playerIndex].style].calls++;
      }

      // Verify the recorded win independently
      const r = s.result!;
      hands++;
      personas.forEach((p) => styles[p.style].hands++);
      if (r.winner === null) {
        draws++;
        // Why did nobody win? Look at who was tenpai and whether they could win on a discard
        for (const pl of s.players) {
          if (shanten(pl.hand, pl.melds.length) !== 0) continue;
          diag.tenpaiAtDraw++;
          let ronOk = false;
          for (const type of ALL_TILE_TYPES) {
            const hypo = createHypotheticalTile(type);
            const ev = evaluateWin(pl.hand, pl.melds, hypo, { isSelfDraw: false, prevailingWind: s.prevailingWind, seatWind: pl.seatWind });
            if (ev.isWin) ronOk = true;
          }
          if (!ronOk) diag.tsumoOnlyAtDraw++;
        }
      }
      else {
        const w = s.players[r.winner];
        const common = { prevailingWind: s.prevailingWind, seatWind: w.seatWind };
        // Re-score with the same situational flags; a self-draw may or may not follow a Kong
        const candidates = r.isSelfDraw
          ? [false, true].map((kong) =>
              evaluateWin(w.hand, w.melds, r.winningTile!, { ...common, isSelfDraw: true, isUnderTheSea: s.wall.length === 0, isSelfDrawOnKong: kong })
            )
          : [evaluateWin(w.hand, w.melds, r.winningTile!, { ...common, isSelfDraw: false, isUnderTheSea: s.wall.length === 0 && !r.isRobbingKong })];
        if (!candidates.some((ev) => ev.isWin && ev.totalFan === r.totalFan) || r.totalFan < 1) {
          violations++;
          console.error('ILLEGAL WIN', r);
        }
        if (r.pointsDelta.reduce((a, b) => a + b, 0) !== 0) {
          violations++;
          console.error('UNBALANCED PAYMENT', r.pointsDelta);
        }
        wins++;
        if (r.isSelfDraw) selfDraws++;
        if (r.isRobbingKong) robbed++;
        fanHist[r.totalFan]++;
        const st = styles[personas[r.winner].style];
        for (const f of r.fanDetails) {
          if (['B1', 'B2', 'B3', 'B5', 'X1', 'A1', 'A7', 'A3', 'A4', 'A2'].includes(f.code)) {
            (st as any).codes ??= {};
            (st as any).codes[f.code] = ((st as any).codes[f.code] ?? 0) + 1;
          }
        }
        st.wins++;
        st.fan += r.totalFan;
        if (r.isSelfDraw) st.selfDraws++;
        if (r.payer !== null) styles[personas[r.payer].style].dealIns++;
      }
      scores = s.players.map((p) => p.score);
    }
    personas.forEach((p, i) => (styles[p.style].score += scores[i]));
    matchScores.push(...scores);
  }

  const secs = (Date.now() - t0) / 1000;
  const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) + '%' : '-');
  console.log(`\n${matches} matches (${difficulty}, seed ${seed}) in ${secs.toFixed(1)}s, ${violations} rule violations`);
  console.log(`hands ${hands}, wins per 16 hands ${((16 * wins) / hands).toFixed(1)}, draws ${pct(draws, hands)}, self-draw share ${pct(selfDraws, wins)}, robbed kongs ${robbed}`);
  const oneFan = fanHist[1];
  const threePlus = fanHist.slice(3).reduce((a, b) => a + b, 0);
  const avgFan = fanHist.reduce((a, n, f) => a + n * f, 0) / Math.max(1, wins);
  console.log(`at exhaustive draws: ${(diag.tenpaiAtDraw / Math.max(1, draws)).toFixed(2)} tenpai players per draw, ${pct(diag.tsumoOnlyAtDraw, diag.tenpaiAtDraw)} of them could only win by self-draw; melds per player at hand end ${(diag.meldsAtEnd / hands / 4).toFixed(2)}`);
  console.log(`fan per win ${avgFan.toFixed(2)}, 1-fan ${pct(oneFan, wins)}, 3+ fan ${pct(threePlus, wins)}`);
  console.log('fan histogram', fanHist.map((n, f) => `${f}:${n}`).slice(1).join(' '));
  const sorted = [...matchScores].sort((a, b) => a - b);
  console.log(`match score spread: p10 ${sorted[Math.floor(sorted.length * 0.1)]}, median ${sorted[Math.floor(sorted.length / 2)]}, p90 ${sorted[Math.floor(sorted.length * 0.9)]}`);
  if (process.env.SIM_HERO) {
    const hero = matchScores.filter((_, i) => i % 4 === 0);
    console.log(`hero (${process.env.SIM_HERO}) average match score vs ${difficulty} field: ${(hero.reduce((a, b) => a + b, 0) / hero.length).toFixed(1)}`);
  }
  console.log('\nstyle      seats  win/16  selfdraw  dealin/16  fan/win  calls/16  avg score');
  for (const [name, st] of Object.entries(styles)) {
    const per16 = (x: number) => ((16 * x) / Math.max(1, st.hands)).toFixed(2);
    console.log(
      `${name.padEnd(10)} ${String(st.seats).padStart(5)}  ${per16(st.wins).padStart(6)}  ${pct(st.selfDraws, st.wins).padStart(8)}  ${per16(st.dealIns).padStart(9)}  ${(st.fan / Math.max(1, st.wins)).toFixed(2).padStart(7)}  ${per16(st.calls).padStart(8)}  ${(st.score / st.seats).toFixed(1).padStart(9)}`
    );
  }
  console.log('\nfan sources per style (count of winning hands containing each):');
  for (const [name, st] of Object.entries(styles)) console.log(name.padEnd(10), JSON.stringify((st as any).codes ?? {}));
  return { violations };
}

if (import.meta.main) {
  const [n = '50', diff = 'tournament', seed = '1'] = process.argv.slice(2);
  const { violations } = runMatches(Number(n), diff as DifficultyLevel, Number(seed));
  process.exit(violations > 0 ? 1 : 0);
}
