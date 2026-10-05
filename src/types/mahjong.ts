/**
 * Mahjong domain types based on Appendix I and Appendix III
 */

export type Suit = 'wan' | 'tiao' | 'tong';
export type Wind = 'E' | 'S' | 'W' | 'N'; // 东 南 西 北
export type Dragon = 'C' | 'F' | 'B'; // 中 发 白

export type TileType = 
  | `${number}${Suit}` // e.g. '1wan' ... '9wan', '1tiao' ... '9tiao', '1tong' ... '9tong'
  | `wind_${Wind}`     // 'wind_E', 'wind_S', 'wind_W', 'wind_N'
  | `dragon_${Dragon}`; // 'dragon_C', 'dragon_F', 'dragon_B'

export type DifficultyLevel = 'beginner' | 'intermediate' | 'master' | 'tournament';

export interface Tile {
  id: string; // unique tile identifier (e.g. 'wan_1_0')
  type: TileType;
  suit?: Suit;
  value?: number; // 1-9 for suit tiles
  wind?: Wind;
  dragon?: Dragon;
  displayName: string;
  shortName: string;
}

export type MeldType = 'chi' | 'peng' | 'ming_gang' | 'an_gang' | 'bu_gang';

export interface Meld {
  id: string;
  type: MeldType;
  tiles: Tile[];
  fromPlayerIndex?: number; // who discarded the tile
  calledTile?: Tile;
}

export interface FanDetail {
  code: string; // e.g. 'A1', 'B2', 'X1'
  name: string; // 'Common Hand' / '平胡'
  fan: number;  // 1 to 10
  desc: string;
}

export interface WinEvaluation {
  isWin: boolean;
  fanDetails: FanDetail[];
  totalFan: number;
  pointsAwarded: number;
  description: string;
  breakdown: {
    sequences: Tile[][];
    triplets: Tile[][];
    pair: Tile[];
    isThirteenOrphans?: boolean;
  } | null;
}

export interface DiscardRecommendation {
  tileId: string;
  tile: Tile;
  shantenAfter: number;
  effectiveTilesCount: number; // 进张总张数
  effectiveTileTypes: TileType[]; // 进张牌类型
  safetyScore: number; // 0 (very dangerous) to 100 (100% safe)
  safetyLevel: 'safe' | 'medium' | 'danger';
  safetyReason: string;
  scoreRank: number; // 1 = best
  recommendationReason: string;
  // Plain shape shanten after the discard (may be lower than shantenAfter when the fastest
  // shape has no fan and could only win by self-draw)
  shapeShantenAfter?: number;
  // No route to a hand with at least 1 fan on a discard remains (only self-draw can win)
  noFanRoute?: boolean;
  // Draws that improve the plain shape but not any fan route (lead to self-draw-only hands)
  selfDrawOnlyTilesCount?: number;
  selfDrawOnlyTileTypes?: TileType[];
}

export interface TenpaiWait {
  tileType: TileType;
  displayName: string;
  remainingCount: number; // tiles remaining in unseen wall
  estimatedFan: number;
  possibleFans: string[];
  // This wait has no fan on a discard: it can only win by self-draw
  selfDrawOnly?: boolean;
}

export interface TurnActionLog {
  turnNumber: number;
  playerIndex: number;
  playerName: string;
  action: 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass';
  tile?: Tile;
  meld?: Meld;
  shantenBefore?: number;
  shantenAfter?: number;
  aiComment?: string;
  isBlunder?: boolean;
  blunderSeverity?: 'critical' | 'inaccuracy';
  blunderType?: 'shanten_retreat' | 'efficiency_loss' | 'dangerous_discard';
  blunderTypeName?: string;
  blunderReason?: string;
  recommendedDiscard?: Tile;
  bestRec?: DiscardRecommendation;
  chosenRec?: DiscardRecommendation;
  // Discards only: the thrown tile was the one just drawn (摸切). Visible to everyone at the table.
  fromDraw?: boolean;
  // The human's discards only: the danger read at that moment, for the post-hand review
  danger?: DiscardDangerRecord;
}

// What the danger model (src/analysis/danger.ts) said when the human discarded
export interface DiscardDangerRecord {
  pct: number; // chance the thrown tile wins for someone, 0-1
  level: 'safe' | 'medium' | 'danger';
  expectedLoss: number; // expected points lost by throwing it
  reasons: string[];
  bySeat: { seat: number; pct: number; fan: number }[];
  // Safest tile in hand at that moment
  safest: { type: TileType; displayName: string; pct: number };
  // Opponent reads at that moment
  opponents: { seat: number; pReady: number; fan: number; reasons: string[] }[];
  hintsOn: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  isHuman: boolean;
  seatWind: Wind; // 东, 南, 西, 北
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  score: number; // Net points in current 16-round game
  startingScore: number;
  isTenpai: boolean;
  tenpaiWaits: TenpaiWait[];
  // Declared a false win this hand (strict mode): can't win again until the next hand
  isDead?: boolean;
}

export interface RoundResult {
  roundIndex: number; // 0 to 15 (Round 1 to 16)
  prevailingWind: Wind; // 圈风 (东, 南, 西, 北)
  roundInWind: number; // 1 to 4
  dealerIndex: number;
  winnerIndex: number | null; // null if draw (荒庄/流局)
  winningTile: Tile | null;
  isSelfDraw: boolean;
  discarderIndex: number | null;
  fanDetails: FanDetail[];
  totalFan: number;
  pointsDelta: number[]; // point change for each player [p0, p1, p2, p3]
  actionLogs: TurnActionLog[];
  handSnapshots: {
    hand: Tile[];
    melds: Meld[];
  }[];
}

export interface GameStats {
  totalGames: number;
  totalRounds: number;
  humanWins: number;
  humanSelfDraws: number;
  humanDealIns: number; // 放铳/出冲
  humanTenpaiCount: number;
  highestFan: number;
  highestFanNames: string[];
  totalPointsEarned: number;
  fansAchievedCounts: Record<string, number>;
  historicalRounds: RoundResult[];
}
