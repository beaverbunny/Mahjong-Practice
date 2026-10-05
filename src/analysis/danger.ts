/**
 * Deal-in danger read for the human player, built only from what a player at the table can see:
 * each opponent's discards in order (and whether each came from the draw or from the hand),
 * their calls, every tile visible on the table and the viewer's own hand.
 *
 * Per opponent it estimates:
 *   - pReady: the chance they can win on a discard right now
 *   - for each tile, the chance it is one of their winning tiles (given they are ready)
 *   - fan: the likely size of their hand if you deal in
 * A tile's danger is the chance it wins for at least one opponent.
 *
 * The weights in ./dangerModel.ts are fitted on simulated Master games, where the hidden hands
 * are known (scripts/danger-calibrate.ts). The bots do not use this model.
 */
import { Meld, TileType, Wind } from '../types/mahjong';
import type { TableState } from '../engine/table';
import { tileIndex } from '../engine/shanten';
import { MODEL } from './dangerModel';

const WIND_INDEX: Record<Wind, number> = { E: 27, S: 28, W: 29, N: 30 };
const SUIT_NAMES = ['万', '条', '筒'];
// Tiles left in the wall after the deal (136 - 53)
const WALL_AFTER_DEAL = 83;

// ---------------------------------------------------------------------------
// Public view: everything the viewer may know, and nothing else
// ---------------------------------------------------------------------------

export interface PublicDiscard {
  idx: number; // tile index 0-33
  fromDraw: boolean; // threw the tile just drawn (摸切)
  afterCall: boolean; // the discard that follows a Chi/Pung (always from the hand)
  called: boolean; // someone claimed it
  order: number; // position in the table's action sequence
}

export interface PublicSeat {
  seat: number;
  seatWind: Wind;
  melds: { type: Meld['type']; idx: number }[]; // idx = lowest tile of the meld
  discards: PublicDiscard[];
  // Order of the last action that changed this player's concealed hand in a way others can see
  // (a discard from the hand, a call or a Kong). -1 if none yet.
  lastChange: number;
}

export interface PublicView {
  viewer: number;
  prevailingWind: Wind;
  wallLeft: number;
  seats: PublicSeat[];
  // Every discard in table order
  timeline: { seat: number; idx: number; order: number }[];
  // Copies of each tile type the viewer can see: rivers, melds and their own hand
  visible: number[];
}

