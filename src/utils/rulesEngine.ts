import { Tile, TileType, Meld, Wind, Dragon, FanDetail, WinEvaluation } from '../types/mahjong';
import { sortTiles } from './mahjongTiles';

// Complete Winning Hand Definitions according to Appendix III
export const DESIGNATED_HANDS = {
  A1: { code: 'A1', name: '平胡 (Common Hand)', fan: 1, desc: '由4副序数牌顺子及1对将牌（可为字牌）组成的和牌' },
  A2: { code: 'A2', name: '自摸 (Self-Draw)', fan: 1, desc: '自己摸到和牌张并宣告和牌' },
  A3: { code: 'A3', name: '圈风刻 (Prevailing Wind Triplet)', fan: 1, desc: '与当前圈风相同的风牌刻子或杠' },
  A4: { code: 'A4', name: '门风刻 (Seat Wind Triplet)', fan: 1, desc: '与自己门风相同的风牌刻子或杠' },
  A5: { code: 'A5', name: '海底捞月 (Under the Sea)', fan: 1, desc: '和牌张为牌墙最后一张牌（抓打皆可）' },
  A6: { code: 'A6', name: '杠上开花 (Self-Draw on Kong)', fan: 1, desc: '开杠后从牌墙摸补牌并自摸和牌' },
  A7: { code: 'A7', name: '箭牌刻 (A Triplet of Dragon Tiles)', fan: 1, desc: '中、发、白任意一组刻子或杠' },
  A8: { code: 'A8', name: '第二箭牌刻 (Second Triplet of Dragon Tiles)', fan: 1, desc: '中、发、白的第二组刻子或杠' },
  B1: { code: 'B1', name: '碰碰胡 (All Triplets)', fan: 3, desc: '由4副刻子（或杠）及1对将牌组成的和牌' },
  B2: { code: 'B2', name: '混一色 (Half Flush)', fan: 3, desc: '由同一种序数牌及字牌（风牌/箭牌）组成' },
  B3: { code: 'B3', name: '小三元 (Little Three Dragons)', fan: 4, desc: '由中、发、白中的2组刻子和1对组成' },
  B4: { code: 'B4', name: '小四喜 (Little Four Winds)', fan: 5, desc: '由东、南、西、北中的3组刻子和1对组成' },
  B5: { code: 'B5', name: '清一色 (Full Flush)', fan: 7, desc: '完全由同一种序数牌组成的和牌' },
  X1: { code: 'X1', name: '大三元 (Big Three Dragons)', fan: 8, desc: '由中、发、白3组刻子（或杠）组成的和牌' },
  X2: { code: 'X2', name: '大四喜 (Big Four Winds)', fan: 10, desc: '由东、南、西、北4组刻子（或杠）组成的和牌' },
  X3: { code: 'X3', name: '十三幺 (Thirteen Orphans)', fan: 10, desc: '由三种序数牌的一、九，四风，三箭共13种牌加其中任意一张成对组成' },
  X4: { code: 'X4', name: '字一色 (All Honors)', fan: 10, desc: '完全由字牌（风牌及箭牌）刻子/对子组成' },
};

// Points calculation as defined in Appendix I
export function calculatePointsDelta(
  fan: number,
  isSelfDraw: boolean,
  winnerIdx: number,
  discarderIdx: number | null
): number[] {
  const delta = [0, 0, 0, 0];
  const effectiveFan = Math.min(Math.max(fan, 1), 10);

  if (isSelfDraw) {
    const winPoints = effectiveFan * 15;
    const lossEach = effectiveFan * 5;

    delta[winnerIdx] = winPoints;
    for (let i = 0; i < 4; i++) {
      if (i !== winnerIdx) {
        delta[i] = -lossEach;
      }
    }
  } else {
    const winPoints = effectiveFan * 10;
    const lossPoints = effectiveFan * 10;

    delta[winnerIdx] = winPoints;
    if (discarderIdx !== null && discarderIdx >= 0 && discarderIdx < 4) {
      delta[discarderIdx] = -lossPoints;
    }
  }

  return delta;
}

