import React from 'react';
import { RoundResult, TurnActionLog } from '../types/mahjong';
import { sortTiles } from '../utils/mahjongTiles';
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
  Trash2,
  Trophy,
  ListFilter,
} from 'lucide-react';

interface GameReviewModalProps {
  roundResult: RoundResult;
  roundNumber: number;
  onClose: () => void;
  allRounds?: RoundResult[];
  onSelectRound?: (round: RoundResult) => void;
  onDeleteRound?: (round: RoundResult) => void;
}

export const GameReviewModal: React.FC<GameReviewModalProps> = ({
  roundResult,
  roundNumber,
  onClose,
  allRounds,
  onSelectRound,
  onDeleteRound,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [showAllHands, setShowAllHands] = React.useState(true);
  const [showBlunderDrawer, setShowBlunderDrawer] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Reset step when changing round
  React.useEffect(() => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setShowBlunderDrawer(false);
    setShowDeleteConfirm(false);
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
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

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowAllHands(!showAllHands)}
              className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs text-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showAllHands ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showAllHands ? '透视全家手牌' : '仅看玩家手牌'}</span>
            </button>

            {onDeleteRound && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800/80 hover:bg-rose-950/80 border border-stone-700/60 hover:border-rose-700 text-stone-400 hover:text-rose-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="删除本局复盘记录"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">删除此局记录</span>
              </button>
            )}

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
              <div className="space-y-2 pt-1 border-t border-stone-800/80">
                <div className="text-[11px] text-stone-400 flex items-center justify-between flex-wrap gap-2">
                  <span>检测到下列策略疑问手（点击标签可直达对应巡目）：</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowBlunderDrawer(!showBlunderDrawer)}
                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer border border-stone-700"
                    >
                      <ListFilter className="w-3 h-3 text-amber-400" />
                      <span>{showBlunderDrawer ? '收起恶手诊断表' : `展开恶手精研表 (${blunderLogs.length})`}</span>
                    </button>
                    <span className="text-[10px] text-rose-400 font-medium">
                      共 {blunderLogs.length} 处需研析
                    </span>
                  </div>
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

                {/* Expanded Blunder Diagnostic Table */}
                {showBlunderDrawer && (
                  <div className="mt-3 p-3 bg-stone-900/90 rounded-xl border border-rose-900/60 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-stone-800">
                      <span className="font-bold text-rose-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>本局所有恶手全量诊断明细清单</span>
                      </span>
                      <span className="text-[11px] text-stone-400">点击行可直接跳至该巡复盘</span>
                    </div>

                    <div className="divide-y divide-stone-800/80 max-h-56 overflow-y-auto pr-1">
                      {blunderLogs.map((bLog, idx) => {
                        const stepIdx = logs.indexOf(bLog);
                        const isCurrent = currentStepIndex === stepIdx;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setIsPlaying(false);
                              setCurrentStepIndex(stepIdx);
                            }}
                            className={`p-2 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors cursor-pointer text-xs ${
                              isCurrent ? 'bg-rose-950/70 border border-rose-600' : 'hover:bg-stone-800/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono font-bold text-stone-300 px-1.5 py-0.5 rounded bg-stone-800 text-[11px] shrink-0">
                                第 {bLog.turnNumber} 巡
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-rose-400">实战切牌:</span>
                                {bLog.tile && <MahjongTile tile={bLog.tile} size="xs" />}
                              </div>
                              <ArrowRight className="w-3 h-3 text-stone-500 shrink-0" />
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-emerald-400">推荐切牌:</span>
                                {bLog.recommendedDiscard && (
                                  <MahjongTile tile={bLog.recommendedDiscard} size="xs" />
                                )}
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                                  bLog.blunderSeverity === 'critical'
                                    ? 'bg-rose-600/30 text-rose-300 border border-rose-700/60'
                                    : 'bg-amber-600/30 text-amber-300 border border-amber-700/60'
                                }`}
                              >
                                {bLog.blunderTypeName}
                              </span>
                            </div>

                            <p className="text-[11px] text-stone-300/90 sm:max-w-xs truncate">
                              {bLog.blunderReason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
            <div className="space-y-4 pt-2 border-t border-stone-800">
              {/* 1. Winner's Full Winning Hand Showcase (胡牌牌型大观) */}
              {roundResult.winnerIndex !== null && roundResult.handSnapshots[roundResult.winnerIndex] && (() => {
                const winnerIdx = roundResult.winnerIndex;
                const winnerSnap = roundResult.handSnapshots[winnerIdx];
                const playerNames = ['玩家 (您)', '下家 (西风)', '对家 (北风)', '上家 (东风)'];
                const winnerName = playerNames[winnerIdx];
                const sortedHand = sortTiles(winnerSnap.hand);

                return (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-stone-900 to-amber-950/30 border border-amber-500/70 shadow-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <span className="font-bold text-sm text-amber-200">
                          🏆 优胜和牌完整牌姿展示 · {winnerName}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-stone-950">
                          {roundResult.isSelfDraw ? '自摸和牌' : '荣和点炮'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-xs border border-amber-500/40">
                          总计 {roundResult.totalFan} 番
                        </span>
                        {roundResult.fanDetails.map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-stone-800 text-amber-300/90 text-[11px] border border-stone-700 font-medium"
                          >
                            {f.name} (+{f.fan}番)
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Complete Winning Hand Form: Melds + Concealed Hand + Winning Tile */}
                    <div className="p-3 bg-stone-950/80 rounded-xl border border-amber-500/30 space-y-2">
                      <div className="text-[11px] text-stone-400 flex items-center justify-between">
                        <span>副露明牌 (碰/吃/杠) + 门前暗手牌 + 决胜和牌张：</span>
                        <span className="text-[10px] text-amber-400 font-medium">
                          {roundResult.isSelfDraw ? '自摸胡牌' : `放铳出冲方：${playerNames[roundResult.discarderIndex ?? 0]}`}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Exposed Melds (吃/碰/杠) */}
                        {winnerSnap.melds.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            {winnerSnap.melds.map((meld, mIdx) => (
                              <div
                                key={meld.id || mIdx}
                                className="flex items-center gap-1 p-1.5 rounded-lg bg-stone-900 border border-stone-700/80 shadow-sm"
                              >
                                <span
                                  className={`text-[10px] px-1 py-0.5 rounded font-bold ${
                                    meld.type === 'peng'
                                      ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                                      : meld.type === 'chi'
                                      ? 'bg-blue-950 text-blue-300 border border-blue-700/60'
                                      : 'bg-purple-950 text-purple-300 border border-purple-700/60'
                                  }`}
                                >
                                  {meld.type === 'peng'
                                    ? '碰'
                                    : meld.type === 'chi'
                                    ? '吃'
                                    : meld.type === 'an_gang'
                                    ? '暗杠'
                                    : '杠'}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  {meld.tiles.map((t, idx) => (
                                    <MahjongTile key={t.id + idx} tile={t} size="sm" />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Divider between Melds and Concealed Hand */}
                        {winnerSnap.melds.length > 0 && sortedHand.length > 0 && (
                          <div className="h-8 w-px bg-stone-700 mx-1 hidden sm:block" />
                        )}

                        {/* Standing Concealed Hand (门前手牌) */}
                        {sortedHand.length > 0 && (
                          <div className="flex items-center gap-0.5 p-1.5 rounded-lg bg-stone-900/60 border border-stone-800">
                            {sortedHand.map((t, idx) => (
                              <MahjongTile key={t.id + idx} tile={t} size="sm" />
                            ))}
                          </div>
                        )}

                        {/* Winning Tile (和牌张) */}
                        {roundResult.winningTile && (
                          <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-amber-950/80 border border-amber-500/80 ring-2 ring-amber-400/40 shadow-lg">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-stone-950 font-black">
                              {roundResult.isSelfDraw ? '自摸' : '荣和'}
                            </span>
                            <MahjongTile tile={roundResult.winningTile} size="sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. All 4 Players' Complete End-of-Round Layout (终局四家手牌与吃碰杠副露全览) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>终局四家完整手牌与副露速览：</span>
                  </h3>
                  <span className="text-[11px] text-stone-400">
                    完整展示四家立牌与吃/碰/杠等所有副露
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {roundResult.handSnapshots.map((snap, pIdx) => {
                    const names = ['玩家 (您)', '下家 (西风)', '对家 (北风)', '上家 (东风)'];
                    const isWinner = pIdx === roundResult.winnerIndex;
                    const isDiscarder = pIdx === roundResult.discarderIndex;
                    const sortedHand = sortTiles(snap.hand);

                    return (
                      <div
                        key={pIdx}
                        className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
                          isWinner
                            ? 'bg-amber-950/30 border-amber-500/80 ring-1 ring-amber-400/30'
                            : isDiscarder
                            ? 'bg-rose-950/25 border-rose-700/60'
                            : 'bg-stone-950/40 border-stone-800'
                        }`}
                      >
                        <div className="font-semibold text-stone-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{names[pIdx]}</span>
                            {snap.melds.length === 0 && (
                              <span className="text-[10px] px-1 rounded bg-stone-800 text-stone-400">
                                门前清
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isWinner
                                ? 'bg-amber-500 text-stone-950'
                                : isDiscarder
                                ? 'bg-rose-600 text-white'
                                : 'text-stone-500'
                            }`}
                          >
                            {isWinner
                              ? `🏆 和牌胜者 (${roundResult.totalFan}番)`
                              : isDiscarder
                              ? '💥 放铳点炮'
                              : '陪打'}
                          </span>
                        </div>

                        {/* Melds (副露区: 吃 / 碰 / 杠) */}
                        {snap.melds && snap.melds.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-stone-400">副露牌组 (碰/吃/杠)：</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {snap.melds.map((meld, mIdx) => (
                                <div
                                  key={meld.id || mIdx}
                                  className="flex items-center gap-1 p-1 bg-stone-900 rounded-lg border border-stone-700/70"
                                >
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                      meld.type === 'peng'
                                        ? 'bg-amber-950 text-amber-300'
                                        : meld.type === 'chi'
                                        ? 'bg-blue-950 text-blue-300'
                                        : 'bg-purple-950 text-purple-300'
                                    }`}
                                  >
                                    {meld.type === 'peng' ? '碰' : meld.type === 'chi' ? '吃' : '杠'}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    {meld.tiles.map((t, idx) => (
                                      <MahjongTile key={t.id + idx} tile={t} size="xs" />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Standing Hand Tiles (门前手牌) */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-stone-400">
                            {snap.melds.length > 0 ? '手中暗牌：' : '完整手牌：'}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            {sortedHand.map((t, idx) => (
                              <MahjongTile key={t.id + idx} tile={t} size="xs" />
                            ))}

                            {/* If Ron Winner, show the winning tile completed from discard */}
                            {isWinner && !roundResult.isSelfDraw && roundResult.winningTile && (
                              <div className="flex items-center gap-1 pl-1 ml-1 border-l border-amber-600/60">
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-stone-950 font-bold">
                                  和
                                </span>
                                <MahjongTile tile={roundResult.winningTile} size="xs" />
                              </div>
                            )}

                            {/* If Tsumo Winner, label indicator */}
                            {isWinner && roundResult.isSelfDraw && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 ml-1">
                                自摸和
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

      {/* Delete Round Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150">
          <div className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl p-5 space-y-4 text-stone-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-100">
                  确认删除第 {roundNumber} 局复盘记录？
                </h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  您即将删除【第 {roundNumber} 局 ({roundResult.prevailingWind}风圈)】的牌谱及恶手研析记录。此操作不可逆，您的累计生涯胜场与积分将保持不变。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-800">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-xs transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (onDeleteRound) onDeleteRound(roundResult);
                  setShowDeleteConfirm(false);
                  onClose();
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
