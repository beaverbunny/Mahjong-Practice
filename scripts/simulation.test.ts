/**
 * Smoke test: full 16-hand matches between bots, through the same engine the app uses.
 *
 * After every action the simulator checks that all 136 tiles are accounted for, hand sizes are
 * right and scores sum to zero; every win is re-scored independently and every payment must
 * balance. Any rule violation fails the test.
 *
 *   bun test scripts/
 */
import { describe, expect, test } from 'bun:test';
import { DifficultyLevel } from '../src/types/mahjong';
import { HANDS_PER_MATCH } from '../src/engine/table';
import { runMatches } from './simulate';

describe('full bot matches follow the rules', () => {
  for (const [difficulty, matches, seed] of [
    ['tournament', 3, 11],
    ['master', 2, 12],
    ['beginner', 2, 13],
  ] as [DifficultyLevel, number, number][]) {
    test(`${matches} ${difficulty} matches with no rule violations`, () => {
      const r = runMatches(matches, difficulty, seed, { quiet: true });
      expect(r.violations).toBe(0);
      expect(r.hands).toBe(matches * HANDS_PER_MATCH);
      // Hands actually get won (a broken engine that ends everything in draws would fail here)
      expect(r.wins).toBeGreaterThan(r.hands / 2);
    }, 120_000);
  }
});
