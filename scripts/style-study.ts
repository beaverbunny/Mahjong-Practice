/**
 * Master-level style experiment. Usage:
 *   bun scripts/style-study.ts <lineup> <matches> <startMatch>
 * lineup: 4 letters from S (speed), V (value/大牌), B (balanced/稳健), D (defensive), e.g. SVBD, BBSS, BVVV
 * Seats rotate every match; deals depend only on the match index (same walls for every lineup).
 */
import { TableState, HANDS_PER_MATCH, dealHand, getClaimOptions, playersWithClaimOptions, resolveClaims, declareSelfDraw, declareKong, discard, ClaimDecision } from '../src/engine/table';
import { decideTurn, decideClaim } from '../src/ai/brain';
import { Persona, PlayStyle, samplePersona } from '../src/ai/personas';

const mul = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const CODE: Record<string, PlayStyle> = { S: 'speed', V: 'value', B: 'balanced', D: 'defensive' };

// A Master-level bot of the given style: Master's own distribution, conditioned on style
function masterOfStyle(style: PlayStyle, rng: () => number): Persona {
  for (;;) { const p = samplePersona('master', rng); if (p.style === style) return p; }
}

const [lineup, nArg, startArg] = process.argv.slice(2);
const N = Number(nArg), START = Number(startArg ?? 0);
const letters = lineup.split('');
type Acc = { seats: number; score: number; sq: number; wins: number; self: number; dealIns: number; fan: number; calls: number; hands: number; scores: number[] };
const acc: Record<string, Acc> = {};
const fedBy: Record<string, number> = {}; // "winner<-payer" counts (discard wins and robbed kongs)
let draws = 0, hands = 0;

for (let m = START; m < START + N; m++) {
  // Rotate the lineup around the table each match (seat order matters for chi and dealing)
  const rot = m % 4;
  const seatStyles = [0, 1, 2, 3].map((i) => letters[(i + rot) % 4]);
  const prng = mul(1_000_003 + m * 7919);
  const personas = seatStyles.map((c) => masterOfStyle(CODE[c], prng));
  const botRng = mul(77_000 + m);
  let scores = [0, 0, 0, 0];
  const matchStats = seatStyles.map(() => ({ wins: 0, self: 0, dealIns: 0, fan: 0, calls: 0 }));
  for (let h = 0; h < HANDS_PER_MATCH; h++) {
    let s: TableState = dealHand(h, scores, mul(5_000_011 + m * 16 + h));
    while (s.phase !== 'ended') {
      if (s.phase === 'turn') {
        const p = s.active; const d = decideTurn(s, p, personas[p], botRng);
        s = d.type === 'tsumo' ? declareSelfDraw(s, p) : d.type === 'kong' ? declareKong(s, p, d.candidate) : discard(s, p, d.tileId);
      } else {
        const dec: (ClaimDecision | undefined)[] = [];
        for (const q of playersWithClaimOptions(s)) dec[q] = decideClaim(s, q, getClaimOptions(s, q)!, personas[q], botRng);
        s = resolveClaims(s, dec);
      }
    }
    const r = s.result!; hands++;
    for (const e of s.log) if (e.meld?.calledTile) matchStats[e.playerIndex].calls++;
    if (r.winner === null) draws++;
    else {
      const w = matchStats[r.winner]; w.wins++; w.fan += r.totalFan; if (r.isSelfDraw) w.self++;
      if (r.payer !== null) {
        matchStats[r.payer].dealIns++;
        const key = `${seatStyles[r.winner]}<-${seatStyles[r.payer]}`; fedBy[key] = (fedBy[key] ?? 0) + 1;
      }
    }
    scores = s.players.map((p) => p.score);
  }
  seatStyles.forEach((c, i) => {
    const a = (acc[c] ??= { seats: 0, score: 0, sq: 0, wins: 0, self: 0, dealIns: 0, fan: 0, calls: 0, hands: 0, scores: [] });
    a.seats++; a.score += scores[i]; a.sq += scores[i] ** 2; a.hands += HANDS_PER_MATCH; a.scores.push(scores[i]);
    const ms = matchStats[i]; a.wins += ms.wins; a.self += ms.self; a.dealIns += ms.dealIns; a.fan += ms.fan; a.calls += ms.calls;
  });
}
// Per-match average per style (sum over that style's seats in a match / seats) is what we report;
// raw per-seat scores are emitted so runs can be pooled.
console.log(JSON.stringify({ lineup, N, START, hands, draws, fedBy, acc: Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, { ...a, scores: undefined, perMatch: aggregatePerMatch(a.scores, a.seats / N) }])) }));

function aggregatePerMatch(seatScores: number[], seatsPerMatch: number): number[] {
  // Average the style's seats within each match, so SE reflects match-level variance
  const out: number[] = [];
  for (let i = 0; i < seatScores.length; i += seatsPerMatch) {
    const chunk = seatScores.slice(i, i + seatsPerMatch);
    out.push(chunk.reduce((x, y) => x + y, 0) / chunk.length);
  }
  return out;
}
