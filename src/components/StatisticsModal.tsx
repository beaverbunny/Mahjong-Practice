import React from 'react';
import { GameStats, PlayerState, RoundResult } from '../types/mahjong';
import { DESIGNATED_HANDS } from '../utils/rulesEngine';
import {
  BarChart3,
  Trophy,
  X,
  TrendingUp,
  ShieldCheck,
  Flame,
  Award,
  RefreshCw,
  FileSearch,
} from 'lucide-react';

interface StatisticsModalProps {
  stats: GameStats;
  currentPlayers: PlayerState[];
  currentRoundIndex: number;
  historicalRounds: RoundResult[];
  onClose: () => void;
  onResetStats: () => void;
  onOpenReviewRound?: (round: RoundResult) => void;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  stats,
  currentPlayers,
  currentRoundIndex,
  historicalRounds,
  onClose,
  onResetStats,
  onOpenReviewRound,
}) => {
  const totalRounds = Math.max(1, stats.totalRounds);
  const winRate = ((stats.humanWins / totalRounds) * 100).toFixed(1);
  const selfDrawRate = stats.humanWins > 0 ? ((stats.humanSelfDraws / stats.humanWins) * 100).toFixed(1) : '0.0';
  const dealInRate = ((stats.humanDealIns / totalRounds) * 100).toFixed(1);
  const tenpaiRate = ((stats.humanTenpaiCount / totalRounds) * 100).toFixed(1);
  const avgPoints = stats.humanWins > 0 ? (stats.totalPointsEarned / stats.humanWins).toFixed(1) : '0.0';

  // Calculate round-by-round cumulative score for the current 16-round match
  let cumulative = 0;
  const matchProgression = historicalRounds.map((r, idx) => {
    cumulative += r.pointsDelta[0];
    return {
      round: idx + 1,
      delta: r.pointsDelta[0],
      total: cumulative,
      wind: r.prevailingWind,
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-serif text-stone-100">
                雀士个人生涯与本场战绩统计
              </h2>
              <div className="text-xs text-stone-400">
                累计对战 {stats.totalRounds} 局 · 当前第 {currentRoundIndex + 1}/16 局
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-stone-300">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col">
              <span className="text-stone-400 text-[11px] flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                和牌胜率
              </span>
              <span className="text-2xl font-bold font-mono text-amber-400 mt-1">{winRate}%</span>
              <span className="text-[10px] text-stone-500 mt-0.5">
                胜 {stats.humanWins} 局 / 负 {totalRounds - stats.humanWins} 局
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col">
              <span className="text-stone-400 text-[11px] flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                自摸比例
              </span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {selfDrawRate}%
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5">
                自摸 {stats.humanSelfDraws} 次 / 荣和 {stats.humanWins - stats.humanSelfDraws} 次
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col">
              <span className="text-stone-400 text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                放铳出冲率
              </span>
              <span className="text-2xl font-bold font-mono text-rose-400 mt-1">
                {dealInRate}%
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5">
                点炮放铳 {stats.humanDealIns} 次
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 flex flex-col">
              <span className="text-stone-400 text-[11px] flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-sky-400" />
                平均和牌得点
              </span>
              <span className="text-2xl font-bold font-mono text-sky-400 mt-1">{avgPoints}</span>
              <span className="text-[10px] text-stone-500 mt-0.5">
                最高单局：{stats.highestFan} 番
              </span>
            </div>
          </div>

          {/* Current 16-Round Match Standings */}
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-200 text-sm">
              当前 16 局大局即时得分榜：
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              {currentPlayers.map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border ${
                    p.isHuman
                      ? 'bg-amber-950/30 border-amber-600/60'
                      : 'bg-stone-950/40 border-stone-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-200">{p.name}</span>
                    <span className="text-stone-400 font-mono text-[10px]">
                      门风: {p.seatWind}
                    </span>
                  </div>
                  <div className="text-lg font-mono font-bold mt-1 text-amber-400">
                    {p.score > 0 ? `+${p.score}` : p.score} 点
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Match Progression Chart */}
          {matchProgression.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-stone-200 text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>16 局积分走势曲线 (本场)：</span>
              </h3>
              <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800">
                <div className="flex items-end gap-1 h-28 pt-2">
                  {matchProgression.map((item) => {
                    const heightPercent = Math.min(
                      100,
                      Math.max(15, (Math.abs(item.total) / 300) * 100)
                    );
                    const isPos = item.total >= 0;

                    return (
                      <div
                        key={item.round}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      >
                        <div
                          className={`w-full rounded-t transition-all ${
                            isPos ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[9px] text-stone-500 mt-1 font-mono">{item.round}</span>

                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-900 border border-stone-700 px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap hidden group-hover:block z-10 font-mono">
                          第{item.round}局: {item.total} ({item.delta > 0 ? `+${item.delta}` : item.delta})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Historical Rounds Replay Section */}
          {historicalRounds.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-stone-200 text-sm flex items-center gap-1.5">
                  <FileSearch className="w-4 h-4 text-amber-400" />
                  <span>各局牌谱归档与实战复盘 (已完赛 {historicalRounds.length} 局)：</span>
                </h3>
                <span className="text-[11px] text-stone-400">点击“复盘此局”随时单步复盘</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {historicalRounds.slice().reverse().map((round, rIdx) => {
                  const isDraw = round.winnerIndex === null;
                  const isHumanWin = round.winnerIndex === 0;
                  const blundersCount = round.actionLogs.filter((l) => l.isBlunder && l.playerIndex === 0).length;

                  return (
                    <div
                      key={round.roundIndex + '_' + rIdx}
                      className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 hover:border-amber-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] text-stone-400 font-serif">第</span>
                          <span className="text-sm font-bold font-mono text-amber-400 leading-none">
                            {round.roundIndex + 1}
                          </span>
                          <span className="text-[9px] text-stone-500 leading-none">局</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-stone-100">
                              {round.prevailingWind}风圈 · {['东局', '南局', '西局', '北局'][round.roundIndex % 4]}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                isDraw
                                  ? 'bg-stone-800 text-stone-400'
                                  : isHumanWin
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              }`}
                            >
                              {isDraw
                                ? '荒庄流局'
                                : isHumanWin
                                ? `玩家${round.isSelfDraw ? '自摸' : '荣和'}`
                                : `电脑${round.winnerIndex}${round.isSelfDraw ? '自摸' : '荣和'}`}
                            </span>
                            {!isDraw && (
                              <span className="font-mono text-[11px] text-amber-400 font-bold">
                                {round.totalFan} 番
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-stone-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            <span>
                              您得分:{' '}
                              <strong
                                className={
                                  round.pointsDelta[0] > 0
                                    ? 'text-emerald-400'
                                    : round.pointsDelta[0] < 0
                                    ? 'text-rose-400'
                                    : 'text-stone-400'
                                }
                              >
                                {round.pointsDelta[0] > 0 ? `+${round.pointsDelta[0]}` : round.pointsDelta[0]}
                              </strong>{' '}
                              点
                            </span>
                            <span>总计 {round.actionLogs.length} 巡操作</span>
                            {blundersCount > 0 ? (
                              <span className="text-rose-400 font-medium">⚠️ {blundersCount} 处打法疑问</span>
                            ) : (
                              <span className="text-emerald-400">✨ 牌效发挥出色</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          if (onOpenReviewRound) onOpenReviewRound(round);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-600 hover:text-stone-950 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer shrink-0"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        <span>复盘此局</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Appendix III Winning Hands Collection */}
          <div className="space-y-2">
            <h3 className="font-semibold text-stone-200 text-sm">
              和种达成图谱 (Appendix III 达成统计)：
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.values(DESIGNATED_HANDS).map((hand) => {
                const count = stats.fansAchievedCounts[hand.code] || 0;
                return (
                  <div
                    key={hand.code}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      count > 0
                        ? 'bg-amber-950/20 border-amber-600/40 text-stone-200'
                        : 'bg-stone-950/40 border-stone-800/60 opacity-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-[11px] truncate text-stone-100">
                        {hand.name.split(' ')[0]}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">{hand.code} · {hand.fan}番</div>
                    </div>
                    <span
                      className={`text-sm font-mono font-bold ${
                        count > 0 ? 'text-amber-400' : 'text-stone-600'
                      }`}
                    >
                      {count} 次
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-950/80 border-t border-stone-800 flex items-center justify-between text-xs">
          <button
            onClick={() => {
              if (window.confirm('确定要重置所有生涯战绩与统计数据吗？')) {
                onResetStats();
              }
            }}
            className="text-stone-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>重置统计</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
