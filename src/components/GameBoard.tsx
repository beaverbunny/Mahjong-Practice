import React from 'react';
import { PlayerState, Tile, Meld, Wind, TurnActionLog, DiscardRecommendation, RoundResult } from '../types/mahjong';
import { MahjongTile } from './MahjongTile';
import { WIND_NAMES, sortTiles } from '../utils/mahjongTiles';
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
  // When round finishes: reveal all players' concealed hands face up
  revealAllHands?: boolean;
  roundResult?: RoundResult | null;
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
  revealAllHands = false,
  roundResult = null,
}) => {
  const human = players[0];
  const rightBot = players[1]; // 下家
  const topBot = players[2];   // 对家
  const leftBot = players[3];  // 上家

  const isHumanTurn = activePlayerIndex === 0;

  // Best recommendation tile ID
  const bestRecTileId = discardRecommendations[0]?.tileId;

  // "下家 · 速攻型 (进阶)" -> "下家"
  const seatOf = (idx: number) => players[idx]?.name.split(' · ')[0] ?? '';

  // Name, seat wind and score; highlighted while it's that player's turn
  const seatBadge = (idx: number) => {
    const p = players[idx];
    return (
      <div
        className={`flex flex-col items-center px-2.5 py-1 rounded-xl text-xs transition-all whitespace-nowrap ${
          activePlayerIndex === idx
            ? 'bg-amber-500/30 text-amber-200 border border-amber-400/80 ring-2 ring-amber-400/30 shadow-md'
            : 'bg-stone-900/60 text-stone-300 border border-stone-800'
        }`}
      >
        <span className="font-bold truncate max-w-[150px]">{p.name}</span>
        <div className="flex items-center gap-1 text-[10px] text-stone-400">
          <span className="text-amber-400 font-mono">{WIND_NAMES[p.seatWind]}風</span>
          <span>{p.score}點</span>
        </div>
      </div>
    );
  };

  // One player's discards, 6 per row, inside a dashed outline of the full river area (4 rows) so the
  // table keeps its shape all hand; the river is labelled until its first discard.
  // Tiles thrown straight from the draw (摸切) are faded.
  const river = (idx: number) => {
    const tiles = players[idx].discards;
    return (
      <div className="relative grid grid-cols-6 gap-1 p-1 rounded-xl bg-black/10 border border-dashed border-white/15 min-h-[166px] min-w-[188px] justify-items-center content-start">
        {tiles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pl-[0.4em] pointer-events-none text-base font-serif tracking-[0.4em] text-white/25">
            {['自家', '下家', '對家', '上家'][idx]}棄牌區
          </div>
        )}
        {tiles.map((t, i) => {
          const isLatest = lastDiscardedTile?.tile.id === t.id && lastDiscardedTile.fromPlayer === idx;
          const isSelectedMatch = selectedTile ? selectedTile.type === t.type : false;
          return (
            <div
              key={t.id + i}
              className={`relative ${drawnDiscardIds.has(t.id) ? 'opacity-50 saturate-50' : ''}`}
              title={drawnDiscardIds.has(t.id) ? '摸到就打：打出的是剛摸到的牌' : '從手牌打出'}
            >
              <MahjongTile tile={t} size="xs" isSelected={isSelectedMatch} dimmed={selectedTile ? !isSelectedMatch : false} />
              {isLatest && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping ring-2 ring-amber-300 pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-[#0E3D24] rounded-2xl overflow-hidden shadow-2xl border-8 border-[#2E1810] flex flex-col justify-between p-3 select-none">
      {/* Subtle table felt inner shadow ring */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />

      {/* ================= TOP PLAYER (对家) ================= */}
      {/* Badge sits beside the hand; the hand stays centered on the table */}
      <div className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="justify-self-end">{seatBadge(2)}</div>
        {/* Top Hand Tiles & Melds */}
        <div className="flex items-center gap-3">
          {/* Concealed or Revealed Tiles */}
          <div className="flex items-center gap-1">
            {revealAllHands ? (
              sortTiles(topBot.hand).map((tile) => {
                const isWinTile = roundResult?.winnerIndex === 2 && roundResult?.winningTile?.id === tile.id;
                const isSelected = selectedTile?.type === tile.type;
                return (
                  <div key={tile.id} className="relative">
                    <MahjongTile
                      tile={tile}
                      size="sm"
                      isSelected={isSelected}
                      onClick={() => onSelectTile(tile)}
                    />
                    {isWinTile && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-1 py-0.2 bg-amber-500 text-stone-950 font-black text-[9px] rounded shadow ring-1 ring-amber-300">
                        胡牌
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              topBot.hand.map((_, idx) => (
                <MahjongTile key={idx} tile={{ type: '1wan' }} size="sm" isFaceDown />
              ))
            )}
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
        <div />
      </div>

      {/* ================= MIDDLE ZONE (LEFT, CENTER, RIGHT) ================= */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-between px-1 my-1">
        {/* LEFT PLAYER (上家) */}
        <div className="flex flex-col items-center gap-1.5 sm:gap-2 w-28 sm:w-36 shrink-0 py-0.5">
          {seatBadge(3)}

          {/* Left Bot Hand Tiles */}
          {revealAllHands ? (
            <div className="flex flex-wrap gap-1 max-w-[130px] sm:max-w-[150px] justify-center max-h-80 overflow-y-auto p-1 bg-stone-950/60 rounded-lg border border-stone-800">
              {sortTiles(leftBot.hand).map((tile) => {
                const isWinTile = roundResult?.winnerIndex === 3 && roundResult?.winningTile?.id === tile.id;
                const isSelected = selectedTile?.type === tile.type;
                return (
                  <div key={tile.id} className="relative">
                    <MahjongTile
                      tile={tile}
                      size="xs"
                      isSelected={isSelected}
                      onClick={() => onSelectTile(tile)}
                    />
                    {isWinTile && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1 py-0.2 bg-amber-500 text-stone-950 font-black text-[8px] rounded shadow ring-1 ring-amber-300">
                        胡牌
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 sm:gap-1 items-center py-0.5">
              {leftBot.hand.map((_, idx) => (
                <div
                  key={idx}
                  className="w-10 sm:w-12 h-3.5 sm:h-4 rounded-[2px] bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-950 border border-emerald-950 shadow-sm flex items-center justify-between px-1 shrink-0"
                  title="上家手牌"
                >
                  <div className="w-1.5 h-full bg-[#FAF8F5] rounded-l-[1px] border-r border-stone-300" />
                  <div className="flex-1 h-1 mx-1 rounded-[1px] bg-emerald-900/40 border border-emerald-600/30" />
                </div>
              ))}
            </div>
          )}

          {/* Left Melds */}
          {leftBot.melds.length > 0 && (
            <div className="flex flex-col gap-1 items-center max-w-full mt-1 shrink-0">
              {leftBot.melds.map((meld) => (
                <MeldDisplay key={meld.id} meld={meld} playerIndex={3} size="sm" />
              ))}
            </div>
          )}
        </div>

        {/* ================= CENTER: COMPASS & 4 DISCARD RIVERS ================= */}
        <div className="flex-1 h-full min-h-0 flex flex-col items-center justify-between gap-1 px-1 sm:px-2">
          {river(2)}

          <div className="w-full flex items-center justify-center gap-3">
            <div className="flex-1 flex justify-end">{river(3)}</div>

            {/* Center Table Compass & Live HUD */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="w-44 h-32 rounded-2xl bg-stone-950/90 backdrop-blur border border-stone-800 shadow-2xl flex flex-col items-center justify-between p-2 text-stone-300 relative overflow-hidden whitespace-nowrap">
                {/* Visual Action Banner Overlay (碰！吃！杠！胡！) */}
                {actionBanner && (
                  <div className="absolute inset-0 bg-stone-950/95 backdrop-blur-md flex flex-col items-center justify-center px-2 z-30 animate-in zoom-in-75 duration-200">
                    {/* Calls ("下家 · 碰！", at most 9 characters) in large gold on one line; longer messages wrap in small text */}
                    <span
                      className={`text-center text-amber-300 ${
                        actionBanner.text.length <= 9
                          ? `font-serif font-black whitespace-nowrap drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-bounce ${
                              actionBanner.text.length <= 7 ? 'text-2xl tracking-widest' : 'text-xl tracking-wide'
                            }`
                          : 'font-bold text-xs leading-snug whitespace-normal break-words'
                      }`}
                    >
                      {actionBanner.text}
                    </span>
                  </div>
                )}

                {/* Seat winds around the dial; the active seat lights up */}
                <div className={`text-sm font-serif font-bold transition-colors ${activePlayerIndex === 2 ? 'text-amber-400 scale-125' : 'text-stone-500'}`}>
                  {WIND_NAMES[topBot.seatWind]}
                </div>

                <div className="w-full flex items-center justify-between px-1">
                  <div className={`text-sm font-serif font-bold transition-colors ${activePlayerIndex === 3 ? 'text-amber-400 scale-125' : 'text-stone-500'}`}>
                    {WIND_NAMES[leftBot.seatWind]}
                  </div>

                  {/* Prevailing wind, hand number and tiles left */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-3xl font-serif font-black text-amber-400 leading-none">
                      {prevailingWind === 'E' ? '東' : prevailingWind === 'S' ? '南' : prevailingWind === 'W' ? '西' : '北'}
                    </span>
                    <div className="flex flex-col leading-tight">
                      <span className="text-[11px] text-stone-200 font-bold">
                        第 {currentRoundNumber} 盤 <span className="text-stone-400 font-mono font-normal">/16</span>
                      </span>
                      <span className="text-[10px] text-stone-400">
                        餘 <span className="text-emerald-400 font-bold font-mono">{wallRemaining}</span> 張
                      </span>
                    </div>
                  </div>

                  <div className={`text-sm font-serif font-bold transition-colors ${activePlayerIndex === 1 ? 'text-amber-400 scale-125' : 'text-stone-500'}`}>
                    {WIND_NAMES[rightBot.seatWind]}
                  </div>
                </div>

                <div className="flex flex-col items-center leading-tight">
                  <div className={`text-sm font-serif font-bold transition-colors ${activePlayerIndex === 0 ? 'text-amber-400 scale-125' : 'text-stone-500'}`}>
                    {WIND_NAMES[human.seatWind]}
                  </div>
                  <div className="text-[9px] text-stone-500">
                    {revealAllHands ? (
                      <span className="text-amber-300 font-bold">對局結束 · 終局亮牌</span>
                    ) : isHumanTurn ? (
                      <span className="text-amber-400 font-semibold animate-pulse">輪到您出牌</span>
                    ) : (
                      <span>{seatOf(activePlayerIndex)}思考中…</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex justify-start">{river(1)}</div>
          </div>

          {river(0)}
        </div>

        {/* RIGHT PLAYER (下家) */}
        <div className="flex flex-col items-center gap-1.5 sm:gap-2 w-28 sm:w-36 shrink-0 py-0.5">
          {seatBadge(1)}

          {/* Right Bot Hand Tiles */}
          {revealAllHands ? (
            <div className="flex flex-wrap gap-1 max-w-[130px] sm:max-w-[150px] justify-center max-h-80 overflow-y-auto p-1 bg-stone-950/60 rounded-lg border border-stone-800">
              {sortTiles(rightBot.hand).map((tile) => {
                const isWinTile = roundResult?.winnerIndex === 1 && roundResult?.winningTile?.id === tile.id;
                const isSelected = selectedTile?.type === tile.type;
                return (
                  <div key={tile.id} className="relative">
                    <MahjongTile
                      tile={tile}
                      size="xs"
                      isSelected={isSelected}
                      onClick={() => onSelectTile(tile)}
                    />
                    {isWinTile && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1 py-0.2 bg-amber-500 text-stone-950 font-black text-[8px] rounded shadow ring-1 ring-amber-300">
                        胡牌
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 sm:gap-1 items-center py-0.5">
              {rightBot.hand.map((_, idx) => (
                <div
                  key={idx}
                  className="w-10 sm:w-12 h-3.5 sm:h-4 rounded-[2px] bg-gradient-to-r from-emerald-950 via-emerald-700 to-emerald-800 border border-emerald-950 shadow-sm flex items-center justify-between px-1 shrink-0"
                  title="下家手牌"
                >
                  <div className="flex-1 h-1 mx-1 rounded-[1px] bg-emerald-900/40 border border-emerald-600/30" />
                  <div className="w-1.5 h-full bg-[#FAF8F5] rounded-r-[1px] border-l border-stone-300" />
                </div>
              ))}
            </div>
          )}

          {/* Right Melds */}
          {rightBot.melds.length > 0 && (
            <div className="flex flex-col gap-1 items-center max-w-full mt-1 shrink-0">
              {rightBot.melds.map((meld) => (
                <MeldDisplay key={meld.id} meld={meld} playerIndex={1} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= BOTTOM HUMAN PLAYER (玩家) ================= */}
      <div className="relative z-40">
        {/* Action Controls (Chi, Peng, Gang, Hu, confirm discard) float centred above the hand so they never shift the table */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max z-40">
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
        </div>

        {/* Hand Area: badge on the left, hand and melds centered on the table */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
          <div className="justify-self-start pb-1">{seatBadge(0)}</div>

          {/* Interactive Hand Tiles & Exposed Melds (Grouped side by side) */}
          <div className="flex items-end justify-center gap-3 pt-7 pb-1">
            <div className="flex items-end justify-center gap-0.5 sm:gap-1 shrink-0">
              {human.hand.map((tile, idx) => {
                const isNewlyDrawn =
                  isHumanTurn && human.hand.length % 3 === 2 && idx === human.hand.length - 1;
                const isRecommended = tile.id === bestRecTileId;
                // One recommendation per tile kind: every copy in hand shares its risk tag
                const rec = discardRecommendations.find((r) => r.tile.type === tile.type);
                const isPengTarget = canPeng && lastDiscardedTile?.tile.type === tile.type;
                const isChiTarget = canChi && chiCombinations.some((comb) => comb.some((t) => t.id === tile.id));

                const isWinTile = roundResult?.winnerIndex === 0 && roundResult?.winningTile?.id === tile.id;

                return (
                  <div key={tile.id} className="relative">
                    <MahjongTile
                      tile={tile}
                      size="lg"
                      isSelected={selectedTile?.id === tile.id || (revealAllHands && selectedTile?.type === tile.type)}
                      isRecommended={isRecommended}
                      safetyLevel={rec?.safetyLevel}
                      isDrawn={isNewlyDrawn}
                      showHints={showHints}
                      isPengTarget={isPengTarget}
                      isChiTarget={isChiTarget}
                      onClick={() => {
                        soundManager.playTileClick();
                        if (selectedTile?.id === tile.id && isHumanTurn && human.hand.length % 3 === 2 && !roundResult) {
                          // Double click to discard
                          soundManager.playTileDiscard();
                          onConfirmDiscard(tile);
                        } else {
                          onSelectTile(tile);
                        }
                      }}
                    />
                    {isWinTile && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.2 bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 font-black text-[10px] rounded shadow ring-1 ring-amber-200">
                        胡牌
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Exposed Melds (Directly beside hand tiles) */}
            {human.melds.length > 0 && (
              <div className="shrink-0 flex items-end gap-1.5 sm:gap-2 pb-0.5 pl-1.5 sm:pl-2.5 border-l border-white/15">
                {human.melds.map((meld) => (
                  <MeldDisplay key={meld.id} meld={meld} playerIndex={0} size="sm" />
                ))}
              </div>
            )}
          </div>
          <div />
        </div>
      </div>
    </div>
  );
};