export function publicView(s: TableState, viewer: number): PublicView {
  const seats: PublicSeat[] = s.players.map((p, i) => ({
    seat: i,
    seatWind: p.seatWind,
    melds: p.melds.map((m) => ({ type: m.type, idx: tileIndex(m.tiles[0].type) })),
    discards: [],
    lastChange: -1,
  }));
  const byId = new Map<string, PublicDiscard>();
  const timeline: PublicView['timeline'] = [];
  s.log.forEach((e, i) => {
    const seat = seats[e.playerIndex];
    if (e.action === 'discard' && e.tile) {
      const prev = s.log[i - 1];
      const afterCall = !!prev && prev.playerIndex === e.playerIndex && (prev.action === 'chi' || prev.action === 'peng');
      const d: PublicDiscard = { idx: tileIndex(e.tile.type), fromDraw: !!e.fromDraw, afterCall, called: false, order: i };
      seat.discards.push(d);
      byId.set(e.tile.id, d);
      timeline.push({ seat: e.playerIndex, idx: d.idx, order: i });
      if (!d.fromDraw) seat.lastChange = i;
    } else if (e.action === 'chi' || e.action === 'peng' || e.action === 'gang') {
      seat.lastChange = i;
      if (e.meld?.calledTile) {
        const d = byId.get(e.meld.calledTile.id);
        if (d) d.called = true;
      }
    }
  });

  const visible = new Array(34).fill(0);
  const add = (type: TileType) => visible[tileIndex(type)]++;
  for (const p of s.players) {
    p.discards.forEach((t) => add(t.type));
    p.melds.forEach((m) => m.tiles.forEach((t) => add(t.type)));
  }
  s.players[viewer].hand.forEach((t) => add(t.type));

  return { viewer, prevailingWind: s.prevailingWind, wallLeft: s.wall.length, seats, timeline, visible };
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const isHonor = (idx: number) => idx >= 27;
const suitOf = (idx: number) => Math.floor(idx / 9);
const valOf = (idx: number) => idx % 9; // 0-8
const isMiddle = (idx: number) => !isHonor(idx) && valOf(idx) >= 2 && valOf(idx) <= 6;
const fromHand = (d: PublicDiscard) => !d.fromDraw && !d.afterCall;

function valueTile(view: PublicView, o: number, idx: number): boolean {
  return idx >= 31 || idx === WIND_INDEX[view.seats[o].seatWind] || idx === WIND_INDEX[view.prevailingWind];
}

// The suit an opponent's melds commit them to, if they look like a flush
function flushSuitOf(st: PublicSeat): number | null {
  if (st.melds.length < 2) return null;
  const suits = new Set(st.melds.filter((m) => !isHonor(m.idx)).map((m) => suitOf(m.idx)));
  return suits.size === 1 ? [...suits][0] : null;
}

export const READY_FEATURES = [
  'm1', 'm2', 'm3', 'm4', 'turn', 'turn2', 'concealedTurn', 'recentHand', 'recentMiddle',
  'lastHand', 'streakBreak', 'drawStreak', 'valueMelds', 'wallGone',
] as const;

export function readyFeatures(view: PublicView, o: number): number[] {
  const st = view.seats[o];
  const ds = st.discards;
  const nd = ds.length;
  const m = st.melds.length;
  const last3 = ds.slice(-3);
  let drawStreak = 0;
  for (let i = nd - 1; i >= 0 && ds[i].fromDraw; i--) drawStreak++;
  const turn = nd / 10;
  const f: Record<(typeof READY_FEATURES)[number], number> = {
    m1: m >= 1 ? 1 : 0,
    m2: m >= 2 ? 1 : 0,
    m3: m >= 3 ? 1 : 0,
    m4: m >= 4 ? 1 : 0,
    turn,
    turn2: turn * turn,
    concealedTurn: m === 0 ? turn : 0,
    recentHand: last3.filter(fromHand).length / 3,
    recentMiddle: last3.filter((d) => fromHand(d) && isMiddle(d.idx)).length / 3,
    lastHand: nd > 0 && fromHand(ds[nd - 1]) ? 1 : 0,
    streakBreak: nd >= 3 && fromHand(ds[nd - 1]) && ds[nd - 2].fromDraw && ds[nd - 3].fromDraw ? 1 : 0,
    drawStreak: Math.min(drawStreak, 4) / 4,
    valueMelds: st.melds.filter((mm) => mm.type !== 'chi' && valueTile(view, o, mm.idx)).length,
    wallGone: 1 - view.wallLeft / WALL_AFTER_DEAL,
  };
  return READY_FEATURES.map((k) => f[k]);
}

export const WAIT_FEATURES = [
  'honorValue', 'honorPlain', 'term', 't28', 't37', 't456',
  'hUn1', 'hUn2', 'hUn3', 'sUn0', 'sUn1', 'sUn2', 'sUn3',
  'genbutsu', 'passed', 'sujiFull', 'sujiHalf', 'seqDead', 'seqAlive1',
  'flushIn', 'flushOff', 'suitShareLow', 'pungOnlyHonor', 'pungOnlySuited', 'nearLastHand', 'earlyNeighbor',
] as const;

export function waitFeatures(view: PublicView, o: number, idx: number): number[] {
  const st = view.seats[o];
  const honor = isHonor(idx);
  const v = valOf(idx);
  const suit = suitOf(idx);
  const unseen = Math.max(0, 4 - view.visible[idx]);
  const ownDiscarded = new Set(st.discards.map((d) => d.idx));

  // Went past since their hand last changed, and they didn't win on it
  const passed = view.timeline.some((t) => t.idx === idx && t.order > st.lastChange && t.seat !== o)
    || st.discards.some((d) => d.idx === idx && d.order > st.lastChange && d.fromDraw);

  let sujiFull = 0;
  let sujiHalf = 0;
  let seqAlive = 0;
  let nearLastHand = 0;
  let earlyNeighbor = 0;
  let suitShareLow = 0;
  if (!honor) {
    const partners = [v - 3, v + 3].filter((x) => x >= 0 && x <= 8).map((x) => suit * 9 + x);
    const hit = partners.filter((p) => ownDiscarded.has(p)).length;
    if (hit === partners.length) sujiFull = 1;
    else if (hit > 0) sujiHalf = 1;

    const free = (x: number) => x >= 0 && x <= 8 && view.visible[suit * 9 + x] < 4;
    if (free(v - 2) && free(v - 1)) seqAlive++;
    if (free(v - 1) && free(v + 1)) seqAlive++;
    if (free(v + 1) && free(v + 2)) seqAlive++;

    const lastHand = [...st.discards].reverse().find((d) => !d.fromDraw);
    if (lastHand && !isHonor(lastHand.idx) && suitOf(lastHand.idx) === suit) {
      const dv = Math.abs(valOf(lastHand.idx) - v);
      if (dv === 1 || dv === 2) nearLastHand = 1;
    }
    earlyNeighbor = st.discards.slice(0, 5).some((d) => {
      if (isHonor(d.idx) || suitOf(d.idx) !== suit) return false;
      const dv = Math.abs(valOf(d.idx) - v);
      return dv === 1 || dv === 2;
    })
      ? 1
      : 0;
    const suited = st.discards.filter((d) => !isHonor(d.idx));
    if (suited.length >= 6 && suited.filter((d) => suitOf(d.idx) === suit).length / suited.length < 0.12) suitShareLow = 1;
  }

  const fs = flushSuitOf(st);
  const pungOnly = st.melds.length >= 2 && st.melds.every((mm) => mm.type !== 'chi');
  const isVal = honor && valueTile(view, o, idx);
  const f: Record<(typeof WAIT_FEATURES)[number], number> = {
    honorValue: isVal ? 1 : 0,
    honorPlain: honor && !isVal ? 1 : 0,
    term: !honor && (v === 0 || v === 8) ? 1 : 0,
    t28: !honor && (v === 1 || v === 7) ? 1 : 0,
    t37: !honor && (v === 2 || v === 6) ? 1 : 0,
    t456: !honor && v >= 3 && v <= 5 ? 1 : 0,
    hUn1: honor && unseen === 1 ? 1 : 0,
    hUn2: honor && unseen === 2 ? 1 : 0,
    hUn3: honor && unseen === 3 ? 1 : 0,
    sUn0: !honor && unseen === 0 ? 1 : 0,
    sUn1: !honor && unseen === 1 ? 1 : 0,
    sUn2: !honor && unseen === 2 ? 1 : 0,
    sUn3: !honor && unseen === 3 ? 1 : 0,
    genbutsu: ownDiscarded.has(idx) ? 1 : 0,
    passed: passed ? 1 : 0,
    sujiFull,
    sujiHalf,
    seqDead: !honor && seqAlive === 0 ? 1 : 0,
    seqAlive1: !honor && seqAlive === 1 ? 1 : 0,
    flushIn: fs !== null && !honor && suit === fs ? 1 : 0,
    flushOff: fs !== null && !honor && suit !== fs ? 1 : 0,
    suitShareLow,
    pungOnlyHonor: pungOnly && honor ? 1 : 0,
    pungOnlySuited: pungOnly && !honor ? 1 : 0,
    nearLastHand,
    earlyNeighbor,
  };
  return WAIT_FEATURES.map((k) => f[k]);
}

export const FAN_FEATURES = ['valueMelds', 'flush', 'flushWithHonors', 'pungOnly', 'melds', 'concealed'] as const;

export function fanFeatures(view: PublicView, o: number): number[] {
  const st = view.seats[o];
  const fs = flushSuitOf(st);
  const f: Record<(typeof FAN_FEATURES)[number], number> = {
    valueMelds: st.melds.filter((mm) => mm.type !== 'chi' && valueTile(view, o, mm.idx)).length,
    flush: fs !== null ? 1 : 0,
    flushWithHonors: fs !== null && st.melds.some((mm) => isHonor(mm.idx)) ? 1 : 0,
    pungOnly: st.melds.length >= 2 && st.melds.every((mm) => mm.type !== 'chi') ? 1 : 0,
    melds: st.melds.length,
    concealed: st.melds.length === 0 ? 1 : 0,
  };
  return FAN_FEATURES.map((k) => f[k]);
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface LinearModel {
  bias: number;
  w: number[];
}

const dot = (m: LinearModel, x: number[]) => x.reduce((a, xi, i) => a + xi * m.w[i], m.bias);
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export const pReadyOf = (x: number[]) => sigmoid(dot(MODEL.ready, x));
export const pWaitOf = (x: number[]) => sigmoid(dot(MODEL.wait, x));
export const fanOf = (x: number[]) => Math.min(10, Math.max(1, dot(MODEL.fan, x)));

// Danger levels for the tile tags (chance the tile wins for someone)
export const LEVELS = { medium: MODEL.levels.medium, danger: MODEL.levels.danger };
export function levelOf(pct: number): 'safe' | 'medium' | 'danger' {
  return pct >= LEVELS.danger ? 'danger' : pct >= LEVELS.medium ? 'medium' : 'safe';
}

export interface OpponentRead {
  seat: number;
  pReady: number;
  fan: number; // likely fan if you deal in
  reasons: string[];
}

export interface TileDanger {
  type: TileType;
  pct: number; // chance it wins for at least one opponent
  level: 'safe' | 'medium' | 'danger';
  expectedLoss: number; // expected points lost (a discard win costs 10 per fan)
  bySeat: { seat: number; pct: number; fan: number }[];
  reasons: string[];
}

export interface DangerRead {
  opponents: OpponentRead[];
  tiles: Record<string, TileDanger>;
}

export function seatLabel(viewer: number, seat: number): string {
  return ['自己', '下家', '对家', '上家'][(seat - viewer + 4) % 4];
}

export function readDanger(view: PublicView, types: TileType[]): DangerRead {
  const opponents: OpponentRead[] = [];
  for (let o = 0; o < 4; o++) {
    if (o === view.viewer) continue;
    const x = readyFeatures(view, o);
    const fx = fanFeatures(view, o);
    opponents.push({ seat: o, pReady: pReadyOf(x), fan: fanOf(fx), reasons: readyReasons(view, o, x) });
  }

  const tiles: Record<string, TileDanger> = {};
  for (const type of new Set(types)) {
    const idx = tileIndex(type);
    let safe = 1;
    let expectedLoss = 0;
    const bySeat: TileDanger['bySeat'] = [];
    let top: { seat: number; pct: number; x: number[] } | null = null;
    for (const op of opponents) {
      const x = waitFeatures(view, op.seat, idx);
      const p = op.pReady * pWaitOf(x);
      safe *= 1 - p;
      expectedLoss += p * op.fan * 10;
      bySeat.push({ seat: op.seat, pct: p, fan: op.fan });
      if (!top || p > top.pct) top = { seat: op.seat, pct: p, x };
    }
    const pct = 1 - safe;
    tiles[type] = {
      type,
      pct,
      level: levelOf(pct),
      expectedLoss,
      bySeat,
      reasons: top ? waitReasons(view, top.seat, idx, top.x, pct) : [],
    };
  }
  return { opponents, tiles };
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

function readyReasons(view: PublicView, o: number, x: number[]): string[] {
  const st = view.seats[o];
  const f = Object.fromEntries(READY_FEATURES.map((k, i) => [k, x[i]]));
  const out: string[] = [];
  if (st.melds.length > 0) out.push(`${st.melds.length} 副露`);
  else if (st.discards.length >= 9) out.push(`门清已打 ${st.discards.length} 张（中后盘门清也常已听牌）`);
  if (f.streakBreak) out.push('连续摸切后突然手切');
  else if (f.drawStreak >= 0.75) out.push('连续摸切多张（手牌不再变化，可能已在等牌）');
  if (f.recentMiddle >= 2 / 3) out.push('最近手切中张');
  if (f.valueMelds > 0) out.push('已碰役牌（有番，可食糊）');
  const fs = flushSuitOf(st);
  if (fs !== null) out.push(`副露全是${SUIT_NAMES[fs]}子（一色方向）`);
  return out;
}

function waitReasons(view: PublicView, o: number, idx: number, x: number[], pct: number): string[] {
  const who = seatLabel(view.viewer, o);
  const st = view.seats[o];
  const f = Object.fromEntries(WAIT_FEATURES.map((k, i) => [k, x[i]]));
  const fs = flushSuitOf(st);
  const unseen = Math.max(0, 4 - view.visible[idx]);
  const safer: string[] = [];
  const riskier: string[] = [];
  // Only cite a signal when the fitted model says it really moves the odds that way
  const weight = (k: (typeof WAIT_FEATURES)[number]) => MODEL.wait.w[WAIT_FEATURES.indexOf(k)];
  const cite = (k: (typeof WAIT_FEATURES)[number], text: string) => {
    if (!f[k]) return;
    if (weight(k) <= -0.15) safer.push(text);
    else if (weight(k) >= 0.15) riskier.push(text);
  };
  cite('passed', `${who}手牌没变后此牌已打过，他没和（过张）`);
  cite('genbutsu', `${who}打过此牌（现物；本规则无振听，仍非绝对安全）`);
  cite('sujiFull', `筋牌：${who}打过筋张`);
  cite('sujiHalf', `半筋：${who}打过一侧筋张`);
  cite('seqDead', '壁：此牌已不能做顺子等张');
  cite('earlyNeighbor', `${who}早巡打过附近的牌`);
  if (fs !== null) {
    cite('flushOff', `${who}做${SUIT_NAMES[fs]}一色，此牌不是其花色`);
    cite('flushIn', `${who}副露全是${SUIT_NAMES[fs]}子，此牌正是他要的花色`);
  }
  if (!f.flushIn) cite('suitShareLow', `${who}几乎不打此花色（可能在做一色）`);
  if (isHonor(idx)) {
    if (unseen === 0) safer.push('此字牌已全部可见，无人能等');
    else if (unseen === 1) safer.push('此字牌只剩 1 张未见（只能单钓）');
    else if (unseen >= 3) riskier.push(`生张字牌：还有 ${unseen} 张未见`);
    cite('honorValue', `${who}的役牌字牌`);
    cite('pungOnlyHonor', `${who}全是碰（对对胡方向，字牌对碰/单钓）`);
  } else {
    if (f.t456 && !f.sujiFull && !f.seqDead) riskier.push('中张：两面等张最多');
    cite('pungOnlySuited', `${who}全是碰（对对胡方向，筋牌无效）`);
  }
  cite('nearLastHand', `靠近${who}最近手切的牌`);
  // Lead with what drives the number
  const lead = pct >= LEVELS.medium ? [...riskier, ...safer] : [...safer, ...riskier];
  return lead.slice(0, 3);
}
