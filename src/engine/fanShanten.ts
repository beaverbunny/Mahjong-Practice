/**
 * Fan-aware shanten for the TVB rules (minimum 1 fan to win on a discard).
 *
 * Plain shanten counts any 4 sets + a pair as a finished hand. Under these rules a hand that mixes
 * plain triplets and sequences with no value tile has 0 fan and can only win by self-draw, so
 * counting it as "ready" is misleading. Here shanten is the minimum over every route whose finished
 * hand is guaranteed at least 1 fan on a discard:
 *  - Common Hand (A1): four sequences + any pair, no pungs
 *  - a value triplet (A3/A4/A7/A8, and the Dragon/Wind hands built on them): any dragon, the seat
 *    wind or the prevailing wind
 *  - Half / Full Flush (B2/B5, All Honors X4): one suit plus honors only
 *  - All Triplets (B1)
 *  - Thirteen Orphans (X3)
 * Situational fan (Under the Sea, Self-Draw) is never assumed.
 *
 * Works on tile-index counts (see shanten.ts): wan 0-8, tiao 9-17, tong 18-26, winds 27-30, dragons 31-33.
 */
import { orphansShantenFromCounts, standardShantenFromCounts } from './shanten';

export interface MeldShape {
  kind: 'chi' | 'pung'; // kongs count as pungs
  index: number; // first tile's index
}

export const NO_FAN_ROUTE = Infinity;

// ---------------------------------------------------------------------------
// Common Hand: sequences only (plus one pair of anything)
// ---------------------------------------------------------------------------

// [sequences, partial sequences, pair, leftover tiles that can start a new block]
type SeqOption = [sets: number, taatsu: number, pair: 0 | 1, seeds: number];
const seqCache = new Map<number, SeqOption[]>();

// Non-dominated splits of one suit, or the honors (which can only form the pair). Leftover suit
// tiles are "seeds" that can grow into a new sequence; leftover honors can only seed the pair.
function sequenceOptions(all34: number[], start: number, len: number, isSuit: boolean): SeqOption[] {
  let key = isSuit ? 1 : 2;
  for (let i = 0; i < len; i++) key = key * 5 + all34[start + i];
  const cached = seqCache.get(key);
  if (cached) return cached;

  const c = all34.slice(start, start + len);
  const found = new Map<string, SeqOption>();
  const search = (i: number, sets: number, taatsu: number, pair: 0 | 1, seeds: number) => {
    while (i < len && c[i] === 0) i++;
    if (i >= len) {
      const sd = Math.min(seeds, 4);
      found.set(`${sets},${taatsu},${pair},${sd}`, [sets, taatsu, pair, sd]);
      return;
    }
    if (isSuit && i <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      search(i, sets + 1, taatsu, pair, seeds);
      c[i]++; c[i + 1]++; c[i + 2]++;
    }
    // The only pair allowed is the eyes; a pair can't grow into a set on this route
    if (c[i] >= 2 && !pair) {
      c[i] -= 2;
      search(i, sets, taatsu, 1, seeds);
      c[i] += 2;
    }
    if (isSuit && i <= 7 && c[i + 1] > 0) {
      c[i]--; c[i + 1]--;
      search(i, sets, taatsu + 1, pair, seeds);
      c[i]++; c[i + 1]++;
    }
    if (isSuit && i <= 6 && c[i + 2] > 0) {
      c[i]--; c[i + 2]--;
      search(i, sets, taatsu + 1, pair, seeds);
      c[i]++; c[i + 2]++;
    }
    c[i]--;
    search(i, sets, taatsu, pair, seeds + 1);
    c[i]++;
  };
  search(0, 0, 0, 0, 0);

  const all = [...found.values()];
  const result = all.filter(
    (a) =>
      !all.some(
        (b) =>
          b !== a && b[2] === a[2] && b[0] >= a[0] && b[1] >= a[1] && b[3] >= a[3] &&
          (b[0] > a[0] || b[1] > a[1] || b[3] > a[3])
      )
  );
  seqCache.set(key, result);
  return result;
}