// Check if a hand configuration satisfies Thirteen Orphans (十三幺 / X3)
export function checkThirteenOrphans(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false;

  const requiredTypes: TileType[] = [
    '1wan', '9wan',
    '1tiao', '9tiao',
    '1tong', '9tong',
    'wind_E', 'wind_S', 'wind_W', 'wind_N',
    'dragon_C', 'dragon_F', 'dragon_B',
  ];

  const counts: Record<string, number> = {};
  for (const t of tiles) {
    counts[t.type] = (counts[t.type] || 0) + 1;
  }

  // Must have all 13 types
  for (const req of requiredTypes) {
    if (!counts[req] || counts[req] < 1) return false;
  }

  // Exactly one of them must have 2 copies
  let pairCount = 0;
  for (const req of requiredTypes) {
    if (counts[req] === 2) pairCount++;
    else if (counts[req] > 2) return false;
  }

  return pairCount === 1;
}

interface Decomposition {
  sequences: Tile[][];
  triplets: Tile[][];
  pair: Tile[];
}

// Find all valid standard Mahjong hand decompositions (4 sets of triplets/sequences + 1 pair)
export function decomposeHand(
  handTiles: Tile[],
  melds: Meld[] = []
): Decomposition[] {
  // melds already provide some sets
  const meldTriplets: Tile[][] = [];
  const meldSequences: Tile[][] = [];

  melds.forEach((m) => {
    if (m.type === 'chi') {
      meldSequences.push(m.tiles);
    } else {
      meldTriplets.push(m.tiles);
    }
  });

  const totalSetsNeeded = 4 - melds.length;
  const sorted = sortTiles(handTiles);
  const results: Decomposition[] = [];

  // Group tiles by type
  const counts: Record<string, Tile[]> = {};
  sorted.forEach((t) => {
    counts[t.type] = counts[t.type] || [];
    counts[t.type].push(t);
  });

  const uniqueTypes = Object.keys(counts);

  // Try each possible pair
  for (const pairType of uniqueTypes) {
    if (counts[pairType].length >= 2) {
      const pair = [counts[pairType][0], counts[pairType][1]];
      const remaining: Tile[] = [];

      for (const tType of uniqueTypes) {
        const startIdx = tType === pairType ? 2 : 0;
        for (let i = startIdx; i < counts[tType].length; i++) {
          remaining.push(counts[tType][i]);
        }
      }

      // Try decomposing remaining into triplets and sequences
      const setCombinations: { seqs: Tile[][]; trips: Tile[][] }[] = [];
      decomposeIntoSets(remaining, [], [], setCombinations);

      for (const comb of setCombinations) {
        if (comb.seqs.length + comb.trips.length === totalSetsNeeded) {
          results.push({
            sequences: [...meldSequences, ...comb.seqs],
            triplets: [...meldTriplets, ...comb.trips],
            pair,
          });
        }
      }
    }
  }

  return results;
}

function decomposeIntoSets(
  tiles: Tile[],
  currentSeqs: Tile[][],
  currentTrips: Tile[][],
  results: { seqs: Tile[][]; trips: Tile[][] }[]
) {
  if (tiles.length === 0) {
    results.push({ seqs: [...currentSeqs], trips: [...currentTrips] });
    return;
  }

  const first = tiles[0];
  const sameTypes = tiles.filter((t) => t.type === first.type);

  // 1. Try forming a triplet
  if (sameTypes.length >= 3) {
    const triplet = sameTypes.slice(0, 3);
    const rest = removeTiles(tiles, triplet);
    currentTrips.push(triplet);
    decomposeIntoSets(rest, currentSeqs, currentTrips, results);
    currentTrips.pop();
  }

  // 2. Try forming a sequence (only suit tiles can form sequence)
  if (first.suit && first.value && first.value <= 7) {
    const t2Type = `${first.value + 1}${first.suit}` as TileType;
    const t3Type = `${first.value + 2}${first.suit}` as TileType;

    const t2 = tiles.find((t) => t.type === t2Type);
    const t3 = tiles.find((t) => t.type === t3Type);

    if (t2 && t3) {
      const seq = [first, t2, t3];
      const rest = removeTiles(tiles, seq);
      currentSeqs.push(seq);
      decomposeIntoSets(rest, currentSeqs, currentTrips, results);
      currentSeqs.pop();
    }
  }
}

