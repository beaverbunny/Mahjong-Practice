import React from 'react';
import { GameStats, PlayerState, RoundResult } from '../types/mahjong';
import { DESIGNATED_HANDS } from '../utils/rulesEngine';
import { WIND_NAMES } from '../utils/mahjongTiles';
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
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface StatisticsModalProps {
  stats: GameStats;
  currentPlayers: PlayerState[];
  currentRoundIndex: number;
  historicalRounds: RoundResult[];
  // Hands of the match in progress are the ones with this matchId
  currentMatchId?: string;
  onClose: () => void;
  onResetStats: () => void;
  onOpenReviewRound?: (round: RoundResult, indexInHistorical?: number) => void;
  onDeleteRound?: (indexInHistorical: number) => void;
  onClearAllRounds?: () => void;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  stats,
  currentPlayers,
  currentRoundIndex,
  historicalRounds,
  currentMatchId,
  onClose,
  onResetStats,
  onOpenReviewRound,
  onDeleteRound,
  onClearAllRounds,
}) => {
  const [pendingDelete, setPendingDelete] = React.useState<
    | { type: 'single'; index: number; round: RoundResult }
    | { type: 'all' }
    | { type: 'reset_all' }
    | null
  >(null);

  const totalRounds = Math.max(1, stats.totalRounds);
  const winRate = ((stats.humanWins / totalRounds) * 100).toFixed(1);
  const selfDrawRate = stats.humanWins > 0 ? ((stats.humanSelfDraws / stats.humanWins) * 100).toFixed(1) : '0.0';
  const dealInRate = ((stats.humanDealIns / totalRounds) * 100).toFixed(1);
  const tenpaiRate = ((stats.humanTenpaiCount / totalRounds) * 100).toFixed(1);
  const avgPoints = stats.humanWins > 0 ? (stats.totalPointsEarned / stats.humanWins).toFixed(1) : '0.0';

  // Calculate round-by-round cumulative score for the current 16-round match only
  let cumulative = 0;
  const matchProgression = historicalRounds
    .filter((r) => currentMatchId !== undefined && r.matchId === currentMatchId)
    .map((r) => {
      cumulative += r.pointsDelta[0];
      return {
        round: r.roundIndex + 1,
        delta: r.pointsDelta[0],
        total: cumulative,
        wind: r.prevailingWind,
      };
    });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[88vh] bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200 my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between shrink-0">
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 text-xs text-stone-300">
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
                      门风: {WIND_NAMES[p.seatWind]}
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
          {historicalRounds.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <FileSearch className="w-4 h-4 text-amber-400" />
                  <h3 className="font-semibold text-stone-200 text-sm">
                    各局牌谱归档与实战复盘 (已完赛 {historicalRounds.length} 局)：
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {onClearAllRounds && (
                    <button
                      onClick={() => setPendingDelete({ type: 'all' })}
                      className="px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-rose-950/70 border border-stone-700/60 hover:border-rose-800 text-stone-400 hover:text-rose-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="清空历史归档中的全部复盘牌谱"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>清空复盘记录</span>
                    </button>
                  )}
                  <span className="text-[11px] text-stone-400 hidden sm:inline">点击“复盘此局”随时单步复盘</span>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {historicalRounds.slice().reverse().map((round, rIdx) => {
                  const originalIndex = historicalRounds.length - 1 - rIdx;
                  const isDraw = round.winnerIndex === null;
                  const isHumanWin = round.winnerIndex === 0;

                  // Detailed Blunder Analysis for this round
                  const humanDiscards = round.actionLogs.filter((l) => l.action === 'discard' && l.playerIndex === 0);
                  const blunderLogs = round.actionLogs.filter((l) => l.isBlunder && l.playerIndex === 0);
                  const criticalBlunders = blunderLogs.filter((l) => l.blunderSeverity === 'critical' || !l.blunderSeverity);
                  const inaccuracyBlunders = blunderLogs.filter((l) => l.blunderSeverity === 'inaccuracy');
                  const accuracyRate = humanDiscards.length > 0
                    ? Math.max(0, Math.round(((humanDiscards.length - blunderLogs.length) / humanDiscards.length) * 100))
                    : 100;
                  const blunderTags = Array.from(new Set(blunderLogs.map((b) => b.blunderTypeName?.split(' ')[0]).filter(Boolean)));

                  return (
                    <div
                      key={round.roundIndex + '_' + rIdx}
                      className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 hover:border-amber-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-stone-900 border border-stone-700 flex flex-col items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] text-stone-400 font-serif">第</span>
                          <span className="text-sm font-bold font-mono text-amber-400 leading-none">
                            {round.roundIndex + 1}
                          </span>
                          <span className="text-[9px] text-stone-500 leading-none">局</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-stone-100">
                              {WIND_NAMES[round.prevailingWind]}风圈 · {['东局', '南局', '西局', '北局'][round.roundIndex % 4]}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 font-mono" title={`历史归档第 ${originalIndex + 1} 局`}>
                              #{originalIndex + 1}
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
                            <span className="text-stone-400 text-[11px]">
                              得分:{' '}
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
                          </div>

                          {/* Round Blunder Analysis & AI Evaluation */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="text-stone-400">
                              出牌 <strong className="text-stone-300 font-mono">{humanDiscards.length}</strong> 巡
                            </span>
                            <span className="text-stone-600">·</span>
                            <span className="font-mono">
                              牌效: <strong className={accuracyRate >= 85 ? 'text-emerald-400' : accuracyRate >= 70 ? 'text-amber-400' : 'text-rose-400'}>{accuracyRate}%</strong>
                            </span>
                            {criticalBlunders.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 font-medium">
                                🔴 {criticalBlunders.length} 严重恶手
                              </span>
                            )}
                            {inaccuracyBlunders.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300 font-medium">
                                🟡 {inaccuracyBlunders.length} 缓手
                              </span>
                            )}
                            {blunderLogs.length === 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 font-medium">
                                ✨ 零恶手 / 牌效极佳
                              </span>
                            )}
                            {blunderTags.slice(0, 2).map((tag, tIdx) => (
                              <span key={tIdx} className="text-[10px] px-1.5 py-0.2 rounded bg-stone-900 border border-stone-800 text-stone-400">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => {
                            onClose();
                            if (onOpenReviewRound) onOpenReviewRound(round, originalIndex);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-amber-600 hover:text-stone-950 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                        >
                          <FileSearch className="w-3.5 h-3.5" />
                          <span>复盘此局</span>
                        </button>

                        {onDeleteRound && (
                          <button
                            onClick={() =>
                              setPendingDelete({
                                type: 'single',
                                index: originalIndex,
                                round,
                              })
                            }
                            className="p-1.5 rounded-lg bg-stone-800/70 hover:bg-rose-950/80 border border-stone-700/60 hover:border-rose-700 text-stone-400 hover:text-rose-300 transition-colors cursor-pointer"
                            title="删除此局复盘记录"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-stone-950/40 border border-stone-800 text-center text-xs text-stone-400 space-y-1">
              <p>暂无已完赛的历史复盘记录。</p>
              <p className="text-[11px] text-stone-500">每完成一局对战，系统将自动录制完整牌谱与恶手分析供您随时回溯。</p>
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
        <div className="px-6 py-3.5 bg-stone-950/80 border-t border-stone-800 flex items-center justify-between text-xs shrink-0">
          <button
            onClick={() => setPendingDelete({ type: 'reset_all' })}
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

      {/* Confirmation Dialog Overlay for Deleting Records / Resetting Stats */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150">
          <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl p-5 space-y-4 text-stone-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-100">
                  {pendingDelete.type === 'single'
                    ? `确认删除第 ${pendingDelete.round.roundIndex + 1} 局复盘记录？`
                    : pendingDelete.type === 'all'
                    ? '确认清空所有历史复盘记录？'
                    : '确认重置所有生涯战绩数据？'}
                </h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  {pendingDelete.type === 'single'
                    ? `您即将删除【第 ${pendingDelete.round.roundIndex + 1} 局 (${WIND_NAMES[pendingDelete.round.prevailingWind]}风圈)】的牌谱及恶手研析记录。此操作不可逆，您的累计生涯胜场与段位得分等全局统计将不受影响。`
                    : pendingDelete.type === 'all'
                    ? `您即将清空历史归档中的全部 ${historicalRounds.length} 局对局牌谱与恶手复盘记录。此操作不可撤销，您的累计胜率与雀士生涯总积分将予以保留。`
                    : '重置后将清除包括总局数、胜率、和牌达成图谱及所有复盘牌谱在内的全部生涯数据，恢复初始状态。'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-xs transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (pendingDelete.type === 'single') {
                    if (onDeleteRound) onDeleteRound(pendingDelete.index);
                  } else if (pendingDelete.type === 'all') {
                    if (onClearAllRounds) onClearAllRounds();
                  } else if (pendingDelete.type === 'reset_all') {
                    onResetStats();
                  }
                  setPendingDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>确认删除</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