function commonHandShanten(counts: number[], melds: MeldShape[]): number {
  if (melds.some((m) => m.kind === 'pung')) return NO_FAN_ROUTE;
  const suits = [
    sequenceOptions(counts, 0, 9, true),
    sequenceOptions(counts, 9, 9, true),
    sequenceOptions(counts, 18, 9, true),
  ];
  const honors = sequenceOptions(counts, 27, 7, false);
  let best = NO_FAN_ROUTE;
  const m = melds.length;
  for (const a of suits[0])
    for (const b of suits[1])
      for (const c of suits[2])
        for (const d of honors) {
          const pair = a[2] + b[2] + c[2] + d[2];
          if (pair > 1) continue;
          const sets = Math.min(4, m + a[0] + b[0] + c[0]);
          const taatsu = a[1] + b[1] + c[1];
          const usable = Math.min(taatsu, 4 - sets);
          // Each missing block (and a missing pair) has to start from a leftover tile; with none
          // available, a junk tile must first be swapped for one (one extra draw each)
          const missingBlocks = 4 - sets - usable;
          const suitSeeds = a[3] + b[3] + c[3] + (taatsu - usable) * 2;
          const needed = missingBlocks + (pair ? 0 : 1);
          const available = suitSeeds + (pair ? 0 : Math.min(1, d[3]));
          const shortfall = Math.max(0, needed - available);
          best = Math.min(best, 8 - 2 * sets - usable - pair + shortfall);
        }
  return best;
}

// ---------------------------------------------------------------------------
// Value triplet: force a triplet of one value tile, the rest any shape
// ---------------------------------------------------------------------------

function valueTripletShanten(
  counts: number[],
  melds: MeldShape[],
  valueTiles: number[],
  obtainable: number[] | undefined
): number {
  let best = NO_FAN_ROUTE;
  for (const v of valueTiles) {
    if (melds.some((m) => m.kind === 'pung' && m.index === v)) {
      return standardShantenFromCounts(counts, melds.length);
    }
    const held = Math.min(counts[v], 3);
    const need = 3 - held;
    // Not enough copies left anywhere to complete this triplet
    if (obtainable && held + obtainable[v] < 3) continue;
    const rest = counts.slice();
    rest[v] -= held;
    // The forced triplet counts as a set; each missing copy is one more tile to draw
    const sh = standardShantenFromCounts(rest, melds.length + 1) + need;
    best = Math.min(best, sh);
  }
  return best;
}

// ---------------------------------------------------------------------------
// Half / Full Flush: only one suit plus honors
// ---------------------------------------------------------------------------

function flushShanten(counts: number[], melds: MeldShape[]): number {
  let best = NO_FAN_ROUTE;
  for (let suit = 0; suit < 3; suit++) {
    const ok = melds.every((m) => m.index >= 27 || Math.floor(m.index / 9) === suit);
    if (!ok) continue;
    const masked = counts.map((c, i) => (i >= 27 || Math.floor(i / 9) === suit ? c : 0));
    // Every off-suit tile must be swapped out (one draw each) before the hand can be ready
    let offSuit = 0;
    counts.forEach((c, i) => (offSuit += masked[i] === c ? 0 : c));
    best = Math.min(best, Math.max(standardShantenFromCounts(masked, melds.length), offSuit));
  }
  return best;
}

// ---------------------------------------------------------------------------
// All Triplets: four pungs + a pair
// ---------------------------------------------------------------------------

function allTripletsShanten(counts: number[], melds: MeldShape[]): number {
  if (melds.some((m) => m.kind === 'chi')) return NO_FAN_ROUTE;
  let triplets = melds.length;
  let pairs = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 3) triplets++;
    else if (counts[i] === 2) pairs++;
  }
  triplets = Math.min(triplets, 4);
  return 8 - 2 * triplets - Math.min(pairs, 5 - triplets);
}

// ---------------------------------------------------------------------------

export interface FanShantenResult {
  // Shanten toward a finish guaranteed at least 1 fan on a discard (Infinity if no route remains)
  fan: number;
  // Plain shape shanten (any 4 sets + pair, which may only win by self-draw)
  shape: number;
}

/**
 * @param counts concealed tiles as 34 counts
 * @param melds exposed melds
 * @param valueTiles honor indices worth a fan as a triplet for this player (dragons, seat and prevailing wind)
 * @param obtainable optional copies of each tile still obtainable (not visible elsewhere); used to
 *        rule out value triplets whose remaining copies are all gone
 */
export function fanShantenFromCounts(
  counts: number[],
  melds: MeldShape[],
  valueTiles: number[],
  obtainable?: number[]
): FanShantenResult {
  const shape = melds.length === 0
    ? Math.min(standardShantenFromCounts(counts, 0), orphansShantenFromCounts(counts))
    : standardShantenFromCounts(counts, melds.length);
  const fan = Math.min(
    commonHandShanten(counts, melds),
    valueTripletShanten(counts, melds, valueTiles, obtainable),
    flushShanten(counts, melds),
    allTripletsShanten(counts, melds),
    melds.length === 0 ? orphansShantenFromCounts(counts) : NO_FAN_ROUTE
  );
  // A fan route can never be faster than the plain shape
  return { fan: Math.max(fan, shape), shape };
}
