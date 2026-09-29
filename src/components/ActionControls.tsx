import React from 'react';
import { Tile, Meld } from '../types/mahjong';
import { MahjongTile } from './MahjongTile';
import { soundManager } from '../utils/audio';

interface ActionControlsProps {
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
  discardPendingTile?: Tile | null;
  onConfirmDiscard?: () => void;
  isHumanTurnToDiscard?: boolean;
  calledTile?: Tile | null;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
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
  discardPendingTile,
  onConfirmDiscard,
  isHumanTurnToDiscard = false,
  calledTile,
}) => {
  const [showChiPicker, setShowChiPicker] = React.useState(false);
  const [showGangPicker, setShowGangPicker] = React.useState(false);

  // Auto reset drawers if calling window closes
  React.useEffect(() => {
    if (!canChi) setShowChiPicker(false);
  }, [canChi]);

  React.useEffect(() => {
    if (!canGang) setShowGangPicker(false);
  }, [canGang]);

  const hasAnyMeldAction = canChi || canPeng || canGang || canHu;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {/* Chi Combination Selector Drawer */}
      {showChiPicker && chiCombinations.length > 0 && (
        <div className="bg-stone-900/95 backdrop-blur border border-amber-500/60 rounded-xl p-3 shadow-2xl flex flex-col items-center gap-2.5 animate-in fade-in zoom-in-95 z-30">
          <div className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
            <span>请选择吃牌顺子组合：</span>
            {calledTile && (
              <span className="text-[11px] text-stone-400 font-normal">
                (吃上家打出的【{calledTile.displayName}】)
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {chiCombinations.map((comb, idx) => (
              <button
                key={idx}
                onClick={() => {
                  soundManager.playMeld();
                  setShowChiPicker(false);
                  onChi(comb);
                }}
                className="flex items-center gap-1 p-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-400 transition-all cursor-pointer shadow-md group"
              >
                {comb.map((t) => {
                  const isTheCalledOne = calledTile && t.id === calledTile.id;
                  return (
                    <div key={t.id} className="relative">
                      <MahjongTile tile={t} size="sm" />
                      {isTheCalledOne && (
                        <div className="absolute -top-1.5 -right-1 bg-amber-500 text-stone-950 font-bold text-[8px] px-0.5 rounded shadow">
                          吃
                        </div>
                      )}
                    </div>
                  );
                })}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowChiPicker(false)}
            className="text-xs text-stone-400 hover:text-white underline cursor-pointer"
          >
            返回
          </button>
        </div>
      )}

      {/* Gang Candidate Selector Drawer */}
      {showGangPicker && gangCandidates.length > 0 && (
        <div className="bg-stone-900/95 backdrop-blur border border-amber-500/60 rounded-xl p-3 shadow-2xl flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 z-30">
          <div className="text-xs text-amber-300 font-bold">请选择要开杠的牌组：</div>
          <div className="flex items-center gap-3">
            {gangCandidates.map((cand, idx) => (
              <button
                key={idx}
                onClick={() => {
                  soundManager.playKong();
                  setShowGangPicker(false);
                  onGang(cand);
                }}
                className="flex items-center gap-1 p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-400 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-0.5">
                  {cand.tiles.map((t, tIdx) => (
                    <MahjongTile key={t.id + tIdx} tile={t} size="sm" />
                  ))}
                </div>
                <span className="text-xs text-amber-200 ml-1">
                  {cand.type === 'an_gang' ? '暗杠' : cand.type === 'bu_gang' ? '补杠' : '明杠'}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowGangPicker(false)}
            className="text-xs text-stone-400 hover:text-white underline cursor-pointer"
          >
            取消
          </button>
        </div>
      )}

      {/* Primary Action Buttons Bar */}
      {(hasAnyMeldAction || isHumanTurnToDiscard) && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-950/85 backdrop-blur border border-stone-800/80 shadow-2xl">
          {/* Discard prompt / confirmation button */}
          {isHumanTurnToDiscard && !hasAnyMeldAction && (
            <div className="flex items-center gap-2">
              {discardPendingTile ? (
                <>
                  <span className="text-xs text-stone-300 font-medium">确认打出：</span>
                  <MahjongTile tile={discardPendingTile} size="xs" />
                  <button
                    onClick={() => {
                      soundManager.playTileDiscard();
                      if (onConfirmDiscard) onConfirmDiscard();
                    }}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
                  >
                    出牌
                  </button>
                </>
              ) : (
                <div className="text-xs text-amber-300/90 font-medium flex items-center gap-1 animate-pulse">
                  <span>👉 请点击选择手牌打出一张完成本巡</span>
                </div>
              )}
            </div>
          )}

          {/* Hu / Self-draw button */}
          {canHu && (
            <button
              onClick={() => {
                soundManager.playHu();
                onHu();
              }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-serif font-black text-sm tracking-widest shadow-lg shadow-red-900/40 transition-all transform hover:scale-105 active:scale-95 cursor-pointer animate-bounce"
            >
              {isSelfDraw ? '自 摸' : '胡 牌'}
            </button>
          )}

          {/* Kong Button */}
          {canGang && (
            <button
              onClick={() => {
                if (gangCandidates.length === 1) {
                  soundManager.playKong();
                  onGang(gangCandidates[0]);
                } else {
                  setShowGangPicker(true);
                }
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-serif font-black text-sm tracking-wider shadow-md transition-all active:scale-95 cursor-pointer"
            >
              杠
            </button>
          )}

          {/* Peng Button */}
          {canPeng && (
            <button
              onClick={() => {
                soundManager.playMeld();
                onPeng();
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-serif font-black text-sm tracking-wider shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>碰</span>
              {calledTile && (
                <span className="text-[11px] bg-blue-950/80 px-1.5 py-0.5 rounded text-blue-200 border border-blue-400/40 font-sans font-medium">
                  {calledTile.displayName}
                </span>
              )}
            </button>
          )}

          {/* Chi Button */}
          {canChi && (
            <button
              onClick={() => {
                if (chiCombinations.length === 1) {
                  soundManager.playMeld();
                  onChi(chiCombinations[0]);
                } else {
                  setShowChiPicker(true);
                }
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-serif font-black text-sm tracking-wider shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>吃</span>
              {chiCombinations.length > 1 && (
                <span className="text-[10px] bg-emerald-800/80 px-1 rounded">
                  ({chiCombinations.length}种)
                </span>
              )}
            </button>
          )}

          {/* Pass Button */}
          {hasAnyMeldAction && (
            <button
              onClick={() => {
                setShowChiPicker(false);
                setShowGangPicker(false);
                onPass();
              }}
              className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-sans text-xs transition-colors cursor-pointer"
            >
              过
            </button>
          )}
        </div>
      )}
    </div>
  );
};