function removeTiles(all: Tile[], toRemove: Tile[]): Tile[] {
  const removeIds = new Set(toRemove.map((t) => t.id));
  return all.filter((t) => !removeIds.has(t.id));
}

// Evaluate complete hand and calculate exact Fan based on Appendix III
export function evaluateWin(
  handTiles: Tile[],
  melds: Meld[],
  winningTile: Tile,
  context: {
    isSelfDraw: boolean;
    prevailingWind: Wind;
    seatWind: Wind;
    isUnderTheSea?: boolean; // Last tile of wall
    isSelfDrawOnKong?: boolean; // 杠上开花
  }
): WinEvaluation {
  // If self-draw, handTiles already contains the drawn tile (14 tiles, or 11/8/5/2 with melds).
  // If win on discard (荣和), handTiles has 13 (or 10/7/4/1) tiles, so add winningTile.
  const effectiveHand = context.isSelfDraw
    ? handTiles
    : [...handTiles, winningTile];

  // All tiles, including the 4th tile of any Kong (used for suit/honor analysis)
  const fullHand = [...effectiveHand, ...melds.flatMap((m) => m.tiles)];

  // Hand must have 14 tiles to be a winning hand, counting each meld (Kongs included) as 3
  if (effectiveHand.length + melds.length * 3 !== 14) {
    return {
      isWin: false,
      fanDetails: [],
      totalFan: 0,
      pointsAwarded: 0,
      description: '未和牌',
      breakdown: null,
    };
  }

  // 1. Check Thirteen Orphans (X3)
  if (melds.length === 0 && checkThirteenOrphans(fullHand)) {
    const fanDetails: FanDetail[] = [DESIGNATED_HANDS.X3];
    if (context.isSelfDraw) fanDetails.push(DESIGNATED_HANDS.A2);
    if (context.isUnderTheSea) fanDetails.push(DESIGNATED_HANDS.A5);

    const totalFan = Math.min(10, fanDetails.reduce((sum, f) => sum + f.fan, 0));
    return {
      isWin: true,
      fanDetails,
      totalFan,
      pointsAwarded: totalFan * (context.isSelfDraw ? 15 : 10),
      description: '国士无双 · 十三幺极品满贯！',
      breakdown: { sequences: [], triplets: [], pair: [winningTile], isThirteenOrphans: true },
    };
  }

  // 2. Standard Hand Decomposition
  const decompositions = decomposeHand(effectiveHand, melds);
  if (decompositions.length === 0) {
    return {
      isWin: false,
      fanDetails: [],
      totalFan: 0,
      pointsAwarded: 0,
      description: '未和牌',
      breakdown: null,
    };
  }

  // Evaluate each decomposition to find the highest Fan combination
  let bestEval: WinEvaluation | null = null;

  for (const decomp of decompositions) {
    const fanDetails: FanDetail[] = [];

    // Analyze suits in hand
    const suitsPresent = new Set<string>();
    let honorCount = 0;
    let suitTileCount = 0;

    fullHand.forEach((t) => {
      if (t.suit) {
        suitsPresent.add(t.suit);
        suitTileCount++;
      } else {
        honorCount++;
      }
    });

    const isAllHonors = suitTileCount === 0 && honorCount === fullHand.length;
    const isFullFlush = suitsPresent.size === 1 && honorCount === 0;
    const isHalfFlush = suitsPresent.size === 1 && honorCount > 0;

    // Check Dragons in triplets and pair
    const dragonTriplets: Dragon[] = [];
    let dragonPair: Dragon | null = null;

    decomp.triplets.forEach((trip) => {
      if (trip[0].dragon) dragonTriplets.push(trip[0].dragon);
    });
    if (decomp.pair[0].dragon) dragonPair = decomp.pair[0].dragon;

    // Check Winds in triplets and pair
    const windTriplets: Wind[] = [];
    let windPair: Wind | null = null;

    decomp.triplets.forEach((trip) => {
      if (trip[0].wind) windTriplets.push(trip[0].wind);
    });
    if (decomp.pair[0].wind) windPair = decomp.pair[0].wind;

    // High Tier Hand Check:
    // X4 All Honors (字一色)
    if (isAllHonors) {
      fanDetails.push(DESIGNATED_HANDS.X4);
    }

    // X2 Big Four Winds (大四喜)
    const isBigFourWinds = windTriplets.length === 4;
    // B4 Little Four Winds (小四喜)
    const isLittleFourWinds = windTriplets.length === 3 && windPair !== null;

    if (isBigFourWinds) {
      fanDetails.push(DESIGNATED_HANDS.X2);
    } else if (isLittleFourWinds) {
      fanDetails.push(DESIGNATED_HANDS.B4);
    }

    // X1 Big Three Dragons (大三元)
    const isBigThreeDragons = dragonTriplets.length === 3;
    // B3 Little Three Dragons (小三元)
    const isLittleThreeDragons = dragonTriplets.length === 2 && dragonPair !== null;

    if (isBigThreeDragons) {
      fanDetails.push(DESIGNATED_HANDS.X1);
    } else if (isLittleThreeDragons) {
      fanDetails.push(DESIGNATED_HANDS.B3);
    }

    // B5 Full Flush (清一色)
    if (isFullFlush && !isAllHonors) {
      fanDetails.push(DESIGNATED_HANDS.B5);
    }

    // B2 Half Flush (混一色)
    if (isHalfFlush) {
      fanDetails.push(DESIGNATED_HANDS.B2);
    }

    // B1 All Triplets (碰碰胡)
    if (decomp.triplets.length === 4 && !isAllHonors) {
      fanDetails.push(DESIGNATED_HANDS.B1);
    }

    // A1 Common Hand (平胡)
    // "A winning hand consisting of 1 pair and 4 sequences of suit tiles"
    // Hand must have 4 sequences and 0 triplets; the pair may be suit or honor tiles.
    if (decomp.sequences.length === 4 && decomp.triplets.length === 0) {
      fanDetails.push(DESIGNATED_HANDS.A1);
    }

    // Wind Triplet checking:
    // "cannot be counted twice with Little or Big Four Winds"
    if (!isBigFourWinds && !isLittleFourWinds) {
      // A3 Prevailing Wind Triplet (圈风刻)
      if (windTriplets.includes(context.prevailingWind)) {
        fanDetails.push(DESIGNATED_HANDS.A3);
      }
      // A4 Seat Wind Triplet (门风刻)
      if (windTriplets.includes(context.seatWind)) {
        // If seat wind matches prevailing wind, it counts as both A3 and A4!
        fanDetails.push(DESIGNATED_HANDS.A4);
      }
    }

    // Dragon Triplet checking:
    // "cannot be counted twice with Little or Big Three Dragons"
    if (!isBigThreeDragons && !isLittleThreeDragons) {
      if (dragonTriplets.length === 1) {
        fanDetails.push(DESIGNATED_HANDS.A7);
      } else if (dragonTriplets.length === 2) {
        fanDetails.push(DESIGNATED_HANDS.A7);
        fanDetails.push(DESIGNATED_HANDS.A8);
      }
    }

    // Operational Fans:
    // A2 Self-Draw (自摸)
    if (context.isSelfDraw) {
      fanDetails.push(DESIGNATED_HANDS.A2);
    }

    // A5 Under the Sea (海底捞月)
    if (context.isUnderTheSea) {
      fanDetails.push(DESIGNATED_HANDS.A5);
    }

    // A6 Self-Draw on Kong (杠上开花)
    if (context.isSelfDrawOnKong) {
      fanDetails.push(DESIGNATED_HANDS.A6);
    }

    // Calculate sum of fan (capped at 10 as per rules)
    const rawFan = fanDetails.reduce((sum, f) => sum + f.fan, 0);
    // Hands not listed in Appendix III are not recognized, so a 0 Fan hand is not a win.
    if (rawFan === 0) continue;
    const totalFan = Math.min(10, rawFan);
    const pointsAwarded = totalFan * (context.isSelfDraw ? 15 : 10);

    const description = fanDetails.map((f) => f.name.split(' ')[0]).join(' + ');

    const currentEval: WinEvaluation = {
      isWin: true,
      fanDetails,
      totalFan,
      pointsAwarded,
      description,
      breakdown: decomp,
    };

    if (!bestEval || currentEval.totalFan > bestEval.totalFan) {
      bestEval = currentEval;
    }
  }

  if (!bestEval) {
    return {
      isWin: false,
      fanDetails: [],
      totalFan: 0,
      pointsAwarded: 0,
      description: '无番不和',
      breakdown: null,
    };
  }

  return bestEval;
}

