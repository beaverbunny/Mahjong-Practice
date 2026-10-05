/**
 * Bot decision-making for the TVB rules.
 *
 * Bots only use information a real player at the table has: their own hand, every exposed meld,
 * every discard, the wall count and the winds. Decisions compare expected points:
 *  - hand value: fan the hand can reach (speed, flush, all-pungs routes) × chance to finish it.
 *    The speed route counts the distance to a hand that can win on a discard (at least 1 fan:
 *    Common Hand, a value triplet, ...); a shape with no fan can only win by self-draw and is
 *    valued as such.
 *  - danger: chance a discard wins for an opponent × the fan their exposed melds suggest
 * Each bot's Persona scales these (value-chasing, caution, eagerness to call, skill noise).
 */
import { Tile, Meld, Wind, TileType } from '../types/mahjong';
import {
  TableState,
  ClaimOptions,
  ClaimDecision,
  KongCandidate,
  getTurnOptions,
  isWinningShape,
} from '../engine/table';
import { evaluateWin } from '../utils/rulesEngine';
import { createHypotheticalTile, meldShapes, valueTileIndices } from '../utils/strategyEngine';
import { fanShantenFromCounts } from '../engine/fanShanten';
import { ALL_TILE_TYPES, shantenFromCounts, tileIndex, toCounts } from '../engine/shanten';
import { Persona } from './personas';

export type Rng = () => number;

export type TurnDecision =
  | { type: 'tsumo' }
  | { type: 'kong'; candidate: KongCandidate }
  | { type: 'discard'; tileId: string };

const WIND_INDEX: Record<Wind, number> = { E: 27, S: 28, W: 29, N: 30 };
const SUITS: ('wan' | 'tiao' | 'tong')[] = ['wan', 'tiao', 'tong'];

// ---------------------------------------------------------------------------
// What the bot can see
// ---------------------------------------------------------------------------

interface Threat {
  seat: number;
  pTenpai: number; // estimated chance this opponent is waiting
  fan: number; // fan their exposed melds suggest
  flushSuit: number | null; // 0-2 if their melds point to a flush in that suit
  discarded: Set<number>; // tile indices they discarded
}

interface Ctx {
  s: TableState;
  me: number;
  persona: Persona;
  rng: Rng;
  unseen: number[];
  unseenTotal: number;
  turnsLeft: number;
  valueWeight: number[]; // fan a triplet of each honor index is worth to me
  valueTiles: number[]; // honor indices whose triplet gives me a fan
  threats: Threat[];
}

function buildCtx(s: TableState, me: number, persona: Persona, rng: Rng): Ctx {
  const visible = new Array(34).fill(0);
  const add = (t: Tile) => visible[tileIndex(t.type)]++;
  s.players[me].hand.forEach(add);
  s.players.forEach((pl) => {
    pl.melds.forEach((m) => m.tiles.forEach(add));
    pl.discards.forEach(add);
  });
  // An added-Kong tile waiting to be robbed is on the table, not in any river
  if (s.claim?.robbingKong) add(s.claim.tile);
  const unseen = visible.map((v) => Math.max(0, 4 - v));

  const pl = s.players[me];
  const valueWeight = new Array(34).fill(0);
  valueWeight[31] = valueWeight[32] = valueWeight[33] = 1;
  valueWeight[WIND_INDEX[pl.seatWind]] += 1;
  valueWeight[WIND_INDEX[s.prevailingWind]] += 1;

  const threats: Threat[] = [];
  for (let k = 1; k < 4; k++) {
    const seat = (me + k) % 4;
    threats.push(readOpponent(s, seat, persona.skill));
  }

  return {
    s,
    me,
    persona,
    rng,
    unseen,
    unseenTotal: unseen.reduce((a, b) => a + b, 0),
    turnsLeft: s.wall.length / 4,
    valueWeight,
    valueTiles: valueTileIndices(s.prevailingWind, pl.seatWind),
    threats,
  };
}

