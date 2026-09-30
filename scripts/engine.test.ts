/**
 * Rule tests for the table engine.   bun test scripts/
 */
import { describe, expect, test } from 'bun:test';
import { Tile, Meld } from '../src/types/mahjong';
import { createFullDeck } from '../src/utils/mahjongTiles';
import {
  TableState,
  dealHand,
  discard,
  getTurnOptions,
  getClaimOptions,
  resolveClaims,
  declareKong,
  declareSelfDraw,
  playersWithClaimOptions,
  checkInvariants,
  FALSE_WIN_PENALTY_EACH,
} from '../src/engine/table';

// Build a table from tile type lists. Unlisted tiles go to the wall (then to discards to make room).
function table(opts: {
  hands: (string[] | null)[]; // null = 13 filler tiles that can't interact with the test's tiles
  melds?: { player: number; type: Meld['type']; tiles: string[] }[];
  wall?: string[]; // front of wall first; remaining tiles are appended unless wallExact
  wallExact?: boolean;
  active: number;
}): TableState {
  const pool = createFullDeck();
  const take = (type: string): Tile => {
    const i = pool.findIndex((t) => t.type === type);
    if (i < 0) throw new Error(`no ${type} left`);
    return pool.splice(i, 1)[0];
  };
  const s = dealHand(0, [0, 0, 0, 0], () => 0.5);
  s.players.forEach((p) => {
    p.hand = [];
    p.melds = [];
    p.discards = [];
  });
  (opts.melds ?? []).forEach((m, k) => {
    s.players[m.player].melds.push({ id: `m${k}`, type: m.type, tiles: m.tiles.map(take) });
  });
  opts.hands.forEach((h, i) => {
    if (h) s.players[i].hand = h.map(take);
  });
  // Filler: never a tile type the test uses; prefer types at least 3 away from any used suited tile.
  // At most 2 copies of a type, so fillers can't pung/kong the test's tiles or win on them.
  const used = new Set<string>();
  const near = new Set<string>();
  const mark = (type: string) => {
    used.add(type);
    const m = type.match(/^(\d)(wan|tiao|tong)$/);
    if (m) for (let d = -2; d <= 2; d++) near.add(`${Number(m[1]) + d}${m[2]}`);
  };
  opts.hands.forEach((h) => h?.forEach(mark));
  (opts.melds ?? []).forEach((m) => m.tiles.forEach(mark));
  (opts.wall ?? []).forEach(mark);
  opts.hands.forEach((h, i) => {
    if (h) return;
    const perType: Record<string, number> = {};
    const hand: Tile[] = [];
    for (const strict of [true, false]) {
      for (let k = 0; k < pool.length && hand.length < 13; ) {
        const t = pool[k];
        const ok = !used.has(t.type) && (!strict || !near.has(t.type)) && (perType[t.type] ?? 0) < 2;
        if (ok) {
          perType[t.type] = (perType[t.type] ?? 0) + 1;
          hand.push(pool.splice(k, 1)[0]);
        } else k++;
      }
    }
    if (hand.length < 13) throw new Error('not enough filler tiles');
    s.players[i].hand = hand;
  });
  const wall = (opts.wall ?? []).map(take);
  if (opts.wallExact) {
    // Park the rest in discards so tile counts stay at 136
    s.players[3].discards.push(...pool.splice(0));
  }
  s.wall = [...wall, ...pool];
  s.active = opts.active;
  s.phase = 'turn';
  s.claim = null;
  return s;
}


