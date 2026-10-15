import {
  Tile,
  TileType,
  Meld,
  Wind,
  DiscardRecommendation,
  TenpaiWait,
  TurnActionLog,
} from '../types/mahjong';
import { evaluateWin, checkThirteenOrphans } from './rulesEngine';
import { getTileNameByType, CHINESE_NUMS } from './mahjongTiles';
import { shanten as fastShanten, toCounts, tileIndex } from '../engine/shanten';
import { fanShantenFromCounts, MeldShape } from '../engine/fanShanten';

const ALL_34_TYPES: TileType[] = [
  '1wan', '2wan', '3wan', '4wan', '5wan', '6wan', '7wan', '8wan', '9wan',
  '1tiao', '2tiao', '3tiao', '4tiao', '5tiao', '6tiao', '7tiao', '8tiao', '9tiao',
  '1tong', '2tong', '3tong', '4tong', '5tong', '6tong', '7tong', '8tong', '9tong',
  'wind_E', 'wind_S', 'wind_W', 'wind_N',
  'dragon_C', 'dragon_F', 'dragon_B',
];

// Helper dummy tile creator for hypothetical incoming tiles
export function createHypotheticalTile(type: TileType): Tile {
  let suit: 'wan' | 'tiao' | 'tong' | undefined;
  let value: number | undefined;
  let wind: Wind | undefined;
  let dragon: 'C' | 'F' | 'B' | undefined;

  if (type.endsWith('wan')) {
    suit = 'wan';
    value = parseInt(type[0], 10);
  } else if (type.endsWith('tiao')) {
    suit = 'tiao';
    value = parseInt(type[0], 10);
  } else if (type.endsWith('tong')) {
    suit = 'tong';
    value = parseInt(type[0], 10);
  } else if (type.startsWith('wind_')) {
    wind = type.replace('wind_', '') as Wind;
  } else if (type.startsWith('dragon_')) {
    dragon = type.replace('dragon_', '') as 'C' | 'F' | 'B';
  }

  return {
    id: `hypo_${type}`,
    type,
    suit,
    value,
    wind,
    dragon,
    displayName: getTileNameByType(type),
    shortName: type,
  };
}

// Calculate Shanten (向听数)
// 0 = Tenpai (听牌), 1 = 1-shanten (一向听), 2 = 2-shanten (二向听)...
// Exact over standard hands and Thirteen Orphans; a complete hand also reports 0.
export function calculateShanten(hand: Tile[], melds: Meld[] = []): number {
  return Math.max(0, fastShanten(hand, melds.length));
}

const WIND_INDEX: Record<Wind, number> = { E: 27, S: 28, W: 29, N: 30 };

// Honor tiles worth a fan as a triplet for this player: dragons, seat wind, prevailing wind
export function valueTileIndices(prevailingWind: Wind, seatWind: Wind): number[] {
  return [...new Set([31, 32, 33, WIND_INDEX[seatWind], WIND_INDEX[prevailingWind]])];
}

export function meldShapes(melds: Meld[]): MeldShape[] {
  return melds.map((m) => ({ kind: m.type === 'chi' ? 'chi' : 'pung', index: tileIndex(m.tiles[0].type) }));
}

// Copies of each tile type still obtainable, given every tile this player can see (own hand included)
function obtainableFrom(visibleTiles: Tile[]): number[] {
  const seen = toCounts(visibleTiles);
  return seen.map((n) => Math.max(0, 4 - n));
}

export interface ShantenInfo {
  // Shanten toward a hand guaranteed at least 1 fan on a discard (what the guide shows)
  display: number;
  // Plain shape shanten (any 4 sets + pair)
  shape: number;
  // No fan route remains: the hand can only ever win by self-draw
  noFanRoute: boolean;
}

/**
 * Fan-aware shanten (向听) under the TVB minimum-1-fan rule. A hand only counts as closer to winning
 * along routes that guarantee a fan on a discard (Common Hand, value triplet, flush, All Triplets,
 * Thirteen Orphans). When no such route remains, the plain shape shanten is shown with noFanRoute.
 */