// Read an opponent's likely fan and readiness from their exposed melds and discards
function readOpponent(s: TableState, seat: number, skill: number): Threat {
  const pl = s.players[seat];
  const melds = pl.melds;
  const m = melds.length;
  const discarded = new Set(pl.discards.map((t) => tileIndex(t.type)));

  let pTenpai = [0.03, 0.12, 0.32, 0.62, 0.9][Math.min(m, 4)];
  // Concealed hands also get ready as the hand goes on
  pTenpai = Math.min(0.92, pTenpai + Math.max(0, pl.discards.length - 5) * 0.03);

  const valueOf = (idx: number) => {
    let v = idx >= 31 ? 1 : 0;
    if (idx >= 27 && idx <= 30) {
      if (idx === WIND_INDEX[pl.seatWind]) v++;
      if (idx === WIND_INDEX[s.prevailingWind]) v++;
    }
    return v;
  };

  let fan = 1;
  let honorMelds = 0;
  const meldSuits = new Set<number>();
  let allPungs = m >= 2;
  for (const meld of melds) {
    const idx = tileIndex(meld.tiles[0].type);
    if (meld.type !== 'chi') fan += valueOf(idx);
    else allPungs = false;
    if (idx >= 27) honorMelds++;
    else meldSuits.add(Math.floor(idx / 9));
  }

  let flushSuit: number | null = null;
  // Skilled players read flushes from melds and from which suit an opponent stopped discarding
  if (m >= 2 && meldSuits.size === 1) {
    const suit = [...meldSuits][0];
    const suitDiscards = pl.discards.filter((t) => tileIndex(t.type) < 27 && Math.floor(tileIndex(t.type) / 9) === suit).length;
    const looksFlush = suitDiscards <= 1 || skill < 0.5;
    if (looksFlush) {
      flushSuit = suit;
      fan += honorMelds > 0 ? 3 : 5; // half flush, or a good chance of a full flush
    }
  }
  if (allPungs) fan += 2;

  return { seat, pTenpai, fan: Math.min(10, fan), flushSuit, discarded };
}

// Chance that `idx` is the tile an opponent is waiting on, given they're tenpai
function dealInChance(ctx: Ctx, idx: number, th: Threat): number {
  const left = ctx.unseen[idx];
  let p: number;
  if (idx >= 27) {
    p = [0, 0.012, 0.03, 0.05, 0.05][left];
  } else {
    const v = idx % 9;
    p = v === 0 || v === 8 ? 0.04 : v === 1 || v === 7 ? 0.055 : 0.07;
    if (left === 0) p *= 0.5; // only a sequence wait remains possible
    // Suji: a tile 3 away that they discarded makes a two-sided wait less likely
    const suitStart = Math.floor(idx / 9) * 9;
    const hasSuji =
      (v >= 3 && th.discarded.has(suitStart + v - 3)) || (v <= 5 && th.discarded.has(suitStart + v + 3));
    if (hasSuji) p *= 0.6;
  }
  // No furiten in these rules, but a tile they threw is still less likely to be their wait
  if (th.discarded.has(idx)) p *= 0.3;
  if (th.flushSuit !== null) {
    if (idx < 27 && Math.floor(idx / 9) === th.flushSuit) p *= 2.4;
    else if (idx < 27) p *= 0.12;
    else p *= 1.2;
  }
  return Math.min(0.5, p);
}

// Expected points lost by discarding tile `idx`
function danger(ctx: Ctx, idx: number): number {
  let d = 0;
  for (const th of ctx.threats) d += th.pTenpai * dealInChance(ctx, idx, th) * 10 * th.fan;
  return d;
}

// ---------------------------------------------------------------------------
// Hand value
// ---------------------------------------------------------------------------

// Chance to finish a hand `sh` tiles from tenpai
function pWin(ctx: Ctx, sh: number, useful: number): number {
  if (sh < 0) return 1;
  const base = [0.62, 0.4, 0.24, 0.13, 0.065, 0.03, 0.012, 0.005, 0.002][Math.min(sh, 8)];
  const ukeFactor = Math.min(1.3, Math.max(0.5, 0.55 + useful / 24));
  const time = Math.min(1, Math.max(0, ctx.turnsLeft / (2.5 * (sh + 1))));
  return base * ukeFactor * time;
}

// Weight a fan value by the persona's appetite for big hands
function biasFan(ctx: Ctx, fan: number): number {
  return fan <= 1 ? fan : 1 + (fan - 1) * ctx.persona.valueBias;
}

function usefulCount(ctx: Ctx, counts: number[], meldCount: number, base: number): number {
  let n = 0;
  for (let i = 0; i < 34; i++) {
    if (ctx.unseen[i] === 0 || counts[i] >= 4) continue;
    counts[i]++;
    if (shantenFromCounts(counts, meldCount) < base) n += ctx.unseen[i];
    counts[i]--;
  }
  return n;
}

