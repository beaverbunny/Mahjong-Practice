import { Tile, TileType } from '../types/mahjong';

// Tile index 0-33: wan 0-8, tiao 9-17, tong 18-26, winds 27-30 (E S W N), dragons 31-33 (C F B)
export const ALL_TILE_TYPES: TileType[] = [
  '1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7wan', '8wan', '9wan',
  '1tiao', '2tiao', '3tiao', '4tiao', '5tiao', '6tiao', '7tiao', '8tiao', '9tiao',
  '1tong', '2tong', '3tong', '4tong', '5tong', '6tong', '7tong', '8tong', '9tong',
  'wind_E', 'wind_S', 'wind_W', 'wind_N',
  'dragon_C', 'dragon_F', 'dragon_B',
];

const TYPE_INDEX: Record<string, number> = Object.fromEntries(
  ALL_TILE_TYPES.map((t, i) => [t, i])
);

export function tileIndex(type: TileType | string): number {
  return TYPE_INDEX[type];
}

export function toCounts(tiles: Tile[]): number[] {
  const counts = new Array(34).fill(0);
  for (const t of tiles) counts[TYPE_INDEX[t.type]]++;
  return counts;
}

const ORPHAN_INDICES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

// A group option: sets, taatsu, and whether the eyes pair is taken inside this group
type GroupOption = [sets: number, taatsu: number, pair: 0 | 1];

const groupCache = new Map<number, GroupOption[]>();

// All non-dominated (sets, taatsu, pair) splits of one suit (9 counts) or the honors (7 counts),
// read from counts[start .. start+len)
function groupOptions(all34: number[], start: number, len: number, isSuit: boolean): GroupOption[] {
  let key = isSuit ? 1 : 2;
  for (let i = 0; i < len; i++) key = key * 5 + all34[start + i];
  const cached = groupCache.get(key);
  if (cached) return cached;

  const c = all34.slice(start, start + len);
  const n = c.length;
  const found = new Map<string, GroupOption>();

  const search = (i: number, sets: number, taatsu: number, pair: 0 | 1) => {
    while (i < n && c[i] === 0) i++;
    if (i >= n) {
      found.set(`${sets},${taatsu},${pair}`, [sets, taatsu, pair]);
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      search(i, sets + 1, taatsu, pair);
      c[i] += 3;
    }
    if (isSuit && i <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      search(i, sets + 1, taatsu, pair);
      c[i]++; c[i + 1]++; c[i + 2]++;
    }
    if (c[i] >= 2) {
      c[i] -= 2;
      if (!pair) search(i, sets, taatsu, 1);
      search(i, sets, taatsu + 1, pair);
      c[i] += 2;
    }
    if (isSuit && i <= 7 && c[i + 1] > 0) {
      c[i]--; c[i + 1]--;
      search(i, sets, taatsu + 1, pair);
      c[i]++; c[i + 1]++;
    }
    if (isSuit && i <= 6 && c[i + 2] > 0) {
      c[i]--; c[i + 2]--;
      search(i, sets, taatsu + 1, pair);
      c[i]++; c[i + 2]++;
    }
    c[i]--;
    search(i, sets, taatsu, pair);
    c[i]++;
  };
  search(0, 0, 0, 0);

  // Keep only options not dominated by another with the same pair flag and >= sets and taatsu.
  // (Options with and without the pair are both kept, since only one group may hold the eyes.)
  const all = [...found.values()];
  const result = all.filter(
    (a) =>
      !all.some(
        (b) =>
          b !== a &&
          b[2] === a[2] && b[0] >= a[0] && b[1] >= a[1] &&
          (b[0] > a[0] || b[1] > a[1])
      )
  );
  groupCache.set(key, result);
  return result;
}

// Exact standard-hand shanten from a 34-count array. -1 means a complete hand.
export function standardShantenFromCounts(counts: number[], meldCount: number): number {
  const g0 = groupOptions(counts, 0, 9, true);
  const g1 = groupOptions(counts, 9, 9, true);
  const g2 = groupOptions(counts, 18, 9, true);
  const g3 = groupOptions(counts, 27, 7, false);
  let best = 8;
  for (const a of g0) {
    for (const b of g1) {
      if (a[2] + b[2] > 1) continue;
      for (const c of g2) {
        if (a[2] + b[2] + c[2] > 1) continue;
        for (const d of g3) {
          const pair = a[2] + b[2] + c[2] + d[2];
          if (pair > 1) continue;
          // A hand holds at most 4 sets (matters when a caller forces an extra set, e.g. a value triplet)
          const sets = Math.min(4, meldCount + a[0] + b[0] + c[0] + d[0]);
          const taatsu = a[1] + b[1] + c[1] + d[1];
          const s = 8 - 2 * sets - Math.min(taatsu, 4 - sets) - pair;
          if (s < best) best = s;
        }
      }
    }
  }
  return best;
}

export function orphansShantenFromCounts(counts: number[]): number {
  let unique = 0;
  let pair = 0;
  for (const i of ORPHAN_INDICES) {
    if (counts[i] > 0) unique++;
    if (counts[i] >= 2) pair = 1;
  }
  return 13 - unique - pair;
}

// Shanten over all hand shapes the rules allow (standard hands and Thirteen Orphans).
// -1 = complete, 0 = tenpai.
export function shantenFromCounts(counts: number[], meldCount: number): number {
  const std = standardShantenFromCounts(counts, meldCount);
  if (meldCount > 0) return std;
  return Math.min(std, orphansShantenFromCounts(counts));
}

export function shanten(hand: Tile[], meldCount: number): number {
  return shantenFromCounts(toCounts(hand), meldCount);
}

// Tile types that lower the shanten of a 3n+1 hand, with how many copies are still unseen.
export function usefulTiles(
  counts: number[],
  meldCount: number,
  unseen: number[]
): { index: number; remaining: number }[] {
  const base = shantenFromCounts(counts, meldCount);
  const out: { index: number; remaining: number }[] = [];
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 4) continue;
    counts[i]++;
    const s = shantenFromCounts(counts, meldCount);
    counts[i]--;
    if (s < base) out.push({ index: i, remaining: Math.max(0, unseen[i]) });
  }
  return out;
}
