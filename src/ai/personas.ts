import { DifficultyLevel } from '../types/mahjong';

export type PlayStyle = 'speed' | 'value' | 'balanced' | 'defensive' | 'casual';

/**
 * How a bot plays. Every bot gets its own sampled persona each match, so opponents
 * differ from each other and from match to match, like a real tournament field.
 */
export interface Persona {
  style: PlayStyle;
  // 0-1: how accurately it evaluates (low skill = noisier choices, weaker reads)
  skill: number;
  // Multiplier on hand value (fan) when planning; >1 chases bigger hands
  valueBias: number;
  // Multiplier on deal-in danger; >1 folds earlier
  caution: number;
  // Relative gain a call must add over not calling (0.2 = +20%); negative calls even when it loses value
  callThreshold: number;
  // Chance per decision of ignoring defense entirely (tunnel vision)
  recklessness: number;
}

export const STYLE_LABELS: Record<PlayStyle, string> = {
  speed: '速攻型',
  value: '大牌型',
  balanced: '稳健型',
  defensive: '防守型',
  casual: '随性型',
};

type Range = [number, number];
interface StyleSpec {
  valueBias: Range;
  caution: Range;
  callThreshold: Range;
  recklessness: Range;
}

const STYLE_SPECS: Record<PlayStyle, StyleSpec> = {
  // Takes cheap, fast wins; calls freely; pushes through danger
  speed: { valueBias: [0.6, 0.85], caution: [0.15, 0.35], callThreshold: [-0.25, 0], recklessness: [0.05, 0.15] },
  // Builds flushes, all-pungs and value pungs; slower, fewer calls unless they add value
  value: { valueBias: [1.25, 1.6], caution: [0.3, 0.6], callThreshold: [0, 0.25], recklessness: [0.02, 0.08] },
  // Value when dealt it, fast otherwise, folds against visible big hands
  balanced: { valueBias: [0.95, 1.2], caution: [0.45, 0.75], callThreshold: [0, 0.2], recklessness: [0, 0.05] },
  // Folds early and plays safe; wins mostly when the hand comes easily
  defensive: { valueBias: [0.9, 1.15], caution: [0.9, 1.4], callThreshold: [0.1, 0.4], recklessness: [0, 0.03] },
  // Recreational player: calls whatever it can, weak reads, careless discards
  casual: { valueBias: [0.7, 1.3], caution: [0.05, 0.25], callThreshold: [-0.5, -0.1], recklessness: [0.2, 0.45] },
};

// Style weights and skill range per difficulty. 'tournament' mimics a real qualifying field.
const FIELDS: Record<DifficultyLevel, { styles: [PlayStyle, number][]; skill: Range }> = {
  beginner: { styles: [['casual', 5], ['speed', 2], ['balanced', 1]], skill: [0.15, 0.45] },
  intermediate: {
    styles: [['casual', 2], ['speed', 3], ['balanced', 3], ['value', 2], ['defensive', 1]],
    skill: [0.4, 0.75],
  },
  master: { styles: [['speed', 3], ['balanced', 4], ['value', 3], ['defensive', 2]], skill: [0.8, 1.0] },
  tournament: {
    styles: [['casual', 3], ['speed', 3], ['balanced', 2.5], ['value', 1.5], ['defensive', 1]],
    skill: [0.35, 0.95],
  },
};

function pick<T>(items: [T, number][], rng: () => number): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

const within = ([lo, hi]: Range, rng: () => number) => lo + (hi - lo) * rng();

export function samplePersona(difficulty: DifficultyLevel, rng: () => number = Math.random): Persona {
  const field = FIELDS[difficulty];
  const style = pick(field.styles, rng);
  const spec = STYLE_SPECS[style];
  // Casual players sit at the low end of the field's skill range
  const skillRange: Range = style === 'casual' ? [field.skill[0], (field.skill[0] + field.skill[1]) / 2] : field.skill;
  return {
    style,
    skill: within(skillRange, rng),
    valueBias: within(spec.valueBias, rng),
    caution: within(spec.caution, rng),
    callThreshold: within(spec.callThreshold, rng),
    recklessness: within(spec.recklessness, rng),
  };
}

export function samplePersonas(difficulty: DifficultyLevel, rng: () => number = Math.random): Persona[] {
  return [0, 1, 2].map(() => samplePersona(difficulty, rng));
}

export function getBotPlayerName(
  seat: number,
  style: PlayStyle,
  skill: number,
  difficulty: DifficultyLevel
): string {
  const seatPrefix = seat === 1 ? '下家' : seat === 2 ? '对家' : '上家';
  const styleStr = STYLE_LABELS[style] || '稳健型';

  let tier = '进阶';
  if (difficulty === 'beginner') {
    tier = '入门';
  } else if (difficulty === 'master') {
    tier = skill >= 0.9 ? '宗师' : '大师';
  } else if (difficulty === 'intermediate') {
    tier = skill >= 0.65 ? '进阶' : '中级';
  } else {
    // tournament field
    tier = skill >= 0.85 ? '宗师' : skill >= 0.65 ? '大师' : skill >= 0.45 ? '进阶' : '入门';
  }

  return `${seatPrefix} · ${styleStr} (${tier})`;
}