// Exact expected points of a tenpai hand from its waits
function tenpaiValue(ctx: Ctx, tiles: Tile[], melds: Meld[]): number {
  const pl = ctx.s.players[ctx.me];
  let waits = 0;
  let ronWaits = 0;
  let fanTsumo = 0;
  let fanRon = 0;
  for (let i = 0; i < 34; i++) {
    const n = ctx.unseen[i];
    if (n === 0) continue;
    const hypo = createHypotheticalTile(ALL_TILE_TYPES[i] as TileType);
    if (!isWinningShape([...tiles, hypo], melds)) continue;
    const common = { prevailingWind: ctx.s.prevailingWind, seatWind: pl.seatWind };
    const tsumo = evaluateWin([...tiles, hypo], melds, hypo, { ...common, isSelfDraw: true });
    const ron = evaluateWin(tiles, melds, hypo, { ...common, isSelfDraw: false });
    waits += n;
    fanTsumo += n * (tsumo.isWin ? tsumo.totalFan : 0);
    if (ron.isWin) {
      ronWaits += n;
      fanRon += n * ron.totalFan;
    }
  }
  if (waits === 0) return 0.2;
  const share = waits / Math.max(20, ctx.unseenTotal);
  const draws = Math.max(0.5, ctx.turnsLeft);
  const pTsumo = 1 - Math.pow(1 - share, draws);
  const pRon = ronWaits > 0 ? 1 - Math.pow(1 - share * 0.5 * (ronWaits / waits), draws * 3) : 0;
  // Waits with no fan on a discard: the formula above overrates self-draw alone
  const survival = 0.72 * (ronWaits === 0 ? TSUMO_ONLY_TENPAI : 1);
  const evTsumo = pTsumo * 15 * biasFan(ctx, fanTsumo / waits);
  const evRon = ronWaits > 0 ? (1 - pTsumo) * pRon * 10 * biasFan(ctx, fanRon / ronWaits) : 0;
  return survival * (evTsumo + evRon);
}

// Ready on waits with no fan on a discard (self-draw only): the tenpai formula overrates winning by
// self-draw alone, so discount it. Tuned in head-to-head simulation (0.35 and 0.6 play about equally; no discount is weaker).
const TSUMO_ONLY_TENPAI = 0.35;

// A shape with no fan only finishes by self-draw: a fraction of the finishing chances of a hand
// that can also win on discards, paid 1.5× (15 per fan instead of 10). Tuned in head-to-head
// simulation: 0.2-0.35 play equally well, higher is weaker; 0.2 keeps bots on fan routes most.
const SELF_DRAW_ONLY_SHARE = 0.2 * 1.5;

// Fan the speed route is likely to carry: value pungs, value pairs, Common Hand chance
function speedFan(ctx: Ctx, counts: number[], melds: Meld[]): number {
  let fan = 0;
  let hasNonValuePung = false;
  for (const m of melds) {
    if (m.type === 'chi') continue;
    const w = ctx.valueWeight[tileIndex(m.tiles[0].type)];
    if (w > 0) fan += w;
    else hasNonValuePung = true;
  }
  let concealedTriplets = 0;
  for (let i = 0; i < 34; i++) {
    const w = ctx.valueWeight[i];
    if (w > 0 && counts[i] >= 3) fan += w;
    else if (w > 0 && counts[i] === 2) fan += 0.4 * w;
    else if (counts[i] >= 3) concealedTriplets++;
  }
  // Common Hand needs four sequences, so an exposed pung of a plain tile rules it out
  if (!hasNonValuePung) fan += concealedTriplets > 0 ? 0.3 : 0.7;
  // With no fan source the hand can only win by self-draw (1 fan): far fewer chances to finish
  return Math.max(fan, 0.3);
}