describe('claim priority', () => {
  test('Hu goes to the first winner in turn order after the discarder', () => {
    // Players 2 and 3 both win on 5tong (dragon triplet for fan); player 1 discards
    const waitHand = ['dragon_C', 'dragon_C', 'dragon_C', '1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7tiao', '8tiao', '9tiao', '5tong'];
    const waitHand2 = ['dragon_F', 'dragon_F', 'dragon_F', '1tiao', '2tiao', '3tiao', '4wan', '5wan', '6wan', '7wan', '8wan', '9wan', '5tong'];
    let s = table({
      hands: [['4tong', '4tong', '6tong', '6tong', '7tong', '7tong', '8tong', '8tong', 'wind_E', 'wind_E', 'dragon_B', 'dragon_B', 'dragon_B'], ['5tong', '1tong', '1tong', '2tong', '2tong', '3tong', '3tong', 'wind_S', 'wind_S', 'wind_W', 'wind_W', 'wind_N', 'wind_N', '9tong'], waitHand, waitHand2],
      active: 1,
    });
    s = discard(s, 1, s.players[1].hand.find((t) => t.type === '5tong')!.id);
    expect(playersWithClaimOptions(s).sort()).toEqual([2, 3]);
    s = resolveClaims(s, [undefined, undefined, { type: 'hu' }, { type: 'hu' }]);
    expect(s.phase).toBe('ended');
    expect(s.result!.winner).toBe(2);
    expect(s.result!.payer).toBe(1);
  });

  test('Pung/Kong outranks Chi across players', () => {
    // Player 3 discards 5tong. Player 0 (next seat) can chi 4-5-6; player 2 holds 5tong pair.
    const s0 = table({
      hands: [
        ['4tong', '6tong', '1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7wan', '8wan', '9wan', 'wind_E', 'wind_S'],
        ['1tiao', '2tiao', '3tiao', '7tiao', '8tiao', '9tiao', '1wan', '1wan', 'wind_W', 'wind_W', 'dragon_C', 'dragon_F', 'dragon_B'],
        ['5tong', '5tong', '2wan', '3wan', '4wan', '2tiao', '3tiao', '4tiao', '9tong', '9tong', 'wind_N', 'wind_N', 'dragon_C'],
        ['5tong', '1tong', '1tong', '2tong', '3tong', '7tong', '8tong', '9tong', 'wind_E', 'wind_S', 'wind_W', 'dragon_F', 'dragon_B', 'wind_N'],
      ],
      active: 3,
    });
    let s = discard(s0, 3, s0.players[3].hand.find((t) => t.type === '5tong')!.id);
    const o0 = getClaimOptions(s, 0)!;
    const o2 = getClaimOptions(s, 2)!;
    expect(o0.chi.length).toBeGreaterThan(0);
    expect(o2.pung).not.toBeNull();
    s = resolveClaims(s, [{ type: 'chi', tiles: o0.chi[0] }, undefined, { type: 'pung' }]);
    expect(s.active).toBe(2);
    expect(s.players[2].melds[0].type).toBe('peng');
    expect(s.players[3].discards.some((t) => t.type === '5tong')).toBe(false);
    // Caller must discard: no win/kong this turn
    expect(getTurnOptions(s, 2)!.kongs.length).toBe(0);
    expect(getTurnOptions(s, 2)!.win).toBeNull();
    expect(checkInvariants(s)).toEqual([]);
  });

  test('Chi is only offered to the next seat', () => {
    const s0 = table({
      hands: [
        ['4tong', '6tong', '1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7wan', '8wan', '9wan', 'wind_E', 'wind_S'],
        ['4tong', '6tong', '1tiao', '2tiao', '3tiao', '7tiao', '8tiao', '9tiao', 'wind_W', 'wind_W', 'dragon_C', 'dragon_F', 'dragon_B'],
        null,
        null,
      ],
      active: 1,
    });
    // Player 1's discard: player 2 is next. Player 0 must not get chi.
    const s = discard(
      { ...s0, players: s0.players.map((p, i) => (i === 1 ? { ...p, hand: [...p.hand, s0.wall[0]] } : p)), wall: s0.wall.slice(1) },
      1,
      s0.players[1].hand[0].id
    );
    expect(getClaimOptions(s, 0)!.chi.length).toBe(0);
  });
});

describe('end of wall', () => {
  test('the last discard can only be claimed to win, and scores Under the Sea', () => {
    let s = table({
      hands: [
        ['5tong', '5tong', '1wan', '2wan', '3wan', 'dragon_C', 'dragon_C', 'dragon_C', '7wan', '8wan', '9wan', '4tiao', '4tiao'],
        ['5tong', '4tong', '6tong', '1tiao', '2tiao', '3tiao', '7tiao', '8tiao', '9tiao', 'wind_W', 'wind_W', 'wind_N', 'wind_N', '9tong'],
        null,
        null,
      ],
      wall: [],
      wallExact: true,
      active: 1,
    });
    s = discard(s, 1, s.players[1].hand.find((t) => t.type === '4tiao' || t.type === '9tong')!.id);
    // Player 0 holds a 5tong pair, but with the wall empty only a win may be claimed
    s = { ...s };
    const s2 = table({
      hands: [
        ['4tiao', '4tiao', '1wan', '2wan', '3wan', 'dragon_C', 'dragon_C', 'dragon_C', '7wan', '8wan', '9wan', '5tong', '5tong'],
        ['4tiao', '4tong', '6tong', '1tiao', '2tiao', '3tiao', '7tiao', '8tiao', '9tiao', 'wind_W', 'wind_W', 'wind_N', 'wind_N', '9tong'],
        null,
        null,
      ],
      wall: [],
      wallExact: true,
      active: 1,
    });
    let t = discard(s2, 1, s2.players[1].hand.find((x) => x.type === '4tiao')!.id);
    const o = getClaimOptions(t, 0)!;
    expect(o.pung).toBeNull();
    expect(o.kong).toBeNull();
    expect(o.win).not.toBeNull();
    expect(o.win!.fanDetails.some((f) => f.code === 'A5')).toBe(true);
    // Passing ends the hand as an exhaustive draw
    t = resolveClaims(t, []);
    expect(t.phase).toBe('ended');
    expect(t.result!.winner).toBeNull();
  });

  test('no Kong once the wall is empty', () => {
    const s = table({
      hands: [
        ['5tong', '5tong', '5tong', '5tong', '1wan', '2wan', '3wan', '7wan', '8wan', '9wan', '4tiao', '4tiao', 'wind_E', 'wind_S'],
        null,
        null,
        null,
      ],
      wall: [],
      wallExact: true,
      active: 0,
    });
    expect(getTurnOptions(s, 0)!.kongs.length).toBe(0);
  });
});

