import { Tile, Meld, Wind, DifficultyLevel } from '../types/mahjong';
import {
  evaluateWin,
  canPeng,
  canMingGang,
  getChiCombinations,
  getAnGangCandidates,
  getBuGangCandidates,
} from './rulesEngine';
import { generateDiscardRecommendations } from './strategyEngine';

export interface BotDecision {
  action: 'hu' | 'gang' | 'peng' | 'chi' | 'pass';
  tiles?: Tile[]; // for chi or gang
  meld?: Meld;
}

export function evaluateBotCallResponse(
  botIndex: number,
  botHand: Tile[],
  botMelds: Meld[],
  discardedTile: Tile,
  discarderIndex: number,
  prevailingWind: Wind,
  botSeatWind: Wind,
  isUnderTheSea: boolean,
  difficulty: DifficultyLevel = 'intermediate'
): BotDecision {
  // 1. Can Bot Hu (Win on discard)? Always declare Hu!
  const testHand = [...botHand, discardedTile];
  const winEval = evaluateWin(testHand, botMelds, discardedTile, {
    isSelfDraw: false,
    prevailingWind,
    seatWind: botSeatWind,
    isUnderTheSea,
  });

  if (winEval.isWin && winEval.totalFan >= 1) {
    return { action: 'hu' };
  }

  // Melds probability scaled by difficulty
  const gangProb = difficulty === 'beginner' ? 0.35 : difficulty === 'intermediate' ? 0.65 : 0.85;
  const pengProb = difficulty === 'beginner' ? 0.35 : difficulty === 'intermediate' ? 0.70 : 0.90;
  const chiProb = difficulty === 'beginner' ? 0.25 : difficulty === 'intermediate' ? 0.55 : 0.80;

  // 2. Can Bot Ming Gang?
  if (canMingGang(botHand, discardedTile)) {
    if (Math.random() < gangProb) {
      const match = botHand.filter((t) => t.type === discardedTile.type).slice(0, 3);
      return {
        action: 'gang',
        tiles: [...match, discardedTile],
      };
    }
  }

  // 3. Can Bot Peng?
  if (canPeng(botHand, discardedTile)) {
    const match = botHand.filter((t) => t.type === discardedTile.type).slice(0, 2);
    const isValuableHonor =
      discardedTile.dragon !== undefined ||
      discardedTile.wind === prevailingWind ||
      discardedTile.wind === botSeatWind;

    if (isValuableHonor || Math.random() < pengProb) {
      return {
        action: 'peng',
        tiles: [...match, discardedTile],
      };
    }
  }

  // 4. Can Bot Chi? (Only from player on the left: (discarderIndex + 1) % 4 === botIndex)
  const isFromLeftPlayer = (discarderIndex + 1) % 4 === botIndex;
  if (isFromLeftPlayer) {
    const chiCombs = getChiCombinations(botHand, discardedTile);
    if (chiCombs.length > 0 && Math.random() < chiProb) {
      return {
        action: 'chi',
        tiles: chiCombs[0],
      };
    }
  }

  return { action: 'pass' };
}

export function chooseBotDiscard(
  botHand: Tile[],
  botMelds: Meld[],
  allVisibleTiles: Tile[],
  prevailingWind: Wind,
  seatWind: Wind,
  opponentDiscards: Tile[][],
  opponentTenpais: boolean[],
  difficulty: DifficultyLevel = 'intermediate'
): Tile {
  const recommendations = generateDiscardRecommendations(
    botHand,
    botMelds,
    allVisibleTiles,
    prevailingWind,
    seatWind,
    opponentDiscards,
    opponentTenpais
  );

  if (recommendations.length > 0) {
    if (difficulty === 'beginner') {
      // Beginner AI: 50% picks top, 35% picks rank 2, 15% picks rank 3
      const roll = Math.random();
      if (roll < 0.5 || recommendations.length === 1) {
        return recommendations[0].tile;
      } else if (roll < 0.85 && recommendations.length >= 2) {
        return recommendations[1].tile;
      } else if (recommendations.length >= 3) {
        return recommendations[2].tile;
      }
      return recommendations[0].tile;
    }

    if (difficulty === 'intermediate') {
      // Intermediate AI: 85% optimal, 15% rank 2
      if (recommendations.length > 1 && Math.random() < 0.15) {
        return recommendations[1].tile;
      }
      return recommendations[0].tile;
    }

    // Master AI: 100% optimal selection
    return recommendations[0].tile;
  }

  // Fallback: discard rightmost tile
  return botHand[botHand.length - 1];
}

export function checkBotConcealedKong(
  botHand: Tile[],
  botMelds: Meld[]
): { type: 'an_gang' | 'bu_gang'; tiles: Tile[]; meld?: Meld } | null {
  // Check An Gang
  const anGangOptions = getAnGangCandidates(botHand);
  if (anGangOptions.length > 0 && Math.random() < 0.6) {
    return { type: 'an_gang', tiles: anGangOptions[0] };
  }

  // Check Bu Gang
  const buGangOptions = getBuGangCandidates(botHand, botMelds);
  if (buGangOptions.length > 0 && Math.random() < 0.8) {
    return {
      type: 'bu_gang',
      tiles: [buGangOptions[0].tile],
      meld: buGangOptions[0].meld,
    };
  }

  return null;
}
