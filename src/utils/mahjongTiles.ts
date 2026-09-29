import { Tile, TileType, Suit, Wind, Dragon } from '../types/mahjong';

export const SUITS: { id: Suit; name: string; symbol: string }[] = [
  { id: 'wan', name: '萬子', symbol: '萬' },
  { id: 'tiao', name: '條子', symbol: '條' },
  { id: 'tong', name: '筒子', symbol: '筒' },
];

export const WINDS: { id: Wind; name: string; char: string }[] = [
  { id: 'E', name: '东风', char: '東' },
  { id: 'S', name: '南风', char: '南' },
  { id: 'W', name: '西风', char: '西' },
  { id: 'N', name: '北风', char: '北' },
];

export const DRAGONS: { id: Dragon; name: string; char: string; color: string }[] = [
  { id: 'C', name: '红中', char: '中', color: '#DC2626' }, // Red
  { id: 'F', name: '发财', char: '發', color: '#16A34A' }, // Green
  { id: 'B', name: '白板', char: '白', color: '#2563EB' }, // Blue frame
];

export const CHINESE_NUMS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function createFullDeck(): Tile[] {
  const deck: Tile[] = [];

  // 1. Wan, Tiao, Tong (1-9, 4 copies each)
  const suits: Suit[] = ['wan', 'tiao', 'tong'];
  suits.forEach((suit) => {
    for (let val = 1; val <= 9; val++) {
      for (let copy = 0; copy < 4; copy++) {
        let suffix = '萬';
        if (suit === 'tiao') suffix = '條';
        if (suit === 'tong') suffix = '筒';

        deck.push({
          id: `${suit}_${val}_${copy}`,
          type: `${val}${suit}` as TileType,
          suit,
          value: val,
          displayName: `${CHINESE_NUMS[val]}${suffix}`,
          shortName: `${val}${suit[0]}`,
        });
      }
    }
  });

  // 2. Winds (E, S, W, N, 4 copies each)
  const winds: Wind[] = ['E', 'S', 'W', 'N'];
  winds.forEach((w) => {
    const windInfo = WINDS.find((item) => item.id === w)!;
    for (let copy = 0; copy < 4; copy++) {
      deck.push({
        id: `wind_${w}_${copy}`,
        type: `wind_${w}` as TileType,
        wind: w,
        displayName: windInfo.name,
        shortName: windInfo.char,
      });
    }
  });

  // 3. Dragons (C, F, B, 4 copies each)
  const dragons: Dragon[] = ['C', 'F', 'B'];
  dragons.forEach((d) => {
    const dInfo = DRAGONS.find((item) => item.id === d)!;
    for (let copy = 0; copy < 4; copy++) {
      deck.push({
        id: `dragon_${d}_${copy}`,
        type: `dragon_${d}` as TileType,
        dragon: d,
        displayName: dInfo.name,
        shortName: dInfo.char,
      });
    }
  });

  return deck;
}

export function shuffleDeck(deck: Tile[]): Tile[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Sorting order: Wan 1-9, Tiao 1-9, Tong 1-9, Winds E/S/W/N, Dragons C/F/B
export function getTileSortWeight(tile: Tile | TileType): number {
  const type = typeof tile === 'string' ? tile : tile.type;

  if (type.endsWith('wan')) {
    const val = parseInt(type[0], 10);
    return 10 + val;
  }
  if (type.endsWith('tiao')) {
    const val = parseInt(type[0], 10);
    return 30 + val;
  }
  if (type.endsWith('tong')) {
    const val = parseInt(type[0], 10);
    return 50 + val;
  }
  if (type === 'wind_E') return 71;
  if (type === 'wind_S') return 72;
  if (type === 'wind_W') return 73;
  if (type === 'wind_N') return 74;
  if (type === 'dragon_C') return 81;
  if (type === 'dragon_F') return 82;
  if (type === 'dragon_B') return 83;

  return 999;
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => getTileSortWeight(a) - getTileSortWeight(b));
}

export function getTileTypeFromSuitVal(suit: Suit, val: number): TileType {
  return `${val}${suit}` as TileType;
}

export function getTileNameByType(type: TileType): string {
  if (type.endsWith('wan')) return `${CHINESE_NUMS[parseInt(type[0], 10)]}萬`;
  if (type.endsWith('tiao')) return `${CHINESE_NUMS[parseInt(type[0], 10)]}條`;
  if (type.endsWith('tong')) return `${CHINESE_NUMS[parseInt(type[0], 10)]}筒`;
  if (type === 'wind_E') return '东风';
  if (type === 'wind_S') return '南风';
  if (type === 'wind_W') return '西风';
  if (type === 'wind_N') return '北风';
  if (type === 'dragon_C') return '红中';
  if (type === 'dragon_F') return '发财';
  if (type === 'dragon_B') return '白板';
  return type;
}

export function areTilesEqual(a: Tile | TileType, b: Tile | TileType): boolean {
  const typeA = typeof a === 'string' ? a : a.type;
  const typeB = typeof b === 'string' ? b : b.type;
  return typeA === typeB;
}