export function analyzeShanten(
  hand: Tile[],
  melds: Meld[],
  prevailingWind: Wind,
  seatWind: Wind,
  visibleTiles?: Tile[]
): ShantenInfo {
  const res = fanShantenFromCounts(
    toCounts(hand),
    meldShapes(melds),
    valueTileIndices(prevailingWind, seatWind),
    visibleTiles ? obtainableFrom(visibleTiles) : undefined
  );
  const noFanRoute = !Number.isFinite(res.fan);
  return {
    display: Math.max(0, noFanRoute ? res.shape : res.fan),
    shape: Math.max(0, res.shape),
    noFanRoute,
  };
}

// Calculate Tenpai Waits (听牌张数 & 预估番数)
export function calculateTenpaiWaits(
  hand: Tile[],
  melds: Meld[],
  allVisibleTiles: Tile[],
  prevailingWind: Wind,
  seatWind: Wind
): TenpaiWait[] {
  // Only applies when hand is 13 cards (or 3n+1 cards)
  if (hand.length % 3 !== 1) return [];

  const waits: TenpaiWait[] = [];

  // Count visible copies of each tile type
  const visibleCounts: Record<string, number> = {};
  allVisibleTiles.forEach((t) => {
    visibleCounts[t.type] = (visibleCounts[t.type] || 0) + 1;
  });

  for (const candidateType of ALL_34_TYPES) {
    const hypoTile = createHypotheticalTile(candidateType);
    const testHand = [...hand, hypoTile];

    // Win on a discard: evaluateWin adds the discarded tile itself, so pass the 13-tile hand
    let evaluation = evaluateWin(hand, melds, hypoTile, {
      isSelfDraw: false,
      prevailingWind,
      seatWind,
    });
    const selfDrawOnly = !evaluation.isWin;
    // A 0 Fan hand can't win on a discard but still wins by self-draw (A2);
    // a self-draw is scored on the full hand including the drawn tile
    if (!evaluation.isWin) {
      evaluation = evaluateWin(testHand, melds, hypoTile, {
        isSelfDraw: true,
        prevailingWind,
        seatWind,
      });
    }

    if (evaluation.isWin && evaluation.totalFan >= 1) {
      const seen = visibleCounts[candidateType] || 0;
      const remaining = Math.max(0, 4 - seen);

      waits.push({
        tileType: candidateType,
        displayName: hypoTile.displayName,
        remainingCount: remaining,
        estimatedFan: evaluation.totalFan,
        possibleFans: evaluation.fanDetails.map((f) => f.name.split(' ')[0]),
        selfDrawOnly,
      });
    }
  }

  return waits;
}

// Analyze Safety and Danger score (0 to 100)
export function evaluateTileSafety(
  tile: Tile,
  opponentDiscards: Tile[][],
  opponentTenpais: boolean[],
  allVisibleTiles: Tile[]
): {
  score: number;
  level: 'safe' | 'medium' | 'danger';
  reason: string;
} {
  // 1. Genbutsu (现物): Discarded by all tenpai opponents.
  // These rules have no furiten, so an opponent can still win on a tile they discarded earlier.
  let safeAgainstAllTenpai = true;
  let tenpaiOpponentCount = 0;

  opponentTenpais.forEach((isTenpai, pIdx) => {
    if (isTenpai) {
      tenpaiOpponentCount++;
      const discards = opponentDiscards[pIdx] || [];
      const hasDiscarded = discards.some((d) => d.type === tile.type);
      if (!hasDiscarded) {
        safeAgainstAllTenpai = false;
      }
    }
  });

  if (tenpaiOpponentCount > 0 && safeAgainstAllTenpai) {
    return {
      score: 85,
      level: 'safe',
      reason: '對手自己打過此牌，較安全，但他仍可胡此牌',
    };
  }

  // 2. Honor tiles visibility
  if (!tile.suit) {
    const visibleCopies = allVisibleTiles.filter((t) => t.type === tile.type).length;
    if (visibleCopies >= 3) {
      return {
        score: 95,
        level: 'safe',
        reason: `絕張字牌：場上已現${visibleCopies}張，極難被胡`,
      };
    }
    if (visibleCopies === 2) {
      return {
        score: 75,
        level: 'safe',
        reason: '熟張字牌：僅存1張，相對安全',
      };
    }
    if (visibleCopies === 0) {
      return {
        score: 30,
        level: 'danger',
        reason: '生張字牌：場上未見，易被對手碰或胡',
      };
    }
  }

  // 3. Suji (筋牌) logic for suit tiles
  if (tile.suit && tile.value) {
    const val = tile.value;
    const suit = tile.suit;

    // Check terminal tiles 1 and 9
    if (val === 1 || val === 9) {
      const neighbor = val === 1 ? 4 : 6;
      const neighborSeenInTenpaiDiscards = opponentDiscards.some((pDiscards, pIdx) => {
        return (
          opponentTenpais[pIdx] &&
          pDiscards.some((d) => d.suit === suit && d.value === neighbor)
        );
      });

      if (neighborSeenInTenpaiDiscards) {
        return {
          score: 70,
          level: 'medium',
          reason: `一九相隔三位：對手打過${neighbor}${suit === 'wan' ? '萬' : suit === 'tiao' ? '條' : '筒'}，兩頭聽可能性較低（並非絕對安全）`,
        };
      }
      return {
        score: 65,
        level: 'medium',
        reason: '一九邊張：危險度略低於中張',
      };
    }

    // Dangerous middle tiles (4, 5, 6)
    if (val >= 4 && val <= 6) {
      return {
        score: 25,
        level: 'danger',
        reason: '中張生張：容易出銃給兩頭或多面聽',
      };
    }
  }

  return {
    score: 55,
    level: 'medium',
    reason: '普通牌：未見明顯危險特徵，需謹慎防守',
  };
}

