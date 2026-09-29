import React from 'react';
import { RoundResult, TurnActionLog } from '../types/mahjong';
import { MahjongTile } from './MahjongTile';
import {
  FileSearch,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Flame,
  ArrowRight,
  ShieldAlert,
  Zap,
  Award,
} from 'lucide-react';

interface GameReviewModalProps {
  roundResult: RoundResult;
  roundNumber: number;
  onClose: () => void;
  allRounds?: RoundResult[];
  onSelectRound?: (round: RoundResult) => void;
}

export const GameReviewModal: React.FC<GameReviewModalProps> = ({
  roundResult,
  roundNumber,
  onClose,
  allRounds,
  onSelectRound,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [showAllHands, setShowAllHands] = React.useState(true);

  // Reset step when changing round
  React.useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, [roundResult]);

  const logs = roundResult.actionLogs;
  const totalSteps = logs.length;

  // Auto-play timer
  React.useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying && currentStepIndex < totalSteps - 1) {
      timer = setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 1200);
    } else if (currentStepIndex >= totalSteps - 1) {
      setIsPlaying(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isPlaying, currentStepIndex, totalSteps]);

  const currentLog: TurnActionLog | undefined = logs[currentStepIndex];

  // Count and categorize blunders in this round
  const humanDiscards = logs.filter((l) => l.action === 'discard' && l.playerIndex === 0);
  const blunderLogs = logs.filter((l) => l.isBlunder && l.playerIndex === 0);
  const criticalBlunders = blunderLogs.filter((l) => l.blunderSeverity === 'critical' || !l.blunderSeverity);
  const inaccuracyBlunders = blunderLogs.filter((l) => l.blunderSeverity === 'inaccuracy');
  const accuracyRate = humanDiscards.length > 0
    ? Math.max(0, Math.round(((humanDiscards.length - blunderLogs.length) / humanDiscards.length) * 100))
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] bg-stone-900 border border-stone-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-200">
        {/* Top Bar */}
        <div className="px-6 py-4 bg-stone-950/80 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSearch className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold font-serif text-stone-100">
                实战复盘与打法研析 · 第 {roundNumber} 局
              </h2>
              <div className="text-xs text-stone-400">
                {roundResult.prevailingWind}风圈 · 总计 {totalSteps} 步操作
                {blunderLogs.length > 0 && (
                  <span className="text-rose-400 ml-2 font-medium">
                    · 检测到 {blunderLogs.length} 处疑问手/恶手
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAllHands(!showAllHands)}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showAllHands ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showAllHands ? '上帝视角 (透视全手牌)' : '仅看玩家手牌'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Round Switcher Sub-header (Allows jumping to and reviewing any round anytime) */}
        {allRounds && allRounds.length > 1 && (
          <div className="px-6 py-2.5 bg-stone-950 border-b border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-400 font-medium">回溯其他对局:</span>
              <select
                value={roundResult.roundIndex}
                onChange={(e) => {
                  const targetIdx = Number(e.target.value);
                  const found = allRounds.find((r) => r.roundIndex === targetIdx);
                  if (found && onSelectRound) {
                    onSelectRound(found);
                  }
                }}
                className="bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg px-2.5 py-1 text-stone-200 text-xs font-mono cursor-pointer focus:ring-1 focus:ring-amber-400 focus:outline-none"
              >
                {allRounds.map((r, idx) => {
                  const isDraw = r.winnerIndex === null;
                  const winnerName = isDraw ? '流局' : r.winnerIndex === 0 ? '玩家' : `电脑${r.winnerIndex}`;
                  const outcomeDesc = isDraw
                    ? '荒庄流局'
                    : `${winnerName}${r.isSelfDraw ? '自摸' : '荣和'} (${r.totalFan}番)`;
                  const deltaStr = r.pointsDelta[0] > 0 ? `+${r.pointsDelta[0]}` : `${r.pointsDelta[0]}`;
                  return (
                    <option key={r.roundIndex + '_' + idx} value={r.roundIndex}>
                      第 {r.roundIndex + 1} 局 ({r.prevailingWind}风圈) · {outcomeDesc} [您得分:{deltaStr}点]
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const currIdx = allRounds.findIndex((r) => r.roundIndex === roundResult.roundIndex);
                  if (currIdx > 0 && onSelectRound) {
                    onSelectRound(allRounds[currIdx - 1]);
                  }
                }}
                disabled={allRounds.findIndex((r) => r.roundIndex === roundResult.roundIndex) <= 0}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>上一局</span>
              </button>
              <button
                onClick={() => {
                  const currIdx = allRounds.findIndex((r) => r.roundIndex === roundResult.roundIndex);
                  if (currIdx >= 0 && currIdx < allRounds.length - 1 && onSelectRound) {
                    onSelectRound(allRounds[currIdx + 1]);
                  }
                }}
                disabled={
                  allRounds.findIndex((r) => r.roundIndex === roundResult.roundIndex) >=
                  allRounds.length - 1
                }
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>下一局</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Replay Player Main Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Round Blunder & Performance Hub */}
          <div className="p-4 bg-stone-950/70 rounded-xl border border-stone-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-stone-200">本局打法与恶手全览：</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-stone-400">
                  出牌总巡：<strong className="text-stone-200 font-mono">{humanDiscards.length}</strong> 巡
                </span>
                <span className="text-stone-400">
                  牌效优良率：
                  <strong
                    className={`font-mono ml-0.5 ${
                      accuracyRate >= 85
                        ? 'text-emerald-400'
                        : accuracyRate >= 70
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {accuracyRate}%
                  </strong>
                </span>
                <span className="text-stone-400">
                  恶手统计：
                  <strong className="text-rose-400 font-mono ml-0.5">{criticalBlunders.length}</strong> 严重
                  {inaccuracyBlunders.length > 0 && (
                    <span className="text-amber-400 font-mono ml-1">/ {inaccuracyBlunders.length} 缓手</span>
                  )}
                </span>
              </div>
            </div>

            {/* Interactive Fast-Jump Blunder Carousel / Pills */}
            {blunderLogs.length > 0 ? (
              <div className="space-y-1.5 pt-1 border-t border-stone-800/80">
                <div className="text-[11px] text-stone-400 flex items-center justify-between">
                  <span>检测到下列策略疑问手（点击标签可直达对应巡目）：</span>
                  <span className="text-[10px] text-rose-400 font-medium">
                    共 {blunderLogs.length} 处需研析
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {blunderLogs.map((bLog, bIdx) => {
                    const stepIdx = logs.indexOf(bLog);
                    const isCurrent = currentStepIndex === stepIdx;
                    return (
                      <button
                        key={bIdx}
                        onClick={() => {
                          setIsPlaying(false);
                          setCurrentStepIndex(stepIdx);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-rose-600 text-white font-bold ring-2 ring-rose-400/80 shadow-md scale-105'
                            : bLog.blunderSeverity === 'critical'
                            ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300'
                            : 'bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-300'
                        }`}
                      >
                        <span className="font-mono">第{bLog.turnNumber}巡</span>
                        {bLog.tile && <MahjongTile tile={bLog.tile} size="xs" />}
                        <span className="text-[10px] opacity-90">
                          {bLog.blunderTypeName?.split(' ')[0] || '打法失误'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-emerald-950/30 border border-emerald-700/50 rounded-lg text-xs text-emerald-300">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>本局发挥近乎完美！经 AI 牌效全量复盘，未检测到任何向听倒退或恶手。</span>
              </div>
            )}
          </div>

          {/* Step Timeline Controls */}
          <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-300">
                巡目与进度：第 {currentLog?.turnNumber || 1} 巡 · 操作 #{currentStepIndex + 1} / {totalSteps}
              </span>
              <span className="text-amber-400 font-mono font-medium">
                当前行动方：{currentLog?.playerName || '系统'}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={0}
              max={Math.max(0, totalSteps - 1)}
              value={currentStepIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentStepIndex(Number(e.target.value));
              }}
              className="w-full accent-amber-500 cursor-pointer"
            />

            {/* Playback Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex(0);
                  }}
                  className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs cursor-pointer"
                  title="回到开头"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  disabled={currentStepIndex === 0}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>上一步</span>
                </button>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? '暂停' : '自动复盘'}</span>
                </button>
                <button
                  disabled={currentStepIndex >= totalSteps - 1}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>下一步</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Jump to Next Blunder */}
              {blunderLogs.length > 0 && (
                <button
                  onClick={() => {
                    const nextBlunder = logs.findIndex(
                      (l, idx) => idx > currentStepIndex && l.isBlunder && l.playerIndex === 0
                    );
                    if (nextBlunder !== -1) {
                      setCurrentStepIndex(nextBlunder);
                    } else {
                      // wrap around to first blunder
                      const first = logs.findIndex((l) => l.isBlunder && l.playerIndex === 0);
                      if (first !== -1) setCurrentStepIndex(first);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/70 border border-rose-700/60 text-rose-300 hover:bg-rose-900 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>下一个疑问手 ({blunderLogs.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Current Step Action Detail Card */}
          {currentLog && (
            <div
              className={`p-4 rounded-xl border space-y-3.5 ${
                currentLog.isBlunder
                  ? 'bg-rose-950/20 border-rose-800/80 ring-1 ring-rose-500/20'
                  : 'bg-stone-950/50 border-stone-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-stone-100">
                    {currentLog.playerName} 执行了：
                  </span>
                  <span className="px-2 py-0.5 rounded bg-stone-800 text-amber-400 font-mono text-xs font-bold">
                    {currentLog.action === 'draw'
                      ? '摸牌'
                      : currentLog.action === 'discard'
                      ? '打出舍牌'
                      : currentLog.action === 'chi'
                      ? '吃牌'
                      : currentLog.action === 'peng'
                      ? '碰牌'
                      : currentLog.action === 'gang'
                      ? '开杠'
                      : currentLog.action === 'hu'
                      ? '宣告和牌！'
                      : '过牌'}
                  </span>
                </div>

                {currentLog.tile && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">操作目标牌：</span>
                    <MahjongTile tile={currentLog.tile} size="sm" />
                  </div>
                )}
              </div>

              {/* Blunder Comparison Section */}
              {currentLog.isBlunder && (
                <div className="p-4 rounded-xl bg-gradient-to-b from-rose-950/50 to-stone-950 border border-rose-700/70 space-y-3.5 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
                      <span>恶手复盘与打法研析</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          currentLog.blunderSeverity === 'critical'
                            ? 'bg-rose-600 text-white shadow'
                            : 'bg-amber-600 text-stone-950'
                        }`}
                      >
                        {currentLog.blunderSeverity === 'critical' ? '🔴 严重恶手' : '🟡 缓手/疑问手'}
                      </span>
                      {currentLog.blunderTypeName && (
                        <span className="px-2 py-0.5 rounded bg-stone-900 text-rose-200 border border-rose-800 text-[11px] font-medium">
                          {currentLog.blunderTypeName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Side-by-Side Tile Comparison Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Actual Discard */}
                    <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-[11px] text-rose-300 font-semibold flex items-center gap-1">
                          <span>实战切牌 (实际操作)</span>
                        </div>
                        <div className="text-xs text-stone-300">
                          向听状态：
                          <strong className="text-rose-400 font-mono">
                            {currentLog.shantenAfter === 0 ? '听牌' : currentLog.shantenAfter + '向听'}
                          </strong>
                        </div>
                        {currentLog.chosenRec && (
                          <div className="text-[11px] text-stone-400">
                            进张面：
                            <span className="text-stone-200 font-bold font-mono">
                              {currentLog.chosenRec.effectiveTilesCount}
                            </span>{' '}
                            张
                            <span className="ml-2 text-[10px] px-1 rounded bg-black/40 text-stone-300">
                              {currentLog.chosenRec.safetyLevel === 'safe'
                                ? '安全牌'
                                : currentLog.chosenRec.safetyLevel === 'danger'
                                ? '危险牌'
                                : '半安牌'}
                            </span>
                          </div>
                        )}
                      </div>
                      {currentLog.tile && (
                        <div className="p-1 rounded-lg bg-black/30 border border-rose-500/50 shadow">
                          <MahjongTile tile={currentLog.tile} size="sm" />
                        </div>
                      )}
                    </div>

                    {/* AI Best Choice */}
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/80 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          <span>AI 推荐最优切牌 (应选)</span>
                        </div>
                        <div className="text-xs text-stone-300">
                          向听状态：
                          <strong className="text-emerald-400 font-mono">
                            {currentLog.bestRec
                              ? currentLog.bestRec.shantenAfter === 0
                                ? '听牌'
                                : currentLog.bestRec.shantenAfter + '向听'
                              : currentLog.shantenAfter + '向听'}
                          </strong>
                        </div>
                        {currentLog.bestRec && (
                          <div className="text-[11px] text-stone-400">
                            进张面：
                            <span className="text-emerald-300 font-bold font-mono">
                              {currentLog.bestRec.effectiveTilesCount}
                            </span>{' '}
                            张
                            <span className="ml-2 text-[10px] px-1 rounded bg-black/40 text-stone-300">
                              {currentLog.bestRec.safetyLevel === 'safe'
                                ? '安全牌'
                                : currentLog.bestRec.safetyLevel === 'danger'
                                ? '危险牌'
                                : '半安牌'}
                            </span>
                          </div>
                        )}
                      </div>
                      {currentLog.recommendedDiscard && (
                        <div className="p-1 rounded-lg bg-black/30 border border-emerald-500/60 shadow">
                          <MahjongTile tile={currentLog.recommendedDiscard} size="sm" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Diagnosis Commentary */}
                  <div className="p-3 rounded-lg bg-black/50 border border-rose-900/60 text-xs text-rose-200/95 leading-relaxed">
                    <span className="font-bold text-rose-300 mr-1.5">💡 牌效与得失深度研判：</span>
                    {currentLog.blunderReason}
                  </div>
                </div>
              )}

              {/* Standard Human Discard Optimal Comment */}
              {!currentLog.isBlunder && currentLog.action === 'discard' && currentLog.playerIndex === 0 && (
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-xs text-stone-300 flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                      <span>切牌正确 (符合 AI 最优策略)</span>
                      {currentLog.shantenAfter !== undefined && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-200 font-mono">
                          {currentLog.shantenAfter === 0 ? '进入听牌' : `${currentLog.shantenAfter}向听`}
                        </span>
                      )}
                    </div>
                    <p className="text-stone-300 leading-relaxed text-[11px]">
                      {currentLog.aiComment || '此巡切牌进张面最大化，手牌结构保持紧凑顺畅。'}
                    </p>
                  </div>
                </div>
              )}

              {/* Standard Turn AI Comment for Bots / Other Actions */}
              {!currentLog.isBlunder && !(currentLog.action === 'discard' && currentLog.playerIndex === 0) && currentLog.aiComment && (
                <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-300 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{currentLog.aiComment}</p>
                </div>
              )}
            </div>
          )}

          {/* End of Round Final Summary */}
          {roundResult.handSnapshots && roundResult.handSnapshots.length === 4 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>终局四家手牌全貌速览：</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {roundResult.handSnapshots.map((snap, pIdx) => {
                  const player = roundResult.actionLogs[0] ? roundResult.actionLogs[0].playerName : '';
                  const names = ['玩家 (您)', '下家 (西风)', '对家 (北风)', '上家 (东风)'];
                  return (
                    <div
                      key={pIdx}
                      className="p-3 rounded-xl bg-stone-950/40 border border-stone-800 space-y-2"
                    >
                      <div className="font-semibold text-stone-200 flex items-center justify-between">
                        <span>{names[pIdx]}</span>
                        <span className="text-[10px] text-stone-500">
                          {pIdx === roundResult.winnerIndex
                            ? '和牌胜者'
                            : pIdx === roundResult.discarderIndex
                            ? '放铳出冲'
                            : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {snap.hand.map((t, idx) => (
                          <MahjongTile key={t.id + idx} tile={t} size="xs" />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-950/80 border-t border-stone-800 flex items-center justify-between text-xs">
          <span className="text-stone-400">
            按左右方向键或拖动滑块可逐步复盘，深入研习每一步牌效得失。
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium transition-colors cursor-pointer"
          >
            关闭复盘
          </button>
        </div>
      </div>
    </div>
  );
};
