/**
 * Fair-play tests: bots must decide using only what a real player at the table can see.
 *
 * At every decision point in seeded games, everything the deciding bot should NOT know is replaced
 * with a different but equally consistent world: every other player's concealed hand (including
 * the human's), the wall's contents and order, and the internal tenpai flags. With the same random
 * seed, the bot's decision must not change.
 *
 *   bun test scripts/
 */
import { describe, expect, test } from 'bun:test';
import { DifficultyLevel } from '../src/types/mahjong';
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
  return { ...s, players, wall: pool.splice(0, s.wall.length) };
}

function checkField(difficulty: DifficultyLevel, games: number, seed: number) {
  let decisions = 0;
  let hiddenChanged = 0;
  const changed: string[] = [];
  for (let g = 0; g < games; g++) {
    const personaRng = mulberry32(seed + g);
    const personas = [0, 1, 2, 3].map(() => samplePersona(difficulty, personaRng));
    const gameRng = mulberry32(seed * 7 + g);
    let s: TableState = dealHand(g % 16, [0, 0, 0, 0], mulberry32(seed * 13 + g));
    while (s.phase !== 'ended') {
      if (s.phase === 'turn') {
        const p = s.active;
        const decisionSeed = Math.floor(gameRng() * 1e9);
        const real = decideTurn(s, p, personas[p], mulberry32(decisionSeed));
        const alt = scrambleHidden(s, p, mulberry32(decisionSeed + 1));
        if (alt.players.some((q, i) => i !== p && q.hand.map((t) => t.id).join() !== s.players[i].hand.map((t) => t.id).join())) {
          hiddenChanged++;
        }
        const fake = decideTurn(alt, p, personas[p], mulberry32(decisionSeed));
        decisions++;
        if (JSON.stringify(real) !== JSON.stringify(fake)) changed.push(`turn p${p} game ${g}`);
        s = real.type === 'tsumo' ? declareSelfDraw(s, p) : real.type === 'kong' ? declareKong(s, p, real.candidate) : discard(s, p, real.tileId);
      } else {
        const decisions_: (ClaimDecision | undefined)[] = [];
        for (const q of playersWithClaimOptions(s)) {
          const decisionSeed = Math.floor(gameRng() * 1e9);
          decisions_[q] = decideClaim(s, q, getClaimOptions(s, q)!, personas[q], mulberry32(decisionSeed));
          const alt = scrambleHidden(s, q, mulberry32(decisionSeed + 1));
          const fake = decideClaim(alt, q, getClaimOptions(alt, q)!, personas[q], mulberry32(decisionSeed));
          decisions++;
          if (JSON.stringify(decisions_[q]) !== JSON.stringify(fake)) changed.push(`claim p${q} game ${g}`);
        }
        s = resolveClaims(s, decisions_);
      }
    }
  }
  return { decisions, hiddenChanged, changed };
}

describe('bots only use visible information', () => {
  for (const [difficulty, seed] of [['master', 101], ['tournament', 202], ['beginner', 303]] as const) {
    test(`${difficulty} bots decide the same whatever the hidden tiles are`, () => {
      const r = checkField(difficulty, 4, seed);
      expect(r.changed).toEqual([]);
      // The test must really have exercised many decisions with different hidden worlds
      expect(r.decisions).toBeGreaterThan(200);
      expect(r.hiddenChanged).toBeGreaterThan(100);
    }, 120_000);
  }
});