// Expected points of a 3n+1 hand (13-tile equivalent) on its best route
function handValue(ctx: Ctx, tiles: Tile[], melds: Meld[]): number {
  const counts = toCounts(tiles);
  const m = melds.length;
  const sh = shantenFromCounts(counts, m);
  if (sh <= 0) return tenpaiValue(ctx, tiles, melds);

  const useful = usefulCount(ctx, counts, m, sh);
  // Speed route. Under the 1-fan minimum a finished shape needs a fan to win on a discard:
  // aim for the fastest shape that has one (Common Hand, a value triplet, ...). A shape with no
  // fan can only win by self-draw: far fewer chances to finish, at 1 fan.
  const routes = fanShantenFromCounts(counts, meldShapes(melds), ctx.valueTiles, ctx.unseen);
  let best = Number.isFinite(routes.fan)
    ? biasFan(ctx, speedFan(ctx, counts, melds)) * pWin(ctx, Math.max(0, routes.fan), useful) * 11
    : 0;
  if (routes.fan > sh) best = Math.max(best, SELF_DRAW_ONLY_SHARE * pWin(ctx, sh, useful) * 11);

  // Flush routes: only when melds allow it and the hand already leans that way
  const meldSuit = (mm: Meld) => {
    const idx = tileIndex(mm.tiles[0].type);
    return idx >= 27 ? -1 : Math.floor(idx / 9);
  };
  let honorsInHand = 0;
  for (let i = 27; i < 34; i++) honorsInHand += counts[i];
  const honorMelds = melds.filter((mm) => meldSuit(mm) === -1);
  for (let suit = 0; suit < 3; suit++) {
    if (melds.some((mm) => meldSuit(mm) !== -1 && meldSuit(mm) !== suit)) continue;
    let inSuit = 0;
    for (let i = suit * 9; i < suit * 9 + 9; i++) inSuit += counts[i];
    inSuit += melds.filter((mm) => meldSuit(mm) === suit).length * 3;
    const honors = honorsInHand + honorMelds.length * 3;
    if (inSuit + honors < 8) continue;

    const valueHonorFan = speedFanHonorsOnly(ctx, counts, melds);
    // Half flush: keep this suit and honors
    const half = counts.map((c, i) => (i >= 27 || Math.floor(i / 9) === suit ? c : 0));
    const shHalf = shantenFromCounts(half, m);
    best = Math.max(best, biasFan(ctx, 3 + valueHonorFan) * pWin(ctx, shHalf, 12) * 11);
    // Full flush: this suit only
    if (honorMelds.length === 0 && inSuit >= 9) {
      const full = counts.map((c, i) => (i < 27 && Math.floor(i / 9) === suit ? c : 0));
      const shFull = shantenFromCounts(full, m);
      best = Math.max(best, biasFan(ctx, 7) * pWin(ctx, shFull, 12) * 11);
    }
  }

  // All Triplets route: no chows allowed
  if (!melds.some((mm) => mm.type === 'chi')) {
    let trips = melds.length;
    let pairs = 0;
    for (let i = 0; i < 34; i++) {
      if (counts[i] >= 3) trips++;
      else if (counts[i] === 2) pairs++;
    }
    const shP = Math.max(0, 8 - 2 * trips - Math.min(pairs, 5 - trips));
    best = Math.max(best, biasFan(ctx, 3 + speedFanHonorsOnly(ctx, counts, melds)) * pWin(ctx, shP, 10) * 11);
  }
  return best;
}

