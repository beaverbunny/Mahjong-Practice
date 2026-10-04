import React from 'react';
import { Meld, Tile } from '../types/mahjong';
import { MahjongTile } from './MahjongTile';

interface MeldDisplayProps {
  meld: Meld;
  playerIndex: number; // 0 = human, 1 = right, 2 = top, 3 = left
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const MeldDisplay: React.FC<MeldDisplayProps> = ({
  meld,
  playerIndex,
  size = 'sm',
  className = '',
}) => {
  // 1. CHI (吃牌)
  // 规则要求：显示吃的牌在三张牌中间，方便判断吃了哪张。
  if (meld.type === 'chi') {
    const called = meld.calledTile;
    let orderedTiles: { tile: Tile; isCalled: boolean }[] = [];

    if (called && meld.tiles.length === 3) {
      // Find the called tile in the meld
      const calledIndex = meld.tiles.findIndex(
        (t) => t.id === called.id || t.type === called.type
      );
      if (calledIndex !== -1) {
        const handTiles = meld.tiles.filter((_, idx) => idx !== calledIndex);
        // Sort the other 2 hand tiles by value
        handTiles.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
        // Place called tile right in the center (index 1)
        orderedTiles = [
          { tile: handTiles[0], isCalled: false },
          { tile: meld.tiles[calledIndex], isCalled: true },
          { tile: handTiles[1], isCalled: false },
        ];
      }
    }

    if (orderedTiles.length !== 3) {
      // Fallback if calledTile not matched: treat middle tile as called
      orderedTiles = meld.tiles.map((t, idx) => ({
        tile: t,
        isCalled: idx === 1,
      }));
    }

    return (
      <div
        className={`flex items-end gap-0.5 p-1 rounded-lg bg-black/40 border border-stone-800/80 shadow-md ${className}`}
        title="吃牌 (中间为所吃之牌)"
      >
        {orderedTiles.map(({ tile, isCalled }, idx) => (
          <MahjongTile
            key={tile.id + idx}
            tile={tile}
            size={size}
            isCalled={isCalled}
          />
        ))}
      </div>
    );
  }

  // 2. PENG (碰牌)
  // 规则要求：
  // 碰上家：左边一张横放
  // 碰对家：中间一张横放
  // 碰下家：右边一张横放
  if (meld.type === 'peng') {
    // Determine relative direction of the discarder:
    // In 4-player table (0: East, 1: South, 2: West, 3: North):
    // For meld owner P:
    // 上家 (Left): (P + 3) % 4 -> diff === 3
    // 对家 (Opposite): (P + 2) % 4 -> diff === 2
    // 下家 (Right): (P + 1) % 4 -> diff === 1
    const from = meld.fromPlayerIndex ?? (playerIndex + 3) % 4;
    const diff = (from - playerIndex + 4) % 4;

    // Determine which tile is horizontal:
    // diff === 3: 上家 -> index 0 (左边一张)
    // diff === 2: 对家 -> index 1 (中间一张)
    // diff === 1: 下家 -> index 2 (右边一张)
    const horizontalIdx = diff === 3 ? 0 : diff === 2 ? 1 : 2;

    const fromLabel = diff === 3 ? '碰上家 (左横)' : diff === 2 ? '碰对家 (中横)' : '碰下家 (右横)';

    return (
      <div
        className={`flex items-end gap-0.5 p-1 rounded-lg bg-black/40 border border-stone-800/80 shadow-md ${className}`}
        title={`碰牌 - ${fromLabel}`}
      >
        {meld.tiles.map((t, idx) => (
          <MahjongTile
            key={t.id + idx}
            tile={t}
            size={size}
            isHorizontal={idx === horizontalIdx}
          />
        ))}
      </div>
    );
  }

  // 3. MING GANG / BU GANG (明杠 / 补杠)
  // 同样遵循横放辨认规则：
  // 碰上家杠：左边一张横放
  // 碰对家杠：中间一张横放
  // 碰下家杠：右边一张横放
  if (meld.type === 'ming_gang' || meld.type === 'bu_gang') {
    const from = meld.fromPlayerIndex ?? (playerIndex + 3) % 4;
    const diff = (from - playerIndex + 4) % 4;
    const horizontalIdx = diff === 3 ? 0 : diff === 2 ? 1 : 3;

    return (
      <div
        className={`flex items-end gap-0.5 p-1 rounded-lg bg-black/40 border border-stone-800/80 shadow-md ${className}`}
        title="明杠"
      >
        {meld.tiles.map((t, idx) => (
          <MahjongTile
            key={t.id + idx}
            tile={t}
            size={size}
            isHorizontal={idx === horizontalIdx}
          />
        ))}
      </div>
    );
  }

  // 4. AN GANG (暗杠)
  // 传统麻将暗杠：两侧两张扣牌，中间两张翻开亮出牌面
  return (
    <div
      className={`flex items-end gap-0.5 p-1 rounded-lg bg-black/40 border border-stone-800/80 shadow-md ${className}`}
      title="暗杠"
    >
      {meld.tiles.map((t, idx) => (
        <MahjongTile
          key={t.id + idx}
          tile={t}
          size={size}
          isFaceDown={idx === 0 || idx === 3}
        />
      ))}
    </div>
  );
};