// Check if player can Chi discarded tile
export function getChiCombinations(hand: Tile[], discardedTile: Tile): Tile[][] {
  if (!discardedTile.suit || !discardedTile.value) return [];

  const suit = discardedTile.suit;
  const val = discardedTile.value;
  const suitsInHand = hand.filter((t) => t.suit === suit && t.value !== undefined);

  const combinations: Tile[][] = [];
  const addedKeys = new Set<string>();

  // [val - 2, val - 1, val]
  if (val >= 3) {
    const tMinus2 = suitsInHand.find((t) => t.value === val - 2);
    const tMinus1 = suitsInHand.find((t) => t.value === val - 1);
    if (tMinus2 && tMinus1) {
      const key = `${val - 2}_${val - 1}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        combinations.push([tMinus2, tMinus1, discardedTile]);
      }
    }
  }

  // [val - 1, val, val + 1]
  if (val >= 2 && val <= 8) {
    const tMinus1 = suitsInHand.find((t) => t.value === val - 1);
    const tPlus1 = suitsInHand.find((t) => t.value === val + 1);
    if (tMinus1 && tPlus1) {
      const key = `${val - 1}_${val + 1}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        combinations.push([tMinus1, discardedTile, tPlus1]);
      }
    }
  }

  // [val, val + 1, val + 2]
  if (val <= 7) {
    const tPlus1 = suitsInHand.find((t) => t.value === val + 1);
    const tPlus2 = suitsInHand.find((t) => t.value === val + 2);
    if (tPlus1 && tPlus2) {
      const key = `${val + 1}_${val + 2}`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        combinations.push([discardedTile, tPlus1, tPlus2]);
      }
    }
  }

  return combinations;
}

