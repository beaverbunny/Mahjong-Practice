/**
 * Strategy guide tests: the fan-aware shanten must agree with the real scorer.
 *
 * Under the TVB minimum-1-fan rule, "tenpai" means some tile wins on a discard with >= 1 fan.
 * These tests compare the guide's fast calculation with brute force (try every winning tile
 * through evaluateWin) on a fixed, seeded sample of hands, plus known regression positions.
 *
 *   bun test scripts/
 */
import { describe, expect, test } from 'bun:test';
import { Meld, Tile, Wind } from '../src/types/mahjong';
import { createFullDeck } from '../src/utils/mahjongTiles';
import { evaluateWin } from '../src/utils/rulesEngine';
import {
  createHypotheticalTile,
  generateDiscardRecommendations,
  calculateTenpaiWaits,
} from '../src/utils/strategyEngine';
import { ALL_TILE_TYPES, shanten, tileIndex, toCounts } from '../src/engine/shanten';
import { fanShantenFromCounts, MeldShape } from '../src/engine/fanShanten';

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

const WIND_INDEX: Record<Wind, number> = { E: 27, S: 28, W: 29, N: 30 };
const SITUATIONS: [Wind, Wind][] = [['E', 'E'], ['E', 'S'], ['S', 'W'], ['N', 'E']];

// A random near-complete hand biased toward fan-relevant shapes (sequences, triplets, honors, one-suit)
function randomHand(rng: () => number) {
  const pool = createFullDeck();
  const grab = (type: string) => {
    const i = pool.findIndex((t) => t.type === type);
    return i < 0 ? null : pool.splice(i, 1)[0];
  };
  const suits = ['wan', 'tiao', 'tong'];
  const honors = ['wind_E', 'wind_S', 'wind_W', 'wind_N', 'dragon_C', 'dragon_F', 'dragon_B'];
  const lean = rng() < 0.25 ? suits[Math.floor(rng() * 3)] : null;
  const suit = () => (lean && rng() < 0.85 ? lean : suits[Math.floor(rng() * 3)]);
  const tiles: Tile[] = [];
  const melds: Meld[] = [];
  for (let k = 0; k < 4; k++) {
    const r = rng();
    let set: (Tile | null)[];
    if (r < 0.5) {
      const s = suit();
      const v = 1 + Math.floor(rng() * 7);
      set = [0, 1, 2].map((d) => grab(`${v + d}${s}`));
    } else if (r < 0.75) {
      const s = suit();
      const v = 1 + Math.floor(rng() * 9);
      set = [0, 1, 2].map(() => grab(`${v}${s}`));
    } else {
      const h = honors[Math.floor(rng() * 7)];
      set = [0, 1, 2].map(() => grab(h));
    }
    if (set.includes(null)) return null;
    const full = set as Tile[];
    if (rng() < 0.25) melds.push({ id: `m${k}`, type: full[0].type === full[1].type ? 'peng' : 'chi', tiles: full });
    else tiles.push(...full);
  }
  const pairType = rng() < 0.3 ? honors[Math.floor(rng() * 7)] : `${1 + Math.floor(rng() * 9)}${suit()}`;
  const p1 = grab(pairType);
  const p2 = grab(pairType);
  if (!p1 || !p2) return null;
  tiles.push(p1, p2);
  return { tiles, melds, pool };
}

const shapesOf = (melds: Meld[]): MeldShape[] =>
  melds.map((m) => ({ kind: m.type === 'chi' ? 'chi' : 'pung', index: tileIndex(m.tiles[0].type) }));

// Brute force: some tile completes this 3n+1 hand with >= 1 fan when won on a discard
function canWinOnDiscard(hand: Tile[], melds: Meld[], pw: Wind, sw: Wind): boolean {
  if (shanten(hand, melds.length) > 0) return false; // not even shape-tenpai
  return ALL_TILE_TYPES.some(
    (type) =>
      evaluateWin(hand, melds, createHypotheticalTile(type), { isSelfDraw: false, prevailingWind: pw, seatWind: sw }).isWin
  );
}

