/**
 * Scoring tests against the official TVB tables (Appendix I points, Appendix III fan list).
 * Expected values are written out by hand from the tournament rules, not derived from the code,
 * so any change that drifts from the tournament's scoring fails here.
 *
 *   bun test scripts/
 */
import { describe, expect, test } from 'bun:test';
import { Meld, Tile, Wind } from '../src/types/mahjong';
import { createFullDeck } from '../src/utils/mahjongTiles';
import { DESIGNATED_HANDS, calculatePointsDelta, evaluateWin } from '../src/utils/rulesEngine';

// Official Appendix III: code -> fan
const OFFICIAL_FAN: Record<string, number> = {
  A1: 1, A2: 1, A3: 1, A4: 1, A5: 1, A6: 1, A7: 1, A8: 1,
  B1: 3, B2: 3, B3: 4, B4: 5, B5: 7,
  X1: 8, X2: 10, X3: 10, X4: 10,
};

// Build tiles from type names, never using more than the 4 real copies of a tile
function tiles(...types: string[]) {
  const deck = createFullDeck();
  const take = (type: string): Tile => {
    const i = deck.findIndex((t) => t.type === type);
    if (i < 0) throw new Error(`no ${type} left`);
    return deck.splice(i, 1)[0];
  };
  return { list: types.map(take), take };
}

interface Case {
  hand: string[]; // concealed tiles, NOT including the winning tile
  win: string; // winning tile
  melds?: { type: Meld['type']; tiles: string[] }[];
  selfDraw?: boolean;
  prevailing?: Wind;
  seat?: Wind;
  underTheSea?: boolean;
  kongDraw?: boolean;
}

function score(c: Case) {
  const { list: hand, take } = tiles(...c.hand);
  const melds: Meld[] = (c.melds ?? []).map((m, i) => ({ id: `m${i}`, type: m.type, tiles: m.tiles.map(take) }));
  const winTile = take(c.win);
  const ctx = {
    isSelfDraw: !!c.selfDraw,
    prevailingWind: c.prevailing ?? 'E',
    seatWind: c.seat ?? 'S',
    isUnderTheSea: c.underTheSea,
    isSelfDrawOnKong: c.kongDraw,
  };
  // Self-draw: the drawn tile is already in hand; discard win: it is passed separately
  const ev = c.selfDraw ? evaluateWin([...hand, winTile], melds, winTile, ctx) : evaluateWin(hand, melds, winTile, ctx);
  return { ...ev, codes: ev.fanDetails.map((f) => f.code).sort() };
}

describe('official tables', () => {
  test('every designated hand has its official fan value, and no others exist', () => {
    const actual = Object.fromEntries(Object.values(DESIGNATED_HANDS).map((h) => [h.code, h.fan]));
    expect(actual).toEqual(OFFICIAL_FAN);
  });

  test('Appendix I points: discard win and self-draw, 1 to 10 fan', () => {
    for (let fan = 1; fan <= 10; fan++) {
      // Winner seat 2; discarder seat 0
      expect(calculatePointsDelta(fan, false, 2, 0)).toEqual([-10 * fan, 0, 10 * fan, 0]);
      expect(calculatePointsDelta(fan, true, 2, null)).toEqual([-5 * fan, -5 * fan, 15 * fan, -5 * fan]);
    }
  });
});