// Generate comprehensive discard recommendations with tile efficiency
export function generateDiscardRecommendations(
  hand: Tile[],
  melds: Meld[],
  allVisibleTiles: Tile[],
  prevailingWind: Wind,
  seatWind: Wind,
  opponentDiscards: Tile[][],
  opponentTenpais: boolean[],
  // Danger read from src/analysis/danger.ts; when given it replaces the simple tile labels
  danger?: Record<string, { pct: number; level: 'safe' | 'medium' | 'danger'; reasons: string[] }>
): DiscardRecommendation[] {
  // Must have 14 tiles (3n+2) to discard
  if (hand.length % 3 !== 2) return [];

  // Visible tiles counts
  const visibleCounts: Record<string, number> = {};
  allVisibleTiles.forEach((t) => {
    visibleCounts[t.type] = (visibleCounts[t.type] || 0) + 1;
  });

  const uniqueHandTiles: Tile[] = [];
  const seenTypes = new Set<string>();
  for (const t of hand) {
    if (!seenTypes.has(t.type)) {
      seenTypes.add(t.type);
      uniqueHandTiles.push(t);
    }
  }

  const recommendations: DiscardRecommendation[] = [];
  const rankKey = new Map<string, number>();
  // Exact deal-in chance for the final tie-break (the 0-100 safety score rounds 0.1% and 0.3% together)
  const exactRisk = new Map<string, number>();

  const counts = toCounts(hand);
  const shapes = meldShapes(melds);
  const valueTiles = valueTileIndices(prevailingWind, seatWind);
  const obtainable = obtainableFrom(allVisibleTiles);
  const fanShantenOf = () => fanShantenFromCounts(counts, shapes, valueTiles, obtainable);

  for (const tileToDiscard of uniqueHandTiles) {
    // Shanten after discarding this tile: fan-aware, plus the plain shape for comparison
    const di = tileIndex(tileToDiscard.type);
    counts[di]--;
    const after = fanShantenOf();
    const noFanRoute = !Number.isFinite(after.fan);
    const shantenAfter = Math.max(0, noFanRoute ? after.shape : after.fan);

    // Effective incoming tiles (进张): draws that move the hand closer to a win with a fan.
    // Draws that only improve a 0-fan shape (self-draw only) are listed separately.
    let effectiveTilesCount = 0;
    const effectiveTileTypes: TileType[] = [];
    let selfDrawOnlyTilesCount = 0;
    const selfDrawOnlyTileTypes: TileType[] = [];

    ALL_34_TYPES.forEach((testType, ti) => {
      if (counts[ti] >= 4) return;
      counts[ti]++;
      const next = fanShantenOf();
      counts[ti]--;
      const seen = visibleCounts[testType] || 0;
      const remaining = Math.max(0, 4 - seen);
      const improvesFan = !noFanRoute && next.fan < after.fan;
      const improvesShape = next.shape < after.shape;
      if (improvesFan || (noFanRoute && improvesShape)) {
        effectiveTilesCount += remaining;
        effectiveTileTypes.push(testType);
      }
      if ((improvesShape && !improvesFan) || (noFanRoute && improvesShape)) {
        selfDrawOnlyTilesCount += remaining;
        selfDrawOnlyTileTypes.push(testType);
      }
    });
    counts[di]++;

    // Rank fan routes first; a hand that can only ever win by self-draw ranks as two steps further
    rankKey.set(tileToDiscard.id, noFanRoute ? after.shape + 2 : after.fan);

    // Evaluate safety
    const read = danger?.[tileToDiscard.type];
    const safety = read
      ? {
          score: Math.round(100 * (1 - read.pct)),
          level: read.level,
          reason: `出銃率約 ${(100 * read.pct).toFixed(read.pct < 0.1 ? 1 : 0)}%${read.reasons.length ? '：' + read.reasons.join('；') : ''}`,
        }
      : evaluateTileSafety(tileToDiscard, opponentDiscards, opponentTenpais, allVisibleTiles);
    exactRisk.set(tileToDiscard.id, read ? read.pct : 1 - safety.score / 100);

    // Composite heuristic score
    // Lower shanten after discard is paramount
    // Then maximum effective tiles
    // Plus safety score
    const score = (5 - shantenAfter) * 1000 + effectiveTilesCount * 10 + safety.score * 0.5;

    let recommendationReason = '';
    const names = (types: TileType[]) =>
      `${types.slice(0, 3).map(getTileNameByType).join('、')}${types.length > 3 ? '等' : ''}`;
    if (noFanRoute) {
      recommendationReason = `已無番種路線，只能自摸：${after.shape <= 0 ? '聽牌' : `差 ${shantenAfter} 張聽牌`}，進張${effectiveTilesCount}張`;
    } else if (shantenAfter === 0) {
      recommendationReason = `有番聽牌！可胡${effectiveTileTypes.length}種牌共${effectiveTilesCount}張`;
    } else {
      recommendationReason = `有番進張：${effectiveTilesCount}張 (${names(effectiveTileTypes)})`;
    }
    if (!noFanRoute && selfDrawOnlyTilesCount > 0) {
      recommendationReason += `；另有${selfDrawOnlyTilesCount}張 (${names(selfDrawOnlyTileTypes)}) 可改善牌型，但暫未帶番`;
    }

    recommendations.push({
      tileId: tileToDiscard.id,
      tile: tileToDiscard,
      shantenAfter,
      effectiveTilesCount,
      effectiveTileTypes,
      safetyScore: safety.score,
      safetyLevel: safety.level,
      safetyReason: safety.reason,
      scoreRank: 0,
      recommendationReason,
      shapeShantenAfter: Math.max(0, after.shape),
      noFanRoute,
      selfDrawOnlyTilesCount,
      selfDrawOnlyTileTypes,
    });
  }

  // Fan a triplet of this tile would add: dragons 1, seat and prevailing wind 1 each (2 when they match)
  const tripletFan = (type: TileType) =>
    type.startsWith('dragon_')
      ? 1
      : (type === `wind_${seatWind}` ? 1 : 0) + (type === `wind_${prevailingWind}` ? 1 : 0);
  const levelOrder = { safe: 0, medium: 1, danger: 2 };

  // Sort by fan-aware shanten (lowest first), then effectiveTilesCount (highest first), then
  // all shape-improving draws, then safety level, then throw the tile worth less fan first (a plain wind before a double wind),
  // then the exact deal-in chance
  recommendations.sort((a, b) => {
    const ka = rankKey.get(a.tileId)!;
    const kb = rankKey.get(b.tileId)!;
    if (ka !== kb) {
      return ka - kb;
    }
    if (b.effectiveTilesCount !== a.effectiveTilesCount) {
      return b.effectiveTilesCount - a.effectiveTilesCount;
    }
    // Then all draws that improve the shape, including those that carry no fan yet: a lone 4wan
    // can still grow into a run, a lone plain wind only into a pair
    const ta = a.effectiveTilesCount + (a.noFanRoute ? 0 : a.selfDrawOnlyTilesCount ?? 0);
    const tb = b.effectiveTilesCount + (b.noFanRoute ? 0 : b.selfDrawOnlyTilesCount ?? 0);
    if (ta !== tb) {
      return tb - ta;
    }
    if (a.safetyLevel !== b.safetyLevel) {
      return levelOrder[a.safetyLevel] - levelOrder[b.safetyLevel];
    }
    const fa = tripletFan(a.tile.type);
    const fb = tripletFan(b.tile.type);
    if (fa !== fb) {
      return fa - fb;
    }
    return exactRisk.get(a.tileId)! - exactRisk.get(b.tileId)!;
  });

  // Assign ranks
  recommendations.forEach((rec, idx) => {
    rec.scoreRank = idx + 1;
  });

  return recommendations;
}

