import React from 'react';
import { PlayerState, Tile, Meld, Wind, TurnActionLog, DiscardRecommendation } from '../types/mahjong';
import { MahjongTile } from './MahjongTile';
import { WIND_NAMES } from '../utils/mahjongTiles';
import { MeldDisplay } from './MeldDisplay';
import { ActionControls } from './ActionControls';
import { soundManager } from '../utils/audio';

interface GameBoardProps {
  players: PlayerState[];
  activePlayerIndex: number;
  prevailingWind: Wind;
  currentRoundNumber: number; // 1 to 16
  dealerIndex: number;
  wallRemaining: number;
  selectedTile: Tile | null;
  onSelectTile: (tile: Tile) => void;
  onConfirmDiscard: (tile: Tile) => void;
  // Meld Action Handlers
  canChi: boolean;
  chiCombinations: Tile[][];
  canPeng: boolean;
  canGang: boolean;
  gangCandidates: { type: 'ming_gang' | 'an_gang' | 'bu_gang'; tiles: Tile[]; meld?: Meld }[];
  canHu: boolean;
  isSelfDraw: boolean;
  onChi: (selectedTiles: Tile[]) => void;
  onPeng: () => void;
  onGang: (candidate: { type: 'ming_gang' | 'an_gang' | 'bu_gang'; tiles: Tile[]; meld?: Meld }) => void;
  onHu: () => void;
  onPass: () => void;
  discardRecommendations: DiscardRecommendation[];
  lastDiscardedTile: { tile: Tile; fromPlayer: number } | null;
  showHints?: boolean;
  actionBanner?: { text: string; playerIdx: number } | null;
  // Discards that were the tile just drawn (摸切), shown faded in the rivers
  drawnDiscardIds?: Set<string>;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  players,
  activePlayerIndex,
  prevailingWind,
  currentRoundNumber,
  dealerIndex,
  wallRemaining,
  selectedTile,
  onSelectTile,
  onConfirmDiscard,
  canChi,
  chiCombinations,
  canPeng,
  canGang,
  gangCandidates,
  canHu,
  isSelfDraw,
  onChi,
  onPeng,
  onGang,
  onHu,
  onPass,
  discardRecommendations,
  lastDiscardedTile,
  showHints = true,
  actionBanner = null,
  drawnDiscardIds = new Set<string>(),
}) => {
  const human = players[0];
  const rightBot = players[1]; // 下家
  const topBot = players[2];   // 对家
  const leftBot = players[3];  // 上家

  const isHumanTurn = activePlayerIndex === 0;

  // Best recommendation tile ID
  const bestRecTileId = discardRecommendations[0]?.tileId;

  // Compute round wind description
  const windRoundName = () => {
    const windMap: Record<Wind, string> = { E: '东风圈', S: '南风圈', W: '西风圈', N: '北风圈' };
    const dealerMap = ['东局', '南局', '西局', '北局'];
    const windIdx = Math.floor((currentRoundNumber - 1) / 4);
    const subIdx = (currentRoundNumber - 1) % 4;
    return `${windMap[prevailingWind]} · ${dealerMap[subIdx]} (${currentRoundNumber}/16)`;
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] max-h-[920px] bg-[#0E3D24] rounded-2xl overflow-hidden shadow-2xl border-8 border-[#2E1810] flex flex-col justify-between p-2 sm:p-4 select-none">
      {/* Subtle table felt inner shadow ring */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />

      {/* ================= TOP PLAYER (对家) ================= */}
      <div className="relative z-10 flex flex-col items-center gap-1">
        {/* Opponent Info Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-all ${
            activePlayerIndex === 2
              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/80 shadow-md ring-2 ring-amber-400/30'
              : 'bg-stone-900/60 text-stone-300 border border-stone-800'
          }`}
        >
          <span className="font-bold">{topBot.name}</span>
          <span className="text-[10px] text-amber-400 font-mono">门风:{WIND_NAMES[topBot.seatWind]}</span>
          <span className="text-[10px] font-mono text-stone-400">
            ({topBot.score > 0 ? `+${topBot.score}` : topBot.score}点)
          </span>
        </div>

        {/* Top Hand Tiles & Melds */}
        <div className="flex items-center gap-3">
          {/* Concealed Tiles */}
          <div className="flex items-center gap-1">
            {topBot.hand.map((_, idx) => (
              <MahjongTile key={idx} tile={{ type: '1wan' }} size="sm" isFaceDown />
            ))}
          </div>

          {/* Melds */}
          {topBot.melds.length > 0 && (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              {topBot.melds.map((meld) => (
                <MeldDisplay key={meld.id} meld={meld} playerIndex={2} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= MIDDLE ZONE (LEFT, CENTER, RIGHT) ================= */}
      <div className="relative z-10 flex-1 flex items-center justify-between px-1 sm:px-4 my-1 overflow-hidden">
        {/* LEFT PLAYER (上家) */}
        <div className="flex flex-col items-center gap-1.5 w-28 sm:w-36 shrink-0">
          <div
            className={`flex flex-col items-center px-2 py-1 rounded-xl text-xs transition-all w-full ${
              activePlayerIndex === 3
                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/80 ring-2 ring-amber-400/30'
                : 'bg-stone-900/60 text-stone-300 border border-stone-800'
            }`}
          >
            <span className="font-bold truncate max-w-[115px] sm:max-w-[135px]">{leftBot.name}</span>
            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              <span className="text-amber-400 font-mono">{WIND_NAMES[leftBot.seatWind]}风</span>
              <span>{leftBot.score}点</span>
            </div>
          </div>

          {/* Left Bot Hand Tiles (vertical stack with authentic 3D Mahjong depth) */}
          <div className="flex flex-col gap-0.5 max-h-48 overflow-hidden items-center">
            {leftBot.hand.slice(0, 13).map((_, idx) => (
              <div
                key={idx}
                className="w-10 sm:w-12 h-3.5 sm:h-4 rounded-[2px] bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-950 border border-emerald-950 shadow-sm flex items-center justify-between px-1"
                title="上家手牌"
              >
                <div className="w-1.5 h-full bg-[#FAF8F5] rounded-l-[1px] border-r border-stone-300" />
                <div className="flex-1 h-1 mx-1 rounded-[1px] bg-emerald-900/40 border border-emerald-600/30" />
              </div>
            ))}
          </div>

          {/* Left Melds */}
          {leftBot.melds.length > 0 && (
            <div className="flex flex-col gap-1 items-center max-w-full overflow-hidden mt-1">
              {leftBot.melds.map((meld) => (
                <MeldDisplay key={meld.id} meld={meld} playerIndex={3} size="sm" />
              ))}
            </div>
          )}
        </div>

        {/* ================= CENTER MAH JONG COMPASS & 4-PLAYER DISCARD RIVERS ================= */}
        <div className="flex-1 max-w-3xl h-full flex flex-col items-center justify-between py-1 px-1 sm:px-2 min-h-0">
          {/* 1. TOP DISCARDS (对家 · 北 弃牌池) */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-stone-300 font-medium mb-0.5 flex items-center gap-1.5">
              <span className="font-bold text-amber-200">对家牌河</span>
              <span className="text-stone-400">({topBot.name})</span>
              <span className="text-[9px] px-1 bg-black/40 rounded text-stone-300 font-mono">
                {topBot.discards.length}张
              </span>
            </div>
            <div className="grid grid-cols-6 gap-0.5 sm:gap-1 p-1 rounded-lg bg-black/30 border border-stone-800/60 min-h-[38px] justify-items-center">
              {topBot.discards.length === 0 ? (
                <div className="col-span-6 text-[10px] text-stone-500 italic py-1 px-4">暂无舍牌</div>
              ) : (
                topBot.discards.map((t, idx) => {
                  const isLatest = lastDiscardedTile?.tile.id === t.id && lastDiscardedTile.fromPlayer === 2;
                  const isSelectedMatch = selectedTile ? selectedTile.type === t.type : false;
                  return (
                    <div
                      key={t.id + idx}
                      className={`relative ${drawnDiscardIds.has(t.id) ? 'opacity-50 saturate-50' : ''}`}
                      title={drawnDiscardIds.has(t.id) ? '摸切：打出的是刚摸到的牌' : '手切：从手牌中打出'}
                    >
                      <MahjongTile
                        tile={t}
                        size="xs"
                        isSelected={isSelectedMatch}
                        dimmed={selectedTile ? !isSelectedMatch : false}
                      />
                      {isLatest && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping ring-2 ring-amber-300 pointer-events-none" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. MIDDLE ROW: LEFT DISCARDS (上家) + COMPASS + RIGHT DISCARDS (下家) */}
          <div className="w-full flex items-center justify-between gap-1 sm:gap-2 my-0.5">
            {/* 上家 (Left Bot) 弃牌池 */}
            <div className="flex-1 flex flex-col items-center max-w-[200px]">
              <div className="text-[10px] text-stone-300 font-medium mb-0.5 flex items-center gap-1">
                <span className="font-bold text-amber-200">上家牌河</span>
                <span className="text-stone-400 truncate max-w-[50px] sm:max-w-[70px]">({leftBot.name})</span>
                <span className="text-[9px] px-1 bg-black/40 rounded text-stone-300 font-mono">
                  {leftBot.discards.length}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-0.5 sm:gap-1 p-1 rounded-lg bg-black/30 border border-stone-800/60 min-h-[38px] w-full justify-items-center">
                {leftBot.discards.length === 0 ? (
                  <div className="col-span-4 sm:col-span-6 text-[10px] text-stone-500 italic py-1 px-1">暂无舍牌</div>
                ) : (
                  leftBot.discards.map((t, idx) => {
                    const isLatest = lastDiscardedTile?.tile.id === t.id && lastDiscardedTile.fromPlayer === 3;
                    const isSelectedMatch = selectedTile ? selectedTile.type === t.type : false;
                    return (
                      <div
                        key={t.id + idx}
                        className={`relative ${drawnDiscardIds.has(t.id) ? 'opacity-50 saturate-50' : ''}`}
                        title={drawnDiscardIds.has(t.id) ? '摸切：打出的是刚摸到的牌' : '手切：从手牌中打出'}
                      >
                        <MahjongTile
                          tile={t}
                          size="xs"
                          isSelected={isSelectedMatch}
                          dimmed={selectedTile ? !isSelectedMatch : false}
                        />
                        {isLatest && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping ring-2 ring-amber-300 pointer-events-none" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Center Table Compass & Live HUD */}
            <div className="relative shrink-0 flex items-center justify-center my-0.5">
              <div className="w-36 sm:w-44 h-28 sm:h-32 rounded-2xl bg-stone-950/90 backdrop-blur border border-stone-800 shadow-2xl flex flex-col items-center justify-between p-2 text-stone-300 relative overflow-hidden">
                {/* Visual Action Banner Overlay (碰！吃！杠！胡！) */}
                {actionBanner && (
                  <div className="absolute inset-0 bg-stone-950/95 backdrop-blur-md flex flex-col items-center justify-center z-30 animate-in zoom-in-75 duration-200">
                    <span className="font-serif font-black text-2xl tracking-widest text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-bounce">
                      {actionBanner.text}
                    </span>
                    <span className="text-[10px] text-stone-300 mt-1">
                      {players[actionBanner.playerIdx]?.name}
                    </span>
                  </div>
                )}

                {/* Top compass wind */}
                <div
                  className={`text-[11px] font-serif font-bold transition-colors ${
                    activePlayerIndex === 2 ? 'text-amber-400 scale-110' : 'text-stone-500'
                  }`}
                >
                  对家 · {WIND_NAMES[topBot.seatWind]}
                </div>

                {/* Middle row: Left, Center info, Right */}
                <div className="w-full flex items-center justify-between px-1">
                  <div
                    className={`text-[11px] font-serif font-bold transition-colors ${
                      activePlayerIndex === 3 ? 'text-amber-400 scale-110' : 'text-stone-500'
                    }`}
                  >
                    <div className="flex flex-col items-center leading-tight whitespace-nowrap">
                      <span>上家</span>
                      <span>{WIND_NAMES[leftBot.seatWind]}</span>
                    </div>
                  </div>

                  {/* Core Dial info */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center gap-1">
                      <span className="text-xl sm:text-2xl font-serif font-black text-amber-400">
                        {prevailingWind === 'E'
                          ? '東'
                          : prevailingWind === 'S'
                          ? '南'
                          : prevailingWind === 'W'
                          ? '西'
                          : '北'}
                      </span>
                      <span className="text-[11px] text-stone-300 font-bold">{windRoundName()}</span>
                    </div>

                    <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                      余牌: <span className="text-emerald-400 font-bold">{wallRemaining}</span> 张
                    </div>

                    <div className="text-[9px] text-stone-500 mt-0.5">
                      {isHumanTurn ? (
                        <span className="text-amber-400 font-semibold animate-pulse">轮到您出牌</span>
                      ) : (
                        <span>{players[activePlayerIndex]?.name}思考中...</span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`text-[11px] font-serif font-bold transition-colors ${
                      activePlayerIndex === 1 ? 'text-amber-400 scale-110' : 'text-stone-500'
                    }`}
                  >
                    <div className="flex flex-col items-center leading-tight whitespace-nowrap">
                      <span>下家</span>
                      <span>{WIND_NAMES[rightBot.seatWind]}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom compass wind */}
                <div
                  className={`text-[11px] font-serif font-bold transition-colors ${
                    activePlayerIndex === 0 ? 'text-amber-400 scale-110' : 'text-stone-500'
                  }`}
                >
                  您 · {WIND_NAMES[human.seatWind]}
                </div>
              </div>

              {/* Pointer glow for active player */}
              {activePlayerIndex === 0 && (
                <div className="absolute -bottom-2 w-8 h-1 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_#F59E0B]" />
              )}
            </div>

            {/* 下家 (Right Bot) 弃牌池 */}
            <div className="flex-1 flex flex-col items-center max-w-[200px]">
              <div className="text-[10px] text-stone-300 font-medium mb-0.5 flex items-center gap-1">
                <span className="font-bold text-amber-200">下家牌河</span>
                <span className="text-stone-400 truncate max-w-[50px] sm:max-w-[70px]">({rightBot.name})</span>
                <span className="text-[9px] px-1 bg-black/40 rounded text-stone-300 font-mono">
                  {rightBot.discards.length}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-0.5 sm:gap-1 p-1 rounded-lg bg-black/30 border border-stone-800/60 min-h-[38px] w-full justify-items-center">
                {rightBot.discards.length === 0 ? (
                  <div className="col-span-4 sm:col-span-6 text-[10px] text-stone-500 italic py-1 px-1">暂无舍牌</div>
                ) : (
                  rightBot.discards.map((t, idx) => {
                    const isLatest = lastDiscardedTile?.tile.id === t.id && lastDiscardedTile.fromPlayer === 1;
                    const isSelectedMatch = selectedTile ? selectedTile.type === t.type : false;
                    return (
                      <div
                        key={t.id + idx}
                        className={`relative ${drawnDiscardIds.has(t.id) ? 'opacity-50 saturate-50' : ''}`}
                        title={drawnDiscardIds.has(t.id) ? '摸切：打出的是刚摸到的牌' : '手切：从手牌中打出'}
                      >
                        <MahjongTile
                          tile={t}
                          size="xs"
                          isSelected={isSelectedMatch}
                          dimmed={selectedTile ? !isSelectedMatch : false}
                        />
                        {isLatest && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping ring-2 ring-amber-300 pointer-events-none" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 3. BOTTOM DISCARDS (玩家自家 弃牌池) */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] text-stone-300 font-medium mb-0.5 flex items-center gap-1.5">
              <span className="font-bold text-emerald-300">自家牌河</span>
              <span className="text-stone-400">(您)</span>
              <span className="text-[9px] text-stone-400" title="摸切 = 打出刚摸到的牌；手切 = 从手牌中打出">
                · 淡色 = 摸切
              </span>
              <span className="text-[9px] px-1 bg-black/40 rounded text-stone-300 font-mono">
                {human.discards.length}张
              </span>
            </div>
            <div className="grid grid-cols-6 gap-0.5 sm:gap-1 p-1 rounded-lg bg-black/30 border border-stone-800/60 min-h-[38px] justify-items-center">
              {human.discards.length === 0 ? (
                <div className="col-span-6 text-[10px] text-stone-500 italic py-1 px-4">暂无舍牌</div>
              ) : (
                human.discards.map((t, idx) => {
                  const isLatest = lastDiscardedTile?.tile.id === t.id && lastDiscardedTile.fromPlayer === 0;
                  const isSelectedMatch = selectedTile ? selectedTile.type === t.type : false;
                  return (
                    <div
                      key={t.id + idx}
                      className={`relative ${drawnDiscardIds.has(t.id) ? 'opacity-50 saturate-50' : ''}`}
                      title={drawnDiscardIds.has(t.id) ? '摸切：打出的是刚摸到的牌' : '手切：从手牌中打出'}
                    >
                      <MahjongTile
                        tile={t}
                        size="xs"
                        isSelected={isSelectedMatch}
                        dimmed={selectedTile ? !isSelectedMatch : false}
                      />
                      {isLatest && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping ring-2 ring-amber-300 pointer-events-none" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PLAYER (下家) */}
        <div className="flex flex-col items-center gap-1.5 w-28 sm:w-36 shrink-0">
          <div
            className={`flex flex-col items-center px-2 py-1 rounded-xl text-xs transition-all w-full ${
              activePlayerIndex === 1
                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/80 ring-2 ring-amber-400/30'
                : 'bg-stone-900/60 text-stone-300 border border-stone-800'
            }`}
          >
            <span className="font-bold truncate max-w-[115px] sm:max-w-[135px]">{rightBot.name}</span>
            <div className="flex items-center gap-1 text-[10px] text-stone-400">
              <span className="text-amber-400 font-mono">{WIND_NAMES[rightBot.seatWind]}风</span>
              <span>{rightBot.score}点</span>
            </div>
          </div>

          {/* Right Bot Hand Tiles (vertical stack with authentic 3D Mahjong depth) */}
          <div className="flex flex-col gap-0.5 max-h-48 overflow-hidden items-center">
            {rightBot.hand.slice(0, 13).map((_, idx) => (
              <div
                key={idx}
                className="w-10 sm:w-12 h-3.5 sm:h-4 rounded-[2px] bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-950 border border-emerald-950 shadow-sm flex items-center justify-between px-1"
                title="下家手牌"
              >
                <div className="w-1.5 h-full bg-[#FAF8F5] rounded-l-[1px] border-r border-stone-300" />
                <div className="flex-1 h-1 mx-1 rounded-[1px] bg-emerald-900/40 border border-emerald-600/30" />
              </div>
            ))}
          </div>

          {/* Right Melds */}
          {rightBot.melds.length > 0 && (
            <div className="flex flex-col gap-1 items-center max-w-full overflow-hidden mt-1">
              {rightBot.melds.map((meld) => (
                <MeldDisplay key={meld.id} meld={meld} playerIndex={1} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= BOTTOM HUMAN PLAYER (玩家) ================= */}
      <div className="relative z-40 flex flex-col items-center gap-2">
        {/* Action Controls Overlay (Chi, Peng, Gang, Hu) */}
        <ActionControls
          canChi={canChi}
          chiCombinations={chiCombinations}
          canPeng={canPeng}
          canGang={canGang}
          gangCandidates={gangCandidates}
          canHu={canHu}
          isSelfDraw={isSelfDraw}
          onChi={onChi}
          onPeng={onPeng}
          onGang={onGang}
          onHu={onHu}
          onPass={onPass}
          discardPendingTile={isHumanTurn && human.hand.length % 3 === 2 ? selectedTile : null}
          isHumanTurnToDiscard={isHumanTurn && human.hand.length % 3 === 2}
          calledTile={lastDiscardedTile?.tile}
          onConfirmDiscard={() => {
            if (selectedTile) {
              onConfirmDiscard(selectedTile);
            }
          }}
        />

        {/* Hand Area Container */}
        <div className="w-full flex items-end justify-between px-2 sm:px-6">
          {/* Player Info Badge (Left of hand) */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-950/80 backdrop-blur border border-stone-800 text-stone-200">
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>{human.name} (您)</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  门风:{WIND_NAMES[human.seatWind]}
                </span>
              </div>
              <div className="text-[11px] font-mono text-stone-400 mt-0.5">
                得分：
                <span className={human.score >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {human.score > 0 ? `+${human.score}` : human.score}
                </span>{' '}
                点
              </div>
            </div>
          </div>

          {/* Interactive Hand Tiles */}
          <div className="flex items-end justify-center gap-1 sm:gap-1.5 overflow-x-auto pb-1 max-w-[85vw]">
            {human.hand.map((tile, idx) => {
              const isNewlyDrawn =
                isHumanTurn && human.hand.length % 3 === 2 && idx === human.hand.length - 1;
              const isRecommended = tile.id === bestRecTileId;
              const rec = discardRecommendations.find((r) => r.tile.id === tile.id);
              const isPengTarget = canPeng && lastDiscardedTile?.tile.type === tile.type;
              const isChiTarget = canChi && chiCombinations.some((comb) => comb.some((t) => t.id === tile.id));

              return (
                <MahjongTile
                  key={tile.id}
                  tile={tile}
                  size="lg"
                  isSelected={selectedTile?.id === tile.id}
                  isRecommended={isRecommended}
                  safetyLevel={rec?.safetyLevel}
                  isDrawn={isNewlyDrawn}
                  showHints={showHints}
                  isPengTarget={isPengTarget}
                  isChiTarget={isChiTarget}
                  onClick={() => {
                    soundManager.playTileClick();
                    if (selectedTile?.id === tile.id && isHumanTurn && human.hand.length % 3 === 2) {
                      // Double click to discard
                      soundManager.playTileDiscard();
                      onConfirmDiscard(tile);
                    } else {
                      onSelectTile(tile);
                    }
                  }}
                />
              );
            })}
          </div>

          {/* Exposed Melds (Right of hand) */}
          <div className="flex items-center gap-2">
            {human.melds.map((meld) => (
              <MeldDisplay key={meld.id} meld={meld} playerIndex={0} size="sm" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