function speedFanHonorsOnly(ctx: Ctx, counts: number[], melds: Meld[]): number {
  let fan = 0;
  for (const m of melds) {
    if (m.type !== 'chi') fan += ctx.valueWeight[tileIndex(m.tiles[0].type)];
  }
  for (let i = 27; i < 34; i++) {
    if (counts[i] >= 3) fan += ctx.valueWeight[i];
    else if (counts[i] === 2) fan += 0.4 * ctx.valueWeight[i];
  }
  return fan;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

function gaussian(rng: Rng): number {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Judgement error: noise proportional to the size of the decision, larger for weaker players
function noise(ctx: Ctx, scale: number): number {
  return gaussian(ctx.rng) * (1 - ctx.persona.skill) * 0.12 * Math.max(0.2, Math.abs(scale));
}

function defenseWeight(ctx: Ctx): number {
  if (ctx.rng() < ctx.persona.recklessness) return 0;
  return ctx.persona.caution * (0.5 + 0.5 * ctx.persona.skill);
}

// Best discard from a 3n+2 hand: expected hand value after it, minus weighted danger
function bestDiscard(ctx: Ctx, hand: Tile[], melds: Meld[]): { tile: Tile; utility: number } {
  const dw = defenseWeight(ctx);
  const seen = new Set<string>();
  const options: { tile: Tile; utility: number }[] = [];
  for (const t of hand) {
    if (seen.has(t.type)) continue;
    seen.add(t.type);
    const rest = hand.filter((x) => x.id !== t.id);
    options.push({ tile: t, utility: handValue(ctx, rest, melds) - dw * danger(ctx, tileIndex(t.type)) });
  }
  const scale = Math.max(...options.map((o) => Math.abs(o.utility)));
  let best = options[0];
  let bestNoisy = -Infinity;
  for (const o of options) {
    const noisy = o.utility + noise(ctx, scale);
    if (noisy > bestNoisy) {
      bestNoisy = noisy;
      best = o;
    }
  }
  return best;
}

export function decideTurn(s: TableState, p: number, persona: Persona, rng: Rng = Math.random): TurnDecision {
  const opts = getTurnOptions(s, p);
  if (!opts) throw new Error(`bot ${p} asked to act out of turn`);
  // Always take a legal self-draw win
  if (opts.win) return { type: 'tsumo' };

  const ctx = buildCtx(s, p, persona, rng);
  const pl = s.players[p];
  const discard = bestDiscard(ctx, pl.hand, pl.melds);

  let bestKong: { candidate: KongCandidate; utility: number } | null = null;
  for (const k of opts.kongs) {
    let rest: Tile[];
    let melds: Meld[];
    let robRisk = 0;
    if (k.type === 'an_gang') {
      rest = pl.hand.filter((t) => t.type !== k.tiles[0].type);
      melds = [...pl.melds, { id: 'hypo', type: 'an_gang', tiles: pl.hand.filter((t) => t.type === k.tiles[0].type) }];
    } else if (k.type === 'bu_gang') {
      rest = pl.hand.filter((t) => t.id !== k.tiles[0].id);
      melds = pl.melds.map((m) => (m.id === k.meld.id ? { ...m, type: 'bu_gang' as const, tiles: [...m.tiles, k.tiles[0]] } : m));
      // Another player could rob the added tile
      robRisk = danger(ctx, tileIndex(k.tiles[0].type)) * persona.caution;
    } else continue;
    // The replacement draw is worth about one extra useful draw
    const v = handValue(ctx, rest, melds);
    const u = v + 0.8 - robRisk + noise(ctx, v);
    if (!bestKong || u > bestKong.utility) bestKong = { candidate: k, utility: u };
  }
  if (bestKong && bestKong.utility >= discard.utility) return { type: 'kong', candidate: bestKong.candidate };
  return { type: 'discard', tileId: discard.tile.id };
}

export function decideClaim(
  s: TableState,
  q: number,
  opts: ClaimOptions,
  persona: Persona,
  rng: Rng = Math.random
): ClaimDecision {
  // Always take a legal win on a discard
  if (opts.win) return { type: 'hu' };
  if (!opts.pung && !opts.kong && opts.chi.length === 0) return { type: 'pass' };

  const ctx = buildCtx(s, q, persona, rng);
  const pl = s.players[q];
  const tile = s.claim!.tile;
  const noCall = handValue(ctx, pl.hand, pl.melds);
  let best: { decision: ClaimDecision; utility: number } = { decision: { type: 'pass' }, utility: noCall };

  const afterCall = (fromHand: Tile[], type: Meld['type']) => {
    const ids = new Set(fromHand.map((t) => t.id));
    const rest = pl.hand.filter((t) => !ids.has(t.id));
    const melds: Meld[] = [...pl.melds, { id: 'hypo', type, tiles: [...fromHand, tile] }];
    return { rest, melds };
  };

  // A call must beat not calling by the persona's relative margin
  const bar = best.utility + Math.max(0.05, Math.abs(best.utility)) * persona.callThreshold;
  if (opts.kong) {
    const { rest, melds } = afterCall(opts.kong, 'ming_gang');
    const v = handValue(ctx, rest, melds);
    const u = v + 0.8 + noise(ctx, v);
    if (u > bar && (best.decision.type === 'pass' || u > best.utility)) best = { decision: { type: 'kong' }, utility: u };
  }
  if (opts.pung) {
    const { rest, melds } = afterCall(opts.pung, 'peng');
    const u = bestDiscard(ctx, rest, melds).utility;
    if (u > bar && (best.decision.type === 'pass' || u > best.utility)) best = { decision: { type: 'pung' }, utility: u };
  }
  for (const combo of opts.chi) {
    const fromHand = combo.filter((t) => t.id !== tile.id);
    const { rest, melds } = afterCall(fromHand, 'chi');
    const u = bestDiscard(ctx, rest, melds).utility;
    if (u > bar && (best.decision.type === 'pass' || u > best.utility)) best = { decision: { type: 'chi', tiles: combo }, utility: u };
  }
  return best.decision;
}
