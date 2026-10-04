/**
 * Pure mahjong table engine for the TVB competition rules.
 *
 * Every legal action goes through here, for the human player, the bots and the headless
 * simulator alike. Functions never mutate their input; each returns a new TableState.
 *
 * Rules implemented (TVB Appendix I & III, otherwise traditional Cantonese):
 * - 16 hands; the dealer passes every hand, after a win or an exhaustive draw.
 * - A win needs at least 1 Fan from the designated list (evaluateWin).
 * - Claims on a discard: Hu (first in turn order from the discarder) > Kong/Pung > Chi (next seat only).
 * - The last discard (wall empty) may only be claimed to win.
 * - A Kong needs a replacement tile, so no Kong once the wall is empty.
 * - An added Kong (bu_gang) can be robbed: another player may win on the added tile,
 *   paid by the Kong declarer like a discard win.
 * - After Chi/Pung the caller must discard (no self-draw win or Kong that turn).
 * - False win (strict mode): the declarer pays 50 to each opponent and can't win for the rest of the hand.
 */
import {
  Tile,
  Meld,
  Wind,
  PlayerState,
  FanDetail,
  TurnActionLog,
  WinEvaluation,
} from '../types/mahjong';
import { createFullDeck, shuffleDeck, sortTiles } from '../utils/mahjongTiles';
import {
  evaluateWin,
  calculatePointsDelta,
  getChiCombinations,
  getAnGangCandidates,
  getBuGangCandidates,
  checkThirteenOrphans,
  decomposeHand,
} from '../utils/rulesEngine';
import { shanten } from './shanten';

export const HANDS_PER_MATCH = 16;
export const FALSE_WIN_PENALTY_EACH = 50;
const WINDS: Wind[] = ['E', 'S', 'W', 'N'];

export type Phase = 'turn' | 'claim' | 'ended';

export interface PendingClaim {
  tile: Tile;
  from: number;
  // An added Kong waiting to see if anyone robs it
  robbingKong?: { meldId: string };
}

export type KongCandidate =
  | { type: 'an_gang'; tiles: Tile[] }
  | { type: 'bu_gang'; tiles: Tile[]; meld: Meld }
  | { type: 'ming_gang'; tiles: Tile[] };

export interface HandResult {
  winner: number | null; // null = exhaustive draw
  payer: number | null; // discarder or robbed Kong declarer; null on self-draw or draw
  isSelfDraw: boolean;
  isRobbingKong: boolean;
  winningTile: Tile | null;
  fanDetails: FanDetail[];
  totalFan: number;
  // Win payments plus any false-win penalties this hand
  pointsDelta: number[];
}

export interface TableState {
  handIndex: number; // 0-15
  dealer: number;
  prevailingWind: Wind;
  wall: Tile[];
  players: PlayerState[];
  active: number;
  phase: Phase;
  claim: PendingClaim | null;
  // About the active player's current tile
  turn: { kongDraw: boolean; justCalled: boolean };
  // False-win penalties already applied this hand
  penaltyDelta: number[];
  result: HandResult | null;
  log: TurnActionLog[];
  turnNumber: number;
}

export interface TurnOptions {
  win: WinEvaluation | null; // legal self-draw win
  shapeComplete: boolean; // hand forms a winning shape, legal or not (strict mode)
  kongs: KongCandidate[];
  canDiscard: boolean;
}

export interface ClaimOptions {
  win: WinEvaluation | null;
  shapeComplete: boolean;
  pung: Tile[] | null; // two tiles from hand
  kong: Tile[] | null; // three tiles from hand
  chi: Tile[][]; // each: two hand tiles + the discard, sorted
}

export type ClaimDecision =
  | { type: 'pass' }
  | { type: 'hu' }
  | { type: 'pung' }
  | { type: 'kong' }
  | { type: 'chi'; tiles: Tile[] };

export type Rng = () => number;

const PLAYER_NAMES = ['您 (玩家)', '下家 · 速攻型 (进阶)', '对家 · 稳健型 (大师)', '上家 · 防守型 (宗师)'];

export function seatWindFor(player: number, dealer: number): Wind {
  return WINDS[(player - dealer + 4) % 4];
}

export function prevailingWindFor(handIndex: number): Wind {
  return WINDS[Math.floor(handIndex / 4)];
}