// Check if player can Peng discarded tile
export function canPeng(hand: Tile[], discardedTile: Tile): boolean {
  const match = hand.filter((t) => t.type === discardedTile.type);
  return match.length >= 2;
}

// Check if player can Ming Gang (discarded tile)
export function canMingGang(hand: Tile[], discardedTile: Tile): boolean {
  const match = hand.filter((t) => t.type === discardedTile.type);
  return match.length >= 3;
}

// Check if player can An Gang (from hand)
export function getAnGangCandidates(hand: Tile[]): Tile[][] {
  const groups: Record<string, Tile[]> = {};
  hand.forEach((t) => {
    groups[t.type] = groups[t.type] || [];
    groups[t.type].push(t);
  });
  return Object.values(groups).filter((g) => g.length === 4);
}

// Check if player can Bu Gang (drawn tile matches existing Peng meld)
export function getBuGangCandidates(hand: Tile[], melds: Meld[]): { meld: Meld; tile: Tile }[] {
  const candidates: { meld: Meld; tile: Tile }[] = [];
  const pengMelds = melds.filter((m) => m.type === 'peng');

  for (const meld of pengMelds) {
    const meldType = meld.tiles[0].type;
    const matchingTile = hand.find((t) => t.type === meldType);
    if (matchingTile) {
      candidates.push({ meld, tile: matchingTile });
    }
  }

  return candidates;
}