export interface BlunderAnalysisResult {
  isBlunder: boolean;
  severity?: 'critical' | 'inaccuracy';
  type?: 'shanten_retreat' | 'efficiency_loss' | 'dangerous_discard';
  typeName?: string;
  reason?: string;
  bestChoice?: Tile;
  bestRec?: DiscardRecommendation;
  chosenRec?: DiscardRecommendation;
  effectiveTilesDiff?: number;
}

// Check if a move was a blunder for review analysis
export function analyzeTurnBlunder(
  discardedTile: Tile,
  recommendations: DiscardRecommendation[]
): BlunderAnalysisResult {
  if (recommendations.length <= 1) return { isBlunder: false };

  const chosenRec = recommendations.find((r) => r.tile.type === discardedTile.type);
  const bestRec = recommendations[0];

  if (!chosenRec) return { isBlunder: false };

  // If chosen tile is already the best recommendation, no blunder
  if (chosenRec.tileId === bestRec.tileId) {
    return {
      isBlunder: false,
      bestChoice: bestRec.tile,
      bestRec,
      chosenRec,
    };
  }

  // Blunder Condition 1: Lost shanten (向听倒退 - 严重恶手)
  if (chosenRec.shantenAfter > bestRec.shantenAfter) {
    return {
      isBlunder: true,
      severity: 'critical',
      type: 'shanten_retreat',
      typeName: '離聽牌倒退 (嚴重失誤)',
      reason: `離聽牌倒退！最佳出牌應為【${bestRec.tile.displayName}】維持${
        bestRec.shantenAfter === 0 ? '聽牌' : '差 ' + bestRec.shantenAfter + ' 張聽牌'
      }，實戰打出【${chosenRec.tile.displayName}】導致手牌倒退至差 ${chosenRec.shantenAfter} 張聽牌，節奏嚴重受損。`,
      bestChoice: bestRec.tile,
      bestRec,
      chosenRec,
      effectiveTilesDiff: bestRec.effectiveTilesCount - chosenRec.effectiveTilesCount,
    };
  }

  // Deal-in danger is reviewed after the hand (src/analysis/danger.ts): whether a risky push was
  // worth it depends on the player's own hand value, so it isn't judged as a mistake here.

  // Blunder Condition 3: Significant effective tile difference (>= 4 tiles is critical, >= 2 is inaccuracy)
  const tileDiff = bestRec.effectiveTilesCount - chosenRec.effectiveTilesCount;
  if (tileDiff >= 4) {
    return {
      isBlunder: true,
      severity: 'critical',
      type: 'efficiency_loss',
      typeName: '進張大幅減少 (嚴重失誤)',
      reason: `進張嚴重虧損：實戰打出【${chosenRec.tile.displayName}】僅餘${chosenRec.effectiveTilesCount}張進張，而最佳選擇【${bestRec.tile.displayName}】進張高達${bestRec.effectiveTilesCount}張，白白損失${tileDiff}張進張面！`,
      bestChoice: bestRec.tile,
      bestRec,
      chosenRec,
      effectiveTilesDiff: tileDiff,
    };
  } else if (tileDiff >= 2) {
    return {
      isBlunder: true,
      severity: 'inaccuracy',
      type: 'efficiency_loss',
      typeName: '進張面次優 (次優打法)',
      reason: `打法略顯狹窄：打出【${chosenRec.tile.displayName}】較最佳出牌【${bestRec.tile.displayName}】減少了${tileDiff}張有效進張（${chosenRec.effectiveTilesCount}張 vs ${bestRec.effectiveTilesCount}張）。`,
      bestChoice: bestRec.tile,
      bestRec,
      chosenRec,
      effectiveTilesDiff: tileDiff,
    };
  }

  return {
    isBlunder: false,
    bestChoice: bestRec.tile,
    bestRec,
    chosenRec,
  };
}