describe('fan-aware shanten agrees with the scorer', () => {
  test('tenpai: matches brute force on 1,500 seeded hands', () => {
    const rng = mulberry32(2026);
    let checked = 0;
    let fanTenpai = 0;
    let shapeOnlyTenpai = 0;
    const mismatches: string[] = [];
    for (let k = 0; checked < 1500; k++) {
      const r = randomHand(rng);
      if (!r) continue;
      const [pw, sw] = SITUATIONS[k % 4];
      const hand = [...r.tiles];
      hand.splice(Math.floor(rng() * hand.length), 1);
      // Sometimes swap a tile for a random one, so not every hand is ready
      if (rng() < 0.4) hand.splice(Math.floor(rng() * hand.length), 1, r.pool.splice(Math.floor(rng() * r.pool.length), 1)[0]);
      const res = fanShantenFromCounts(toCounts(hand), shapesOf(r.melds), [31, 32, 33, WIND_INDEX[sw], WIND_INDEX[pw]]);
      const brute = canWinOnDiscard(hand, r.melds, pw, sw);
      checked++;
      if (res.fan <= 0) fanTenpai++;
      if (res.shape <= 0 && res.fan > 0) shapeOnlyTenpai++;
      if ((res.fan <= 0) !== brute) mismatches.push(hand.map((t) => t.type).join(' '));
    }
    expect(mismatches).toEqual([]);
    // The sample must actually exercise both kinds of tenpai
    expect(fanTenpai).toBeGreaterThan(300);
    expect(shapeOnlyTenpai).toBeGreaterThan(100);
  }, 120_000);

  test('one away: reachable fan tenpai matches brute force on seeded hands', () => {
    const rng = mulberry32(77);
    let checked = 0;
    const mismatches: string[] = [];
    for (let k = 0; checked < 120; k++) {
      const r = randomHand(rng);
      if (!r) continue;
      const [pw, sw] = SITUATIONS[k % 4];
      const hand = [...r.tiles];
      hand.splice(Math.floor(rng() * hand.length), 1);
      hand.splice(Math.floor(rng() * hand.length), 1, r.pool.splice(Math.floor(rng() * r.pool.length), 1)[0]);
      const res = fanShantenFromCounts(toCounts(hand), shapesOf(r.melds), [31, 32, 33, WIND_INDEX[sw], WIND_INDEX[pw]]);
      if (res.fan < 1 || res.fan > 2) continue;
      checked++;
      // Brute force: is there a draw + discard that reaches fan tenpai?
      let reachable = false;
      outer: for (const type of ALL_TILE_TYPES) {
        const drawn = { ...createHypotheticalTile(type), id: `drawn_${type}` };
        const h14 = [...hand, drawn];
        for (let d = 0; d < h14.length; d++) {
          if (canWinOnDiscard(h14.filter((_, i) => i !== d), r.melds, pw, sw)) {
            reachable = true;
            break outer;
          }
        }
      }
      if ((res.fan === 1) !== reachable) mismatches.push(`${hand.map((t) => t.type).join(' ')} fan=${res.fan}`);
    }
    expect(mismatches).toEqual([]);
  }, 120_000);
});

describe('wait list labels', () => {
  test('each wait is marked self-draw only exactly when it cannot win on a discard', () => {
    const rng = mulberry32(4242);
    let waitsChecked = 0;
    let discardWins = 0;
    let selfDrawOnly = 0;
    const wrong: string[] = [];
    for (let k = 0; waitsChecked < 600; k++) {
      const r = randomHand(rng);
      if (!r) continue;
      const [pw, sw] = SITUATIONS[k % 4];
      const hand = [...r.tiles];
      hand.splice(Math.floor(rng() * hand.length), 1);
      for (const w of calculateTenpaiWaits(hand, r.melds, [], pw, sw)) {
        waitsChecked++;
        const ron = evaluateWin(hand, r.melds, createHypotheticalTile(w.tileType), {
          isSelfDraw: false,
          prevailingWind: pw,
          seatWind: sw,
        });
        if (ron.isWin) discardWins++;
        else selfDrawOnly++;
        if (!!w.selfDrawOnly === ron.isWin) wrong.push(`${hand.map((t) => t.type).join(' ')} wait ${w.tileType}`);
        // A discard-win wait shows the fan it scores on a discard (no assumed Self-Draw fan)
        if (ron.isWin && w.estimatedFan !== ron.totalFan) wrong.push(`fan ${w.tileType}: ${w.estimatedFan} vs ${ron.totalFan}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(discardWins).toBeGreaterThan(100);
    expect(selfDrawOnly).toBeGreaterThan(50);
  }, 120_000);
});

describe('guide regression positions', () => {
  function hand(...types: string[]) {
    const deck = createFullDeck();
    return types.map((type) => {
      const i = deck.findIndex((t) => t.type === type);
      return deck.splice(i, 1)[0];
    });
  }
  const recommend = (h: Tile[], pw: Wind = 'E', sw: Wind = 'E') =>
    generateDiscardRecommendations(h, [], h, pw, sw, [[], [], [], []], [false, false, false, false]);

  test('6-7-7 case: a draw that only makes a plain triplet is not a useful tile', () => {
    // Only fan available is Common Hand; drawing 7wan or 2tong makes a 0-fan triplet shape
    const h = hand('1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7tong', '8tong', '6wan', '7wan', '7wan', '2tong', '2tong', '9tiao');
    const top = recommend(h)[0];
    expect(top.tile.type).toBe('9tiao');
    expect(top.shantenAfter).toBe(1);
    expect(top.effectiveTileTypes.sort()).toEqual(['5wan', '6tong', '8wan', '9tong'].sort());
    expect(top.effectiveTilesCount).toBe(16);
    expect(top.selfDrawOnlyTileTypes?.sort()).toEqual(['2tong', '7wan'].sort());
  });

  test('a value-tile wait counts; a wait that only makes a plain triplet is marked self-draw only', () => {
    // 中中 555萬 234條 789筒 11萬: 中 completes a dragon triplet (fan), 1萬 a plain triplet (no fan)
    const h = hand('dragon_C', 'dragon_C', '5wan', '5wan', '5wan', '2tiao', '3tiao', '4tiao', '7tong', '8tong', '9tong', '1wan', '1wan', '9tiao');
    const top = recommend(h, 'E', 'S')[0];
    expect(top.tile.type).toBe('9tiao');
    expect(top.shantenAfter).toBe(0);
    const waits = calculateTenpaiWaits(h.filter((t) => t.id !== top.tile.id), [], [], 'E', 'S');
    const byType = Object.fromEntries(waits.map((w) => [w.tileType, !!w.selfDrawOnly]));
    expect(byType).toEqual({ dragon_C: false, '1wan': true });
  });
});