// Seats in turn order after `from` (from+1, from+2, from+3)
export function seatsAfter(from: number): number[] {
  return [1, 2, 3].map((k) => (from + k) % 4);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function dealHand(
  handIndex: number,
  scores: number[],
  rng: Rng = Math.random,
  names: string[] = PLAYER_NAMES
): TableState {
  const deck = shuffleWith(createFullDeck(), rng);
  const dealer = handIndex % 4;
  const players: PlayerState[] = [0, 1, 2, 3].map((i) => ({
    id: `player_${i}`,
    name: names[i],
    isHuman: i === 0,
    seatWind: seatWindFor(i, dealer),
    hand: [],
    melds: [],
    discards: [],
    score: scores[i] ?? 0,
    startingScore: scores[i] ?? 0,
    isTenpai: false,
    tenpaiWaits: [],
    isDead: false,
  }));

  let ptr = 0;
  for (let k = 0; k < 4; k++) {
    const p = (dealer + k) % 4;
    const n = p === dealer ? 14 : 13;
    players[p].hand = sortTiles(deck.slice(ptr, ptr + n));
    ptr += n;
  }

  return {
    handIndex,
    dealer,
    prevailingWind: prevailingWindFor(handIndex),
    wall: deck.slice(ptr),
    players,
    active: dealer,
    phase: 'turn',
    claim: null,
    turn: { kongDraw: false, justCalled: false },
    penaltyDelta: [0, 0, 0, 0],
    result: null,
    log: [],
    turnNumber: 1,
  };
}

function shuffleWith(deck: Tile[], rng: Rng): Tile[] {
  if (rng === Math.random) return shuffleDeck(deck);
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Does the hand (concealed tiles, including the tile to win on) form 4 sets + a pair or 13 Orphans?
export function isWinningShape(concealed: Tile[], melds: Meld[]): boolean {
  if (concealed.length + melds.length * 3 !== 14) return false;
  if (melds.length === 0 && checkThirteenOrphans(concealed)) return true;
  return decomposeHand(concealed, melds).length > 0;
}

export function getTurnOptions(s: TableState, p: number): TurnOptions | null {
  if (s.phase !== 'turn' || s.active !== p) return null;
  const pl = s.players[p];
  const fresh = !s.turn.justCalled; // tile came from the wall (or the deal)

  let win: WinEvaluation | null = null;
  let shapeComplete = false;
  if (fresh) {
    // A player who false-won can't declare again this hand
    shapeComplete = !pl.isDead && isWinningShape(pl.hand, pl.melds);
    if (shapeComplete) {
      const ev = evaluateWin(pl.hand, pl.melds, pl.hand[pl.hand.length - 1], {
        isSelfDraw: true,
        prevailingWind: s.prevailingWind,
        seatWind: pl.seatWind,
        isUnderTheSea: s.wall.length === 0,
        isSelfDrawOnKong: s.turn.kongDraw,
      });
      if (ev.isWin) win = ev;
    }
  }

  const kongs: KongCandidate[] = [];
  if (fresh && s.wall.length > 0) {
    for (const tiles of getAnGangCandidates(pl.hand)) kongs.push({ type: 'an_gang', tiles });
    for (const { meld, tile } of getBuGangCandidates(pl.hand, pl.melds)) {
      kongs.push({ type: 'bu_gang', tiles: [tile], meld });
    }
  }

  return { win, shapeComplete, kongs, canDiscard: true };
}

export function getClaimOptions(s: TableState, q: number): ClaimOptions | null {
  if (s.phase !== 'claim' || !s.claim || s.claim.from === q) return null;
  const { tile, from, robbingKong } = s.claim;
  const pl = s.players[q];
  const withTile = [...pl.hand, tile];

  const shapeComplete = !pl.isDead && isWinningShape(withTile, pl.melds);
  let win: WinEvaluation | null = null;
  if (shapeComplete) {
    const ev = evaluateWin(pl.hand, pl.melds, tile, {
      isSelfDraw: false,
      prevailingWind: s.prevailingWind,
      seatWind: pl.seatWind,
      // Under the Sea applies to the discard of the last tile, not to a robbed Kong
      isUnderTheSea: !robbingKong && s.wall.length === 0,
    });
    if (ev.isWin) win = ev;
  }

  const empty: ClaimOptions = { win, shapeComplete, pung: null, kong: null, chi: [] };
  // A robbed Kong can only be claimed to win; so can the last discard
  if (robbingKong || s.wall.length === 0) return empty;

  const same = pl.hand.filter((t) => t.type === tile.type);
  return {
    ...empty,
    pung: same.length >= 2 ? same.slice(0, 2) : null,
    kong: same.length >= 3 ? same.slice(0, 3) : null,
    chi: q === (from + 1) % 4 ? getChiCombinations(pl.hand, tile) : [],
  };
}

// Players who have something to decide on the pending claim
export function playersWithClaimOptions(s: TableState): number[] {
  if (s.phase !== 'claim' || !s.claim) return [];
  return seatsAfter(s.claim.from).filter((q) => {
    const o = getClaimOptions(s, q);
    return !!o && (o.shapeComplete || !!o.pung || !!o.kong || o.chi.length > 0);
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function clonePlayers(s: TableState): PlayerState[] {
  return s.players.map((p) => ({
    ...p,
    hand: [...p.hand],
    melds: p.melds.map((m) => ({ ...m, tiles: [...m.tiles] })),
    discards: [...p.discards],
  }));
}

function logEntry(s: TableState, p: number, entry: Omit<TurnActionLog, 'turnNumber' | 'playerIndex' | 'playerName'>): TurnActionLog {
  return { turnNumber: s.turnNumber, playerIndex: p, playerName: s.players[p].name, ...entry };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Illegal action: ${msg}`);
}

export function discard(s: TableState, p: number, tileId: string, extraLog: Partial<TurnActionLog> = {}): TableState {
  const opts = getTurnOptions(s, p);
  assert(opts, `player ${p} can't discard now`);
  const players = clonePlayers(s);
  const pl = players[p];
  const idx = pl.hand.findIndex((t) => t.id === tileId);
  assert(idx >= 0, `tile ${tileId} not in hand`);
  const [tile] = pl.hand.splice(idx, 1);
  pl.hand = sortTiles(pl.hand);
  pl.discards.push(tile);
  pl.isTenpai = shanten(pl.hand, pl.melds.length) <= 0;

  return {
    ...s,
    players,
    phase: 'claim',
    claim: { tile, from: p },
    turn: { kongDraw: false, justCalled: false },
    log: [...s.log, logEntry(s, p, { action: 'discard', tile, ...extraLog })],
    turnNumber: s.turnNumber + 1,
  };
}

export function declareKong(s: TableState, p: number, candidate: KongCandidate): TableState {
  const opts = getTurnOptions(s, p);
  assert(opts, `player ${p} can't declare a Kong now`);
  assert(candidate.type !== 'ming_gang', 'exposed Kong is a claim on a discard');
  const legal = opts.kongs.some(
    (k) => k.type === candidate.type && k.tiles[0].type === candidate.tiles[0].type
  );
  assert(legal, `Kong of ${candidate.tiles[0].type} is not available`);

  const players = clonePlayers(s);
  const pl = players[p];

  if (candidate.type === 'an_gang') {
    const type = candidate.tiles[0].type;
    const tiles = pl.hand.filter((t) => t.type === type);
    assert(tiles.length === 4, 'concealed Kong needs 4 tiles');
    pl.hand = pl.hand.filter((t) => t.type !== type);
    const meld: Meld = { id: `meld_${p}_${s.turnNumber}_an`, type: 'an_gang', tiles };
    pl.melds.push(meld);
    const next: TableState = {
      ...s,
      players,
      log: [...s.log, logEntry(s, p, { action: 'gang', tile: tiles[0], meld, aiComment: '暗杠' })],
    };
    return drawReplacement(next, p);
  }

  // Added Kong: the tile leaves the hand now; others may rob it before the Kong completes
  const tile = candidate.tiles[0];
  const hIdx = pl.hand.findIndex((t) => t.id === tile.id);
  assert(hIdx >= 0, 'added Kong tile not in hand');
  pl.hand.splice(hIdx, 1);
  return {
    ...s,
    players,
    phase: 'claim',
    claim: { tile, from: p, robbingKong: { meldId: candidate.meld.id } },
    turn: { kongDraw: false, justCalled: false },
  };
}

function drawReplacement(s: TableState, p: number): TableState {
  // Callers only allow a Kong while the wall has tiles
  assert(s.wall.length > 0, 'no replacement tile');
  const wall = [...s.wall];
  const tile = wall.pop()!; // replacement from the back of the wall
  const players = s.players.map((pl, i) => (i === p ? { ...pl, hand: [...pl.hand, tile] } : pl));
  return {
    ...s,
    wall,
    players,
    active: p,
    phase: 'turn',
    claim: null,
    turn: { kongDraw: true, justCalled: false },
  };
}

function drawFromWall(s: TableState, p: number): TableState {
  if (s.wall.length === 0) return endHand(s, null, null, null, false, false, null);
  const [tile, ...wall] = s.wall;
  const players = s.players.map((pl, i) => (i === p ? { ...pl, hand: [...pl.hand, tile] } : pl));
  return {
    ...s,
    wall,
    players,
    active: p,
    phase: 'turn',
    claim: null,
    turn: { kongDraw: false, justCalled: false },
  };
}

// Self-draw win (or a false win attempt in strict mode)
export function declareSelfDraw(s: TableState, p: number): TableState {
  const opts = getTurnOptions(s, p);
  assert(opts, `player ${p} can't declare a win now`);
  const pl = s.players[p];
  if (!opts.win) return applyFalseWin(s, p);
  return endHand(s, p, null, pl.hand[pl.hand.length - 1], true, false, opts.win);
}

function applyFalseWin(s: TableState, p: number): TableState {
  const penaltyDelta = [...s.penaltyDelta];
  const players = clonePlayers(s);
  for (let i = 0; i < 4; i++) {
    const d = i === p ? -3 * FALSE_WIN_PENALTY_EACH : FALSE_WIN_PENALTY_EACH;
    penaltyDelta[i] += d;
    players[i].score += d;
  }
  players[p].isDead = true;
  return {
    ...s,
    players,
    penaltyDelta,
    log: [
      ...s.log,
      logEntry(s, p, {
        action: 'hu',
        aiComment: `诈胡！手牌不符合任何番种，罚付每家 ${FALSE_WIN_PENALTY_EACH} 点，本局不得再和牌`,
      }),
    ],
  };
}

/**
 * Resolve the pending claim once every player with options has decided.
 * `decisions[q]` is ignored for players without options; missing entries count as pass.
 */
export function resolveClaims(s: TableState, decisions: (ClaimDecision | undefined)[]): TableState {
  assert(s.phase === 'claim' && s.claim, 'no claim pending');
  const { tile, from, robbingKong } = s.claim;
  let state = s;

  // 1. Hu, first in turn order after the discarder
  for (const q of seatsAfter(from)) {
    if (decisions[q]?.type !== 'hu') continue;
    const opts = getClaimOptions(state, q);
    if (!opts) continue;
    if (opts.win) {
      return endHand(state, q, from, tile, false, !!robbingKong, opts.win);
    }
    state = applyFalseWin(state, q);
  }

  // 2. Kong / Pung (at most one player can hold a pair of this tile)
  for (const q of seatsAfter(from)) {
    const d = decisions[q];
    if (d?.type !== 'kong' && d?.type !== 'pung') continue;
    const opts = getClaimOptions(state, q);
    if (d.type === 'kong' && opts?.kong) return claimMeld(state, q, 'ming_gang', [...opts.kong, tile]);
    if (d.type === 'pung' && opts?.pung) return claimMeld(state, q, 'peng', [...opts.pung, tile]);
  }

  // 3. Chi, next seat only
  const next = (from + 1) % 4;
  const d = decisions[next];
  if (d?.type === 'chi') {
    const opts = getClaimOptions(state, next);
    const chosen = opts?.chi.find((c) => sameTileIds(c, d.tiles));
    if (chosen) return claimMeld(state, next, 'chi', chosen);
  }

  // 4. Nobody claims
  if (robbingKong) return completeAddedKong(state, from, tile, robbingKong.meldId);
  return drawFromWall({ ...state, claim: null }, next);
}

function sameTileIds(a: Tile[], b: Tile[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a.map((t) => t.id));
  return b.every((t) => ids.has(t.id));
}

function claimMeld(s: TableState, q: number, type: 'chi' | 'peng' | 'ming_gang', tiles: Tile[]): TableState {
  const { tile, from } = s.claim!;
  const players = clonePlayers(s);
  const pl = players[q];
  const fromHand = new Set(tiles.filter((t) => t.id !== tile.id).map((t) => t.id));
  pl.hand = pl.hand.filter((t) => !fromHand.has(t.id));
  const meld: Meld = {
    id: `meld_${q}_${s.turnNumber}_${type}`,
    type,
    tiles: sortTiles(tiles),
    fromPlayerIndex: from,
    calledTile: tile,
  };
  pl.melds.push(meld);
  // The claimed tile leaves the discarder's river
  const disc = players[from].discards;
  if (disc.length && disc[disc.length - 1].id === tile.id) disc.pop();

  const action = type === 'chi' ? 'chi' : type === 'peng' ? 'peng' : 'gang';
  const next: TableState = {
    ...s,
    players,
    active: q,
    phase: 'turn',
    claim: null,
    turn: { kongDraw: false, justCalled: true },
    log: [...s.log, logEntry(s, q, { action, tile, meld })],
  };
  return type === 'ming_gang' ? drawReplacement(next, q) : next;
}

function completeAddedKong(s: TableState, p: number, tile: Tile, meldId: string): TableState {
  const players = clonePlayers(s);
  const pl = players[p];
  const meld = pl.melds.find((m) => m.id === meldId);
  assert(meld && meld.type === 'peng', 'added Kong needs an exposed Pung');
  meld.type = 'bu_gang';
  meld.tiles = [...meld.tiles, tile];
  const next: TableState = {
    ...s,
    players,
    log: [...s.log, logEntry(s, p, { action: 'gang', tile, meld, aiComment: '补杠' })],
  };
  return drawReplacement(next, p);
}

function endHand(
  s: TableState,
  winner: number | null,
  payer: number | null,
  winningTile: Tile | null,
  isSelfDraw: boolean,
  isRobbingKong: boolean,
  ev: WinEvaluation | null
): TableState {
  const winDelta =
    winner !== null && ev
      ? calculatePointsDelta(ev.totalFan, isSelfDraw, winner, payer)
      : [0, 0, 0, 0];
  const players = s.players.map((pl, i) => ({ ...pl, score: pl.score + winDelta[i] }));
  const result: HandResult = {
    winner,
    payer,
    isSelfDraw,
    isRobbingKong,
    winningTile,
    fanDetails: ev?.fanDetails ?? [],
    totalFan: ev?.totalFan ?? 0,
    pointsDelta: winDelta.map((d, i) => d + s.penaltyDelta[i]),
  };
  const log =
    winner !== null
      ? [
          ...s.log,
          logEntry(s, winner, {
            action: 'hu' as const,
            tile: winningTile ?? undefined,
            aiComment: isRobbingKong ? '抢杠和！' : isSelfDraw ? '自摸！' : '和牌！',
          }),
        ]
      : s.log;
  return { ...s, players, phase: 'ended', claim: null, result, log };
}

// ---------------------------------------------------------------------------
// Invariants (used by the simulator and in development)
// ---------------------------------------------------------------------------

export function checkInvariants(s: TableState): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  let count = s.wall.length;
  s.wall.forEach((t) => ids.add(t.id));
  const claimTile = s.claim?.tile;
  s.players.forEach((pl, i) => {
    const tiles = [...pl.hand, ...pl.melds.flatMap((m) => m.tiles), ...pl.discards];
    count += tiles.length;
    tiles.forEach((t) => {
      if (ids.has(t.id)) errors.push(`duplicate tile ${t.id}`);
      ids.add(t.id);
    });
    const kongs = pl.melds.filter((m) => m.tiles.length === 4).length;
    const expected = pl.hand.length + pl.melds.length * 3;
    const want = s.phase === 'turn' && s.active === i ? 14 : 13;
    if (s.phase !== 'ended' && expected !== want) {
      errors.push(`player ${i} has ${expected} effective tiles, expected ${want} (${kongs} kongs)`);
    }
  });
  if (claimTile && s.claim?.robbingKong) {
    // The added-Kong tile is in limbo: count it once
    if (!ids.has(claimTile.id)) count += 1;
  }
  // A robbed Kong tile ends the hand as the winning tile, outside every hand and river
  if (s.phase === 'ended' && s.result?.isRobbingKong && s.result.winningTile && !ids.has(s.result.winningTile.id)) {
    count += 1;
  }
  if (count !== 136) errors.push(`tile count ${count} != 136`);
  const scoreSum = s.players.reduce((a, p) => a + p.score, 0);
  if (scoreSum !== 0) errors.push(`scores sum to ${scoreSum}`);
  return errors;
}