describe('each designated hand (prevailing East, seat South unless stated)', () => {
  test('A1 Common Hand: four sequences + a suit pair', () => {
    const r = score({ hand: ['1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '2tong', '3tong', '4tong', '5tong'], win: '5tong' });
    expect(r.codes).toEqual(['A1']);
    expect(r.totalFan).toBe(1);
  });

  test('A1 Common Hand also allows an honor pair', () => {
    const r = score({ hand: ['1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '2tong', '3tong', '4tong', 'wind_N'], win: 'wind_N' });
    expect(r.codes).toEqual(['A1']);
  });

  test('A2 Self-Draw: a 0-fan hand cannot win on a discard, but wins by self-draw for 1 fan', () => {
    const zeroFan: Case = { hand: ['1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7tong', '8tong', '9tong', '2wan', '2wan', '2wan', '5tiao'], win: '5tiao' };
    expect(score(zeroFan).isWin).toBe(false);
    const r = score({ ...zeroFan, selfDraw: true });
    expect(r.isWin).toBe(true);
    expect(r.codes).toEqual(['A2']);
    expect(r.totalFan).toBe(1);
  });

  test('A3 Prevailing Wind Triplet', () => {
    const r = score({ hand: ['wind_E', 'wind_E', 'wind_E', '1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '5tong'], win: '5tong' });
    expect(r.codes).toEqual(['A3']);
  });

  test('A4 Seat Wind Triplet', () => {
    const r = score({ hand: ['wind_S', 'wind_S', 'wind_S', '1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '5tong'], win: '5tong' });
    expect(r.codes).toEqual(['A4']);
  });

  test('a wind that is both seat and prevailing scores A3 and A4', () => {
    const r = score({ hand: ['wind_E', 'wind_E', 'wind_E', '1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '5tong'], win: '5tong', seat: 'E' });
    expect(r.codes).toEqual(['A3', 'A4']);
    expect(r.totalFan).toBe(2);
  });

  test('a wind that is neither seat nor prevailing scores nothing', () => {
    const r = score({ hand: ['wind_W', 'wind_W', 'wind_W', '1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '5tong'], win: '5tong' });
    expect(r.isWin).toBe(false);
  });

  test('A5 Under the Sea', () => {
    const r = score({ hand: ['1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '2tong', '3tong', '4tong', '5tong'], win: '5tong', underTheSea: true });
    expect(r.codes).toEqual(['A1', 'A5']);
  });

  test('A6 Self-Draw on Kong (with A2 Self-Draw)', () => {
    const r = score({
      hand: ['1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '5tong'],
      melds: [{ type: 'an_gang', tiles: ['dragon_C', 'dragon_C', 'dragon_C', 'dragon_C'] }],
      win: '5tong',
      selfDraw: true,
      kongDraw: true,
    });
    expect(r.codes).toEqual(['A2', 'A6', 'A7']);
    expect(r.totalFan).toBe(3);
  });

  test('A7 A Triplet of Dragon Tiles', () => {
    const r = score({ hand: ['dragon_C', 'dragon_C', 'dragon_C', '1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '5tong'], win: '5tong' });
    expect(r.codes).toEqual(['A7']);
  });

  test('A8 Second Triplet of Dragon Tiles', () => {
    const r = score({ hand: ['dragon_C', 'dragon_C', 'dragon_C', 'dragon_F', 'dragon_F', 'dragon_F', '1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '5tong'], win: '5tong' });
    expect(r.codes).toEqual(['A7', 'A8']);
    expect(r.totalFan).toBe(2);
  });

  test('B1 All Triplets', () => {
    const r = score({ hand: ['1wan', '1wan', '1wan', '5tiao', '5tiao', '5tiao', '9tong', '9tong', '9tong', '2wan', '2wan', '2wan', '3tiao'], win: '3tiao' });
    expect(r.codes).toEqual(['B1']);
    expect(r.totalFan).toBe(3);
  });

  test('B2 Half Flush', () => {
    const r = score({ hand: ['1tiao', '2tiao', '3tiao', '4tiao', '5tiao', '6tiao', '7tiao', '8tiao', '9tiao', 'wind_W', 'wind_W', 'wind_W', '5tiao'], win: '5tiao' });
    expect(r.codes).toEqual(['B2']);
    expect(r.totalFan).toBe(3);
  });

  test('B3 Little Three Dragons replaces the dragon triplets (no A7/A8)', () => {
    const r = score({ hand: ['dragon_C', 'dragon_C', 'dragon_C', 'dragon_F', 'dragon_F', 'dragon_F', 'dragon_B', '1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao'], win: 'dragon_B' });
    expect(r.codes).toEqual(['B3']);
    expect(r.totalFan).toBe(4);
  });

  test('B4 Little Four Winds replaces the wind triplets (no A3/A4)', () => {
    const r = score({ hand: ['wind_E', 'wind_E', 'wind_E', 'wind_S', 'wind_S', 'wind_S', 'wind_W', 'wind_W', 'wind_W', 'wind_N', '1wan', '2wan', '3wan'], win: 'wind_N' });
    // Winds + one suit is also a Half Flush
    expect(r.codes).toEqual(['B2', 'B4']);
    expect(r.totalFan).toBe(8);
  });

  test('B5 Full Flush (here also a Common Hand)', () => {
    const r = score({ hand: ['1tiao', '2tiao', '3tiao', '4tiao', '5tiao', '6tiao', '7tiao', '8tiao', '9tiao', '2tiao', '3tiao', '4tiao', '5tiao'], win: '5tiao' });
    expect(r.codes).toEqual(['A1', 'B5']);
    expect(r.totalFan).toBe(8);
  });

  test('X1 Big Three Dragons replaces the dragon triplets (no A7/A8)', () => {
    const r = score({ hand: ['dragon_C', 'dragon_C', 'dragon_C', 'dragon_F', 'dragon_F', 'dragon_F', 'dragon_B', 'dragon_B', 'dragon_B', '1wan', '2wan', '3wan', '5tiao'], win: '5tiao' });
    expect(r.codes).toEqual(['X1']);
    expect(r.totalFan).toBe(8);
  });

  test('X2 Big Four Winds (no A3/A4), capped at 10', () => {
    const r = score({ hand: ['wind_E', 'wind_E', 'wind_E', 'wind_S', 'wind_S', 'wind_S', 'wind_W', 'wind_W', 'wind_W', 'wind_N', 'wind_N', 'wind_N', '5wan'], win: '5wan' });
    expect(r.codes).toContain('X2');
    expect(r.codes).not.toContain('A3');
    expect(r.codes).not.toContain('A4');
    expect(r.totalFan).toBe(10);
  });

  test('X3 Thirteen Orphans', () => {
    const r = score({ hand: ['1wan', '9wan', '1tiao', '9tiao', '1tong', '9tong', 'wind_E', 'wind_S', 'wind_W', 'wind_N', 'dragon_C', 'dragon_F', 'dragon_B'], win: '1wan' });
    expect(r.codes).toEqual(['X3']);
    expect(r.totalFan).toBe(10);
  });

  test('X4 All Honors, capped at 10', () => {
    const r = score({ hand: ['wind_E', 'wind_E', 'wind_E', 'wind_N', 'wind_N', 'wind_N', 'dragon_C', 'dragon_C', 'dragon_C', 'dragon_F', 'dragon_F', 'dragon_F', 'wind_W'], win: 'wind_W' });
    expect(r.codes).toContain('X4');
    expect(r.totalFan).toBe(10);
  });
});

describe('what is and is not a winning hand', () => {
  test('a Kong counts as a triplet', () => {
    const r = score({
      hand: ['1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7tong', '8tong', '9tong', '5tiao'],
      melds: [{ type: 'ming_gang', tiles: ['dragon_C', 'dragon_C', 'dragon_C', 'dragon_C'] }],
      win: '5tiao',
    });
    expect(r.isWin).toBe(true);
    expect(r.codes).toEqual(['A7']);
  });

  test('exposed melds count toward the hand (exposed pung kills Common Hand)', () => {
    const r = score({
      hand: ['1wan', '2wan', '3wan', '4tiao', '5tiao', '6tiao', '7tong', '8tong', '9tong', '5tiao'],
      melds: [{ type: 'peng', tiles: ['2wan', '2wan', '2wan'] }],
      win: '5tiao',
    });
    expect(r.isWin).toBe(false);
  });

  test('seven pairs is not a designated hand', () => {
    const r = score({ hand: ['1wan', '1wan', '3wan', '3wan', '5tiao', '5tiao', '7tiao', '7tiao', '2tong', '2tong', '8tong', '8tong', 'wind_E'], win: 'wind_E' });
    expect(r.isWin).toBe(false);
  });

  test('an incomplete hand is not a win', () => {
    const r = score({ hand: ['1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7tiao', '8tiao', '9tiao', '2tong', '3tong', '5tong', '5tong'], win: '9tong' });
    expect(r.isWin).toBe(false);
  });
});
