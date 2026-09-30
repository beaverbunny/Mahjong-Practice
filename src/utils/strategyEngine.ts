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
export function calculateShanten(hand: Tile[], melds: Meld[] = []): number {
  const fullHand = [...hand, ...melds.flatMap((m) => m.tiles)];

  // Check 13 Orphans shanten if no open melds
  let kokushiShanten = 99;
  if (melds.length === 0) {
    const orphanTypes: TileType[] = [
      '1wan', '9wan', '1tiao', '9tiao', '1tong', '9tong',
      'wind_E', 'wind_S', 'wind_W', 'wind_N',
      'dragon_C', 'dragon_F', 'dragon_B',
    ];
    let uniqueCount = 0;
    let hasPair = false;

    const counts: Record<string, number> = {};
    for (const t of hand) {
      counts[t.type] = (counts[t.type] || 0) + 1;
    }

    for (const ot of orphanTypes) {
      if (counts[ot]) {
        uniqueCount++;
        if (counts[ot] >= 2) hasPair = true;
      }
    }

    kokushiShanten = 13 - uniqueCount - (hasPair ? 1 : 0);
  }

  // Calculate standard hand shanten
  const standardShanten = calculateStandardShanten(hand, melds.length);

  return Math.min(kokushiShanten, standardShanten);
}

function calculateStandardShanten(hand: Tile[], meldCount: number): number {
  const counts: Record<string, number> = {};
  for (const t of hand) {
    counts[t.type] = (counts[t.type] || 0) + 1;
  }

  let minShanten = 8;
  const uniqueTypes = Object.keys(counts);

  // Case 1: Try with each possible pair
  for (const pairType of uniqueTypes) {
    if (counts[pairType] >= 2) {
      counts[pairType] -= 2;
      const shanten = evaluateSetsAndTaatsu(counts, meldCount, true);
      minShanten = Math.min(minShanten, shanten);
      counts[pairType] += 2;
    }
  }

  // Case 2: Try without pair
  const shantenNoPair = evaluateSetsAndTaatsu(counts, meldCount, false);
  minShanten = Math.min(minShanten, shantenNoPair);

  return Math.max(0, minShanten);
}

