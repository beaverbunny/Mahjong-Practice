import React from 'react';
import { Tile, TileType, Meld, Wind, DiscardRecommendation, TenpaiWait } from '../types/mahjong';
import { MahjongTile } from './MahjongTile';
import { createFullDeck, shuffleDeck, sortTiles } from '../utils/mahjongTiles';
import {
  calculateShanten,
  generateDiscardRecommendations,
  calculateTenpaiWaits,
} from '../utils/strategyEngine';
import { GraduationCap, X, RefreshCw, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface PracticeDrillsModalProps {
  onClose: () => void;
}

export const PracticeDrillsModal: React.FC<PracticeDrillsModalProps> = ({ onClose }) => {
  const [hand, setHand] = React.useState<Tile[]>([]);
  const [selectedTile, setSelectedTile] = React.useState<Tile | null>(null);
  const [hasEvaluated, setHasEvaluated] = React.useState(false);
  const [recommendations, setRecommendations] = React.useState<DiscardRecommendation[]>([]);

  // Generate random 14-tile practice problem
  const generateNewProblem = React.useCallback(() => {
    const deck = shuffleDeck(createFullDeck());
    const sampleHand = sortTiles(deck.slice(0, 14));
    setHand(sampleHand);
    setSelectedTile(null);
    setHasEvaluated(false);

    // Precalculate recommendations
    const recs = generateDiscardRecommendations(
      sampleHand,
      [],
      sampleHand,
      'E',
      'E',
      [[], [], [], []],
      [false, false, false, false]
    );
    setRecommendations(recs);
  }, []);

  React.useEffect(() => {
    generateNewProblem();
  }, [generateNewProblem]);

  const handleTileClick = (t: Tile) => {
    if (hasEvaluated) return;
    soundManager.playTileClick();
    setSelectedTile(t);
  };

  const handleConfirmDiscard = () => {
    if (!selectedTile) return;
    soundManager.playTileDiscard();
    setHasEvaluated(true);
  };

  const bestRec = recommendations[0];
  const userRec = recommendations.find((r) => r.tile.id === selectedTile?.id);
  const isOptimal = userRec?.scoreRank === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-serif text-stone-100">
                牌效何切与向听进阶研习
              </h2>
              <div className="text-xs text-stone-400">
                实战题库演练 · 磨炼舍牌直觉与进张最大化
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-stone-300">
          <div className="p-3.5 bg-stone-950/60 rounded-xl border border-stone-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-200">当前手牌 (14张)：</span>
              <span className="text-[11px] text-stone-400">
                请点击选择一张你认为【牌效最高】的舍牌打出
              </span>
            </div>
            <button
              onClick={generateNewProblem}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>换一题</span>
            </button>
          </div>

          {/* Interactive Hand */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 p-4 bg-stone-950/80 rounded-2xl border border-stone-800">
            {hand.map((tile) => (
              <MahjongTile
                key={tile.id}
                tile={tile}
                size="lg"
                isSelected={selectedTile?.id === tile.id}
                isRecommended={hasEvaluated && tile.id === bestRec?.tileId}
                onClick={() => handleTileClick(tile)}
              />
            ))}
          </div>

          {/* Action to confirm */}
          {!hasEvaluated && selectedTile && (
            <div className="flex justify-center">
              <button
                onClick={handleConfirmDiscard}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                确认切出【{selectedTile.displayName}】并分析牌效
              </button>
            </div>
          )}

          {/* Results Analysis */}
          {hasEvaluated && bestRec && userRec && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isOptimal
                    ? 'bg-emerald-950/30 border-emerald-600/70 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-700/70 text-rose-200'
                }`}
              >
                {isOptimal ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-bold text-sm">
                    {isOptimal ? '正解！你的出牌达到了全局最高牌效' : '略有瑕疵：存在更优进张选择'}
                  </h3>
                  <p className="mt-1 leading-relaxed text-xs">
                    {isOptimal
                      ? `打出【${selectedTile?.displayName}】后，向听数降至${userRec.shantenAfter}，有效进张达${userRec.effectiveTilesCount}张！`
                      : `你切出了【${selectedTile?.displayName}】(进张${userRec.effectiveTilesCount}张)，而最佳切牌为【${bestRec.tile.displayName}】(进张高达${bestRec.effectiveTilesCount}张)！`}
                  </p>
                </div>
              </div>

              {/* Detailed Options Comparison Table */}
              <div className="space-y-2">
                <span className="font-semibold text-stone-200">各备选舍牌牌效横向对比：</span>
                <div className="space-y-1.5">
                  {recommendations.slice(0, 4).map((rec, idx) => (
                    <div
                      key={rec.tileId}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        idx === 0
                          ? 'bg-emerald-950/20 border-emerald-700/60'
                          : rec.tileId === selectedTile?.id
                          ? 'bg-amber-950/20 border-amber-600/60'
                          : 'bg-stone-950/40 border-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-stone-400 text-xs font-bold">
                          #{idx + 1}
                        </span>
                        <MahjongTile tile={rec.tile} size="xs" />
                        <div>
                          <div className="font-bold text-stone-200 text-xs">
                            切 {rec.tile.displayName}
                          </div>
                          <div className="text-[10px] text-stone-400">
                            {rec.shantenAfter === 0 ? '听牌' : `${rec.shantenAfter}向听`} ·{' '}
                            {rec.recommendationReason}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {rec.effectiveTilesCount} 张进张
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-950/80 border-t border-stone-800 flex justify-between items-center text-xs">
          <span className="text-stone-400">多做何切训练，可在实战对局中快人一步听牌。</span>
          <button
            onClick={generateNewProblem}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold transition-colors cursor-pointer"
          >
            下一题演练
          </button>
        </div>
      </div>
    </div>
  );
};
