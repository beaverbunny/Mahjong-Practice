import React from 'react';
import {
  Tile,
  TileType,
  Meld,
  Wind,
  DiscardRecommendation,
  TenpaiWait,
  PlayerState,
} from '../types/mahjong';
import { MahjongTile } from './MahjongTile';
import { Sparkles, ShieldAlert, Award, Compass, Eye, Info } from 'lucide-react';

interface StrategyPanelProps {
  hand: Tile[];
  melds: Meld[];
  currentShanten: number;
  tenpaiWaits: TenpaiWait[];
  discardRecommendations: DiscardRecommendation[];
  players: PlayerState[];
  activePlayerIndex: number;
  prevailingWind: Wind;
  humanSeatWind: Wind;
  onTileSelect?: (tile: Tile) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const StrategyPanel: React.FC<StrategyPanelProps> = ({
  hand,
  melds,
  currentShanten,
  tenpaiWaits,
  discardRecommendations,
  players,
  activePlayerIndex,
  prevailingWind,
  humanSeatWind,
  onTileSelect,
  isOpen,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = React.useState<'efficiency' | 'defense' | 'yaku'>('efficiency');

  const shantenLabel = () => {
    if (currentShanten === 0) return '听牌 (Tenpai)';
    if (currentShanten === 1) return '一向听 (1-Shanten)';
    if (currentShanten === 2) return '二向听 (2-Shanten)';
    if (currentShanten === 3) return '三向听 (3-Shanten)';
    return `${currentShanten} 向听`;
  };

  // Potential Yaku Progress Analysis
  const analyzeYakuProgress = () => {
    const fullHand = [...hand, ...melds.flatMap((m) => m.tiles)];
    const suits = { wan: 0, tiao: 0, tong: 0 };
    let honors = 0;
    let dragons = 0;
    let winds = 0;

    fullHand.forEach((t) => {
      if (t.suit) suits[t.suit]++;
      if (t.dragon) {
        dragons++;
        honors++;
      }
      if (t.wind) {
        winds++;
        honors++;
      }
    });

    const dominantSuitCount = Math.max(suits.wan, suits.tiao, suits.tong);
    const dominantSuit = (Object.keys(suits) as ('wan' | 'tiao' | 'tong')[]).find(
      (s) => suits[s] === dominantSuitCount
    );

    const goals: { name: string; fan: number; progress: number; tip: string }[] = [];

    // Full Flush (清一色 7番)
    if (dominantSuitCount >= 7) {
      goals.push({
        name: '清一色 (7番)',
        fan: 7,
        progress: Math.min(100, Math.round((dominantSuitCount / 14) * 100)),
        tip: `已有 ${dominantSuitCount}/14 张${dominantSuit === 'wan' ? '万' : dominantSuit === 'tiao' ? '条' : '筒'}子，可果断清理它色牌`,
      });
    }

    // Half Flush (混一色 3番)
    if (dominantSuitCount + honors >= 9 && honors > 0) {
      goals.push({
        name: '混一色 (3番)',
        fan: 3,
        progress: Math.min(100, Math.round(((dominantSuitCount + honors) / 14) * 100)),
        tip: `单色结合字牌已达 ${dominantSuitCount + honors} 张，成牌极快`,
      });
    }

    // All Triplets (碰碰胡 3番)
    // Count pairs in hand
    const counts: Record<string, number> = {};
    hand.forEach((t) => (counts[t.type] = (counts[t.type] || 0) + 1));
    const handPairs = Object.values(counts).filter((c) => c >= 2).length;
    const pengMelds = melds.filter((m) => m.type !== 'chi').length;
    const totalPairsOrTrips = handPairs + pengMelds;

    if (totalPairsOrTrips >= 3) {
      goals.push({
        name: '碰碰胡 (3番)',
        fan: 3,
        progress: Math.min(100, Math.round((totalPairsOrTrips / 5) * 100)),
        tip: `已有 ${totalPairsOrTrips} 组对子/刻子，遇碰即碰加速成型`,
      });
    }

    // Dragon / Wind Triplet (1番 each)
    if (dragons >= 2) {
      goals.push({
        name: '箭牌刻 (1-2番)',
        fan: 1,
        progress: Math.min(100, Math.round((dragons / 3) * 100)),
        tip: '中发白是宝贵的番种来源，注意留存碰出',
      });
    }

    // Common Hand (平胡 1番)
    if (honors === 0 && dominantSuitCount < 10) {
      goals.push({
        name: '平胡 (1番)',
        fan: 1,
        progress: 80,
        tip: '四副序数顺子加任意对子，进攻防守最均衡',
      });
    }

    return goals;
  };

  const yakuGoals = analyzeYakuProgress();

  return (
    <aside
      className={`fixed top-16 right-4 bottom-4 z-30 transition-all duration-300 flex flex-col ${
        isOpen ? 'w-88 sm:w-96' : 'w-12 pointer-events-none'
      }`}
    >
      {/* Toggle Tab Button */}
      <button
        onClick={onToggle}
        className={`pointer-events-auto self-start mb-2 px-3 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-amber-400 border border-amber-500/30 shadow-lg text-xs font-medium flex items-center gap-1.5 backdrop-blur cursor-pointer transition-transform hover:scale-105`}
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>{isOpen ? '收起策略助手' : '策略助手'}</span>
      </button>

      {/* Main Container */}
      {isOpen && (
        <div className="flex-1 bg-stone-900/95 backdrop-blur-md border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-stone-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-stone-800 bg-stone-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-stone-100">实战策略与牌效研习</h3>
            </div>
            <div className="text-xs px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-mono">
              {shantenLabel()}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center border-b border-stone-800 bg-stone-950/40 p-1">
            <button
              onClick={() => setActiveTab('efficiency')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'efficiency'
                  ? 'bg-stone-800 text-amber-400 font-bold shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              进张与牌效
            </button>
            <button
              onClick={() => setActiveTab('defense')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'defense'
                  ? 'bg-stone-800 text-amber-400 font-bold shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              局势与防守
            </button>
            <button
              onClick={() => setActiveTab('yaku')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeTab === 'yaku'
                  ? 'bg-stone-800 text-amber-400 font-bold shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              番种目标
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* TAB 1: Tile Efficiency (进张与牌效) */}
            {activeTab === 'efficiency' && (
              <div className="space-y-4">
                {/* Tenpai Status Section */}
                {currentShanten === 0 && (
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-950/60 to-stone-900 border border-emerald-700/60 shadow-inner">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                        <Award className="w-4 h-4 text-emerald-400" />
                        <span>已听牌！等待和牌张：</span>
                      </div>
                      <span className="text-[11px] text-stone-400">
                        共 {tenpaiWaits.reduce((acc, w) => acc + w.remainingCount, 0)} 张余牌
                      </span>
                    </div>

                    <div className="space-y-2 mt-2">
                      {tenpaiWaits.map((wait) => (
                        <div
                          key={wait.tileType}
                          className="flex items-center justify-between bg-stone-900/80 p-2 rounded-lg border border-stone-800"
                        >
                          <div className="flex items-center gap-2">
                            <MahjongTile tile={{ type: wait.tileType }} size="xs" />
                            <div>
                              <div className="font-semibold text-stone-100">{wait.displayName}</div>
                              <div className="text-[10px] text-amber-400/90">
                                {wait.possibleFans.join(' + ') || '基本和牌'}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-emerald-400 text-sm">
                              {wait.remainingCount} 张
                            </div>
                            <div className="text-[10px] text-stone-400">预估 {wait.estimatedFan} 番</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discard Recommendations */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-stone-200">最佳舍牌推荐 (牌效排行)：</span>
                    <span className="text-[11px] text-stone-400">点击牌面可选中</span>
                  </div>

                  {discardRecommendations.length === 0 ? (
                    <div className="text-stone-500 italic p-3 text-center bg-stone-950/40 rounded-xl">
                      手牌为13张时请等待轮到自己摸牌
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {discardRecommendations.slice(0, 4).map((rec, idx) => (
                        <div
                          key={rec.tileId}
                          onClick={() => onTileSelect && onTileSelect(rec.tile)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            idx === 0
                              ? 'bg-emerald-950/40 border-emerald-600/70 hover:bg-emerald-950/60'
                              : 'bg-stone-950/40 border-stone-800 hover:bg-stone-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <MahjongTile tile={rec.tile} size="sm" isRecommended={idx === 0} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-100 text-xs">
                                  {rec.tile.displayName}
                                </span>
                                {idx === 0 && (
                                  <span className="text-[10px] text-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 rounded font-medium">
                                    最优推荐
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-stone-400 mt-0.5">
                                {rec.recommendationReason}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-amber-400 block">
                              {rec.effectiveTilesCount} 张进张
                            </span>
                            <span
                              className={`text-[10px] ${
                                rec.safetyLevel === 'safe'
                                  ? 'text-emerald-400'
                                  : rec.safetyLevel === 'medium'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {rec.safetyLevel === 'safe'
                                ? '安全'
                                : rec.safetyLevel === 'medium'
                                ? '较稳'
                                : '危险'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Defense and Opponent Situation (局势与防守) */}
            {activeTab === 'defense' && (
              <div className="space-y-4">
                <div className="p-3 bg-stone-950/50 rounded-xl border border-stone-800 space-y-2">
                  <div className="font-bold text-stone-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>对手听牌与鸣牌警戒</span>
                  </div>
                  {players
                    .filter((p) => !p.isHuman)
                    .map((bot, idx) => (
                      <div
                        key={bot.id}
                        className="flex items-center justify-between py-1.5 border-b border-stone-800/60 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-300">{bot.name}</span>
                          <span className="text-stone-500 font-mono text-[10px]">
                            ({bot.seatWind}风)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-stone-400 text-[11px]">
                            副露: {bot.melds.length} 组
                          </span>
                          {bot.isTenpai ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-900/80 text-rose-300 font-bold text-[10px] border border-rose-700 animate-pulse">
                              已听牌
                            </span>
                          ) : (
                            <span className="text-stone-500 text-[10px]">未听</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Defense Safety Guide */}
                <div className="space-y-2">
                  <div className="font-bold text-stone-200">当前手牌安全度速查：</div>
                  <div className="grid grid-cols-2 gap-2">
                    {discardRecommendations.map((rec) => (
                      <div
                        key={rec.tileId}
                        className="p-2 rounded-lg bg-stone-950/40 border border-stone-800 flex items-center gap-2"
                      >
                        <MahjongTile tile={rec.tile} size="xs" safetyLevel={rec.safetyLevel} />
                        <div className="overflow-hidden">
                          <div className="text-[11px] font-semibold truncate text-stone-200">
                            {rec.tile.displayName}
                          </div>
                          <div className="text-[9px] text-stone-400 truncate">
                            {rec.safetyReason}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-200/90 leading-relaxed">
                  <span className="font-bold">防守铁律：</span>
                  对手鸣牌3组或听牌时，优先切打“现物”（对手弃牌河中已出现的牌）或字牌绝张，切忌打生张中张（四五六）出冲点炮。
                </div>
              </div>
            )}

            {/* TAB 3: Target Yaku (番种路线目标) */}
            {activeTab === 'yaku' && (
              <div className="space-y-3">
                <div className="font-bold text-stone-200 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>当前手牌番种潜力分析</span>
                </div>

                {yakuGoals.map((goal, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-stone-950/40 border border-stone-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 text-xs">{goal.name}</span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        契合度 {goal.progress}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-stone-400 leading-normal">{goal.tip}</p>
                  </div>
                ))}

                <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800 text-[11px] text-stone-400 space-y-1">
                  <div className="font-semibold text-stone-300">本局风圈增益：</div>
                  <p>
                    圈风：<span className="text-amber-400 font-bold">{prevailingWind}风</span>{' '}
                    (圈风刻1番) · 门风：
                    <span className="text-amber-400 font-bold">{humanSeatWind}风</span> (门风刻1番)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