function evaluateSetsAndTaatsu(
  counts: Record<string, number>,
  meldCount: number,
  hasPair: boolean
): number {
  let sets = meldCount;
  let taatsu = 0;

  const tempCounts = { ...counts };

  // 1. Extract Triplets
  for (const type of Object.keys(tempCounts)) {
    while (tempCounts[type] >= 3) {
      sets++;
      tempCounts[type] -= 3;
    }
  }

  // 2. Extract Sequences
  const suits: ('wan' | 'tiao' | 'tong')[] = ['wan', 'tiao', 'tong'];
  for (const suit of suits) {
    for (let val = 1; val <= 7; val++) {
      const t1 = `${val}${suit}`;
      const t2 = `${val + 1}${suit}`;
      const t3 = `${val + 2}${suit}`;

      while (tempCounts[t1] > 0 && tempCounts[t2] > 0 && tempCounts[t3] > 0) {
        sets++;
        tempCounts[t1]--;
        tempCounts[t2]--;
        tempCounts[t3]--;
      }
    }
  }

  // 3. Extract Taatsu (Pairs & Incomplete Sequences)
  for (const type of Object.keys(tempCounts)) {
    if (tempCounts[type] >= 2) {
      taatsu++;
      tempCounts[type] -= 2;
    }
  }

  for (const suit of suits) {
    for (let val = 1; val <= 8; val++) {
      const t1 = `${val}${suit}`;
      const t2 = `${val + 1}${suit}`;
      if (tempCounts[t1] > 0 && tempCounts[t2] > 0) {
        taatsu++;
        tempCounts[t1]--;
        tempCounts[t2]--;
      }
    }
    for (let val = 1; val <= 7; val++) {
      const t1 = `${val}${suit}`;
      const t3 = `${val + 2}${suit}`;
      if (tempCounts[t1] > 0 && tempCounts[t3] > 0) {
        taatsu++;
        tempCounts[t1]--;
        tempCounts[t3]--;
      }
    }
  }

  // Mahjong standard formula:
  // 8 - 2 * sets - taatsu - (hasPair ? 1 : 0)
  // Limited by: sets + taatsu <= 4
  const usableTaatsu = Math.min(4 - sets, taatsu);
  const shanten = 8 - 2 * sets - usableTaatsu - (hasPair ? 1 : 0);

  return shanten;
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

    let evaluation = evaluateWin(testHand, melds, hypoTile, {
      isSelfDraw: false,
      prevailingWind,
      seatWind,
    });
    // A 0 Fan hand can't win on a discard but still wins by self-draw (A2)
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
  // 1. Genbutsu (现物): Discarded by all tenpai opponents
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
      score: 100,
      level: 'safe',
      reason: '现物绝对安全：听牌对手已打过此牌，无法出冲',
    };
  }

  // 2. Honor tiles visibility
  if (!tile.suit) {
    const visibleCopies = allVisibleTiles.filter((t) => t.type === tile.type).length;
    if (visibleCopies >= 3) {
      return {
        score: 95,
        level: 'safe',
        reason: `绝张字牌：场上已现${visibleCopies}张，极难成和`,
      };
    }
    if (visibleCopies === 2) {
      return {
        score: 75,
        level: 'safe',
        reason: '二熟字牌：仅存1张，相对安全',
      };
    }
    if (visibleCopies === 0) {
      return {
        score: 30,
        level: 'danger',
        reason: '生张字牌：场上未见，易被对手碰听或和牌',
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
          score: 85,
          level: 'safe',
          reason: `筋一九：对手打过${neighbor}${suit === 'wan' ? '万' : suit === 'tiao' ? '条' : '筒'}，避开两面听`,
        };
      }
      return {
        score: 65,
        level: 'medium',
        reason: '一九幺九边张：危险度略低于中张',
      };
    }

    // Dangerous middle tiles (4, 5, 6)
    if (val >= 4 && val <= 6) {
      return {
        score: 25,
        level: 'danger',
        reason: '中张生牌：极易点炮多面听（如两面、两头嵌）',
      };
    }
  }

  return {
    score: 55,
    level: 'medium',
    reason: '普通牌：未见明显危险特征，需谨慎防守',
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
  opponentTenpais: boolean[]
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

  for (const tileToDiscard of uniqueHandTiles) {
    // Remaining hand after discarding this tile
    const remainingHand = hand.filter((t) => t.id !== tileToDiscard.id);
    const shantenAfter = calculateShanten(remainingHand, melds);

    // Calculate effective incoming tiles (进张面 & 张数)
    let effectiveTilesCount = 0;
    const effectiveTileTypes: TileType[] = [];

    for (const testType of ALL_34_TYPES) {
      const hypo = createHypotheticalTile(testType);
      const testHand = [...remainingHand, hypo];
      const newShanten = calculateShanten(testHand, melds);

      if (newShanten < shantenAfter) {
        // This tile improves shanten!
        const seen = visibleCounts[testType] || 0;
        const remaining = Math.max(0, 4 - seen);
        effectiveTilesCount += remaining;
        effectiveTileTypes.push(testType);
      }
    }

    // Evaluate safety
    const safety = evaluateTileSafety(
      tileToDiscard,
      opponentDiscards,
      opponentTenpais,
      allVisibleTiles
    );

    // Composite heuristic score
    // Lower shanten after discard is paramount
    // Then maximum effective tiles
    // Plus safety score
    const score = (5 - shantenAfter) * 1000 + effectiveTilesCount * 10 + safety.score * 0.5;

    let recommendationReason = '';
    if (shantenAfter === 0) {
      recommendationReason = `听牌！可听${effectiveTileTypes.length}种牌共${effectiveTilesCount}张进张`;
    } else {
      recommendationReason = `向听优化：进张面广达${effectiveTilesCount}张 (${effectiveTileTypes.slice(0, 3).map(getTileNameByType).join('、')}${effectiveTileTypes.length > 3 ? '等' : ''})`;
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
    });
  }

  // Sort by shanten (lowest first), then effectiveTilesCount (highest first), then safety
  recommendations.sort((a, b) => {
    if (a.shantenAfter !== b.shantenAfter) {
      return a.shantenAfter - b.shantenAfter;
    }
    if (b.effectiveTilesCount !== a.effectiveTilesCount) {
      return b.effectiveTilesCount - a.effectiveTilesCount;
    }
    return b.safetyScore - a.safetyScore;
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
      typeName: '向听数倒退 (严重恶手)',
      reason: `向听数后退！最佳切牌应为【${bestRec.tile.displayName}】维持${
        bestRec.shantenAfter === 0 ? '听牌' : bestRec.shantenAfter + '向听'
      }，实战切出【${chosenRec.tile.displayName}】导致手牌倒退至${chosenRec.shantenAfter}向听，节奏严重受损。`,
      bestChoice: bestRec.tile,
      bestRec,
      chosenRec,
      effectiveTilesDiff: bestRec.effectiveTilesCount - chosenRec.effectiveTilesCount,
    };
  }

  // Blunder Condition 2: High danger tile discarded into tenpai opponent when safe cards exist (放铳高危恶手)
  if (
    chosenRec.safetyLevel === 'danger' &&
    bestRec.safetyLevel === 'safe' &&
    bestRec.safetyScore >= 80
  ) {
    return {
      isBlunder: true,
      severity: 'critical',
      type: 'dangerous_discard',
      typeName: '高危出冲点炮 (防守恶手)',
      reason: `危险防守失误：对手已听牌，实战切出高危生张【${chosenRec.tile.displayName}】（放铳风险极高）。手牌中存在现物安全牌【${bestRec.tile.displayName}】可保安全过巡。`,
      bestChoice: bestRec.tile,
      bestRec,
      chosenRec,
      effectiveTilesDiff: bestRec.effectiveTilesCount - chosenRec.effectiveTilesCount,
    };
  }

  // Blunder Condition 3: Significant effective tile difference (>= 4 tiles is critical, >= 2 is inaccuracy)
  const tileDiff = bestRec.effectiveTilesCount - chosenRec.effectiveTilesCount;
  if (tileDiff >= 4) {
    return {
      isBlunder: true,
      severity: 'critical',
      type: 'efficiency_loss',
      typeName: '牌效重度缩水 (牌效恶手)',
      reason: `牌效严重亏损：实战切出【${chosenRec.tile.displayName}】仅余${chosenRec.effectiveTilesCount}张进张，而最佳选择【${bestRec.tile.displayName}】进张高达${bestRec.effectiveTilesCount}张，白白损失${tileDiff}张进张面！`,
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
      typeName: '进张面次优 (缓手/疑问手)',
      reason: `打法略显狭窄：切出【${chosenRec.tile.displayName}】较最佳切牌【${bestRec.tile.displayName}】减少了${tileDiff}张有效进张（${chosenRec.effectiveTilesCount}张 vs ${bestRec.effectiveTilesCount}张）。`,
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