describe('kongs', () => {
  test('an added Kong can be robbed, and the Kong declarer pays', () => {
    let s = table({
      hands: [
        ['5tong', '1wan', '2wan', '3wan', '7wan', '8wan', '9wan', '4tiao', '5tiao', '6tiao', 'wind_E'],
        // Player 1 waits on 5tong with a dragon triplet
        ['dragon_C', 'dragon_C', 'dragon_C', '1tiao', '2tiao', '3tiao', '7tiao', '8tiao', '9tiao', '4tong', '6tong', 'wind_W', 'wind_W'],
        null,
        null,
      ],
      melds: [{ player: 0, type: 'peng', tiles: ['5tong', '5tong', '5tong'] }],
      active: 0,
    });
    const opts = getTurnOptions(s, 0)!;
    const bu = opts.kongs.find((k) => k.type === 'bu_gang')!;
    expect(bu).toBeDefined();
    s = declareKong(s, 0, bu);
    expect(s.phase).toBe('claim');
    expect(checkInvariants(s)).toEqual([]);
    const o1 = getClaimOptions(s, 1)!;
    expect(o1.win).not.toBeNull();
    expect(o1.pung).toBeNull();
    s = resolveClaims(s, [undefined, { type: 'hu' }]);
    expect(s.result!.winner).toBe(1);
    expect(s.result!.payer).toBe(0);
    expect(s.result!.isRobbingKong).toBe(true);
    expect(s.result!.pointsDelta).toEqual([-10, 10, 0, 0]);
  });

  test('an unrobbed added Kong completes and draws a replacement, scoring Self-Draw on Kong', () => {
    let s = table({
      hands: [
        ['5tong', '1wan', '2wan', '3wan', '7wan', '8wan', '9wan', '4tiao', '5tiao', '6tiao', 'wind_E'],
        null,
        null,
        null,
      ],
      melds: [{ player: 0, type: 'peng', tiles: ['5tong', '5tong', '5tong'] }],
      wall: ['1tiao', '2tiao'],
      active: 0,
    });
    // Put a winning replacement at the back of the wall
    const east = s.wall.findIndex((t) => t.type === 'wind_E');
    const [e] = s.wall.splice(east, 1);
    s.wall.push(e);
    s = declareKong(s, 0, getTurnOptions(s, 0)!.kongs[0]);
    s = resolveClaims(s, []);
    expect(s.phase).toBe('turn');
    expect(s.players[0].melds[0].type).toBe('bu_gang');
    expect(checkInvariants(s)).toEqual([]);
    const t = getTurnOptions(s, 0)!;
    expect(t.win).not.toBeNull();
    expect(t.win!.fanDetails.some((f) => f.code === 'A6')).toBe(true);
    s = declareSelfDraw(s, 0);
    expect(s.result!.winner).toBe(0);
  });
});

describe('false wins (strict mode)', () => {
  test('declaring a 0-fan hand on a discard costs 50 to each opponent and kills the hand', () => {
    let s = table({
      hands: [
        // 0 fan on a discard: sequences + a plain triplet
        ['1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7tong', '8tong', '9tong', '2wan', '2wan', '2wan', '5tiao'],
        ['5tiao', '1tiao', '9tiao', '1tong', '9tong', 'wind_E', 'wind_S', 'wind_W', 'wind_N', 'dragon_C', 'dragon_F', 'dragon_B', '9wan', '1wan'],
        null,
        null,
      ],
      active: 1,
    });
    s = discard(s, 1, s.players[1].hand.find((t) => t.type === '5tiao')!.id);
    const o = getClaimOptions(s, 0)!;
    expect(o.shapeComplete).toBe(true);
    expect(o.win).toBeNull();
    s = resolveClaims(s, [{ type: 'hu' }]);
    expect(s.phase).toBe('turn'); // play continues
    expect(s.players[0].isDead).toBe(true);
    expect(s.players.map((p) => p.score)).toEqual([
      -3 * FALSE_WIN_PENALTY_EACH,
      FALSE_WIN_PENALTY_EACH,
      FALSE_WIN_PENALTY_EACH,
      FALSE_WIN_PENALTY_EACH,
    ]);
    expect(checkInvariants(s)).toEqual([]);
  });
});
