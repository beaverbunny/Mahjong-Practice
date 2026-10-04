import React from 'react';
import { RoundResult, PlayerState } from '../types/mahjong';
import { sortTiles } from '../utils/mahjongTiles';
import { MahjongTile } from './MahjongTile';
import { MeldDisplay } from './MeldDisplay';
import { Award, ArrowRight, RotateCcw, AlertCircle, FileSearch, BarChart3 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RoundResultModalProps {
  result: RoundResult;
  players: PlayerState[];
  currentRoundNumber: number; // 1 to 16
  onNextRound: () => void;
  onOpenReview: () => void;
  onRestartMatch?: () => void;
  onOpenStats?: () => void;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  result,
  players,
  currentRoundNumber,
  onNextRound,
  onOpenReview,
  onRestartMatch,
  onOpenStats,
}) => {
  const isDraw = result.winnerIndex === null;
  const isHumanWinner = result.winnerIndex === 0;
  const winner = result.winnerIndex !== null ? players[result.winnerIndex] : null;
  const discarder = result.discarderIndex !== null ? players[result.discarderIndex] : null;

  React.useEffect(() => {
    if (isHumanWinner) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isHumanWinner]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header Banner */}
        <div
          className={`px-5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b shrink-0 ${
            isDraw
              ? 'bg-stone-800 border-stone-700 text-stone-200'
              : isHumanWinner
              ? 'bg-gradient-to-r from-emerald-900 to-stone-900 border-emerald-600/50 text-emerald-100'
              : 'bg-stone-950 border-stone-800 text-stone-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Award
              className={`w-5 h-5 ${
                isHumanWinner ? 'text-amber-400' : isDraw ? 'text-stone-400' : 'text-rose-400'
              }`}
            />
            <div>
              <h2 className="text-sm sm:text-base font-bold font-serif">
                {isDraw
                  ? '荒庄流局 (牌墙摸尽)'
                  : `${winner?.name} ${result.isSelfDraw ? '自摸和牌！' : '荣和点炮！'}`}
              </h2>
              <div className="text-[11px] sm:text-xs text-stone-400">
                第 {currentRoundNumber} 局 / 共 16 局 · {result.prevailingWind}风圈
              </div>
            </div>
          </div>

          {!isDraw && (
            <div className="text-right">
              <span className="text-lg sm:text-xl font-bold font-mono text-amber-400">
                {result.totalFan} 番
              </span>
              <div className="text-[10px] sm:text-[11px] text-stone-400">
                {result.isSelfDraw ? '自摸(+15每番)' : '点炮(+10每番)'}
              </div>
            </div>
          )}
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-stone-300 text-xs overscroll-contain">
          {/* Winning Tile & Type Display */}
          {!isDraw && result.winningTile && (
            <div className="flex items-center justify-between p-3.5 bg-stone-950/70 rounded-xl border border-stone-800">
              <div className="flex items-center gap-3">
                <MahjongTile tile={result.winningTile} size="md" />
                <div>
                  <div className="font-semibold text-stone-100 text-sm">
                    和牌张：{result.winningTile.displayName}
                  </div>
                  <div className="text-stone-400 text-xs mt-0.5">
                    {result.isSelfDraw
                      ? '自摸和牌，各家均摊给分'
                      : `放铳者：${discarder?.name || '未知'}`}
                  </div>
                </div>
              </div>

              {/* Fan Badge */}
              <div className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-600/60 text-amber-300 font-bold font-mono text-sm">
                总番数：{result.totalFan} 番
              </div>
            </div>
          )}

          {/* Winner's Complete Hand (Melds + Concealed Hand + Winning Tile) */}
          {!isDraw && winner && (
            <div className="p-3.5 bg-stone-950/70 rounded-xl border border-stone-800 space-y-2">
              <div className="font-semibold text-stone-200 text-xs flex items-center justify-between">
                <span>{winner.name} 完整胡牌牌型姿态：</span>
                <span className="text-[11px] text-amber-400">
                  {result.isSelfDraw ? '自摸' : `荣和点炮 (放铳方: ${discarder?.name || '未知'})`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {/* Exposed Melds */}
                {winner.melds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {winner.melds.map((meld) => (
                      <MeldDisplay
                        key={meld.id}
                        meld={meld}
                        playerIndex={result.winnerIndex ?? 0}
                        size="sm"
                      />
                    ))}
                  </div>
                )}

                {/* Hand Tiles */}
                <div className="flex items-center gap-0.5 p-1 bg-stone-900/60 rounded-lg border border-stone-800">
                  {sortTiles(winner.hand).map((t, idx) => (
                    <MahjongTile key={t.id + idx} tile={t} size="sm" />
                  ))}
                </div>

                {/* Winning Tile */}
                {result.winningTile && (
                  <div className="flex items-center gap-1.5 p-1 rounded-lg bg-amber-950/60 border border-amber-500/80 ring-1 ring-amber-400/40">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-bold">
                      {result.isSelfDraw ? '自摸' : '荣和'}
                    </span>
                    <MahjongTile tile={result.winningTile} size="sm" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fan Details Breakdown (According to Appendix III) */}
          {!isDraw && result.fanDetails.length > 0 && (
            <div className="space-y-2">
              <div className="font-semibold text-stone-200 flex items-center justify-between">
                <span>番种明细列表 (遵循 Appendix III 标准)：</span>
                <span className="text-[11px] text-stone-400">指定番数计入</span>
              </div>
              <div className="divide-y divide-stone-800 bg-stone-950/50 rounded-xl border border-stone-800 p-2">
                {result.fanDetails.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-500 font-bold text-[11px]">
                        [{f.code}]
                      </span>
                      <span className="text-stone-100 font-medium">{f.name}</span>
                      <span className="text-stone-500 text-[10px] hidden sm:inline">{f.desc}</span>
                    </div>
                    <span className="font-mono font-bold text-amber-400">+{f.fan} 番</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Points Delta Table (According to Appendix I) */}
          <div className="space-y-2">
            <div className="font-semibold text-stone-200">
              本局结算分数变动 (遵循 Appendix I 计分法则)：
            </div>
            <div className="grid grid-cols-4 gap-2">
              {players.map((p, idx) => {
                const delta = result.pointsDelta[idx];
                const isPositive = delta > 0;
                const isNegative = delta < 0;

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border text-center ${
                      idx === result.winnerIndex
                        ? 'bg-amber-950/30 border-amber-600/60'
                        : idx === result.discarderIndex
                        ? 'bg-rose-950/30 border-rose-700/60'
                        : 'bg-stone-950/40 border-stone-800'
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-stone-300 truncate">{p.name}</div>
                    <div
                      className={`text-sm font-mono font-bold mt-1 ${
                        isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-stone-400'
                      }`}
                    >
                      {isPositive ? `+${delta}` : delta}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      总分: {p.score}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Footer Buttons */}
        <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-2 sm:gap-3 flex-wrap sm:flex-nowrap shrink-0 z-20 shadow-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenReview}
              className="px-3 sm:px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSearch className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-400" />
              <span>实战复盘</span>
            </button>

            {onOpenStats && (
              <button
                onClick={onOpenStats}
                className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-stone-300 hover:text-amber-300 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="查看生涯战绩与本场积分"
              >
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                <span>战绩</span>
              </button>
            )}

            {onRestartMatch && (
              <button
                onClick={onRestartMatch}
                className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700/80 text-stone-300 hover:text-amber-300 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="重新开始整场 16 局大局比赛"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>重开</span>
              </button>
            )}
          </div>

          <button
            onClick={onNextRound}
            className="px-5 sm:px-7 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-950/60 transition-all active:scale-95 cursor-pointer ml-auto shrink-0 ring-2 ring-amber-300/40"
          >
            <span>{currentRoundNumber >= 16 ? '进入最终结算' : '进入下一局'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
