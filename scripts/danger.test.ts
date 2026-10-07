/**
 * Tests for the human-facing danger model (src/analysis/danger.ts) and the draw-vs-hand record.
 *
 * - The model only reads public information: redrawing every hidden tile never changes its output.
 * - Its numbers stay honest: on simulated Master games it ranks dangerous tiles well and its
 *   percentages match how often tiles really deal in.
 * - Bot play is pinned: the same seeds give the same games unless the bots are changed on purpose.
 *
 *   bun test scripts/
 */
import { describe, expect, test } from 'bun:test';
import { createFullDeck } from '../src/utils/mahjongTiles';
import {
  TableState,
  ClaimDecision,
  dealHand,
  getClaimOptions,
  playersWithClaimOptions,
  resolveClaims,
  declareSelfDraw,
  declareKong,
  discard,
} from '../src/engine/table';
import { decideTurn, decideClaim } from '../src/ai/brain';
import { samplePersona } from '../src/ai/personas';
import { publicView, readDanger } from '../src/analysis/danger';
import { ALL_TILE_TYPES } from '../src/engine/shanten';
import { runMatches } from './simulate';
import { collect, evaluateTiles, auc } from './danger-calibrate';

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

const DECK = createFullDeck();

// Redraw everything `viewer` cannot see, keeping hand sizes and wall length
function scrambleHidden(s: TableState, viewer: number, rng: () => number): TableState {
  const visible = new Set<string>();
  s.players[viewer].hand.forEach((t) => visible.add(t.id));
  s.players.forEach((p) => {
    p.melds.forEach((m) => m.tiles.forEach((t) => visible.add(t.id)));
    p.discards.forEach((t) => visible.add(t.id));
  });
  if (s.claim) visible.add(s.claim.tile.id);
  const pool = DECK.filter((t) => !visible.has(t.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const players = s.players.map((p, i) =>
    i === viewer ? p : { ...p, hand: pool.splice(0, p.hand.length), isTenpai: rng() < 0.5 }
  );
  return { ...s, players, wall: pool.splice(0, s.wall.length), turn: { ...s.turn, drawnId: null } };
}

// Play seeded Master hands and call `at` before every discard
function playHands(hands: number, seed: number, at: (s: TableState, p: number) => void) {
  const personaRng = mulberry32(seed);
  const personas = [0, 1, 2, 3].map(() => samplePersona('master', personaRng));
  const rng = mulberry32(seed * 7);
  for (let h = 0; h < hands; h++) {
    let s: TableState = dealHand(h, [0, 0, 0, 0], mulberry32(seed * 13 + h));
    while (s.phase !== 'ended') {
      if (s.phase === 'turn') {
        const p = s.active;
        const d = decideTurn(s, p, personas[p], rng);
        if (d.type === 'discard') at(s, p);
        s = d.type === 'tsumo' ? declareSelfDraw(s, p) : d.type === 'kong' ? declareKong(s, p, d.candidate) : discard(s, p, d.tileId);
      } else {
        const dec: (ClaimDecision | undefined)[] = [];
        for (const q of playersWithClaimOptions(s)) dec[q] = decideClaim(s, q, getClaimOptions(s, q)!, personas[q], rng);
        s = resolveClaims(s, dec);
      }
    }
  }
}

describe('danger model uses only what the player can see', () => {
  test('redrawing every hidden tile never changes the read', () => {
    let checked = 0;
    const changed: string[] = [];
    const rng = mulberry32(5);
    playHands(6, 404, (s, p) => {
      const types = ALL_TILE_TYPES;
      const real = JSON.stringify(readDanger(publicView(s, p), types));
      const alt = JSON.stringify(readDanger(publicView(scrambleHidden(s, p, rng), p), types));
      checked++;
      if (real !== alt) changed.push(`hand ${s.handIndex} turn ${s.turnNumber} viewer ${p}`);
    });
    expect(changed).toEqual([]);
    expect(checked).toBeGreaterThan(200);
  }, 60_000);
});

describe('danger model is accurate on simulated Master games', () => {
  test('ranks dealing-in tiles well and its percentages match reality', () => {
    const sample = collect(6, 7_000_000, true);
    const { pred, truth, old } = evaluateTiles(sample.tiles);
    const dealIns = truth.reduce((a, b) => a + b, 0);
    const predicted = pred.reduce((a, b) => a + b, 0);
    expect(pred.length).toBeGreaterThan(20_000);
    // 0.5 is a coin flip; the model scores about 0.88 and the old labeler about 0.59
    expect(auc(pred, truth)).toBeGreaterThan(0.82);
    expect(auc(pred, truth)).toBeGreaterThan(auc(old, truth) + 0.15);
    // Overall it predicts about as many deal-ins as really happen
    expect(predicted / dealIns).toBeGreaterThan(0.75);
    expect(predicted / dealIns).toBeLessThan(1.33);
    // Tiles called safe almost never deal in; tiles called dangerous often do
    const rate = (lo: number, hi: number) => {
      let n = 0;
      let y = 0;
      pred.forEach((q, i) => {
        if (q >= lo && q < hi) {
          n++;
          y += truth[i];
        }
      });
      return y / n;
    };
    expect(rate(0, 0.03)).toBeLessThan(0.012);
    expect(rate(0.08, 1.01)).toBeGreaterThan(0.08);
  }, 120_000);
});

describe('bot play is pinned', () => {
  test('bots play exactly the recorded games (UI, guide and danger-model changes must not move them)', () => {
    // Fingerprints of every action in these seeded matches. Only an intentional change to the bots
    // (src/ai/) may change them: then check it head-to-head in simulation and record the new values.
    // Last recorded: Master field reweighted (balanced 5, defensive 1).
    expect(runMatches(2, 'master', 21, { quiet: true }).fingerprint).toBe(2343956129);
    expect(runMatches(1, 'tournament', 22, { quiet: true }).fingerprint).toBe(1175943090);
  }, 120_000);
});

describe('draw vs hand discards (摸切 / 手切)', () => {
  test('each discard records whether it was the tile just drawn', () => {
    let checked = 0;
    let fromDraw = 0;
    playHands(6, 505, (s, p) => {
      const drawn = s.turn.drawnId;
      const pl = s.players[p];
      // Throw the drawn tile when there is one, otherwise the first tile in hand
      const tile = pl.hand.find((t) => t.id === drawn) ?? pl.hand[0];
      const after = discard(s, p, tile.id);
      const entry = after.log[after.log.length - 1];
      expect(entry.action).toBe('discard');
      expect(entry.fromDraw).toBe(tile.id === drawn);
      // After a Chi/Pung, or the dealer's first discard, there is no drawn tile
      if (s.turn.justCalled || s.log.length === 0) expect(drawn).toBeNull();
      if (drawn) {
        const other = pl.hand.find((t) => t.id !== drawn)!;
        expect(discard(s, p, other.id).log.at(-1)!.fromDraw).toBe(false);
      }
      checked++;
      if (entry.fromDraw) fromDraw++;
    });
    expect(checked).toBeGreaterThan(100);
    expect(fromDraw).toBeGreaterThan(50);
  }, 60_000);
});
